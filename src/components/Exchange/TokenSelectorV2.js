import { useState, useEffect } from "react";
import cx from "classnames";

// import { BiChevronDown } from "react-icons/bi";

import Modal from "../Modal/Modal";

import dropDownIcon from "img/DROP_DOWN.svg";
import TooltipWithPortal from "../Tooltip/TooltipWithPortal";
import { bigNumberify, expandDecimals, formatAmount } from "lib/numbers";
import { getToken } from "config/tokens";
import { importImage } from "lib/legacy";
import { FaSearch } from "react-icons/fa";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowDownIcon } from "components/Icons";

const translateVariants = {
  hidden: { x: 300 },
  visible: { x: 0 },
};

export default function TokenSelector(props) {
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [searchKeyword, setSearchKeyword] = useState("");
  const tokenInfo = getToken(props.chainId, props.tokenAddress);
  const {
    tokens,
    mintingCap,
    infoTokens,
    showMintingCap,
    // disabled,
    selectedTokenLabel,
    showBalances = true,
    showTokenImgInDropdown = false,
    showSymbolImage = false,
    showNewCaret = false,
    getTokenState = () => ({ disabled: false, message: null }),
    disableBodyScrollLock,
    isBuy,
    className = "",
  } = props;

  const visibleTokens = tokens.filter((t) => !t.isTempHidden);

  const onSelectToken = (token) => {
    setIsModalVisible(false);
    props.onSelectToken(token);
  };

  useEffect(() => {
    if (isModalVisible) {
      setSearchKeyword("");
    }
  }, [isModalVisible]);

  if (!tokenInfo) {
    return null;
  }

  const tokenImage = importImage(`ic_${tokenInfo.symbol.toLowerCase()}_24.svg`);

  const onSearchKeywordChange = (e) => {
    setSearchKeyword(e.target.value);
  };

  const filteredTokens = visibleTokens.filter((item) => {
    return (
      item.name.toLowerCase().indexOf(searchKeyword.toLowerCase()) > -1 ||
      item.symbol.toLowerCase().indexOf(searchKeyword.toLowerCase()) > -1
    );
  });

  const _handleKeyDown = (e) => {
    if (e.key === "Enter" && filteredTokens.length > 0) {
      onSelectToken(filteredTokens[0]);
    }
  };

  return (
    <div>
      <Modal
        disableBodyScrollLock={disableBodyScrollLock}
        isVisible={isModalVisible}
        setIsVisible={setIsModalVisible}
        label="Select Market"
        position="center"
        className="!w-[420px]"
      >
        <div>
          <div className="relative flex items-center justify-between p-0 pl-3 mb-2 bg-transparent border rounded-sm cursor-pointer border-slate-800">
            <FaSearch />
            <input
              type="text"
              className="w-full p-2 overflow-hidden text-sm bg-transparent border-0 outline-none text-ellipsis whitespace-nowrap focus:ring-0 focus:ring-offset-0"
              placeholder="Search Token"
              value={searchKeyword}
              onChange={(e) => onSearchKeywordChange(e)}
              onKeyDown={_handleKeyDown}
              autoFocus
            />
          </div>
          {filteredTokens.map((token, tokenIndex) => {
            const tokenPopupImage = importImage(`ic_${token.symbol.toLowerCase()}_40.svg`);
            let info = infoTokens ? infoTokens[token.address] : {};
            let mintAmount;
            let balance = info.balance;
            if (showMintingCap && mintingCap && info.usdgAmount) {
              mintAmount = mintingCap.sub(info.usdgAmount);
            }
            if (mintAmount && mintAmount.lt(0)) {
              mintAmount = bigNumberify(0);
            }
            let balanceUsd;
            if (balance && info.maxPrice) {
              balanceUsd = balance.mul(info.maxPrice).div(expandDecimals(1, token.decimals));
            }

            const tokenState = getTokenState(info) || {};

            return (
              <AnimatePresence key={token.address}>
                <motion.div
                  className={cx(
                    "relative mb-2 flex cursor-pointer items-center justify-between rounded-sm border border-slate-800 p-2 hover:bg-slate-800",
                    { disabled: tokenState.disabled }
                  )}
                  onClick={() => !tokenState.disabled && onSelectToken(token)}
                  initial="hidden"
                  animate="visible"
                  exit="hidden"
                  variants={translateVariants}
                  transition={{ duration: 0.2 + tokenIndex * 0.05 }}
                >
                  {tokenState.disabled && tokenState.message && (
                    <TooltipWithPortal
                      className="TokenSelector-tooltip"
                      portalClassName="TokenSelector-tooltip-portal"
                      handle={<div className="TokenSelector-tooltip-backing" />}
                      position={tokenIndex < filteredTokens.length / 2 ? "center-bottom" : "center-top"}
                      disableHandleStyle
                      closeOnDoubleClick
                      fitHandleWidth
                      renderContent={() => tokenState.message}
                    />
                  )}
                  <div className="flex flex-row items-center justify-center">
                    {showTokenImgInDropdown && (
                      <img src={tokenPopupImage} alt={token.name} className="mr-[2px] ml-0 block h-5 w-5" />
                    )}
                    <div className="flex flex-col ml-2">
                      <div className="text-xs font-medium font-medium text-slate-300">{token.symbol}</div>
                      <span className="text-xs font-medium leading-[15px] text-slate-500">{token.name}</span>
                    </div>
                  </div>
                  <div className="flex flex-col text-right text-slate-300">
                    {showBalances && balance && (
                      <div className="text-xs font-medium font-medium text-slate-300">
                        {balance.gt(0) && formatAmount(balance, token.decimals, 4, true)}
                        {balance.eq(0) && "-"}
                      </div>
                    )}
                    <span className="text-xs font-medium leading-[15px] text-slate-500">
                      {mintAmount && <div>Mintable: {formatAmount(mintAmount, token.decimals, 2, true)} USDG</div>}
                      {showMintingCap && !mintAmount && <div>-</div>}
                      {!showMintingCap && showBalances && balanceUsd && balanceUsd.gt(0) && (
                        <div>${formatAmount(balanceUsd, 30, 2, true)}</div>
                      )}
                    </span>
                  </div>
                </motion.div>
              </AnimatePresence>
            );
          })}
        </div>
      </Modal>
      {selectedTokenLabel ? (
        <div
          className={cx(
            "flex min-w-[46.5px] cursor-pointer flex-row items-center justify-end whitespace-nowrap rounded text-right font-medium leading-[25px] text-slate-200",
            className
          )}
          onClick={() => setIsModalVisible(true)}
        >
          {selectedTokenLabel}
          {!showNewCaret && (
            // <BiChevronDown className={cx("inline-block align-middle text-[23.25px]", { "m-0 mr-[5px]": isBuy })} />
            <ArrowDownIcon className={cx("ml-1 inline-block align-middle text-[23.25px]", { "m-0 mr-[5px]": isBuy })} />
          )}
        </div>
      ) : (
        <div
          className={cx(
            "flex min-w-[46.5px] cursor-pointer flex-row items-center justify-end whitespace-nowrap rounded text-right font-medium leading-[25px] text-slate-300 mt-[2px] hover:text-slate-600",
            className
          )}
          onClick={() => setIsModalVisible(true)}
        >
          {tokenInfo.symbol}
          {showSymbolImage && <img src={tokenImage} alt={tokenInfo.symbol} className={cx("ml-2", { hidden: isBuy })} />}
          {showNewCaret && <img src={dropDownIcon} alt="dropDownIcon" />}
          {!showNewCaret && (
            // <BiChevronDown className={cx("inline-block align-middle text-[23.25px]", { "m-0 mr-[5px]": isBuy })} />
            <ArrowDownIcon className={cx("ml-1 inline-block align-middle text-[23.25px]", { "m-0 mr-[5px]": isBuy })} />
          )}
        </div>
      )}
    </div>
  );
}
