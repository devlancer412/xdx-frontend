import React, { useState, useEffect } from "react";
import { useHistory } from "react-router-dom";
import { Trans, t } from "@lingui/macro";
import { useWeb3React } from "@web3-react/core";
import useSWR from "swr";
import { ethers } from "ethers";
import Tab from "../Tab/Tab";
import cx from "classnames";
import { getContract } from "config/contracts";
import {
  getBuyXlxToAmount,
  getBuyXlxFromAmount,
  getSellXlxFromAmount,
  getSellXlxToAmount,
  adjustForDecimals,
  XLX_DECIMALS,
  USD_DECIMALS,
  BASIS_POINTS_DIVISOR,
  XLX_COOLDOWN_DURATION,
  SECONDS_PER_YEAR,
  USDG_DECIMALS,
  PLACEHOLDER_ACCOUNT,
  importImage,
} from "lib/legacy";

import { useXdxPrice } from "domain/legacy";

import TokenSelector from "../Exchange/TokenSelectorV2";
import BuyInputSection from "../BuyInputSection/BuyInputSection";
import Tooltip from "../Tooltip/Tooltip";

import Reader from "abis/Reader.json";
import RewardReader from "abis/RewardReader.json";
import Vault from "abis/Vault.json";
import XlxManager from "abis/XlxManager.json";
import RewardTracker from "abis/RewardTracker.json";
import Vester from "abis/Vester.json";
import RewardRouter from "abis/RewardRouter.json";
import Token from "abis/Token.json";

import xlx24Icon from "img/ic_xlx_24.svg";
import xlx40Icon from "img/ic_xlx_40.svg";

import avalanche16Icon from "img/ic_avalanche_16.svg";
import arbitrum16Icon from "img/ic_arbitrum_16.svg";

import AssetDropdown from "pages/Dashboard/AssetDropdown";
import SwapErrorModal from "./XlxErrorModal";
import StatsTooltipRow from "../StatsTooltip/StatsTooltipRow";
import { AVALANCHE, getChainName, IS_NETWORK_DISABLED } from "config/chains";
import { callContract, contractFetcher } from "lib/contracts";
import { approveTokens, useInfoTokens } from "domain/tokens";
import { useLocalStorageByChainId } from "lib/localStorage";
import { helperToast } from "lib/helperToast";
import { getTokenInfo, getUsd } from "domain/tokens/utils";
import { bigNumberify, expandDecimals, formatAmount, formatAmountFree, formatKeyAmount, parseValue } from "lib/numbers";
import { getNativeToken, getToken, getTokens, getWhitelistedTokens, getWrappedToken } from "config/tokens";
import { useChainId } from "lib/chains";
import { IoMdSwap } from "react-icons/io";

const { AddressZero } = ethers.constants;

function getStakingData(stakingInfo) {
  if (!stakingInfo || stakingInfo.length === 0) {
    return;
  }

  const keys = ["stakedXlxTracker", "feeXlxTracker"];
  const data = {};
  const propsLength = 5;

  for (let i = 0; i < keys.length; i++) {
    const key = keys[i];
    data[key] = {
      claimable: stakingInfo[i * propsLength],
      tokensPerInterval: stakingInfo[i * propsLength + 1],
      averageStakedAmounts: stakingInfo[i * propsLength + 2],
      cumulativeRewards: stakingInfo[i * propsLength + 3],
      totalSupply: stakingInfo[i * propsLength + 4],
    };
  }

  return data;
}

function getTooltipContent(managedUsd, tokenInfo, token) {
  return (
    <>
      <StatsTooltipRow
        label={t`Current Pool Amount`}
        value={[
          `$${formatAmount(managedUsd, USD_DECIMALS, 0, true)}`,
          `(${formatKeyAmount(tokenInfo, "poolAmount", token.decimals, 0, true)} ${token.symbol})`,
        ]}
      />
      <StatsTooltipRow label="Max Pool Capacity" value={formatAmount(tokenInfo.maxUsdgAmount, 18, 0, true)} />
    </>
  );
}

