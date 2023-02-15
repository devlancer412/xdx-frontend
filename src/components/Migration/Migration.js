import React, { useEffect, useState } from "react";
import { useWeb3React } from "@web3-react/core";
import cx from "classnames";
import useSWR from "swr";
import { ethers } from "ethers";

import Modal from "../Modal/Modal";

import { getConnectWalletHandler } from "lib/legacy";
import { getContract } from "config/contracts";

import Reader from "abis/Reader.json";
import Token from "abis/Token.json";
import XdxMigrator from "abis/XdxMigrator.json";
import { CHAIN_ID, getExplorerUrl } from "config/chains";
import { contractFetcher } from "lib/contracts";
import { helperToast } from "lib/helperToast";
import { useEagerConnect, useInactiveListener } from "lib/wallets";
import { approveTokens } from "domain/tokens";
import {
  bigNumberify,
  expandDecimals,
  formatAmount,
  formatAmountFree,
  formatArrayAmount,
  parseValue,
} from "lib/numbers";

const { MaxUint256, AddressZero } = ethers.constants;

const precision = 1000000;
const decimals = 6;
const xdxPrice = bigNumberify(2 * precision);
const tokens = [
  {
    name: "XDX",
    symbol: "XDX",
    address: getContract(CHAIN_ID, "XDX"),
    price: bigNumberify(10.97 * precision),
    iouToken: getContract(CHAIN_ID, "GMT_XDX_IOU"),
    cap: MaxUint256,
    bonus: 0,
  },
  {
    name: "xXDX",
    symbol: "xXDX",
    address: getContract(CHAIN_ID, "XGMT"),
    price: bigNumberify(90.31 * precision),
    iouToken: getContract(CHAIN_ID, "XGMT_XDX_IOU"),
    cap: MaxUint256,
    bonus: 0,
  },
  {
    name: "XDX-USDG",
    symbol: "LP",
    address: getContract(CHAIN_ID, "GMT_USDG_PAIR"),
    price: bigNumberify(parseInt(6.68 * precision)),
    iouToken: getContract(CHAIN_ID, "GMT_USDG_XDX_IOU"),
    cap: expandDecimals(483129, 18),
    bonus: 10,
  },
  {
    name: "xXDX-USDG",
    symbol: "LP",
    address: getContract(CHAIN_ID, "XGMT_USDG_PAIR"),
    price: bigNumberify(parseInt(19.27 * precision)),
    iouToken: getContract(CHAIN_ID, "XGMT_USDG_XDX_IOU"),
    cap: expandDecimals(150191, 18),
    bonus: 10,
  },
];

const readerAddress = getContract(CHAIN_ID, "Reader");
const xdxMigratorAddress = getContract(CHAIN_ID, "XdxMigrator");

