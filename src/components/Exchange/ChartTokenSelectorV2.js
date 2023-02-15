import React from "react";
import { Menu } from "@headlessui/react";
// import { FaChevronDown } from "react-icons/fa";
import cx from "classnames";
import { LONG, SHORT, SWAP } from "lib/legacy";
import { getTokens, getWhitelistedTokens } from "config/tokens";
import { ArrowDownIcon } from "components/Icons";

export default function ChartTokenSelector(props) {
  const { chainId, selectedToken, onSelectToken, swapOption } = props;

  const isLong = swapOption === LONG;
  const isShort = swapOption === SHORT;
  const isSwap = swapOption === SWAP;

  let options = getTokens(chainId);
  const whitelistedTokens = getWhitelistedTokens(chainId);
  const indexTokens = whitelistedTokens.filter((token) => !token.isStable && !token.isWrapped);
  const shortableTokens = indexTokens.filter((token) => token.isShortable);

  if (isLong) {
    options = indexTokens;
  }
  if (isShort) {
    options = shortableTokens;
  }

  const onSelect = async (token) => {
    onSelectToken(token);
  };

  var value = selectedToken;

  return (
    <Menu>
      <Menu.Button as="div" disabled={isSwap}>
        <button
          className={cx(
            "flex w-full flex-row items-center justify-between rounded-[3px] py-0 px-[5px] text-center text-[14px] md:w-auto",
            {
              "cursor-default": isSwap,
            }
          )}
        >
          <div className="flex flex-row items-center">
            <img src={value.imageUrl} className="mr-2 w-4" alt="Icon" />
            <span className="mr-[10px] text-sm text-slate-300">{value.symbol}-USD</span>
          </div>
          {/* {!isSwap && <FaChevronDown size={14} />} */}
          {!isSwap && <ArrowDownIcon className="text-[14px]" />}
        </button>
      </Menu.Button>
      <div className="chart-token-menu">
        <Menu.Items
          as="div"
          className="absolute top-[45px] left-0 z-50 w-full origin-top-right cursor-pointer list-none rounded border border-slate-800 bg-slate-900 py-1 md:w-[158px] md:py-0"
        >
          {options.map((option, index) => (
            <Menu.Item key={index}>
              <div
                className="flex h-[34px] items-center justify-between rounded py-[8.5px] px-4 text-[14px] text-slate-400 hover:text-slate-200"
                onClick={() => {
                  onSelect(option);
                }}
              >
                <span className="flex flex-row items-center gap-1">
                  <img src={option.imageUrl} className="mr-1 w-5" alt="Icon" />
                  {option.name}
                  <span className="rounded-sm bg-slate-950 px-1 text-[10px]">{option.symbol}</span>
                </span>
                <div className="flex flex-col items-end text-end">
                  <div className="text-[10px] text-slate-300">$1000</div>
                  <span className="text-[8px] text-green-500">10%</span>
                </div>
              </div>
            </Menu.Item>
          ))}
        </Menu.Items>
      </div>
    </Menu>
  );
}