export default function XlxSwap(props) {
  const {
    savedSlippageAmount,
    isBuying,
    isBuy,
    setPendingTxns,
    connectWallet,
    setIsBuying,
    savedShouldDisableValidationForTesting,
  } = props;
  const history = useHistory();
  const swapLabel = isBuying ? "BuyXlx" : "SellXlx";
  const tabLabel = isBuying ? t`Buy XLX` : t`Sell XLX`;
  const { active, library, account } = useWeb3React();
  const { chainId } = useChainId();
  // const chainName = getChainName(chainId)
  const tokens = getTokens(chainId);
  const whitelistedTokens = getWhitelistedTokens(chainId);
  const tokenList = whitelistedTokens.filter((t) => !t.isWrapped);
  const visibleTokens = tokenList.filter((t) => !t.isTempHidden);
  const [swapValue, setSwapValue] = useState("");
  const [xlxValue, setXlxValue] = useState("");
  const [swapTokenAddress, setSwapTokenAddress] = useLocalStorageByChainId(
    chainId,
    `${swapLabel}-swap-token-address`,
    AddressZero
  );
  const [isApproving, setIsApproving] = useState(false);
  const [isWaitingForApproval, setIsWaitingForApproval] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [anchorOnSwapAmount, setAnchorOnSwapAmount] = useState(true);
  const [feeBasisPoints, setFeeBasisPoints] = useState("");
  const [modalError, setModalError] = useState(false);

  const readerAddress = getContract(chainId, "Reader");
  const rewardReaderAddress = getContract(chainId, "RewardReader");
  const vaultAddress = getContract(chainId, "Vault");
  const nativeTokenAddress = getContract(chainId, "NATIVE_TOKEN");
  const stakedXlxTrackerAddress = getContract(chainId, "StakedXlxTracker");
  const feeXlxTrackerAddress = getContract(chainId, "FeeXlxTracker");
  const usdgAddress = getContract(chainId, "USDG");
  const xlxManagerAddress = getContract(chainId, "XlxManager");
  const rewardRouterAddress = getContract(chainId, "RewardRouter");
  const tokensForBalanceAndSupplyQuery = [stakedXlxTrackerAddress, usdgAddress];

  const tokenAddresses = tokens.map((token) => token.address);
  const { data: tokenBalances } = useSWR(
    [`XlxSwap:getTokenBalances:${active}`, chainId, readerAddress, "getTokenBalances", account || PLACEHOLDER_ACCOUNT],
    {
      fetcher: contractFetcher(library, Reader, [tokenAddresses]),
    }
  );

  const { data: balancesAndSupplies } = useSWR(
    [
      `XlxSwap:getTokenBalancesWithSupplies:${active}`,
      chainId,
      readerAddress,
      "getTokenBalancesWithSupplies",
      account || PLACEHOLDER_ACCOUNT,
    ],
    {
      fetcher: contractFetcher(library, Reader, [tokensForBalanceAndSupplyQuery]),
    }
  );

  const { data: aums } = useSWR([`XlxSwap:getAums:${active}`, chainId, xlxManagerAddress, "getAums"], {
    fetcher: contractFetcher(library, XlxManager),
  });

  const { data: totalTokenWeights } = useSWR(
    [`XlxSwap:totalTokenWeights:${active}`, chainId, vaultAddress, "totalTokenWeights"],
    {
      fetcher: contractFetcher(library, Vault),
    }
  );

  const tokenAllowanceAddress = swapTokenAddress === AddressZero ? nativeTokenAddress : swapTokenAddress;
  const { data: tokenAllowance } = useSWR(
    [active, chainId, tokenAllowanceAddress, "allowance", account || PLACEHOLDER_ACCOUNT, xlxManagerAddress],
    {
      fetcher: contractFetcher(library, Token),
    }
  );

  const { data: lastPurchaseTime } = useSWR(
    [`XlxSwap:lastPurchaseTime:${active}`, chainId, xlxManagerAddress, "lastAddedAt", account || PLACEHOLDER_ACCOUNT],
    {
      fetcher: contractFetcher(library, XlxManager),
    }
  );

  const { data: xlxBalance } = useSWR(
    [`XlxSwap:xlxBalance:${active}`, chainId, feeXlxTrackerAddress, "stakedAmounts", account || PLACEHOLDER_ACCOUNT],
    {
      fetcher: contractFetcher(library, RewardTracker),
    }
  );

  const xlxVesterAddress = getContract(chainId, "XlxVester");
  const { data: reservedAmount } = useSWR(
    [`XlxSwap:reservedAmount:${active}`, chainId, xlxVesterAddress, "pairAmounts", account || PLACEHOLDER_ACCOUNT],
    {
      fetcher: contractFetcher(library, Vester),
    }
  );

  const { xdxPrice } = useXdxPrice(chainId, { arbitrum: chainId === AVALANCHE ? library : undefined }, active);

  const rewardTrackersForStakingInfo = [stakedXlxTrackerAddress, feeXlxTrackerAddress];
  const { data: stakingInfo } = useSWR(
    [`XlxSwap:stakingInfo:${active}`, chainId, rewardReaderAddress, "getStakingInfo", account || PLACEHOLDER_ACCOUNT],
    {
      fetcher: contractFetcher(library, RewardReader, [rewardTrackersForStakingInfo]),
    }
  );

  const stakingData = getStakingData(stakingInfo);

  const redemptionTime = lastPurchaseTime ? lastPurchaseTime.add(XLX_COOLDOWN_DURATION) : undefined;
  const inCooldownWindow = redemptionTime && parseInt(Date.now() / 1000) < redemptionTime;

  const xlxSupply = balancesAndSupplies ? balancesAndSupplies[1] : bigNumberify(0);
  const usdgSupply = balancesAndSupplies ? balancesAndSupplies[3] : bigNumberify(0);
  let aum;
  if (aums && aums.length > 0) {
    aum = isBuying ? aums[0] : aums[1];
  }
  const xlxPrice =
    aum && aum.gt(0) && xlxSupply.gt(0)
      ? aum.mul(expandDecimals(1, XLX_DECIMALS)).div(xlxSupply)
      : expandDecimals(1, USD_DECIMALS);
  let xlxBalanceUsd;
  if (xlxBalance) {
    xlxBalanceUsd = xlxBalance.mul(xlxPrice).div(expandDecimals(1, XLX_DECIMALS));
  }
  const xlxSupplyUsd = xlxSupply.mul(xlxPrice).div(expandDecimals(1, XLX_DECIMALS));

  let reserveAmountUsd;
  if (reservedAmount) {
    reserveAmountUsd = reservedAmount.mul(xlxPrice).div(expandDecimals(1, XLX_DECIMALS));
  }

  let maxSellAmount = xlxBalance;
  if (xlxBalance && reservedAmount) {
    maxSellAmount = xlxBalance.sub(reservedAmount);
  }

  const { infoTokens } = useInfoTokens(library, chainId, active, tokenBalances, undefined);
  const swapToken = getToken(chainId, swapTokenAddress);
  const swapTokenInfo = getTokenInfo(infoTokens, swapTokenAddress);

  const swapTokenBalance = swapTokenInfo && swapTokenInfo.balance ? swapTokenInfo.balance : bigNumberify(0);

  const swapAmount = parseValue(swapValue, swapToken && swapToken.decimals);
  const xlxAmount = parseValue(xlxValue, XLX_DECIMALS);

  const needApproval =
    isBuying && swapTokenAddress !== AddressZero && tokenAllowance && swapAmount && swapAmount.gt(tokenAllowance);

  const swapUsdMin = getUsd(swapAmount, swapTokenAddress, false, infoTokens);
  const xlxUsdMax = xlxAmount && xlxPrice ? xlxAmount.mul(xlxPrice).div(expandDecimals(1, XLX_DECIMALS)) : undefined;

  let isSwapTokenCapReached;
  if (swapTokenInfo.managedUsd && swapTokenInfo.maxUsdgAmount) {
    isSwapTokenCapReached = swapTokenInfo.managedUsd.gt(
      adjustForDecimals(swapTokenInfo.maxUsdgAmount, USDG_DECIMALS, USD_DECIMALS)
    );
  }

  const onSwapValueChange = (e) => {
    setAnchorOnSwapAmount(true);
    setSwapValue(e.target.value);
  };

  const onXlxValueChange = (e) => {
    setAnchorOnSwapAmount(false);
    setXlxValue(e.target.value);
  };

  const onSelectSwapToken = (token) => {
    setSwapTokenAddress(token.address);
    setIsWaitingForApproval(false);
  };

  const nativeToken = getTokenInfo(infoTokens, AddressZero);

  let totalApr = bigNumberify(0);

  let feeXlxTrackerAnnualRewardsUsd;
  let feeXlxTrackerApr;
  if (
    stakingData &&
    stakingData.feeXlxTracker &&
    stakingData.feeXlxTracker.tokensPerInterval &&
    nativeToken &&
    nativeToken.minPrice &&
    xlxSupplyUsd &&
    xlxSupplyUsd.gt(0)
  ) {
    feeXlxTrackerAnnualRewardsUsd = stakingData.feeXlxTracker.tokensPerInterval
      .mul(SECONDS_PER_YEAR)
      .mul(nativeToken.minPrice)
      .div(expandDecimals(1, 18));
    feeXlxTrackerApr = feeXlxTrackerAnnualRewardsUsd.mul(BASIS_POINTS_DIVISOR).div(xlxSupplyUsd);
    totalApr = totalApr.add(feeXlxTrackerApr);
  }

  let stakedXlxTrackerAnnualRewardsUsd;
  let stakedXlxTrackerApr;

  if (
    xdxPrice &&
    stakingData &&
    stakingData.stakedXlxTracker &&
    stakingData.stakedXlxTracker.tokensPerInterval &&
    xlxSupplyUsd &&
    xlxSupplyUsd.gt(0)
  ) {
    stakedXlxTrackerAnnualRewardsUsd = stakingData.stakedXlxTracker.tokensPerInterval
      .mul(SECONDS_PER_YEAR)
      .mul(xdxPrice)
      .div(expandDecimals(1, 18));
    stakedXlxTrackerApr = stakedXlxTrackerAnnualRewardsUsd.mul(BASIS_POINTS_DIVISOR).div(xlxSupplyUsd);
    totalApr = totalApr.add(stakedXlxTrackerApr);
  }

  useEffect(() => {
    const updateSwapAmounts = () => {
      if (anchorOnSwapAmount) {
        if (!swapAmount) {
          setXlxValue("");
          setFeeBasisPoints("");
          return;
        }

        if (isBuying) {
          const { amount: nextAmount, feeBasisPoints: feeBps } = getBuyXlxToAmount(
            swapAmount,
            swapTokenAddress,
            infoTokens,
            xlxPrice,
            usdgSupply,
            totalTokenWeights
          );
          const nextValue = formatAmountFree(nextAmount, XLX_DECIMALS, XLX_DECIMALS);
          setXlxValue(nextValue);
          setFeeBasisPoints(feeBps);
        } else {
          const { amount: nextAmount, feeBasisPoints: feeBps } = getSellXlxFromAmount(
            swapAmount,
            swapTokenAddress,
            infoTokens,
            xlxPrice,
            usdgSupply,
            totalTokenWeights
          );
          const nextValue = formatAmountFree(nextAmount, XLX_DECIMALS, XLX_DECIMALS);
          setXlxValue(nextValue);
          setFeeBasisPoints(feeBps);
        }

        return;
      }

      if (!xlxAmount) {
        setSwapValue("");
        setFeeBasisPoints("");
        return;
      }

      if (swapToken) {
        if (isBuying) {
          const { amount: nextAmount, feeBasisPoints: feeBps } = getBuyXlxFromAmount(
            xlxAmount,
            swapTokenAddress,
            infoTokens,
            xlxPrice,
            usdgSupply,
            totalTokenWeights
          );
          const nextValue = formatAmountFree(nextAmount, swapToken.decimals, swapToken.decimals);
          setSwapValue(nextValue);
          setFeeBasisPoints(feeBps);
        } else {
          const { amount: nextAmount, feeBasisPoints: feeBps } = getSellXlxToAmount(
            xlxAmount,
            swapTokenAddress,
            infoTokens,
            xlxPrice,
            usdgSupply,
            totalTokenWeights,
            true
          );

          const nextValue = formatAmountFree(nextAmount, swapToken.decimals, swapToken.decimals);
          setSwapValue(nextValue);
          setFeeBasisPoints(feeBps);
        }
      }
    };

    updateSwapAmounts();
  }, [
    isBuying,
    anchorOnSwapAmount,
    swapAmount,
    xlxAmount,
    swapToken,
    swapTokenAddress,
    infoTokens,
    xlxPrice,
    usdgSupply,
    totalTokenWeights,
  ]);

  const switchSwapOption = (hash = "") => {
    history.push(`${history.location.pathname}#${hash}`);
    props.setIsBuying(hash === "redeem" ? false : true);
  };

  const fillMaxAmount = () => {
    if (isBuying) {
      setAnchorOnSwapAmount(true);
      setSwapValue(formatAmountFree(swapTokenBalance, swapToken.decimals, swapToken.decimals));
      return;
    }

    setAnchorOnSwapAmount(false);
    setXlxValue(formatAmountFree(maxSellAmount, XLX_DECIMALS, XLX_DECIMALS));
  };

  const getError = () => {
    if (IS_NETWORK_DISABLED[chainId]) {
      if (isBuying) return [t`XLX buy disabled, pending ${getChainName(chainId)} upgrade`];
      return [t`XLX sell disabled, pending ${getChainName(chainId)} upgrade`];
    }

    if (!isBuying && inCooldownWindow) {
      return [t`Redemption time not yet reached`];
    }

    if (!swapAmount || swapAmount.eq(0)) {
      return [t`Enter an amount`];
    }
    if (!xlxAmount || xlxAmount.eq(0)) {
      return [t`Enter an amount`];
    }

    if (isBuying) {
      const swapTokenInfo = getTokenInfo(infoTokens, swapTokenAddress);
      if (
        !savedShouldDisableValidationForTesting &&
        swapTokenInfo &&
        swapTokenInfo.balance &&
        swapAmount &&
        swapAmount.gt(swapTokenInfo.balance)
      ) {
        return [t`Insufficient ${swapTokenInfo.symbol} balance`];
      }

      if (swapTokenInfo.maxUsdgAmount && swapTokenInfo.usdgAmount && swapUsdMin) {
        const usdgFromAmount = adjustForDecimals(swapUsdMin, USD_DECIMALS, USDG_DECIMALS);
        const nextUsdgAmount = swapTokenInfo.usdgAmount.add(usdgFromAmount);
        if (swapTokenInfo.maxUsdgAmount.gt(0) && nextUsdgAmount.gt(swapTokenInfo.maxUsdgAmount)) {
          return [t`${swapTokenInfo.symbol} pool exceeded, try different token`, true];
        }
      }
    }

    if (!isBuying) {
      if (maxSellAmount && xlxAmount && xlxAmount.gt(maxSellAmount)) {
        return [t`Insufficient XLX balance`];
      }

      const swapTokenInfo = getTokenInfo(infoTokens, swapTokenAddress);
      if (
        swapTokenInfo &&
        swapTokenInfo.availableAmount &&
        swapAmount &&
        swapAmount.gt(swapTokenInfo.availableAmount)
      ) {
        return [t`Insufficient liquidity`];
      }
    }

    return [false];
  };

  const isPrimaryEnabled = () => {
    if (IS_NETWORK_DISABLED[chainId]) {
      return false;
    }
    if (!active) {
      return true;
    }
    const [error, modal] = getError();
    if (error && !modal) {
      return false;
    }
    if ((needApproval && isWaitingForApproval) || isApproving) {
      return false;
    }
    if (isApproving) {
      return false;
    }
    if (isSubmitting) {
      return false;
    }
    if (isBuying && isSwapTokenCapReached) {
      return false;
    }

    return true;
  };

  const getPrimaryText = () => {
    if (!active) {
      return t`Connect Wallet`;
    }
    const [error, modal] = getError();
    if (error && !modal) {
      return error;
    }
    if (isBuying && isSwapTokenCapReached) {
      return t`Max Capacity for ${swapToken.symbol} Reached`;
    }

    if (needApproval && isWaitingForApproval) {
      return t`Waiting for Approval`;
    }
    if (isApproving) {
      return t`Approving ${swapToken.symbol}...`;
    }
    if (needApproval) {
      return t`Approve ${swapToken.symbol}`;
    }

    if (isSubmitting) {
      return isBuying ? t`Buying...` : t`Selling...`;
    }

    return isBuying ? t`Buy XLX` : t`Sell XLX`;
  };

  const approveFromToken = () => {
    approveTokens({
      setIsApproving,
      library,
      tokenAddress: swapToken.address,
      spender: xlxManagerAddress,
      chainId: chainId,
      onApproveSubmitted: () => {
        setIsWaitingForApproval(true);
      },
      infoTokens,
      getTokenInfo,
    });
  };

  const buyXlx = () => {
    setIsSubmitting(true);

    const minXlx = xlxAmount.mul(BASIS_POINTS_DIVISOR - savedSlippageAmount).div(BASIS_POINTS_DIVISOR);

    const contract = new ethers.Contract(rewardRouterAddress, RewardRouter.abi, library.getSigner());
    const method = swapTokenAddress === AddressZero ? "mintAndStakeXlxETH" : "mintAndStakeXlx";
    const params = swapTokenAddress === AddressZero ? [0, minXlx] : [swapTokenAddress, swapAmount, 0, minXlx];
    const value = swapTokenAddress === AddressZero ? swapAmount : 0;

    callContract(chainId, contract, method, params, {
      value,
      sentMsg: t`Buy submitted.`,
      failMsg: t`Buy failed.`,
      successMsg: t`${formatAmount(xlxAmount, 18, 4, true)} XLX bought with ${formatAmount(
        swapAmount,
        swapTokenInfo.decimals,
        4,
        true
      )} ${swapTokenInfo.symbol}!`,
      setPendingTxns,
    })
      .then(async () => {})
      .finally(() => {
        setIsSubmitting(false);
      });
  };

  const sellXlx = () => {
    setIsSubmitting(true);

    const minOut = swapAmount.mul(BASIS_POINTS_DIVISOR - savedSlippageAmount).div(BASIS_POINTS_DIVISOR);

    const contract = new ethers.Contract(rewardRouterAddress, RewardRouter.abi, library.getSigner());
    const method = swapTokenAddress === AddressZero ? "unstakeAndRedeemXlxETH" : "unstakeAndRedeemXlx";
    const params =
      swapTokenAddress === AddressZero ? [xlxAmount, minOut, account] : [swapTokenAddress, xlxAmount, minOut, account];

    callContract(chainId, contract, method, params, {
      sentMsg: t`Sell submitted!`,
      failMsg: t`Sell failed.`,
      successMsg: t`${formatAmount(xlxAmount, 18, 4, true)} XLX sold for ${formatAmount(
        swapAmount,
        swapTokenInfo.decimals,
        4,
        true
      )} ${swapTokenInfo.symbol}!`,
      setPendingTxns,
    })
      .then(async () => {})
      .finally(() => {
        setIsSubmitting(false);
      });
  };

  const onClickPrimary = () => {
    if (!active) {
      connectWallet();
      return;
    }

    if (needApproval) {
      approveFromToken();
      return;
    }

    const [, modal] = getError();

    if (modal) {
      setModalError(true);
      return;
    }

    if (isBuying) {
      buyXlx();
    } else {
      sellXlx();
    }
  };

  let payLabel = t`Pay`;
  let receiveLabel = t`Receive`;
  let payBalance = "$0.00";
  let receiveBalance = "$0.00";
  if (isBuying) {
    if (swapUsdMin) {
      payBalance = `$${formatAmount(swapUsdMin, USD_DECIMALS, 2, true)}`;
    }
    if (xlxUsdMax) {
      receiveBalance = `$${formatAmount(xlxUsdMax, USD_DECIMALS, 2, true)}`;
    }
  } else {
    if (xlxUsdMax) {
      payBalance = `$${formatAmount(xlxUsdMax, USD_DECIMALS, 2, true)}`;
    }
    if (swapUsdMin) {
      receiveBalance = `$${formatAmount(swapUsdMin, USD_DECIMALS, 2, true)}`;
    }
  }

  const selectToken = (token) => {
    setAnchorOnSwapAmount(false);
    setSwapTokenAddress(token.address);
    helperToast.success(t`${token.symbol} selected in order form`);
  };

  let feePercentageText = formatAmount(feeBasisPoints, 2, 2, true, "-");
  if (feeBasisPoints !== undefined && feeBasisPoints.toString().length > 0) {
    feePercentageText += "%";
  }

  const wrappedTokenSymbol = getWrappedToken(chainId).symbol;
  const nativeTokenSymbol = getNativeToken(chainId).symbol;

  const onSwapOptionChange = (opt) => {
    if (opt === t`Sell XLX`) {
      switchSwapOption("redeem");
    } else {
      switchSwapOption();
    }
  };

  return (
    <div className="XlxSwap">
      <SwapErrorModal
        isVisible={Boolean(modalError)}
        setIsVisible={setModalError}
        swapToken={swapToken}
        chainId={chainId}
        xlxAmount={xlxAmount}
        usdgSupply={usdgSupply}
        totalTokenWeights={totalTokenWeights}
        xlxPrice={xlxPrice}
        infoTokens={infoTokens}
        swapUsdMin={swapUsdMin}
      />
      <div className="grid grid-cols-1 gap-[15px] rounded-b-lg lg:grid-cols-[1fr_auto]">
        <div className="relative w-full rounded border border-slate-800 p-[15px] pb-[18.6px] text-[15px]">
          <div className="mb-[15px] flex flex-row items-center justify-start text-[16px] leading-[21px]">
            <div className="flex">
              <div className="relative flex mr-2">
                {chainId === AVALANCHE ? (
                  <img
                    src={avalanche16Icon}
                    alt="avalanche16Icon"
                    className="absolute bottom-0 right-0 border rounded-full border-slate-800"
                  />
                ) : (
                  <img
                    src={arbitrum16Icon}
                    alt="arbitrum16Icon"
                    className="absolute bottom-0 right-0 border rounded-full border-slate-800"
                  />
                )}
              </div>
              <div>
                <div className="text-[16px] leading-[21px]">XLX</div>
                <div className="text-[12px] leading-[15px] text-slate-400">XLX</div>
              </div>
              <div>
                <AssetDropdown assetSymbol="XLX" />
              </div>
            </div>
          </div>
          <div className="-mx-[15px] my-[10.5px] h-[1px] bg-slate-800"></div>
          <div className="grid grid-cols-1 gap-[8px]">
            <div className="grid grid-cols-[1fr_auto] gap-[15px]">
              <div className="text-slate-400">
                <Trans>Price</Trans>
              </div>
              <div className="text-right text-slate-300">${formatAmount(xlxPrice, USD_DECIMALS, 3, true)}</div>
            </div>
            <div className="grid grid-cols-[1fr_auto] gap-[15px]">
              <div className="text-slate-400">
                <Trans>Wallet</Trans>
              </div>
              <div className="text-right text-slate-300">
                {formatAmount(xlxBalance, XLX_DECIMALS, 4, true)} XLX ($
                {formatAmount(xlxBalanceUsd, USD_DECIMALS, 2, true)})
              </div>
            </div>
            <div className="grid grid-cols-[1fr_auto] gap-[15px]">
              <div className="text-slate-400">Staked</div>
              <div className="text-right text-slate-300">
                {formatAmount(xlxBalance, XLX_DECIMALS, 4, true)} XLX ($
                {formatAmount(xlxBalanceUsd, USD_DECIMALS, 2, true)})
              </div>
            </div>
          </div>
          <div className="-mx-[15px] my-[10.5px] h-[1px] bg-slate-800"></div>
          <div className="grid grid-cols-1 gap-[8px]">
            {!isBuying && (
              <div className="grid grid-cols-[1fr_auto] gap-[15px]">
                <div className="text-slate-400">
                  <Trans>Reserved</Trans>
                </div>
                <div className="text-right text-slate-300">
                  <Tooltip
                    handle={`${formatAmount(reservedAmount, 18, 4, true)} XLX ($${formatAmount(
                      reserveAmountUsd,
                      USD_DECIMALS,
                      2,
                      true
                    )})`}
                    position="right-bottom"
                    renderContent={() =>
                      t`${formatAmount(reservedAmount, 18, 4, true)} XLX have been reserved for vesting.`
                    }
                  />
                </div>
              </div>
            )}
            <div className="grid grid-cols-[1fr_auto] gap-[15px]">
              <div className="text-slate-400">
                <Trans>APR</Trans>
              </div>
              <div className="text-right text-slate-300">
                <Tooltip
                  handle={`${formatAmount(totalApr, 2, 2, true)}%`}
                  position="right-bottom"
                  renderContent={() => {
                    return (
                      <>
                        <StatsTooltipRow
                          label={t`${nativeTokenSymbol} (${wrappedTokenSymbol}) APR`}
                          value={`${formatAmount(feeXlxTrackerApr, 2, 2, false)}%`}
                          showDollar={false}
                        />
                        <StatsTooltipRow
                          label={t`Escrowed XDX APR`}
                          value={`${formatAmount(stakedXlxTrackerApr, 2, 2, false)}%`}
                          showDollar={false}
                        />
                      </>
                    );
                  }}
                />
              </div>
            </div>
            <div className="grid grid-cols-[1fr_auto] gap-[15px]">
              <div className="text-slate-400">
                <Trans>Total Supply</Trans>
              </div>
              <div className="text-right text-slate-300">
                <Trans>
                  {formatAmount(xlxSupply, XLX_DECIMALS, 4, true)} XLX ($
                  {formatAmount(xlxSupplyUsd, USD_DECIMALS, 2, true)})
                </Trans>
              </div>
            </div>
          </div>
        </div>
        <div className="relative w-full rounded border border-slate-800 p-[15px] pt-0 text-[15px] lg:max-w-[479.5px]">
          <Tab
            options={[t`Buy XLX`, t`Sell XLX`]}
            option={tabLabel}
            onChange={onSwapOptionChange}
            className="my-[15px]"
          />
          {isBuying && (
            <BuyInputSection
              topLeftLabel={payLabel}
              topRightLabel={t`Balance: `}
              tokenBalance={`${formatAmount(swapTokenBalance, swapToken.decimals, 4, true)}`}
              inputValue={swapValue}
              onInputValueChange={onSwapValueChange}
              showMaxButton={swapValue !== formatAmountFree(swapTokenBalance, swapToken.decimals, swapToken.decimals)}
              onClickTopRightLabel={fillMaxAmount}
              onClickMax={fillMaxAmount}
              selectedToken={swapToken}
              balance={payBalance}
            >
              <TokenSelector
                label={t`Pay`}
                chainId={chainId}
                tokenAddress={swapTokenAddress}
                onSelectToken={onSelectSwapToken}
                tokens={whitelistedTokens}
                infoTokens={infoTokens}
                showSymbolImage={true}
                showTokenImgInDropdown={true}
                isBuy={true}
                className="!text-[19px]"
              />
            </BuyInputSection>
          )}

          {!isBuying && (
            <BuyInputSection
              topLeftLabel={payLabel}
              topRightLabel={t`Available: `}
              tokenBalance={`${formatAmount(maxSellAmount, XLX_DECIMALS, 4, true)}`}
              inputValue={xlxValue}
              onInputValueChange={onXlxValueChange}
              showMaxButton={xlxValue !== formatAmountFree(maxSellAmount, XLX_DECIMALS, XLX_DECIMALS)}
              onClickTopRightLabel={fillMaxAmount}
              onClickMax={fillMaxAmount}
              balance={payBalance}
              defaultTokenName={"XLX"}
            >
              <div className="text-[19px] leading-[25px]">
                XLX <img src={xlx24Icon} alt="xlx24Icon" className={cx({ hidden: isBuy })} />
              </div>
            </BuyInputSection>
          )}

          <div className="relative z-10">
            <div
              className="absolute left-1/2 -top-[19.375px] -ml-[17.825px] flex h-[30.65px] w-[30.65px] cursor-pointer items-center justify-center rounded-full bg-slate-700 hover:bg-indigo-500"
              onClick={() => setIsBuying(!isBuying)}
            >
              <IoMdSwap className="block rotate-90 text-center text-[20px]" />
            </div>
          </div>

          {isBuying && (
            <BuyInputSection
              topLeftLabel={receiveLabel}
              topRightLabel={t`Balance: `}
              tokenBalance={`${formatAmount(xlxBalance, XLX_DECIMALS, 4, true)}`}
              inputValue={xlxValue}
              onInputValueChange={onXlxValueChange}
              balance={receiveBalance}
              defaultTokenName={"XLX"}
            >
              <div className="text-[19px] leading-[25px]">
                XLX <img src={xlx24Icon} alt="xlx24Icon" className={cx({ hidden: isBuy })} />
              </div>
            </BuyInputSection>
          )}

          {!isBuying && (
            <BuyInputSection
              topLeftLabel={receiveLabel}
              topRightLabel={t`Balance: `}
              tokenBalance={`${formatAmount(swapTokenBalance, swapToken.decimals, 4, true)}`}
              inputValue={swapValue}
              onInputValueChange={onSwapValueChange}
              balance={receiveBalance}
              selectedToken={swapToken}
            >
              <TokenSelector
                label={t`Receive`}
                chainId={chainId}
                tokenAddress={swapTokenAddress}
                onSelectToken={onSelectSwapToken}
                tokens={whitelistedTokens}
                infoTokens={infoTokens}
                className="!text-[19px]"
                showSymbolImage={true}
                showTokenImgInDropdown={true}
                isBuy={isBuy}
              />
            </BuyInputSection>
          )}

          <div>
            <div className="mb-2 flex h-[15px] items-center justify-between text-[14px]">
              <div className="mr-2 text-slate-400">{feeBasisPoints > 50 ? t`WARNING: High Fees` : t`Fees`}</div>
              <div className="flex justify-end text-right text-slate-300">
                {isBuying && (
                  <Tooltip
                    handle={isBuying && isSwapTokenCapReached ? "NA" : feePercentageText}
                    position="right-bottom"
                    renderContent={() => {
                      if (!feeBasisPoints) {
                        return (
                          <div className="text-slate-300">
                            Fees will be shown once you have entered an amount in the order form.
                          </div>
                        );
                      }
                      return (
                        <div className="text-slate-300">
                          {feeBasisPoints > 50 && <Trans>To reduce fees, select a different asset to pay with.</Trans>}
                          <Trans>Check the "Save on Fees" section below to get the lowest fee percentages.</Trans>
                        </div>
                      );
                    }}
                  />
                )}
                {!isBuying && (
                  <Tooltip
                    handle={feePercentageText}
                    position="right-bottom"
                    renderContent={() => {
                      if (!feeBasisPoints) {
                        return (
                          <div className="text-slate-300">
                            Fees will be shown once you have entered an amount in the order form.
                          </div>
                        );
                      }
                      return (
                        <div className="text-slate-300">
                          {feeBasisPoints > 50 && <Trans>To reduce fees, select a different asset to receive.</Trans>}
                          <Trans>Check the "Save on Fees" section below to get the lowest fee percentages.</Trans>
                        </div>
                      );
                    }}
                  />
                )}
              </div>
            </div>
          </div>
          <div className="pt-0 m-0 text-center">
            <button
              className="inline-block w-full p-3 text-sm text-center rounded cursor-pointer bg-slate-800 text-slate-300 hover:bg-indigo-500 disabled:cursor-not-allowed"
              onClick={onClickPrimary}
              disabled={!isPrimaryEnabled()}
            >
              {getPrimaryText()}
            </button>
          </div>
        </div>
      </div>
      <div className="mb-6 pt-[31px]">
        <div className="mb-[8px] flex flex-row items-center text-xl font-medium text-slate-300">Save on Fees</div>
        {isBuying && (
          <div className="text-sm text-slate-600">
            <Trans>Fees may vary depending on which asset you use to Buy XLX.</Trans>
            <br />{" "}
            <Trans>
              Enter the amount of XLX you want to purchase in the order form, then check here to compare fees.
            </Trans>
          </div>
        )}
        {!isBuying && (
          <div className="text-sm text-slate-600">
            <Trans>Fees may vary depending on which asset you sell XLX for.</Trans>
            <br />{" "}
            <Trans>
              Enter the amount of XLX you want to redeem in the order form, then check here to compare fees.
            </Trans>
          </div>
        )}
      </div>
      <div className="relative pt-0 text-xs font-medium text-left rounded border-slate-800 lg:border">
        {/* <div className="XlxSwap-token-list-content"> */}
        <table className="hidden w-full text-white whitespace-nowrap lg:table">
          <thead>
            <tr className="text-slate-600">
              <th className="rounded-tl bg-slate-950 py-3.5 pl-4 pr-3 text-left text-xs font-medium sm:pl-6">
                <Trans>TOKEN</Trans>
              </th>
              <th className="bg-slate-950 px-3 py-3.5 text-left text-xs font-medium">
                <Trans>PRICE</Trans>
              </th>
              <th className="bg-slate-950 px-3 py-3.5 text-left text-xs font-medium">
                {isBuying ? (
                  <Tooltip
                    handle={t`AVAILABLE`}
                    tooltipIconPosition="right"
                    position="right-bottom text-none"
                    renderContent={() => (
                      <p className="text-slate-300">
                        <Trans>Available amount to deposit into XLX.</Trans>
                      </p>
                    )}
                  />
                ) : (
                  <Tooltip
                    handle={t`AVAILABLE`}
                    tooltipIconPosition="right"
                    position="center-bottom text-none"
                    renderContent={() => {
                      return (
                        <p className="text-slate-300">
                          <Trans>
                            Available amount to withdraw from XLX. Funds not utilized by current open positions.
                          </Trans>
                        </p>
                      );
                    }}
                  />
                )}
              </th>
              <th className="bg-slate-950 px-3 py-3.5 text-left text-xs font-medium">
                <Trans>WALLET</Trans>
              </th>
              <th className="bg-slate-950 px-3 py-3.5 text-left text-xs font-medium">
                <Tooltip
                  handle={t`FEES`}
                  tooltipIconPosition="right"
                  position="right-bottom text-none"
                  renderContent={() => {
                    return (
                      <div className="text-slate-300">
                        <Trans>Fees will be shown once you have entered an amount in the order form.</Trans>
                      </div>
                    );
                  }}
                />
              </th>
              <th className="rounded-tr bg-slate-950 px-3 py-3.5 pr-6 text-right text-xs font-medium"></th>
            </tr>
          </thead>
          <tbody>
            {visibleTokens.map((token, index) => {
              let tokenFeeBps;
              if (isBuying) {
                const { feeBasisPoints: feeBps } = getBuyXlxFromAmount(
                  xlxAmount,
                  token.address,
                  infoTokens,
                  xlxPrice,
                  usdgSupply,
                  totalTokenWeights
                );
                tokenFeeBps = feeBps;
              } else {
                const { feeBasisPoints: feeBps } = getSellXlxToAmount(
                  xlxAmount,
                  token.address,
                  infoTokens,
                  xlxPrice,
                  usdgSupply,
                  totalTokenWeights
                );
                tokenFeeBps = feeBps;
              }
              const tokenInfo = getTokenInfo(infoTokens, token.address);
              let managedUsd;
              if (tokenInfo && tokenInfo.managedUsd) {
                managedUsd = tokenInfo.managedUsd;
              }
              let availableAmountUsd;
              if (tokenInfo && tokenInfo.minPrice && tokenInfo.availableAmount) {
                availableAmountUsd = tokenInfo.availableAmount
                  .mul(tokenInfo.minPrice)
                  .div(expandDecimals(1, token.decimals));
              }
              let balanceUsd;
              if (tokenInfo && tokenInfo.minPrice && tokenInfo.balance) {
                balanceUsd = tokenInfo.balance.mul(tokenInfo.minPrice).div(expandDecimals(1, token.decimals));
              }
              const tokenImage = importImage("ic_" + token.symbol.toLowerCase() + "_40.svg");
              let isCapReached = tokenInfo.managedAmount?.gt(tokenInfo.maxUsdgAmount);

              let amountLeftToDeposit = bigNumberify(0);
              if (tokenInfo.maxUsdgAmount && tokenInfo.maxUsdgAmount.gt(0)) {
                amountLeftToDeposit = tokenInfo.maxUsdgAmount
                  .sub(tokenInfo.usdgAmount)
                  .mul(expandDecimals(1, USD_DECIMALS))
                  .div(expandDecimals(1, USDG_DECIMALS));
              }
              if (amountLeftToDeposit.lt(0)) {
                amountLeftToDeposit = bigNumberify(0);
              }
              function renderFees() {
                const swapUrl = `https://app.1inch.io/#/${chainId}/swap/`;
                switch (true) {
                  case (isBuying && isCapReached) || (!isBuying && managedUsd?.lt(1)):
                    return (
                      <Tooltip
                        handle="NA"
                        position="right-bottom"
                        renderContent={() => (
                          <div className="text-slate-300">
                            <Trans>Max pool capacity reached for {tokenInfo.symbol}</Trans>

                            <br />
                            <br />
                            <Trans>Please mint XLX using another token</Trans>
                            <br />
                            <p>
                              <a className="underline text-slate-300" href={swapUrl} target="_blank" rel="noreferrer">
                                <Trans> Swap {tokenInfo.symbol} on 1inch</Trans>
                              </a>
                            </p>
                          </div>
                        )}
                      />
                    );
                  case (isBuying && !isCapReached) || (!isBuying && managedUsd?.gt(0)):
                    return `${formatAmount(tokenFeeBps, 2, 2, true, "-")}${
                      tokenFeeBps !== undefined && tokenFeeBps.toString().length > 0 ? "%" : ""
                    }`;
                  default:
                    return "";
                }
              }

              return (
                <tr
                  key={token.symbol}
                  className={cx(index === 0 ? "border-slate-800" : "border-slate-800", "border-t")}
                >
                  <td className="py-4 pl-4 pr-3 text-sm font-medium whitespace-nowrap sm:pl-6">
                    <div className="flex">
                      <div className="flex mr-2">
                        <img src={tokenImage} alt={token.symbol} width="30px" />
                      </div>
                      <div>
                        <div className="text-sm text-slate-300">{token.name}</div>
                        <div className="text-xs font-medium text-slate-600">{token.symbol}</div>
                      </div>
                      <div>
                        <AssetDropdown assetSymbol={token.symbol} assetInfo={token} />
                      </div>
                    </div>
                  </td>
                  <td className="px-3 py-4 text-sm whitespace-nowrap text-slate-300">
                    ${formatKeyAmount(tokenInfo, "minPrice", USD_DECIMALS, 2, true)}
                  </td>
                  <td className="px-3 py-4 text-sm whitespace-nowrap text-slate-300">
                    {isBuying && (
                      <div>
                        <Tooltip
                          handle={
                            amountLeftToDeposit && amountLeftToDeposit.lt(0)
                              ? "$0.00"
                              : `$${formatAmount(amountLeftToDeposit, USD_DECIMALS, 2, true)}`
                          }
                          position="right-bottom"
                          tooltipIconPosition="right"
                          renderContent={() => getTooltipContent(managedUsd, tokenInfo, token)}
                        />
                      </div>
                    )}
                    {!isBuying && (
                      <div>
                        <Tooltip
                          handle={
                            availableAmountUsd && availableAmountUsd.lt(0)
                              ? "$0.00"
                              : `$${formatAmount(availableAmountUsd, USD_DECIMALS, 2, true)}`
                          }
                          position="right-bottom"
                          tooltipIconPosition="right"
                          renderContent={() => getTooltipContent(managedUsd, tokenInfo, token)}
                        />
                      </div>
                    )}
                  </td>
                  <td className="px-3 py-4 text-sm whitespace-nowrap text-slate-300">
                    {formatKeyAmount(tokenInfo, "balance", tokenInfo.decimals, 2, true)} {tokenInfo.symbol} ($
                    {formatAmount(balanceUsd, USD_DECIMALS, 2, true)})
                  </td>
                  <td className="px-3 py-4 text-sm whitespace-nowrap text-slate-300">{renderFees()}</td>
                  <td className="relative py-4 pl-3 pr-4 text-sm font-medium text-right whitespace-nowrap sm:pr-6">
                    <button
                      className={cx(
                        "box-border inline-flex min-h-[36px] w-full cursor-pointer items-center justify-center rounded bg-slate-700 px-4 text-[14px] leading-[20px] text-slate-300 hover:bg-indigo-500",
                        isBuying ? "buying" : "selling"
                      )}
                      onClick={() => selectToken(token)}
                    >
                      {isBuying ? t`Buy with ${token.symbol}` : t`Sell for ${token.symbol}`}
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        <div className="mt-2 grid grid-cols-1 gap-[15px] lg:hidden lg:grid-cols-2">
          {visibleTokens.map((token) => {
            let tokenFeeBps;
            if (isBuying) {
              const { feeBasisPoints: feeBps } = getBuyXlxFromAmount(
                xlxAmount,
                token.address,
                infoTokens,
                xlxPrice,
                usdgSupply,
                totalTokenWeights
              );
              tokenFeeBps = feeBps;
            } else {
              const { feeBasisPoints: feeBps } = getSellXlxToAmount(
                xlxAmount,
                token.address,
                infoTokens,
                xlxPrice,
                usdgSupply,
                totalTokenWeights
              );
              tokenFeeBps = feeBps;
            }
            const tokenInfo = getTokenInfo(infoTokens, token.address);
            let managedUsd;
            if (tokenInfo && tokenInfo.managedUsd) {
              managedUsd = tokenInfo.managedUsd;
            }
            let availableAmountUsd;
            if (tokenInfo && tokenInfo.minPrice && tokenInfo.availableAmount) {
              availableAmountUsd = tokenInfo.availableAmount
                .mul(tokenInfo.minPrice)
                .div(expandDecimals(1, token.decimals));
            }
            let balanceUsd;
            if (tokenInfo && tokenInfo.minPrice && tokenInfo.balance) {
              balanceUsd = tokenInfo.balance.mul(tokenInfo.minPrice).div(expandDecimals(1, token.decimals));
            }

            let amountLeftToDeposit = bigNumberify(0);
            if (tokenInfo.maxUsdgAmount && tokenInfo.maxUsdgAmount.gt(0)) {
              amountLeftToDeposit = tokenInfo.maxUsdgAmount
                .sub(tokenInfo.usdgAmount)
                .mul(expandDecimals(1, USD_DECIMALS))
                .div(expandDecimals(1, USDG_DECIMALS));
            }
            if (amountLeftToDeposit.lt(0)) {
              amountLeftToDeposit = bigNumberify(0);
            }
            let isCapReached = tokenInfo.managedAmount?.gt(tokenInfo.maxUsdgAmount);

            function renderFees() {
              switch (true) {
                case (isBuying && isCapReached) || (!isBuying && managedUsd?.lt(1)):
                  return (
                    <Tooltip
                      handle="NA"
                      position="right-bottom"
                      renderContent={() => (
                        <Trans>
                          Max pool capacity reached for {tokenInfo.symbol}. Please mint XLX using another token
                        </Trans>
                      )}
                    />
                  );
                case (isBuying && !isCapReached) || (!isBuying && managedUsd?.gt(0)):
                  return `${formatAmount(tokenFeeBps, 2, 2, true, "-")}${
                    tokenFeeBps !== undefined && tokenFeeBps.toString().length > 0 ? "%" : ""
                  }`;
                default:
                  return "";
              }
            }
            const tokenImage = importImage("ic_" + token.symbol.toLowerCase() + "_24.svg");
            return (
              <div className="relative text-xs font-medium border rounded shadow border-slate-800" key={token.symbol}>
                <div className="flex items-center justify-start rounded-t bg-slate-950 p-[15px] py-3.5 text-xs font-medium uppercase text-slate-600">
                  <img src={tokenImage} alt={token.symbol} className="w-5 mr-2" />
                  <div>{token.symbol}</div>
                  <div>
                    <AssetDropdown assetSymbol={token.symbol} assetInfo={token} />
                  </div>
                </div>
                <div className="mb-[10.5px] h-[1px] bg-slate-800"></div>
                <div className="grid grid-cols-1 gap-2">
                  <div className="mx-[15px] grid grid-cols-[1fr_auto] gap-[15px]">
                    <div className="text-slate-400">Price</div>
                    <div>${formatKeyAmount(tokenInfo, "minPrice", USD_DECIMALS, 2, true)}</div>
                  </div>
                  {isBuying && (
                    <div className="mx-[15px] grid grid-cols-[1fr_auto] gap-[15px]">
                      <Tooltip
                        handle="Available"
                        position="left-bottom"
                        renderContent={() => (
                          <p className="text-slate-300">
                            <Trans>Available amount to deposit into XLX.</Trans>
                          </p>
                        )}
                      />
                      <div>
                        <Tooltip
                          handle={amountLeftToDeposit && `$${formatAmount(amountLeftToDeposit, USD_DECIMALS, 2, true)}`}
                          position="right-bottom"
                          tooltipIconPosition="right"
                          renderContent={() => getTooltipContent(managedUsd, tokenInfo, token)}
                        />
                      </div>
                    </div>
                  )}
                  {!isBuying && (
                    <div className="mx-[15px] grid grid-cols-[1fr_auto] gap-[15px]">
                      <div className="text-slate-400">
                        <Tooltip
                          handle={t`Available`}
                          position="left-bottom"
                          renderContent={() => {
                            return (
                              <p className="text-slate-300">
                                <Trans>
                                  Available amount to withdraw from XLX. Funds not utilized by current open positions.
                                </Trans>
                              </p>
                            );
                          }}
                        />
                      </div>

                      <div>
                        <Tooltip
                          handle={
                            availableAmountUsd && availableAmountUsd.lt(0)
                              ? "$0.00"
                              : `$${formatAmount(availableAmountUsd, USD_DECIMALS, 2, true)}`
                          }
                          position="right-bottom"
                          tooltipIconPosition="right"
                          renderContent={() => getTooltipContent(managedUsd, tokenInfo, token)}
                        />
                      </div>
                    </div>
                  )}

                  <div className="mx-[15px] grid grid-cols-[1fr_auto] gap-[15px]">
                    <div className="text-slate-400">
                      <Trans>Wallet</Trans>
                    </div>
                    <div>
                      {formatKeyAmount(tokenInfo, "balance", tokenInfo.decimals, 2, true)} {tokenInfo.symbol} ($
                      {formatAmount(balanceUsd, USD_DECIMALS, 2, true)})
                    </div>
                  </div>
                  <div className="mx-[15px] grid grid-cols-[1fr_auto] gap-[15px]">
                    <div>
                      {tokenFeeBps ? (
                        t`Fees`
                      ) : (
                        <Tooltip
                          handle="Fees"
                          renderContent={() => (
                            <p className="text-slate-300">
                              <Trans>Fees will be shown once you have entered an amount in the order form.</Trans>
                            </p>
                          )}
                        />
                      )}
                    </div>
                    <div>{renderFees()}</div>
                  </div>
                  <div className="my-[10.5px] h-[1px] bg-slate-800"></div>
                  <div className="-m-[6.2px] mx-[9px] mb-[12px]">
                    {isBuying && (
                      <button
                        className="relative m-[6.2px] box-border inline-flex min-h-[36px] cursor-pointer items-center rounded bg-slate-700 px-4 text-[14px] leading-[20px] text-slate-300  hover:bg-[#4f60fc]"
                        onClick={() => selectToken(token)}
                      >
                        <Trans>Buy with {token.symbol}</Trans>
                      </button>
                    )}
                    {!isBuying && (
                      <button
                        className="relative m-[6.2px] box-border inline-flex min-h-[36px] cursor-pointer items-center rounded bg-slate-700 px-4 text-[14px] leading-[20px] text-slate-300  hover:bg-[#4f60fc]"
                        onClick={() => selectToken(token)}
                      >
                        <Trans>Sell for {token.symbol}</Trans>
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