function MigrationModal(props) {
  const {
    isVisible,
    setIsVisible,
    isPendingApproval,
    setIsPendingApproval,
    value,
    setValue,
    index,
    balances,
    active,
    account,
    library,
  } = props;
  const token = tokens[index];
  const [isMigrating, setIsMigrating] = useState(false);
  const [isApproving, setIsApproving] = useState(false);

  const { data: tokenAllowance, mutate: updateTokenAllowance } = useSWR(
    [active, CHAIN_ID, token.address, "allowance", account, xdxMigratorAddress],
    {
      fetcher: contractFetcher(library, Token),
    }
  );

  let maxAmount;
  if (balances) {
    maxAmount = balances[index * 2];
  }

  useEffect(() => {
    if (active) {
      library.on("block", () => {
        updateTokenAllowance(undefined, true);
      });
      return () => {
        library.removeAllListeners("block");
      };
    }
  }, [active, library, updateTokenAllowance]);

  let amount = parseValue(value, 18);
  const needApproval = tokenAllowance && amount && amount.gt(tokenAllowance);

  let baseAmount;
  let bonusAmount;
  let totalAmount;

  let baseAmountUsd;
  let bonusAmountUsd;
  let totalAmountUsd;

  if (amount) {
    baseAmount = amount.mul(token.price).div(xdxPrice);
    bonusAmount = baseAmount.mul(token.bonus).div(100);
    totalAmount = baseAmount.add(bonusAmount);

    baseAmountUsd = baseAmount.mul(xdxPrice);
    bonusAmountUsd = bonusAmount.mul(xdxPrice);
    totalAmountUsd = totalAmount.mul(xdxPrice);
  }

  const getError = () => {
    if (!amount || amount.eq(0)) {
      return "Enter an amount";
    }
    if (maxAmount && amount.gt(maxAmount)) {
      return "Max amount exceeded";
    }
  };

  const onClickPrimary = () => {
    if (needApproval) {
      approveTokens({
        setIsApproving,
        library,
        tokenAddress: token.address,
        spender: xdxMigratorAddress,
        chainId: CHAIN_ID,
        onApproveSubmitted: () => {
          setIsPendingApproval(true);
        },
      });
      return;
    }

    setIsMigrating(true);
    const contract = new ethers.Contract(xdxMigratorAddress, XdxMigrator.abi, library.getSigner());
    contract
      .migrate(token.address, amount)
      .then(async (res) => {
        const txUrl = getExplorerUrl(CHAIN_ID) + "tx/" + res.hash;
        helperToast.success(
          <div>
            Migration submitted!{" "}
            <a className="text-slate-300 underline" href={txUrl} target="_blank" rel="noopener noreferrer">
              View status.
            </a>
            <br />
          </div>
        );
        setIsVisible(false);
      })
      .catch((e) => {
        console.error(e);
        helperToast.error("Migration failed");
      })
      .finally(() => {
        setIsMigrating(false);
      });
  };

  const isPrimaryEnabled = () => {
    const error = getError();
    if (error) {
      return false;
    }
    if (isApproving) {
      return false;
    }
    if (isMigrating) {
      return false;
    }
    if (needApproval && isPendingApproval) {
      return false;
    }
    return true;
  };

  const getPrimaryText = () => {
    const error = getError();
    if (error) {
      return error;
    }
    if (isApproving) {
      return `Approving...`;
    }
    if (needApproval && isPendingApproval) {
      return "Waiting for Approval";
    }
    if (needApproval) {
      return `Approve ${token.name}`;
    }
    if (isMigrating) {
      return "Migrating...";
    }
    return "Migrate";
  };

  return (
    <div className="StakeModal">
      <Modal isVisible={isVisible} setIsVisible={setIsVisible} label={`Migrate ${token.name}`}>
        <div className="mb-2 rounded bg-slate-700 p-4 shadow">
          <div className="grid grid-cols-2 pb-[12.5px] text-[14px]">
            <div className="opacity-70">
              <div className="inline-block text-[14px]">Migrate</div>
            </div>
            <div
              className="flex cursor-pointer items-end justify-end text-end opacity-70"
              onClick={() => setValue(formatAmountFree(maxAmount, 18, 8))}
            >
              Max: {formatAmount(maxAmount, 18, 4, true)}
            </div>
          </div>
          <div className="grid grid-cols-[1fr_auto] pb-[3.1px]">
            <div>
              <input
                type="number"
                placeholder="0.0"
                className="w-full overflow-hidden text-ellipsis whitespace-nowrap border-none bg-transparent p-0 pr-5 text-xl text-slate-200 placeholder-slate-400 ring-offset-0 focus:outline-none focus:ring-0"
                value={value}
                onChange={(e) => setValue(e.target.value)}
              />
            </div>
            <div className="text-right text-[21px]">{token.symbol}</div>
          </div>
        </div>
        <div className="MigrationModal-info-box">
          <div className="App-info-row">
            <div className="App-info-label">{token.bonus > 0 ? "Base Tokens" : "To Receive"}</div>
            <div className="flex items-end justify-end text-end">
              {baseAmount &&
                `${formatAmount(baseAmount, 18, 4, true)} XDX ($${formatAmount(
                  baseAmountUsd,
                  18 + decimals,
                  2,
                  true
                )})`}
              {!baseAmount && "-"}
            </div>
          </div>
          {token.bonus > 0 && (
            <div className="App-info-row">
              <div className="App-info-label">Bonus Tokens</div>
              <div className="flex items-end justify-end text-end">
                {bonusAmount &&
                  `${formatAmount(bonusAmount, 18, 4, true)} XDX ($${formatAmount(
                    bonusAmountUsd,
                    18 + decimals,
                    2,
                    true
                  )})`}
                {!bonusAmount && "-"}
              </div>
            </div>
          )}
          {token.bonus > 0 && (
            <div className="App-info-row">
              <div className="App-info-label">To Receive</div>
              <div className="flex items-end justify-end text-end">
                {totalAmount &&
                  `${formatAmount(totalAmount, 18, 4, true)} XDX ($${formatAmount(
                    totalAmountUsd,
                    18 + decimals,
                    2,
                    true
                  )})`}
                {!totalAmount && "-"}
              </div>
            </div>
          )}
        </div>
        <div className="pt-[3.1px]">
          <button
            className="w-full rounded-[3px]  bg-slate-800 p-[15px] text-[14px] leading-none hover:bg-[#4f60fc] hover:shadow disabled:cursor-not-allowed"
            onClick={onClickPrimary}
            disabled={!isPrimaryEnabled()}
          >
            {getPrimaryText()}
          </button>
        </div>
      </Modal>
    </div>
  );
}

export default function Migration() {
  const [isMigrationModalVisible, setIsMigrationModalVisible] = useState(false);
  const [isPendingApproval, setIsPendingApproval] = useState(false);
  const [migrationIndex, setMigrationIndex] = useState(0);
  const [migrationValue, setMigrationValue] = useState("");

  const { connector, activate, active, account, library } = useWeb3React();
  const [activatingConnector, setActivatingConnector] = useState();
  useEffect(() => {
    if (activatingConnector && activatingConnector === connector) {
      setActivatingConnector(undefined);
    }
  }, [activatingConnector, connector]);
  const triedEager = useEagerConnect();
  useInactiveListener(!triedEager || !!activatingConnector);
  const connectWallet = getConnectWalletHandler(activate);

  const tokenAddresses = tokens.map((token) => token.address);
  const iouTokenAddresses = tokens.map((token) => token.iouToken);

  const { data: iouBalances, mutate: updateIouBalances } = useSWR(
    ["Migration:iouBalances", CHAIN_ID, readerAddress, "getTokenBalancesWithSupplies", account || AddressZero],
    {
      fetcher: contractFetcher(library, Reader, [iouTokenAddresses]),
    }
  );

  const { data: balances, mutate: updateBalances } = useSWR(
    ["Migration:balances", CHAIN_ID, readerAddress, "getTokenBalancesWithSupplies", account || AddressZero],
    {
      fetcher: contractFetcher(library, Reader, [tokenAddresses]),
    }
  );

  const { data: migratedAmounts, mutate: updateMigratedAmounts } = useSWR(
    ["Migration:migratedAmounts", CHAIN_ID, xdxMigratorAddress, "getTokenAmounts"],
    {
      fetcher: contractFetcher(library, XdxMigrator, [tokenAddresses]),
    }
  );

  let xdxBalance;
  let totalMigratedXdx;
  let totalMigratedUsd;

  if (iouBalances) {
    xdxBalance = bigNumberify(0);
    totalMigratedXdx = bigNumberify(0);

    for (let i = 0; i < iouBalances.length / 2; i++) {
      xdxBalance = xdxBalance.add(iouBalances[i * 2]);
      totalMigratedXdx = totalMigratedXdx.add(iouBalances[i * 2 + 1]);
    }

    totalMigratedUsd = totalMigratedXdx.mul(xdxPrice);
  }

  useEffect(() => {
    if (active) {
      library.on("block", () => {
        updateBalances(undefined, true);
        updateIouBalances(undefined, true);
        updateMigratedAmounts(undefined, true);
      });
      return () => {
        library.removeAllListeners("block");
      };
    }
  }, [active, library, updateBalances, updateIouBalances, updateMigratedAmounts]);

  const showMigrationModal = (index) => {
    setIsPendingApproval(false);
    setMigrationValue("");
    setMigrationIndex(index);
    setIsMigrationModalVisible(true);
  };

  return (
    <div className="Migration Page">
      <MigrationModal
        isVisible={isMigrationModalVisible}
        setIsVisible={setIsMigrationModalVisible}
        isPendingApproval={isPendingApproval}
        setIsPendingApproval={setIsPendingApproval}
        value={migrationValue}
        setValue={setMigrationValue}
        index={migrationIndex}
        balances={balances}
        active={active}
        account={account}
        library={library}
      />
      <div>
        <div className="Stake-title App-hero">
          <div className="Stake-title-primary App-hero-primary">
            ${formatAmount(totalMigratedUsd, decimals + 18, 0, true)}
          </div>
          <div className="Stake-title-secondary">Total Assets Migrated</div>
        </div>
      </div>
      <div className="Migration-note">Your wallet: {formatAmount(xdxBalance, 18, 4, true)} XDX</div>
      <div className="Migration-note">
        Please read the&nbsp;
        <a href="https://xdx.exchange/docs" target="_blank" rel="noopener noreferrer">
          Medium post
        </a>{" "}
        before migrating.
      </div>
      <div className="Migration-cards">
        {tokens.map((token, index) => {
          const { cap, price, bonus } = token;
          const hasCap = cap.lt(MaxUint256);
          return (
            <div className={cx("border", "App-card", { primary: index === 0 })} key={index}>
              <div className="Stake-card-title App-card-title">{token.name}</div>
              <div className="Stake-card-bottom App-card-content">
                <div className="Stake-info App-card-row">
                  <div className="text-slate-400">Wallet</div>
                  <div>{formatArrayAmount(balances, index * 2, 18, 4, true)}</div>
                </div>
                <div className="Stake-info App-card-row">
                  <div className="text-slate-400">Migration Price</div>
                  <div>${formatAmount(price, decimals, 2, true)}</div>
                </div>
                <div className="Stake-info App-card-row">
                  <div className="text-slate-400">Bonus Tokens</div>
                  <div>{parseFloat(bonus).toFixed(2)}%</div>
                </div>
                <div className="Stake-info App-card-row">
                  <div className="text-slate-400">Migrated</div>
                  {!hasCap && <div>{formatArrayAmount(migratedAmounts, index, 18, 0, true)}</div>}
                  {hasCap && (
                    <div>
                      {formatArrayAmount(migratedAmounts, index, 18, 0, true)} / {formatAmount(cap, 18, 0, true)}
                    </div>
                  )}
                </div>
                <div className="-m-[6.2px] mx-[9px] mb-[12px]">
                  {!active && (
                    <button
                      className="relative m-[6.2px] box-border inline-flex min-h-[36px] cursor-pointer items-center rounded bg-slate-700 px-4 text-[14px] leading-[20px] text-slate-300  hover:bg-[#4f60fc]"
                      onClick={connectWallet}
                    >
                      Connect Wallet
                    </button>
                  )}
                  {active && (
                    <button
                      className="relative m-[6.2px] box-border inline-flex min-h-[36px] cursor-pointer items-center rounded bg-slate-700 px-4 text-[14px] leading-[20px] text-slate-300  hover:bg-[#4f60fc]"
                      onClick={() => showMigrationModal(index)}
                    >
                      Migrate
                    </button>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
