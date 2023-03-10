import React, { useEffect, useMemo, useState } from "react";
import Tooltip from "../Tooltip/Tooltip";
import { t, Trans } from "@lingui/macro";
import Slider, { SliderTooltip } from "rc-slider";
import "rc-slider/assets/index.css";
import { WalletIcon } from "@heroicons/react/24/outline";

import cx from "classnames";
import useSWR from "swr";
import { ethers } from "ethers";

import { IoMdSwap } from "react-icons/io";
import { BsArrowRight } from "react-icons/bs";

import {
  adjustForDecimals,
  BASIS_POINTS_DIVISOR,
  calculatePositionDelta,
  DEFAULT_HIGHER_SLIPPAGE_AMOUNT,
  DUST_BNB,
  getExchangeRate,
  getExchangeRateDisplay,
  getLeverage,
  getLiquidationPrice,
  getNextFromAmount,
  getNextToAmount,
  getPositionKey,
  isTriggerRatioInverted,
  LEVERAGE_ORDER_OPTIONS,
  LIMIT,
  LONG,
  MARGIN_FEE_BASIS_POINTS,
  MARKET,
  PRECISION,
  SHORT,
  STOP,
  SWAP,
  SWAP_OPTIONS,
  SWAP_ORDER_OPTIONS,
  USD_DECIMALS,
  USDG_ADDRESS,
  USDG_DECIMALS,
} from "lib/legacy";
import { getChainName, getConstant, IS_NETWORK_DISABLED, isSupportedChain } from "config/chains";
import * as Api from "domain/legacy";
import { getContract } from "config/contracts";

import Checkbox from "../Checkbox/Checkbox";
import Tab from "../Tab/Tab";
import SwapTab from "../Tab/SwapTab";
import TokenSelector from "./TokenSelectorV2";
import ExchangeInfoRow from "./ExchangeInfoRow";
import ConfirmationBox from "./ConfirmationBox";
import OrdersToa from "./OrdersToa";

import PositionRouter from "abis/PositionRouter.json";
import Router from "abis/Router.json";
import Token from "abis/Token.json";
import WETH from "abis/WETH.json";

import longImg from "img/long.svg";
import shortImg from "img/short.svg";
import swapImg from "img/swap.svg";

import { useUserReferralCode } from "domain/referrals";
import NoLiquidityErrorModal from "./NoLiquidityErrorModal";
import StatsTooltipRow from "../StatsTooltip/StatsTooltipRow";
import { callContract, contractFetcher } from "lib/contracts";
import {
  approveTokens,
  getMostAbundantStableToken,
  replaceNativeTokenAddress,
  shouldRaiseGasError,
} from "domain/tokens";
import { useLocalStorageByChainId, useLocalStorageSerializeKey } from "lib/localStorage";
import { helperToast } from "lib/helperToast";
import { getTokenInfo, getUsd } from "domain/tokens/utils";
import { usePrevious } from "lib/usePrevious";
import { bigNumberify, expandDecimals, formatAmount, formatAmountFree, parseValue } from "lib/numbers";
import { getToken, getTokenBySymbol, getTokens, getWhitelistedTokens } from "config/tokens";
import { Disclosure } from "@headlessui/react";
import { FaAngleDown } from "react-icons/fa";

const SWAP_ICONS = {
  [LONG]: longImg,
  [SHORT]: shortImg,
  [SWAP]: swapImg,
};
const { AddressZero } = ethers.constants;

const leverageSliderHandle = (props) => {
  const { value, dragging, index, ...restProps } = props;
  return (
    <SliderTooltip
      prefixCls="rc-slider-tooltip"
      overlay={`${parseFloat(value).toFixed(2)}x`}
      visible={dragging}
      placement="top"
      key={index}
    >
      <Slider.Handle value={value} {...restProps} />
    </SliderTooltip>
  );
};

function getNextAveragePrice({ size, sizeDelta, hasProfit, delta, nextPrice, isLong }) {
  if (!size || !sizeDelta || !delta || !nextPrice) {
    return;
  }
  const nextSize = size.add(sizeDelta);
  let divisor;
  if (isLong) {
    divisor = hasProfit ? nextSize.add(delta) : nextSize.sub(delta);
  } else {
    divisor = hasProfit ? nextSize.sub(delta) : nextSize.add(delta);
  }
  if (!divisor || divisor.eq(0)) {
    return;
  }
  const nextAveragePrice = nextPrice.mul(nextSize).div(divisor);
  return nextAveragePrice;
}

export default function SwapBox(props) {
  const {
    pendingPositions,
    setPendingPositions,
    infoTokens,
    active,
    library,
    account,
    fromTokenAddress,
    setFromTokenAddress,
    toTokenAddress,
    setToTokenAddress,
    swapOption,
    setSwapOption,
    positionsMap,
    pendingTxns,
    setPendingTxns,
    tokenSelection,
    setTokenSelection,
    setIsConfirming,
    isConfirming,
    isPendingConfirmation,
    setIsPendingConfirmation,
    flagOrdersEnabled,
    chainId,
    nativeTokenAddress,
    savedSlippageAmount,
    totalTokenWeights,
    usdgSupply,
    orders,
    savedIsPnlInLeverage,
    orderBookApproved,
    positionRouterApproved,
    isWaitingForPluginApproval,
    approveOrderBook,
    approvePositionRouter,
    setIsWaitingForPluginApproval,
    isWaitingForPositionRouterApproval,
    setIsWaitingForPositionRouterApproval,
    isPluginApproving,
    isPositionRouterApproving,
    savedShouldDisableValidationForTesting,
    minExecutionFee,
    minExecutionFeeUSD,
    minExecutionFeeErrorMessage,
  } = props;

  const [fromValue, setFromValue] = useState("");
  const [toValue, setToValue] = useState("");
  const [anchorOnFromAmount, setAnchorOnFromAmount] = useState(true);
  const [isApproving, setIsApproving] = useState(false);
  const [isWaitingForApproval, setIsWaitingForApproval] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [modalError, setModalError] = useState(false);
  const [isHigherSlippageAllowed, setIsHigherSlippageAllowed] = useState(false);
  const { attachedOnChain, userReferralCode } = useUserReferralCode(library, chainId, account);

  let allowedSlippage = savedSlippageAmount;
  if (isHigherSlippageAllowed) {
    allowedSlippage = DEFAULT_HIGHER_SLIPPAGE_AMOUNT;
  }

  const defaultCollateralSymbol = getConstant(chainId, "defaultCollateralSymbol");
  // TODO hack with useLocalStorageSerializeKey
  const [shortCollateralAddress, setShortCollateralAddress] = useLocalStorageByChainId(
    chainId,
    "Short-Collateral-Address",
    getTokenBySymbol(chainId, defaultCollateralSymbol).address
  );
  const isLong = swapOption === LONG;
  const isShort = swapOption === SHORT;
  const isSwap = swapOption === SWAP;

  function getTokenLabel() {
    switch (true) {
      case isLong:
        return t`Long`;
      case isShort:
        return t`Short`;
      case isSwap:
        return t`Receive`;
      default:
        return "";
    }
  }
  const [leverageOption, setLeverageOption] = useLocalStorageSerializeKey(
    [chainId, "Exchange-swap-leverage-option"],
    "2"
  );
  const [isLeverageSliderEnabled, setIsLeverageSliderEnabled] = useLocalStorageSerializeKey(
    [chainId, "Exchange-swap-leverage-slider-enabled"],
    true
  );

  const hasLeverageOption = isLeverageSliderEnabled && !isNaN(parseFloat(leverageOption));

  const [ordersToaOpen, setOrdersToaOpen] = useState(false);

  let [orderOption, setOrderOption] = useLocalStorageSerializeKey([chainId, "Order-option"], MARKET);
  if (!flagOrdersEnabled) {
    orderOption = MARKET;
  }

  const onOrderOptionChange = (option) => {
    setOrderOption(option);
  };

  const isMarketOrder = orderOption === MARKET;
  const orderOptions = isSwap ? SWAP_ORDER_OPTIONS : LEVERAGE_ORDER_OPTIONS;
  const orderOptionLabels = { [STOP]: "Trigger" };

  const [triggerPriceValue, setTriggerPriceValue] = useState("");
  const triggerPriceUsd = isMarketOrder ? 0 : parseValue(triggerPriceValue, USD_DECIMALS);

  const onTriggerPriceChange = (evt) => {
    setTriggerPriceValue(evt.target.value || "");
  };

  const onTriggerRatioChange = (evt) => {
    setTriggerRatioValue(evt.target.value || "");
  };

  let positionKey;
  if (isLong) {
    positionKey = getPositionKey(account, toTokenAddress, toTokenAddress, true, nativeTokenAddress);
  }
  if (isShort) {
    positionKey = getPositionKey(account, shortCollateralAddress, toTokenAddress, false, nativeTokenAddress);
  }

  const existingPosition = positionKey ? positionsMap[positionKey] : undefined;
  const hasExistingPosition = existingPosition && existingPosition.size && existingPosition.size.gt(0);

  const whitelistedTokens = getWhitelistedTokens(chainId);
  const tokens = getTokens(chainId);
  const fromTokens = tokens;
  const stableTokens = tokens.filter((token) => token.isStable);
  const indexTokens = whitelistedTokens.filter((token) => !token.isStable && !token.isWrapped);
  const shortableTokens = indexTokens.filter((token) => token.isShortable);

  let toTokens = tokens;
  if (isLong) {
    toTokens = indexTokens;
  }
  if (isShort) {
    toTokens = shortableTokens;
  }

  const needOrderBookApproval = !isMarketOrder && !orderBookApproved;
  const prevNeedOrderBookApproval = usePrevious(needOrderBookApproval);

  const needPositionRouterApproval = (isLong || isShort) && isMarketOrder && !positionRouterApproved;
  const prevNeedPositionRouterApproval = usePrevious(needPositionRouterApproval);

  useEffect(() => {
    if (!needOrderBookApproval && prevNeedOrderBookApproval && isWaitingForPluginApproval) {
      setIsWaitingForPluginApproval(false);
      helperToast.success(<div>Orders enabled!</div>);
    }
  }, [needOrderBookApproval, prevNeedOrderBookApproval, setIsWaitingForPluginApproval, isWaitingForPluginApproval]);

  useEffect(() => {
    if (!needPositionRouterApproval && prevNeedPositionRouterApproval && isWaitingForPositionRouterApproval) {
      setIsWaitingForPositionRouterApproval(false);
      helperToast.success(<div>Leverage enabled!</div>);
    }
  }, [
    needPositionRouterApproval,
    prevNeedPositionRouterApproval,
    setIsWaitingForPositionRouterApproval,
    isWaitingForPositionRouterApproval,
  ]);

  useEffect(() => {
    if (!needOrderBookApproval && prevNeedOrderBookApproval && isWaitingForPluginApproval) {
      setIsWaitingForPluginApproval(false);
      helperToast.success(<div>Orders enabled!</div>);
    }
  }, [needOrderBookApproval, prevNeedOrderBookApproval, setIsWaitingForPluginApproval, isWaitingForPluginApproval]);

  const routerAddress = getContract(chainId, "Router");
  const tokenAllowanceAddress = fromTokenAddress === AddressZero ? nativeTokenAddress : fromTokenAddress;
  const { data: tokenAllowance } = useSWR(
    active && [active, chainId, tokenAllowanceAddress, "allowance", account, routerAddress],
    {
      fetcher: contractFetcher(library, Token),
    }
  );

  // const { data: hasOutdatedUi } = Api.useHasOutdatedUi();

  const fromToken = getToken(chainId, fromTokenAddress);
  const toToken = getToken(chainId, toTokenAddress);
  const shortCollateralToken = getTokenInfo(infoTokens, shortCollateralAddress);

  const fromTokenInfo = getTokenInfo(infoTokens, fromTokenAddress);
  const toTokenInfo = getTokenInfo(infoTokens, toTokenAddress);

  const renderAvailableLongLiquidity = () => {
    if (!isLong) {
      return null;
    }

    return (
      <div className="mb-[4.65px] grid grid-cols-[auto_auto] text-xs font-medium">
        <div className="mr-2 text-xs font-medium text-slate-600">
          <Trans>Available Liquidity</Trans>
        </div>
        <div className="flex justify-end text-right">
          <Tooltip
            handle={`$${formatAmount(toTokenInfo.maxAvailableLong, USD_DECIMALS, 2, true)}`}
            position="right-bottom"
            renderContent={() => {
              return (
                <>
                  <StatsTooltipRow
                    label={`Max ${toTokenInfo.symbol} long capacity`}
                    value={formatAmount(toTokenInfo.maxLongCapacity, USD_DECIMALS, 0, true)}
                  />
                  <StatsTooltipRow
                    label={`Current ${toTokenInfo.symbol} long`}
                    value={formatAmount(toTokenInfo.guaranteedUsd, USD_DECIMALS, 0, true)}
                  />
                </>
              );
            }}
          ></Tooltip>
        </div>
      </div>
    );
  };

  const fromBalance = fromTokenInfo ? fromTokenInfo.balance : bigNumberify(0);
  const toBalance = toTokenInfo ? toTokenInfo.balance : bigNumberify(0);

  const fromAmount = parseValue(fromValue, fromToken && fromToken.decimals);
  const toAmount = parseValue(toValue, toToken && toToken.decimals);

  const isPotentialWrap = (fromToken.isNative && toToken.isWrapped) || (fromToken.isWrapped && toToken.isNative);
  const isWrapOrUnwrap = isSwap && isPotentialWrap;
  const needApproval =
    fromTokenAddress !== AddressZero &&
    tokenAllowance &&
    fromAmount &&
    fromAmount.gt(tokenAllowance) &&
    !isWrapOrUnwrap;
  const prevFromTokenAddress = usePrevious(fromTokenAddress);
  const prevNeedApproval = usePrevious(needApproval);
  const prevToTokenAddress = usePrevious(toTokenAddress);

  const fromUsdMin = getUsd(fromAmount, fromTokenAddress, false, infoTokens);
  const toUsdMax = getUsd(toAmount, toTokenAddress, true, infoTokens, orderOption, triggerPriceUsd);

  const indexTokenAddress = toTokenAddress === AddressZero ? nativeTokenAddress : toTokenAddress;
  const collateralTokenAddress = isLong ? indexTokenAddress : shortCollateralAddress;
  const collateralToken = getToken(chainId, collateralTokenAddress);

  const [triggerRatioValue, setTriggerRatioValue] = useState("");

  const triggerRatioInverted = useMemo(() => {
    return isTriggerRatioInverted(fromTokenInfo, toTokenInfo);
  }, [toTokenInfo, fromTokenInfo]);

  const maxToTokenOut = useMemo(() => {
    const value = toTokenInfo.availableAmount?.gt(toTokenInfo.poolAmount?.sub(toTokenInfo.bufferAmount))
      ? toTokenInfo.poolAmount?.sub(toTokenInfo.bufferAmount)
      : toTokenInfo.availableAmount;

    if (!value) {
      return bigNumberify(0);
    }

    return value.gt(0) ? value : bigNumberify(0);
  }, [toTokenInfo]);

  const maxToTokenOutUSD = useMemo(() => {
    return getUsd(maxToTokenOut, toTokenAddress, false, infoTokens);
  }, [maxToTokenOut, toTokenAddress, infoTokens]);

  const maxFromTokenInUSD = useMemo(() => {
    const value = fromTokenInfo.maxUsdgAmount
      ?.sub(fromTokenInfo.usdgAmount)
      .mul(expandDecimals(1, USD_DECIMALS))
      .div(expandDecimals(1, USDG_DECIMALS));

    if (!value) {
      return bigNumberify(0);
    }

    return value.gt(0) ? value : bigNumberify(0);
  }, [fromTokenInfo]);

  const maxFromTokenIn = useMemo(() => {
    if (!fromTokenInfo.maxPrice) {
      return bigNumberify(0);
    }
    return maxFromTokenInUSD?.mul(expandDecimals(1, fromTokenInfo.decimals)).div(fromTokenInfo.maxPrice).toString();
  }, [maxFromTokenInUSD, fromTokenInfo]);

  let maxSwapAmountUsd = bigNumberify(0);

  if (maxToTokenOutUSD && maxFromTokenInUSD) {
    maxSwapAmountUsd = maxToTokenOutUSD.lt(maxFromTokenInUSD) ? maxToTokenOutUSD : maxFromTokenInUSD;
  }

  const triggerRatio = useMemo(() => {
    if (!triggerRatioValue) {
      return bigNumberify(0);
    }
    let ratio = parseValue(triggerRatioValue, USD_DECIMALS);
    if (ratio.eq(0)) {
      return bigNumberify(0);
    }
    if (triggerRatioInverted) {
      ratio = PRECISION.mul(PRECISION).div(ratio);
    }
    return ratio;
  }, [triggerRatioValue, triggerRatioInverted]);

  useEffect(() => {
    if (
      fromToken &&
      fromTokenAddress === prevFromTokenAddress &&
      !needApproval &&
      prevNeedApproval &&
      isWaitingForApproval
    ) {
      setIsWaitingForApproval(false);
      helperToast.success(<div>{fromToken.symbol} approved!</div>);
    }
  }, [
    fromTokenAddress,
    prevFromTokenAddress,
    needApproval,
    prevNeedApproval,
    setIsWaitingForApproval,
    fromToken.symbol,
    isWaitingForApproval,
    fromToken,
  ]);

  useEffect(() => {
    if (!toTokens.find((token) => token.address === toTokenAddress)) {
      setToTokenAddress(swapOption, toTokens[0].address);
    }
  }, [swapOption, toTokens, toTokenAddress, setToTokenAddress]);

  useEffect(() => {
    if (swapOption !== SHORT) {
      return;
    }
    if (toTokenAddress === prevToTokenAddress) {
      return;
    }
    for (let i = 0; i < stableTokens.length; i++) {
      const stableToken = stableTokens[i];
      const key = getPositionKey(account, stableToken.address, toTokenAddress, false, nativeTokenAddress);
      const position = positionsMap[key];
      if (position && position.size && position.size.gt(0)) {
        setShortCollateralAddress(position.collateralToken.address);
        return;
      }
    }
  }, [
    account,
    toTokenAddress,
    prevToTokenAddress,
    swapOption,
    positionsMap,
    stableTokens,
    nativeTokenAddress,
    shortCollateralAddress,
    setShortCollateralAddress,
  ]);

  useEffect(() => {
    const updateSwapAmounts = () => {
      if (anchorOnFromAmount) {
        if (!fromAmount) {
          setToValue("");
          return;
        }
        if (toToken) {
          const { amount: nextToAmount } = getNextToAmount(
            chainId,
            fromAmount,
            fromTokenAddress,
            toTokenAddress,
            infoTokens,
            undefined,
            !isMarketOrder && triggerRatio,
            usdgSupply,
            totalTokenWeights,
            isSwap
          );

          const nextToValue = formatAmountFree(nextToAmount, toToken.decimals, toToken.decimals);
          setToValue(nextToValue);
        }
        return;
      }

      if (!toAmount) {
        setFromValue("");
        return;
      }
      if (fromToken) {
        const { amount: nextFromAmount } = getNextFromAmount(
          chainId,
          toAmount,
          fromTokenAddress,
          toTokenAddress,
          infoTokens,
          undefined,
          !isMarketOrder && triggerRatio,
          usdgSupply,
          totalTokenWeights,
          isSwap
        );
        const nextFromValue = formatAmountFree(nextFromAmount, fromToken.decimals, fromToken.decimals);
        setFromValue(nextFromValue);
      }
    };

    const updateLeverageAmounts = () => {
      if (!hasLeverageOption) {
        return;
      }
      if (anchorOnFromAmount) {
        if (!fromAmount) {
          setToValue("");
          return;
        }

        const toTokenInfo = getTokenInfo(infoTokens, toTokenAddress);
        if (toTokenInfo && toTokenInfo.maxPrice && fromUsdMin && fromUsdMin.gt(0)) {
          const leverageMultiplier = parseInt(leverageOption * BASIS_POINTS_DIVISOR);
          const toTokenPriceUsd =
            !isMarketOrder && triggerPriceUsd && triggerPriceUsd.gt(0) ? triggerPriceUsd : toTokenInfo.maxPrice;

          const { feeBasisPoints } = getNextToAmount(
            chainId,
            fromAmount,
            fromTokenAddress,
            collateralTokenAddress,
            infoTokens,
            undefined,
            undefined,
            usdgSupply,
            totalTokenWeights,
            isSwap
          );

          let fromUsdMinAfterFee = fromUsdMin;
          if (feeBasisPoints) {
            fromUsdMinAfterFee = fromUsdMin.mul(BASIS_POINTS_DIVISOR - feeBasisPoints).div(BASIS_POINTS_DIVISOR);
          }

          const toNumerator = fromUsdMinAfterFee.mul(leverageMultiplier).mul(BASIS_POINTS_DIVISOR);
          const toDenominator = bigNumberify(MARGIN_FEE_BASIS_POINTS)
            .mul(leverageMultiplier)
            .add(bigNumberify(BASIS_POINTS_DIVISOR).mul(BASIS_POINTS_DIVISOR));

          const nextToUsd = toNumerator.div(toDenominator);

          const nextToAmount = nextToUsd.mul(expandDecimals(1, toToken.decimals)).div(toTokenPriceUsd);

          const nextToValue = formatAmountFree(nextToAmount, toToken.decimals, toToken.decimals);

          setToValue(nextToValue);
        }
        return;
      }

      if (!toAmount) {
        setFromValue("");
        return;
      }

      const fromTokenInfo = getTokenInfo(infoTokens, fromTokenAddress);
      if (fromTokenInfo && fromTokenInfo.minPrice && toUsdMax && toUsdMax.gt(0)) {
        const leverageMultiplier = parseInt(leverageOption * BASIS_POINTS_DIVISOR);

        const baseFromAmountUsd = toUsdMax.mul(BASIS_POINTS_DIVISOR).div(leverageMultiplier);

        let fees = toUsdMax.mul(MARGIN_FEE_BASIS_POINTS).div(BASIS_POINTS_DIVISOR);

        const { feeBasisPoints } = getNextToAmount(
          chainId,
          fromAmount,
          fromTokenAddress,
          collateralTokenAddress,
          infoTokens,
          undefined,
          undefined,
          usdgSupply,
          totalTokenWeights,
          isSwap
        );

        if (feeBasisPoints) {
          const swapFees = baseFromAmountUsd.mul(feeBasisPoints).div(BASIS_POINTS_DIVISOR);
          fees = fees.add(swapFees);
        }

        const nextFromUsd = baseFromAmountUsd.add(fees);

        const nextFromAmount = nextFromUsd.mul(expandDecimals(1, fromToken.decimals)).div(fromTokenInfo.minPrice);

        const nextFromValue = formatAmountFree(nextFromAmount, fromToken.decimals, fromToken.decimals);

        setFromValue(nextFromValue);
      }
    };

    if (isSwap) {
      updateSwapAmounts();
    }

    if (isLong || isShort) {
      updateLeverageAmounts();
    }
  }, [
    anchorOnFromAmount,
    fromAmount,
    toAmount,
    fromToken,
    toToken,
    fromTokenAddress,
    toTokenAddress,
    infoTokens,
    isSwap,
    isLong,
    isShort,
    leverageOption,
    fromUsdMin,
    toUsdMax,
    isMarketOrder,
    triggerPriceUsd,
    triggerRatio,
    hasLeverageOption,
    usdgSupply,
    totalTokenWeights,
    chainId,
    collateralTokenAddress,
    indexTokenAddress,
  ]);

  let entryMarkPrice;
  let exitMarkPrice;
  if (toTokenInfo) {
    entryMarkPrice = swapOption === LONG ? toTokenInfo.maxPrice : toTokenInfo.minPrice;
    exitMarkPrice = swapOption === LONG ? toTokenInfo.minPrice : toTokenInfo.maxPrice;
  }

  let leverage = bigNumberify(0);
  if (fromUsdMin && toUsdMax && fromUsdMin.gt(0)) {
    const fees = toUsdMax.mul(MARGIN_FEE_BASIS_POINTS).div(BASIS_POINTS_DIVISOR);
    if (fromUsdMin.sub(fees).gt(0)) {
      leverage = toUsdMax.mul(BASIS_POINTS_DIVISOR).div(fromUsdMin.sub(fees));
    }
  }

  let nextAveragePrice = isMarketOrder ? entryMarkPrice : triggerPriceUsd;
  if (hasExistingPosition) {
    let nextDelta, nextHasProfit;

    if (isMarketOrder) {
      nextDelta = existingPosition.delta;
      nextHasProfit = existingPosition.hasProfit;
    } else {
      const data = calculatePositionDelta(triggerPriceUsd || bigNumberify(0), existingPosition);
      nextDelta = data.delta;
      nextHasProfit = data.hasProfit;
    }

    nextAveragePrice = getNextAveragePrice({
      size: existingPosition.size,
      sizeDelta: toUsdMax,
      hasProfit: nextHasProfit,
      delta: nextDelta,
      nextPrice: isMarketOrder ? entryMarkPrice : triggerPriceUsd,
      isLong,
    });
  }

  const liquidationPrice = getLiquidationPrice({
    isLong,
    size: hasExistingPosition ? existingPosition.size : bigNumberify(0),
    collateral: hasExistingPosition ? existingPosition.collateral : bigNumberify(0),
    averagePrice: nextAveragePrice,
    entryFundingRate: hasExistingPosition ? existingPosition.entryFundingRate : bigNumberify(0),
    cumulativeFundingRate: hasExistingPosition ? existingPosition.cumulativeFundingRate : bigNumberify(0),
    sizeDelta: toUsdMax,
    collateralDelta: fromUsdMin,
    increaseCollateral: true,
    increaseSize: true,
  });

  const existingLiquidationPrice = existingPosition ? getLiquidationPrice(existingPosition) : undefined;
  let displayLiquidationPrice = liquidationPrice ? liquidationPrice : existingLiquidationPrice;

  if (hasExistingPosition) {
    const collateralDelta = fromUsdMin ? fromUsdMin : bigNumberify(0);
    const sizeDelta = toUsdMax ? toUsdMax : bigNumberify(0);
    leverage = getLeverage({
      size: existingPosition.size,
      sizeDelta,
      collateral: existingPosition.collateral,
      collateralDelta,
      increaseCollateral: true,
      entryFundingRate: existingPosition.entryFundingRate,
      cumulativeFundingRate: existingPosition.cumulativeFundingRate,
      increaseSize: true,
      hasProfit: existingPosition.hasProfit,
      delta: existingPosition.delta,
      includeDelta: savedIsPnlInLeverage,
    });
  } else if (hasLeverageOption) {
    leverage = bigNumberify(parseInt(leverageOption * BASIS_POINTS_DIVISOR));
  }

  const getSwapError = () => {
    if (IS_NETWORK_DISABLED[chainId]) {
      return [t`Swaps disabled, pending ${getChainName(chainId)} upgrade`];
    }

    if (fromTokenAddress === toTokenAddress) {
      return [t`Select different tokens`];
    }

    if (!isMarketOrder) {
      if ((toToken.isStable || toToken.isUsdg) && (fromToken.isStable || fromToken.isUsdg)) {
        return [t`Select different tokens`];
      }

      if (fromToken.isNative && toToken.isWrapped) {
        return [t`Select different tokens`];
      }

      if (toToken.isNative && fromToken.isWrapped) {
        return [t`Select different tokens`];
      }
    }

    if (!fromAmount || fromAmount.eq(0)) {
      return [t`Enter an amount`];
    }
    if (!toAmount || toAmount.eq(0)) {
      return [t`Enter an amount`];
    }

    const fromTokenInfo = getTokenInfo(infoTokens, fromTokenAddress);
    if (!fromTokenInfo || !fromTokenInfo.minPrice) {
      return [t`Incorrect network`];
    }
    if (
      !savedShouldDisableValidationForTesting &&
      fromTokenInfo &&
      fromTokenInfo.balance &&
      fromAmount &&
      fromAmount.gt(fromTokenInfo.balance)
    ) {
      return [t`Insufficient ${fromTokenInfo.symbol} balance`];
    }

    const toTokenInfo = getTokenInfo(infoTokens, toTokenAddress);

    if (!isMarketOrder) {
      if (!triggerRatioValue || triggerRatio.eq(0)) {
        return [t`Enter a price`];
      }

      const currentRate = getExchangeRate(fromTokenInfo, toTokenInfo);
      if (currentRate && currentRate.lt(triggerRatio)) {
        return triggerRatioInverted ? [t`Price below Mark Price`] : [t`Price above Mark Price`];
      }
    }

    if (
      !isWrapOrUnwrap &&
      toToken &&
      toTokenAddress !== USDG_ADDRESS &&
      toTokenInfo &&
      toTokenInfo.availableAmount &&
      toAmount.gt(toTokenInfo.availableAmount)
    ) {
      return [t`Insufficient liquidity`];
    }
    if (
      !isWrapOrUnwrap &&
      toAmount &&
      toTokenInfo.bufferAmount &&
      toTokenInfo.poolAmount &&
      toTokenInfo.bufferAmount.gt(toTokenInfo.poolAmount.sub(toAmount))
    ) {
      return [t`Insufficient liquidity`];
    }

    if (
      fromUsdMin &&
      fromTokenInfo.maxUsdgAmount &&
      fromTokenInfo.maxUsdgAmount.gt(0) &&
      fromTokenInfo.usdgAmount &&
      fromTokenInfo.maxPrice
    ) {
      const usdgFromAmount = adjustForDecimals(fromUsdMin, USD_DECIMALS, USDG_DECIMALS);
      const nextUsdgAmount = fromTokenInfo.usdgAmount.add(usdgFromAmount);

      if (nextUsdgAmount.gt(fromTokenInfo.maxUsdgAmount)) {
        return [`${fromTokenInfo.symbol} pool exceeded`];
      }
    }

    return [false];
  };

  const getLeverageError = () => {
    if (IS_NETWORK_DISABLED[chainId]) {
      return [t`Leverage disabled, pending ${getChainName(chainId)} upgrade`];
    }
    // if (hasOutdatedUi) {
    //   return [t`Page outdated, please refresh`];
    // }

    if (!toAmount || toAmount.eq(0)) {
      return [t`Enter an amount`];
    }

    let toTokenInfo = getTokenInfo(infoTokens, toTokenAddress);
    if (toTokenInfo && toTokenInfo.isStable) {
      return [t`${swapOption === LONG ? "Longing" : "Shorting"} ${toTokenInfo.symbol} not supported`];
    }

    const fromTokenInfo = getTokenInfo(infoTokens, fromTokenAddress);
    if (
      !savedShouldDisableValidationForTesting &&
      fromTokenInfo &&
      fromTokenInfo.balance &&
      fromAmount &&
      fromAmount.gt(fromTokenInfo.balance)
    ) {
      return [t`Insufficient ${fromTokenInfo.symbol} balance`];
    }

    if (leverage && leverage.eq(0)) {
      return [t`Enter an amount`];
    }
    if (!isMarketOrder && (!triggerPriceValue || triggerPriceUsd.eq(0))) {
      return [t`Enter a price`];
    }

    if (!hasExistingPosition && fromUsdMin && fromUsdMin.lt(expandDecimals(10, USD_DECIMALS))) {
      return [t`Min order: 10 USD`];
    }

    if (leverage && leverage.lt(1.1 * BASIS_POINTS_DIVISOR)) {
      return [t`Min leverage: 1.1x`];
    }

    if (leverage && leverage.gt(50 * BASIS_POINTS_DIVISOR)) {
      return [t`Max leverage: 50x`];
    }

    if (!isMarketOrder && entryMarkPrice && triggerPriceUsd && !savedShouldDisableValidationForTesting) {
      if (isLong && entryMarkPrice.lt(triggerPriceUsd)) {
        return [t`Price above Mark Price`];
      }
      if (!isLong && entryMarkPrice.gt(triggerPriceUsd)) {
        return [t`Price below Mark Price`];
      }
    }

    if (isLong) {
      let requiredAmount = toAmount;
      if (fromTokenAddress !== toTokenAddress) {
        const { amount: swapAmount } = getNextToAmount(
          chainId,
          fromAmount,
          fromTokenAddress,
          toTokenAddress,
          infoTokens,
          undefined,
          undefined,
          usdgSupply,
          totalTokenWeights,
          isSwap
        );
        requiredAmount = requiredAmount.add(swapAmount);

        if (toToken && toTokenAddress !== USDG_ADDRESS) {
          if (!toTokenInfo.availableAmount) {
            return [t`Liquidity data not loaded`];
          }
          if (toTokenInfo.availableAmount && requiredAmount.gt(toTokenInfo.availableAmount)) {
            return [t`Insufficient liquidity`];
          }
        }

        if (
          toTokenInfo.poolAmount &&
          toTokenInfo.bufferAmount &&
          toTokenInfo.bufferAmount.gt(toTokenInfo.poolAmount.sub(swapAmount))
        ) {
          return [t`Insufficient liquidity`, true, "BUFFER"];
        }

        if (
          fromUsdMin &&
          fromTokenInfo.maxUsdgAmount &&
          fromTokenInfo.maxUsdgAmount.gt(0) &&
          fromTokenInfo.minPrice &&
          fromTokenInfo.usdgAmount
        ) {
          const usdgFromAmount = adjustForDecimals(fromUsdMin, USD_DECIMALS, USDG_DECIMALS);
          const nextUsdgAmount = fromTokenInfo.usdgAmount.add(usdgFromAmount);
          if (nextUsdgAmount.gt(fromTokenInfo.maxUsdgAmount)) {
            return [t`${fromTokenInfo.symbol} pool exceeded, try different token`, true, "MAX_USDG"];
          }
        }
      }

      if (toTokenInfo && toTokenInfo.maxPrice) {
        const sizeUsd = toAmount.mul(toTokenInfo.maxPrice).div(expandDecimals(1, toTokenInfo.decimals));
        if (
          toTokenInfo.maxGlobalLongSize &&
          toTokenInfo.maxGlobalLongSize.gt(0) &&
          toTokenInfo.maxAvailableLong &&
          sizeUsd.gt(toTokenInfo.maxAvailableLong)
        ) {
          return [t`Max ${toTokenInfo.symbol} long exceeded`];
        }
      }
    }

    if (isShort) {
      let stableTokenAmount = bigNumberify(0);
      if (fromTokenAddress !== shortCollateralAddress && fromAmount && fromAmount.gt(0)) {
        const { amount: nextToAmount } = getNextToAmount(
          chainId,
          fromAmount,
          fromTokenAddress,
          shortCollateralAddress,
          infoTokens,
          undefined,
          undefined,
          usdgSupply,
          totalTokenWeights,
          isSwap
        );
        stableTokenAmount = nextToAmount;
        if (stableTokenAmount.gt(shortCollateralToken.availableAmount)) {
          return [t`Insufficient liquidity, change "Profits In"`];
        }

        if (
          shortCollateralToken.bufferAmount &&
          shortCollateralToken.poolAmount &&
          shortCollateralToken.bufferAmount.gt(shortCollateralToken.poolAmount.sub(stableTokenAmount))
        ) {
          // suggest swapping to collateralToken
          return [t`Insufficient liquidity, change "Profits In"`, true, "BUFFER"];
        }

        if (
          fromTokenInfo.maxUsdgAmount &&
          fromTokenInfo.maxUsdgAmount.gt(0) &&
          fromTokenInfo.minPrice &&
          fromTokenInfo.usdgAmount
        ) {
          const usdgFromAmount = adjustForDecimals(fromUsdMin, USD_DECIMALS, USDG_DECIMALS);
          const nextUsdgAmount = fromTokenInfo.usdgAmount.add(usdgFromAmount);
          if (nextUsdgAmount.gt(fromTokenInfo.maxUsdgAmount)) {
            return [t`${fromTokenInfo.symbol} pool exceeded, try different token`, true, "MAX_USDG"];
          }
        }
      }
      if (
        !shortCollateralToken ||
        !fromTokenInfo ||
        !toTokenInfo ||
        !toTokenInfo.maxPrice ||
        !shortCollateralToken.availableAmount
      ) {
        return [t`Fetching token info...`];
      }

      const sizeUsd = toAmount.mul(toTokenInfo.maxPrice).div(expandDecimals(1, toTokenInfo.decimals));
      const sizeTokens = sizeUsd
        .mul(expandDecimals(1, shortCollateralToken.decimals))
        .div(shortCollateralToken.minPrice);

      if (!toTokenInfo.maxAvailableShort) {
        return [t`Liquidity data not loaded`];
      }

      if (
        toTokenInfo.maxGlobalShortSize &&
        toTokenInfo.maxGlobalShortSize.gt(0) &&
        toTokenInfo.maxAvailableShort &&
        sizeUsd.gt(toTokenInfo.maxAvailableShort)
      ) {
        return [t`Max ${toTokenInfo.symbol} short exceeded`];
      }

      stableTokenAmount = stableTokenAmount.add(sizeTokens);
      if (stableTokenAmount.gt(shortCollateralToken.availableAmount)) {
        return [t`Insufficient liquidity, change "Profits In"`];
      }
    }

    return [false];
  };

  const getToLabel = () => {
    if (isSwap) {
      return t`Receive`;
    }
    if (isLong) {
      return t`Long`;
    }
    return t`Short`;
  };

  const getError = () => {
    if (isSwap) {
      return getSwapError();
    }
    return getLeverageError();
  };

  const renderOrdersToa = () => {
    if (!ordersToaOpen) {
      return null;
    }

    return (
      <OrdersToa
        setIsVisible={setOrdersToaOpen}
        approveOrderBook={approveOrderBook}
        isPluginApproving={isPluginApproving}
      />
    );
  };

  const isPrimaryEnabled = () => {
    if (IS_NETWORK_DISABLED[chainId]) {
      return false;
    }
    if (isStopOrder) {
      return true;
    }
    if (!active) {
      return true;
    }
    const [error, modal] = getError();
    if (error && !modal) {
      return false;
    }
    if (needOrderBookApproval && isWaitingForPluginApproval) {
      return false;
    }
    if ((needApproval && isWaitingForApproval) || isApproving) {
      return false;
    }
    if (needPositionRouterApproval && isWaitingForPositionRouterApproval) {
      return false;
    }
    if (isPositionRouterApproving) {
      return false;
    }
    if (isApproving) {
      return false;
    }
    if (isSubmitting) {
      return false;
    }

    return true;
  };

  const getPrimaryText = () => {
    if (isStopOrder) {
      return t`Open a position`;
    }
    if (!active) {
      return t`Connect Wallet`;
    }
    if (!isSupportedChain(chainId)) {
      return t`Incorrect Network`;
    }
    const [error, modal] = getError();
    if (error && !modal) {
      return error;
    }

    if (needPositionRouterApproval && isWaitingForPositionRouterApproval) {
      return t`Enabling Leverage...`;
    }
    if (isPositionRouterApproving) {
      return t`Enabling Leverage...`;
    }
    if (needPositionRouterApproval) {
      return t`Enable Leverage`;
    }

    if (needApproval && isWaitingForApproval) {
      return t`Waiting for Approval`;
    }
    if (isApproving) {
      return t`Approving ${fromToken.symbol}...`;
    }
    if (needApproval) {
      return t`Approve ${fromToken.symbol}`;
    }

    if (needOrderBookApproval && isWaitingForPluginApproval) {
      return t`Enabling Orders...`;
    }
    if (isPluginApproving) {
      return t`Enabling Orders...`;
    }
    if (needOrderBookApproval) {
      return t`Enable Orders`;
    }

    if (!isMarketOrder) return `Create ${orderOption.charAt(0) + orderOption.substring(1).toLowerCase()} Order`;

    if (isSwap) {
      if (toUsdMax && toUsdMax.lt(fromUsdMin.mul(95).div(100))) {
        return t`High Slippage, Swap Anyway`;
      }
      return "Swap";
    }

    if (isLong) {
      const indexTokenInfo = getTokenInfo(infoTokens, toTokenAddress);
      if (indexTokenInfo && indexTokenInfo.minPrice) {
        const { amount: nextToAmount } = getNextToAmount(
          chainId,
          fromAmount,
          fromTokenAddress,
          indexTokenAddress,
          infoTokens,
          undefined,
          undefined,
          usdgSupply,
          totalTokenWeights,
          isSwap
        );
        const nextToAmountUsd = nextToAmount
          .mul(indexTokenInfo.minPrice)
          .div(expandDecimals(1, indexTokenInfo.decimals));
        if (fromTokenAddress === USDG_ADDRESS && nextToAmountUsd.lt(fromUsdMin.mul(98).div(100))) {
          return t`High USDG Slippage, Long Anyway`;
        }
      }
      return t`Long ${toToken.symbol}`;
    }

    return t`Short ${toToken.symbol}`;
  };

  const onSelectFromToken = (token) => {
    setFromTokenAddress(swapOption, token.address);
    setIsWaitingForApproval(false);

    if (isShort && token.isStable) {
      setShortCollateralAddress(token.address);
    }
  };

  const onSelectShortCollateralAddress = (token) => {
    setShortCollateralAddress(token.address);
  };

  const onSelectToToken = (token) => {
    setToTokenAddress(swapOption, token.address);
  };

  const onFromValueChange = (e) => {
    setAnchorOnFromAmount(true);
    setFromValue(e.target.value);
  };

  const onToValueChange = (e) => {
    setAnchorOnFromAmount(false);
    setToValue(e.target.value);
  };

  const switchTokens = () => {
    if (fromAmount && toAmount) {
      if (anchorOnFromAmount) {
        setToValue(formatAmountFree(fromAmount, fromToken.decimals, 8));
      } else {
        setFromValue(formatAmountFree(toAmount, toToken.decimals, 8));
      }
      setAnchorOnFromAmount(!anchorOnFromAmount);
    }
    setIsWaitingForApproval(false);

    const updatedTokenSelection = JSON.parse(JSON.stringify(tokenSelection));
    updatedTokenSelection[swapOption] = {
      from: toTokenAddress,
      to: fromTokenAddress,
    };
    setTokenSelection(updatedTokenSelection);
  };

  const wrap = async () => {
    setIsSubmitting(true);

    const contract = new ethers.Contract(nativeTokenAddress, WETH.abi, library.getSigner());
    callContract(chainId, contract, "deposit", {
      value: fromAmount,
      sentMsg: "Swap submitted.",
      successMsg: `Swapped ${formatAmount(fromAmount, fromToken.decimals, 4, true)} ${
        fromToken.symbol
      } for ${formatAmount(toAmount, toToken.decimals, 4, true)} ${toToken.symbol}!`,
      failMsg: "Swap failed.",
      setPendingTxns,
    })
      .then(async (res) => {})
      .finally(() => {
        setIsSubmitting(false);
      });
  };

  const unwrap = async () => {
    setIsSubmitting(true);

    const contract = new ethers.Contract(nativeTokenAddress, WETH.abi, library.getSigner());
    callContract(chainId, contract, "withdraw", [fromAmount], {
      sentMsg: t`Swap submitted!`,
      failMsg: t`Swap failed.`,
      successMsg: `Swapped ${formatAmount(fromAmount, fromToken.decimals, 4, true)} ${
        fromToken.symbol
      } for ${formatAmount(toAmount, toToken.decimals, 4, true)} ${toToken.symbol}!`,
      setPendingTxns,
    })
      .then(async (res) => {})
      .finally(() => {
        setIsSubmitting(false);
      });
  };

  const swap = async () => {
    if (fromToken.isNative && toToken.isWrapped) {
      wrap();
      return;
    }

    if (fromTokenAddress.isWrapped && toToken.isNative) {
      unwrap();
      return;
    }

    setIsSubmitting(true);
    let path = [fromTokenAddress, toTokenAddress];
    if (anchorOnFromAmount) {
      const { path: multiPath } = getNextToAmount(
        chainId,
        fromAmount,
        fromTokenAddress,
        toTokenAddress,
        infoTokens,
        undefined,
        undefined,
        usdgSupply,
        totalTokenWeights,
        isSwap
      );
      if (multiPath) {
        path = multiPath;
      }
    } else {
      const { path: multiPath } = getNextFromAmount(
        chainId,
        toAmount,
        fromTokenAddress,
        toTokenAddress,
        infoTokens,
        undefined,
        undefined,
        usdgSupply,
        totalTokenWeights,
        isSwap
      );
      if (multiPath) {
        path = multiPath;
      }
    }

    let method;
    let contract;
    let value;
    let params;
    let minOut;
    if (shouldRaiseGasError(getTokenInfo(infoTokens, fromTokenAddress), fromAmount)) {
      setIsSubmitting(false);
      setIsPendingConfirmation(true);
      helperToast.error(
        `Leave at least ${formatAmount(DUST_BNB, 18, 3)} ${getConstant(chainId, "nativeTokenSymbol")} for gas`
      );
      return;
    }

    if (!isMarketOrder) {
      minOut = toAmount;
      Api.createSwapOrder(chainId, library, path, fromAmount, minOut, triggerRatio, nativeTokenAddress, {
        sentMsg: t`Swap Order submitted!`,
        successMsg: t`Swap Order created!`,
        failMsg: t`Swap Order creation failed.`,
        pendingTxns,
        setPendingTxns,
      })
        .then(() => {
          setIsConfirming(false);
        })
        .finally(() => {
          setIsSubmitting(false);
          setIsPendingConfirmation(false);
        });
      return;
    }

    path = replaceNativeTokenAddress(path, nativeTokenAddress);
    method = "swap";
    value = bigNumberify(0);
    if (toTokenAddress === AddressZero) {
      method = "swapTokensToETH";
    }

    minOut = toAmount.mul(BASIS_POINTS_DIVISOR - allowedSlippage).div(BASIS_POINTS_DIVISOR);
    params = [path, fromAmount, minOut, account];
    if (fromTokenAddress === AddressZero) {
      method = "swapETHToTokens";
      value = fromAmount;
      params = [path, minOut, account];
    }
    contract = new ethers.Contract(routerAddress, Router.abi, library.getSigner());

    callContract(chainId, contract, method, params, {
      value,
      sentMsg: `Swap ${!isMarketOrder ? " order " : ""} submitted!`,
      successMsg: `Swapped ${formatAmount(fromAmount, fromToken.decimals, 4, true)} ${
        fromToken.symbol
      } for ${formatAmount(toAmount, toToken.decimals, 4, true)} ${toToken.symbol}!`,
      failMsg: t`Swap failed.`,
      setPendingTxns,
    })
      .then(async () => {
        setIsConfirming(false);
      })
      .finally(() => {
        setIsSubmitting(false);
        setIsPendingConfirmation(false);
      });
  };

  const createIncreaseOrder = () => {
    let path = [fromTokenAddress];

    if (path[0] === USDG_ADDRESS) {
      if (isLong) {
        const stableToken = getMostAbundantStableToken(chainId, infoTokens);
        path.push(stableToken.address);
      } else {
        path.push(shortCollateralAddress);
      }
    }

    const minOut = 0;
    const indexToken = getToken(chainId, indexTokenAddress);
    const successMsg = t`
      Created limit order for ${indexToken.symbol} ${isLong ? "Long" : "Short"}: ${formatAmount(
      toUsdMax,
      USD_DECIMALS,
      2
    )} USD!
    `;
    return Api.createIncreaseOrder(
      chainId,
      library,
      nativeTokenAddress,
      path,
      fromAmount,
      indexTokenAddress,
      minOut,
      toUsdMax,
      collateralTokenAddress,
      isLong,
      triggerPriceUsd,
      {
        pendingTxns,
        setPendingTxns,
        sentMsg: t`Limit order submitted!`,
        successMsg,
        failMsg: t`Limit order creation failed.`,
      }
    )
      .then(() => {
        setIsConfirming(false);
      })
      .finally(() => {
        setIsSubmitting(false);
        setIsPendingConfirmation(false);
      });
  };

  let referralCode = ethers.constants.HashZero;
  if (!attachedOnChain && userReferralCode) {
    referralCode = userReferralCode;
  }

  const increasePosition = async () => {
    setIsSubmitting(true);
    const tokenAddress0 = fromTokenAddress === AddressZero ? nativeTokenAddress : fromTokenAddress;
    const indexTokenAddress = toTokenAddress === AddressZero ? nativeTokenAddress : toTokenAddress;
    let path = [indexTokenAddress]; // assume long
    if (toTokenAddress !== fromTokenAddress) {
      path = [tokenAddress0, indexTokenAddress];
    }

    if (fromTokenAddress === AddressZero && toTokenAddress === nativeTokenAddress) {
      path = [nativeTokenAddress];
    }

    if (fromTokenAddress === nativeTokenAddress && toTokenAddress === AddressZero) {
      path = [nativeTokenAddress];
    }

    if (isShort) {
      path = [shortCollateralAddress];
      if (tokenAddress0 !== shortCollateralAddress) {
        path = [tokenAddress0, shortCollateralAddress];
      }
    }

    const refPrice = isLong ? toTokenInfo.maxPrice : toTokenInfo.minPrice;
    const priceBasisPoints = isLong ? BASIS_POINTS_DIVISOR + allowedSlippage : BASIS_POINTS_DIVISOR - allowedSlippage;
    const priceLimit = refPrice.mul(priceBasisPoints).div(BASIS_POINTS_DIVISOR);

    const boundedFromAmount = fromAmount ? fromAmount : bigNumberify(0);

    if (fromAmount && fromAmount.gt(0) && fromTokenAddress === USDG_ADDRESS && isLong) {
      const { amount: nextToAmount, path: multiPath } = getNextToAmount(
        chainId,
        fromAmount,
        fromTokenAddress,
        indexTokenAddress,
        infoTokens,
        undefined,
        undefined,
        usdgSupply,
        totalTokenWeights,
        isSwap
      );
      if (nextToAmount.eq(0)) {
        helperToast.error(t`Insufficient liquidity`);
        return;
      }
      if (multiPath) {
        path = replaceNativeTokenAddress(multiPath);
      }
    }

    let params = [
      path, // _path
      indexTokenAddress, // _indexToken
      boundedFromAmount, // _amountIn
      0, // _minOut
      toUsdMax, // _sizeDelta
      isLong, // _isLong
      priceLimit, // _acceptablePrice
      minExecutionFee, // _executionFee
      referralCode, // _referralCode
      AddressZero, // callback
    ];

    let method = "createIncreasePosition";
    let value = minExecutionFee;
    if (fromTokenAddress === AddressZero) {
      method = "createIncreasePositionETH";
      value = boundedFromAmount.add(minExecutionFee);
      params = [
        path, // _path
        indexTokenAddress, // _indexToken
        0, // _minOut
        toUsdMax, // _sizeDelta
        isLong, // _isLong
        priceLimit, // _acceptablePrice
        minExecutionFee, // _executionFee
        referralCode, // _referralCode
        AddressZero, // callback
      ];
    }

    if (shouldRaiseGasError(getTokenInfo(infoTokens, fromTokenAddress), fromAmount)) {
      setIsSubmitting(false);
      setIsPendingConfirmation(false);
      helperToast.error(
        t`Leave at least ${formatAmount(DUST_BNB, 18, 3)} ${getConstant(chainId, "nativeTokenSymbol")} for gas`
      );
      return;
    }

    const contractAddress = getContract(chainId, "PositionRouter");
    const contract = new ethers.Contract(contractAddress, PositionRouter.abi, library.getSigner());
    const indexToken = getTokenInfo(infoTokens, indexTokenAddress);
    const tokenSymbol = indexToken.isWrapped ? getConstant(chainId, "nativeTokenSymbol") : indexToken.symbol;
    const successMsg = t`Requested increase of ${tokenSymbol} ${isLong ? "Long" : "Short"} by ${formatAmount(
      toUsdMax,
      USD_DECIMALS,
      2
    )} USD.`;

    callContract(chainId, contract, method, params, {
      value,
      setPendingTxns,
      sentMsg: `${isLong ? "Long" : "Short"} submitted.`,
      failMsg: `${isLong ? "Long" : "Short"} failed.`,
      successMsg,
      // for Arbitrum, sometimes the successMsg shows after the position has already been executed
      // hide the success message for Arbitrum as a workaround
      hideSuccessMsg: false,
    })
      .then(async () => {
        setIsConfirming(false);

        const key = getPositionKey(account, path[path.length - 1], indexTokenAddress, isLong);
        let nextSize = toUsdMax;
        if (hasExistingPosition) {
          nextSize = existingPosition.size.add(toUsdMax);
        }

        pendingPositions[key] = {
          updatedAt: Date.now(),
          pendingChanges: {
            size: nextSize,
          },
        };

        setPendingPositions({ ...pendingPositions });
      })
      .finally(() => {
        setIsSubmitting(false);
        setIsPendingConfirmation(false);
      });
  };

  const onSwapOptionChange = (opt) => {
    setSwapOption(opt);
    if (orderOption === STOP) {
      setOrderOption(MARKET);
    }
    setAnchorOnFromAmount(true);
    setFromValue("");
    setToValue("");
    setTriggerPriceValue("");
    setTriggerRatioValue("");

    if (opt === SHORT && infoTokens) {
      const fromToken = getToken(chainId, tokenSelection[opt].from);
      if (fromToken && fromToken.isStable) {
        setShortCollateralAddress(fromToken.address);
      } else {
        const stableToken = getMostAbundantStableToken(chainId, infoTokens);
        setShortCollateralAddress(stableToken.address);
      }
    }
  };

  const onConfirmationClick = () => {
    if (!active) {
      props.connectWallet();
      return;
    }

    if (needOrderBookApproval) {
      approveOrderBook();
      return;
    }

    setIsPendingConfirmation(true);

    if (isSwap) {
      swap();
      return;
    }

    if (orderOption === LIMIT) {
      createIncreaseOrder();
      return;
    }

    increasePosition();
  };

  function approveFromToken() {
    approveTokens({
      setIsApproving,
      library,
      tokenAddress: fromToken.address,
      spender: routerAddress,
      chainId: chainId,
      onApproveSubmitted: () => {
        setIsWaitingForApproval(true);
      },
      infoTokens,
      getTokenInfo,
      pendingTxns,
      setPendingTxns,
    });
  }

  const onClickPrimary = () => {
    if (isStopOrder) {
      setOrderOption(MARKET);
      return;
    }

    if (!active) {
      props.connectWallet();
      return;
    }

    if (needPositionRouterApproval) {
      approvePositionRouter({
        sentMsg: t`Enable leverage sent.`,
        failMsg: t`Enable leverage failed.`,
      });
      return;
    }

    if (needApproval) {
      approveFromToken();
      return;
    }

    if (needOrderBookApproval) {
      setOrdersToaOpen(true);
      return;
    }

    const [, modal, errorCode] = getError();

    if (modal) {
      setModalError(errorCode);
      return;
    }

    if (isSwap) {
      if (fromTokenAddress === AddressZero && toTokenAddress === nativeTokenAddress) {
        wrap();
        return;
      }

      if (fromTokenAddress === nativeTokenAddress && toTokenAddress === AddressZero) {
        unwrap();
        return;
      }
    }

    setIsConfirming(true);
    setIsHigherSlippageAllowed(false);
  };

  const isStopOrder = orderOption === STOP;
  const showFromAndToSection = !isStopOrder;
  const showTriggerPriceSection = !isSwap && !isMarketOrder && !isStopOrder;
  const showTriggerRatioSection = isSwap && !isMarketOrder && !isStopOrder;

  let fees;
  let feesUsd;
  let feeBps;
  let swapFees;
  let positionFee;
  if (isSwap) {
    if (fromAmount) {
      const { feeBasisPoints } = getNextToAmount(
        chainId,
        fromAmount,
        fromTokenAddress,
        toTokenAddress,
        infoTokens,
        undefined,
        undefined,
        usdgSupply,
        totalTokenWeights,
        isSwap
      );
      if (feeBasisPoints !== undefined) {
        fees = fromAmount.mul(feeBasisPoints).div(BASIS_POINTS_DIVISOR);
        const feeTokenPrice =
          fromTokenInfo.address === USDG_ADDRESS ? expandDecimals(1, USD_DECIMALS) : fromTokenInfo.maxPrice;
        feesUsd = fees.mul(feeTokenPrice).div(expandDecimals(1, fromTokenInfo.decimals));
      }
      feeBps = feeBasisPoints;
    }
  } else if (toUsdMax) {
    positionFee = toUsdMax.mul(MARGIN_FEE_BASIS_POINTS).div(BASIS_POINTS_DIVISOR);
    feesUsd = positionFee;

    const { feeBasisPoints } = getNextToAmount(
      chainId,
      fromAmount,
      fromTokenAddress,
      collateralTokenAddress,
      infoTokens,
      undefined,
      undefined,
      usdgSupply,
      totalTokenWeights,
      isSwap
    );
    if (feeBasisPoints) {
      swapFees = fromUsdMin.mul(feeBasisPoints).div(BASIS_POINTS_DIVISOR);
      feesUsd = feesUsd.add(swapFees);
    }
    feeBps = feeBasisPoints;
  }

  const leverageMarks = {
    1.1: "1.1x",
    10: "10x",
    20: "20x",
    30: "30x",
    40: "40x",
    50: "50x",
  };

  if (!fromToken || !toToken) {
    return null;
  }

  let hasZeroBorrowFee = false;
  let borrowFeeText;
  if (isLong && toTokenInfo && toTokenInfo.fundingRate) {
    borrowFeeText = formatAmount(toTokenInfo.fundingRate, 4, 4) + "% / 1h";
    if (toTokenInfo.fundingRate.eq(0)) {
      // hasZeroBorrowFee = true
    }
  }
  if (isShort && shortCollateralToken && shortCollateralToken.fundingRate) {
    borrowFeeText = formatAmount(shortCollateralToken.fundingRate, 4, 4) + "% / 1h";
    if (shortCollateralToken.fundingRate.eq(0)) {
      // hasZeroBorrowFee = true
    }
  }

  function setFromValueToMaximumAvailable() {
    if (!fromToken || !fromBalance) {
      return;
    }

    const maxAvailableAmount = fromToken.isNative ? fromBalance.sub(bigNumberify(DUST_BNB).mul(2)) : fromBalance;
    setFromValue(formatAmountFree(maxAvailableAmount, fromToken.decimals, fromToken.decimals));
    setAnchorOnFromAmount(true);
  }

  function shouldShowMaxButton() {
    if (!fromToken || !fromBalance) {
      return false;
    }
    const maxAvailableAmount = fromToken.isNative ? fromBalance.sub(bigNumberify(DUST_BNB).mul(2)) : fromBalance;
    return fromValue !== formatAmountFree(maxAvailableAmount, fromToken.decimals, fromToken.decimals);
  }

  return (
    <div className="grid w-full grid-cols-1">
      {active ? (
        <Disclosure>
          {({ open }) => (
            <div className="hidden w-full md:block">
              <div className="flex h-10 w-full items-center justify-between border-b border-slate-800 px-4">
                <span className="flex flex-row items-center text-sm font-medium lg:text-xs">
                  <img src={toToken.imageUrl} className="mr-1 w-5" alt="Icon" />
                  {toToken.symbol}-USD
                </span>
                <div className="pointer-events-auto flex items-center justify-center gap-1">
                  <Disclosure.Button>
                    <FaAngleDown className={`${open ? "rotate-180 transform" : ""}text-slate-200`} />
                  </Disclosure.Button>
                </div>
              </div>
              <Disclosure.Panel className="grid w-full grid-cols-1 divide-y divide-slate-800 overflow-auto font-medium duration-300">
                {toTokens.map((token) => {
                  const tokenInfo = getTokenInfo(infoTokens, token.address);
                  return (
                    <button
                      key={token.name + token.address}
                      type="button"
                      className="flex flex-row items-center justify-between px-4 py-1 text-xs font-medium"
                      onClick={() => onSelectToToken(token)}
                    >
                      <span className="flex flex-row items-center gap-1">
                        <img src={token.imageUrl} className="mr-1 w-5" alt="Icon" />
                        {token.name}
                        <span className="rounded-sm bg-slate-950 px-1 text-[10px]">{token.symbol}</span>
                      </span>
                      <div className="flex flex-col items-end text-end">
                        <div className="text-[10px] text-green-500">
                          ${tokenInfo.maxPrice && formatAmount(tokenInfo.maxPrice, USD_DECIMALS, 2, true)}
                        </div>
                        <span className="text-[8px] text-red-500">
                          ${tokenInfo.minPrice && formatAmount(tokenInfo.minPrice, USD_DECIMALS, 2, true)}
                        </span>
                      </div>
                    </button>
                  );
                })}
              </Disclosure.Panel>
            </div>
          )}
        </Disclosure>
      ) : (
        <div className="mb-[5px] flex w-full flex-col items-center justify-center gap-3 py-7">
          <div className="text-xs font-medium text-slate-600 2xl:text-sm">Connect your wallet to start trading</div>
        </div>
      )}
      <div className="flex h-max w-full flex-col duration-500 lg:h-full">
        <div className="relative rounded px-4 text-sm">
          <div className="mb-5">
            <SwapTab
              icons={SWAP_ICONS}
              options={SWAP_OPTIONS}
              option={swapOption}
              onChange={onSwapOptionChange}
              className="mb-[10.5px]"
            />
            {flagOrdersEnabled && (
              <div className="flex w-full items-center justify-between border-b-2 border-slate-800 pt-4">
                <Tab
                  options={orderOptions}
                  optionLabels={orderOptionLabels}
                  className="m-0"
                  type="inline"
                  option={orderOption}
                  onChange={onOrderOptionChange}
                />
              </div>
            )}
          </div>
          {showFromAndToSection && (
            <React.Fragment>
              <div className="mb-2 rounded bg-slate-800 p-4 text-xs font-medium">
                <div className="grid grid-cols-2 pb-4 text-xs">
                  <div className="text-slate-300">
                    {fromUsdMin && (
                      <div className="Exchange-swap-usd text-xs font-medium">
                        Pay: {formatAmount(fromUsdMin, USD_DECIMALS, 2, true)} USD
                      </div>
                    )}
                    {!fromUsdMin && "Pay"}
                  </div>
                  {fromBalance && (
                    <div
                      className="flex cursor-pointer justify-end text-right text-slate-600"
                      onClick={setFromValueToMaximumAvailable}
                    >
                      Balance: {formatAmount(fromBalance, fromToken.decimals, 4, true)}
                    </div>
                  )}
                </div>
                <div className="grid grid-cols-[1fr_auto]">
                  <div className="relative overflow-hidden">
                    <input
                      type="number"
                      min="0"
                      placeholder="0.0"
                      className="text-md w-full overflow-hidden text-ellipsis whitespace-nowrap border-none bg-transparent p-0 pr-5 text-slate-200 placeholder-slate-400 ring-offset-0 focus:outline-none focus:ring-0"
                      value={fromValue}
                      onChange={onFromValueChange}
                    />
                    {shouldShowMaxButton() && (
                      <div
                        className="absolute right-[12.5px] top-0 cursor-pointer rounded bg-slate-700 py-1 px-2 text-xs font-medium hover:bg-indigo-500"
                        onClick={setFromValueToMaximumAvailable}
                      >
                        MAX
                      </div>
                    )}
                  </div>
                  <div>
                    <TokenSelector
                      label="Pay"
                      chainId={chainId}
                      tokenAddress={fromTokenAddress}
                      onSelectToken={onSelectFromToken}
                      tokens={fromTokens}
                      infoTokens={infoTokens}
                      showMintingCap={false}
                      showTokenImgInDropdown={true}
                      className="!text-sm"
                    />
                  </div>
                </div>
              </div>
              <div className="relative z-10">
                <div
                  className="absolute left-1/2 -top-[19.375px] -ml-[17.825px] flex h-[25.65px] w-[25.65px] cursor-pointer items-center justify-center rounded-full bg-indigo-500 hover:bg-indigo-600"
                  onClick={switchTokens}
                >
                  <IoMdSwap className="block rotate-90 text-center text-[15px]" />
                </div>
              </div>
              <div className="mb-2 rounded bg-slate-800 p-4 text-xs font-medium">
                <div className="grid grid-cols-2 pb-4 text-xs">
                  <div className="text-slate-300">
                    {toUsdMax && (
                      <div className="Exchange-swap-usd text-xs">
                        {getToLabel()}: {formatAmount(toUsdMax, USD_DECIMALS, 2, true)} USD
                      </div>
                    )}
                    {!toUsdMax && getToLabel()}
                  </div>
                  {toBalance && isSwap && (
                    <div className="flex justify-end text-right text-slate-600">
                      <Trans>Balance</Trans>: {formatAmount(toBalance, toToken.decimals, 4, true)}
                    </div>
                  )}
                  {(isLong || isShort) && hasLeverageOption && (
                    <div className="flex justify-end text-right text-slate-600">
                      <Trans>Leverage</Trans>: {parseFloat(leverageOption).toFixed(2)}x
                    </div>
                  )}
                </div>
                <div className="grid grid-cols-[1fr_auto]">
                  <div>
                    <input
                      type="number"
                      min="0"
                      placeholder="0.0"
                      className="text-md w-full overflow-hidden text-ellipsis whitespace-nowrap border-none bg-transparent p-0 pr-5 text-slate-200 placeholder-slate-400 ring-offset-0 focus:outline-none focus:ring-0"
                      value={toValue}
                      onChange={onToValueChange}
                    />
                  </div>
                  <div>
                    <TokenSelector
                      label={getTokenLabel()}
                      chainId={chainId}
                      tokenAddress={toTokenAddress}
                      onSelectToken={onSelectToToken}
                      tokens={toTokens}
                      infoTokens={infoTokens}
                      showTokenImgInDropdown={true}
                      className="!text-sm"
                    />
                  </div>
                </div>
              </div>
            </React.Fragment>
          )}
          {showTriggerRatioSection && (
            <div className="mb-2 rounded bg-slate-800 p-4 text-xs font-medium">
              <div className="grid grid-cols-2 pb-[12.5px] text-[14px]">
                <div className="text-slate-300">
                  <Trans>Price</Trans>
                </div>
                {fromTokenInfo && toTokenInfo && (
                  <div
                    className="flex cursor-pointer justify-end text-right text-slate-600"
                    onClick={() => {
                      setTriggerRatioValue(
                        formatAmountFree(
                          getExchangeRate(fromTokenInfo, toTokenInfo, triggerRatioInverted),
                          USD_DECIMALS,
                          10
                        )
                      );
                    }}
                  >
                    {formatAmount(getExchangeRate(fromTokenInfo, toTokenInfo, triggerRatioInverted), USD_DECIMALS, 4)}
                  </div>
                )}
              </div>
              <div className="grid grid-cols-[1fr_auto]">
                <div className="relative overflow-hidden">
                  <input
                    type="number"
                    min="0"
                    placeholder="0.0"
                    className="text-md small w-full overflow-hidden text-ellipsis whitespace-nowrap border-none bg-transparent p-0 pr-5 text-slate-300 placeholder-slate-400 ring-offset-0 focus:outline-none focus:ring-0"
                    value={triggerRatioValue}
                    onChange={onTriggerRatioChange}
                  />
                </div>
                {(() => {
                  if (!toTokenInfo) return;
                  if (!fromTokenInfo) return;
                  const [tokenA, tokenB] = triggerRatioInverted
                    ? [toTokenInfo, fromTokenInfo]
                    : [fromTokenInfo, toTokenInfo];
                  return (
                    <div className="pr-4 text-right text-sm font-medium text-slate-300">
                      {tokenA.symbol}&nbsp;per&nbsp;{tokenB.symbol}
                    </div>
                  );
                })()}
              </div>
            </div>
          )}
          {showTriggerPriceSection && (
            <div className="mb-2 rounded bg-slate-800 p-4 text-xs font-medium">
              <div className="grid grid-cols-2 pb-[12.5px] text-[14px]">
                <div className="text-slate-300">
                  <Trans>Price</Trans>
                </div>
                <div
                  className="flex cursor-pointer justify-end text-right text-slate-600"
                  onClick={() => {
                    setTriggerPriceValue(formatAmountFree(entryMarkPrice, USD_DECIMALS, 2));
                  }}
                >
                  Mark: {formatAmount(entryMarkPrice, USD_DECIMALS, 2, true)}
                </div>
              </div>
              <div className="grid grid-cols-[1fr_auto]">
                <div className="relative overflow-hidden">
                  <input
                    type="number"
                    min="0"
                    placeholder="0.0"
                    className="text-md w-full overflow-hidden text-ellipsis whitespace-nowrap border-none bg-transparent p-0 pr-5 text-slate-300 placeholder-slate-400 ring-offset-0 focus:outline-none focus:ring-0"
                    value={triggerPriceValue}
                    onChange={onTriggerPriceChange}
                  />
                </div>
                <div className="pr-4 text-right text-sm font-medium text-slate-300">USD</div>
              </div>
            </div>
          )}
          {isSwap && (
            <div className="mb-[10.5px]">
              <ExchangeInfoRow label="Fees">
                <div>
                  {!fees && "-"}
                  {fees && (
                    <div>
                      {formatAmount(feeBps, 2, 2, false)}%&nbsp; ({formatAmount(fees, fromToken.decimals, 4, true)}{" "}
                      {fromToken.symbol}: ${formatAmount(feesUsd, USD_DECIMALS, 2, true)})
                    </div>
                  )}
                </div>
              </ExchangeInfoRow>
            </div>
          )}
          {(isLong || isShort) && !isStopOrder && (
            <div className="mb-[10.5px]">
              <div className="mb-2 mt-4 text-[14px]">
                <Checkbox
                  isChecked={isLeverageSliderEnabled}
                  setIsChecked={setIsLeverageSliderEnabled}
                  className="flex-row-reverse"
                  follow="right"
                >
                  <span className="text-xs font-medium text-slate-600">Leverage slider</span>
                </Checkbox>
              </div>
              {isLeverageSliderEnabled && (
                <div
                  className={cx("mt-[15px] mb-[34px] pr-2", "App-slider", {
                    "text-green-500": isLong,
                    "text-[#fa3c58]": isShort,
                  })}
                >
                  <Slider
                    min={1.1}
                    max={50}
                    step={0.1}
                    marks={leverageMarks}
                    handle={leverageSliderHandle}
                    onChange={(value) => setLeverageOption(value)}
                    value={leverageOption}
                    defaultValue={leverageOption}
                  />
                </div>
              )}
              {isShort && (
                <div className="mb-[4.65px] grid grid-cols-[auto_auto] text-xs font-medium">
                  <div className="mr-2 text-xs font-medium text-slate-600">
                    <Trans>Collateral In</Trans>
                  </div>

                  <div className="flex justify-end text-right">
                    <TokenSelector
                      label="Collateral In"
                      chainId={chainId}
                      tokenAddress={shortCollateralAddress}
                      onSelectToken={onSelectShortCollateralAddress}
                      tokens={stableTokens}
                      showTokenImgInDropdown={true}
                    />
                  </div>
                </div>
              )}
              {isLong && (
                <div className="mb-[4.65px] grid grid-cols-[auto_auto] text-xs font-medium">
                  <div className="mr-2 text-xs font-medium text-slate-600">
                    <Trans>Collateral In</Trans>
                  </div>
                  <div className="flex justify-end text-right">
                    <Tooltip
                      position="right-bottom"
                      handle="USD"
                      renderContent={() => (
                        <span className="text-xs font-medium">
                          <Trans>
                            A snapshot of the USD value of your {existingPosition?.collateralToken?.symbol} collateral
                            is taken when the position is opened.
                          </Trans>
                          <br />
                          <br />
                          <Trans>
                            When closing the position, you can select which token you would like to receive the profits
                            in.
                          </Trans>
                        </span>
                      )}
                    />
                  </div>
                </div>
              )}
              <div className="mb-[4.65px] grid grid-cols-[auto_auto] text-xs font-medium">
                <div className="mr-2 text-xs font-medium text-slate-600">
                  <Trans>Leverage</Trans>
                </div>
                <div className="flex justify-end text-right">
                  {hasExistingPosition && toAmount && toAmount.gt(0) && (
                    <div className="inline-flex flex-row items-center opacity-70">
                      {formatAmount(existingPosition.leverage, 4, 2)}x
                      <BsArrowRight className="mb-[3.1px] align-middle" />
                    </div>
                  )}
                  {toAmount && leverage && leverage.gt(0) && `${formatAmount(leverage, 4, 2)}x`}
                  {!toAmount && leverage && leverage.gt(0) && `-`}
                  {leverage && leverage.eq(0) && `-`}
                </div>
              </div>
              <div className="mb-[4.65px] grid grid-cols-[auto_auto] text-xs font-medium">
                <div className="mr-2 text-xs font-medium text-slate-600">
                  <Trans>Entry Price</Trans>
                </div>
                <div className="flex justify-end text-right">
                  {hasExistingPosition && toAmount && toAmount.gt(0) && (
                    <div className="inline-flex flex-row items-center opacity-70">
                      ${formatAmount(existingPosition.averagePrice, USD_DECIMALS, 2, true)}
                      <BsArrowRight className="mb-[3.1px] align-middle" />
                    </div>
                  )}
                  {nextAveragePrice && `$${formatAmount(nextAveragePrice, USD_DECIMALS, 2, true)}`}
                  {!nextAveragePrice && `-`}
                </div>
              </div>
              <div className="mb-[4.65px] grid grid-cols-[auto_auto] text-xs font-medium">
                <div className="mr-2 text-xs font-medium text-slate-600">
                  <Trans>Liq. Price</Trans>
                </div>
                <div className="flex justify-end text-right">
                  {hasExistingPosition && toAmount && toAmount.gt(0) && (
                    <div className="inline-flex flex-row items-center opacity-70">
                      ${formatAmount(existingLiquidationPrice, USD_DECIMALS, 2, true)}
                      <BsArrowRight className="mb-[3.1px] align-middle" />
                    </div>
                  )}
                  {toAmount &&
                    displayLiquidationPrice &&
                    `$${formatAmount(displayLiquidationPrice, USD_DECIMALS, 2, true)}`}
                  {!toAmount && displayLiquidationPrice && `-`}
                  {!displayLiquidationPrice && `-`}
                </div>
              </div>
              <ExchangeInfoRow label="Fees">
                <div>
                  {!feesUsd && "-"}
                  {feesUsd && (
                    <Tooltip
                      handle={`$${formatAmount(feesUsd, USD_DECIMALS, 2, true)}`}
                      position="right-bottom"
                      renderContent={() => {
                        return (
                          <div>
                            {swapFees && (
                              <div>
                                {collateralToken.symbol} is required for collateral. <br />
                                <br />
                                <StatsTooltipRow
                                  label={`Swap ${fromToken.symbol} to ${collateralToken.symbol} Fee`}
                                  value={formatAmount(swapFees, USD_DECIMALS, 2, true)}
                                />
                                <br />
                              </div>
                            )}
                            <div>
                              <StatsTooltipRow
                                label={`Position Fee (0.1% of position size)`}
                                value={formatAmount(positionFee, USD_DECIMALS, 2, true)}
                              />
                            </div>
                          </div>
                        );
                      }}
                    />
                  )}
                </div>
              </ExchangeInfoRow>
            </div>
          )}
          {isStopOrder && (
            <div className="mb-2 rounded bg-slate-800 p-4 text-xs font-medium">
              Take-profit and stop-loss orders can be set after opening a position. <br />
              <br />
              There will be a "Close" button on each position row, clicking this will display the option to set trigger
              orders. <br />
              <br />
              For screenshots and more information, please see the{" "}
              <a href="https://xdx.exchange/docs" target="_blank" rel="noopener noreferrer">
                docs
              </a>
              .
            </div>
          )}
          <div className="pt-[3.1px]">
            <button
              className={cx(
                "flex w-full cursor-pointer items-center justify-center rounded text-center text-xs text-slate-200 disabled:cursor-not-allowed disabled:bg-slate-800 disabled:text-slate-200",
                active ? "bg-indigo-500 p-3 hover:bg-indigo-600" : "bg-indigo-500 p-2 hover:bg-indigo-600"
              )}
              onClick={onClickPrimary}
              disabled={!isPrimaryEnabled()}
            >
              {!active && <WalletIcon className="mr-2 -ml-1 h-5 w-5" aria-hidden="true" />}
              {getPrimaryText()}
            </button>
          </div>
        </div>
        {isSwap && (
          <div className="relative mt-2 border-t border-slate-800 p-4 text-sm">
            <div className="mb-[12.5px]">
              <Trans>Swap</Trans>
            </div>
            <div className="-mx-[15px] mb-[15px] h-[1px] bg-slate-800"></div>
            <div className="mb-[4.65px] grid grid-cols-[auto_auto] text-xs font-medium">
              <div className="mr-2 text-slate-400">{fromToken.symbol} Price</div>
              <div className="flex justify-end text-right">
                ${fromTokenInfo && formatAmount(fromTokenInfo.minPrice, USD_DECIMALS, 2, true)}
              </div>
            </div>
            <div className="mb-[4.65px] grid grid-cols-[auto_auto] text-xs font-medium">
              <div className="mr-2 text-xs font-medium text-slate-600">{toToken.symbol} Price</div>
              <div className="flex justify-end text-right">
                ${toTokenInfo && formatAmount(toTokenInfo.maxPrice, USD_DECIMALS, 2, true)}
              </div>
            </div>
            <div className="mb-[4.65px] grid grid-cols-[auto_auto] text-xs font-medium">
              <div className="mr-2 text-xs font-medium text-slate-600">
                <Trans>Available Liquidity</Trans>
              </div>

              <div className="al-swap flex justify-end text-right">
                <Tooltip
                  handle={`$${formatAmount(maxSwapAmountUsd, USD_DECIMALS, 2, true)}`}
                  position="right-bottom"
                  renderContent={() => {
                    return (
                      <div className="text-xs font-medium">
                        <StatsTooltipRow
                          label={`Max ${fromTokenInfo.symbol} in`}
                          value={[
                            `${formatAmount(maxFromTokenIn, fromTokenInfo.decimals, 0, true)} ${fromTokenInfo.symbol}`,
                            `($${formatAmount(maxFromTokenInUSD, USD_DECIMALS, 0, true)})`,
                          ]}
                        />
                        <StatsTooltipRow
                          label={`Max ${toTokenInfo.symbol} out`}
                          value={[
                            `${formatAmount(maxToTokenOut, toTokenInfo.decimals, 0, true)} ${toTokenInfo.symbol}`,
                            `($${formatAmount(maxToTokenOutUSD, USD_DECIMALS, 0, true)})`,
                          ]}
                        />
                      </div>
                    );
                  }}
                />
              </div>
            </div>
            {!isMarketOrder && (
              <ExchangeInfoRow label="Price">
                {getExchangeRateDisplay(getExchangeRate(fromTokenInfo, toTokenInfo), fromToken, toToken)}
              </ExchangeInfoRow>
            )}
          </div>
        )}
        {(isLong || isShort) && (
          <div className="relative mt-2 border-t border-slate-800 p-4 text-sm">
            <div className="mb-[12.5px] text-xs font-medium">
              {isLong ? "Long" : "Short"}&nbsp;{toToken.symbol}
            </div>
            <div className="-mx-[15px] mb-[15px] h-[1px] bg-slate-800"></div>
            <div className="mb-[4.65px] grid grid-cols-[auto_auto] text-xs font-medium">
              <div className="mr-2 text-xs font-medium text-slate-600">
                <Trans>Entry Price</Trans>
              </div>
              <div className="flex justify-end text-right">
                <Tooltip
                  handle={`$${formatAmount(entryMarkPrice, USD_DECIMALS, 2, true)}`}
                  position="right-bottom"
                  renderContent={() => {
                    return (
                      <div className="text-xs font-medium">
                        The position will be opened at {formatAmount(entryMarkPrice, USD_DECIMALS, 2, true)} USD with a
                        max slippage of {parseFloat(savedSlippageAmount / 100.0).toFixed(2)}%.
                        <br />
                        <br />
                        The slippage amount can be configured under Settings, found by clicking on your address at the
                        top right of the page after connecting your wallet.
                        <br />
                        <br />
                        <a href="https://xdx.exchange/docs" target="_blank" rel="noopener noreferrer">
                          More Info
                        </a>
                      </div>
                    );
                  }}
                />
              </div>
            </div>
            <div className="mb-[4.65px] grid grid-cols-[auto_auto] text-xs font-medium">
              <div className="mr-2 text-xs font-medium text-slate-600">
                <Trans>Exit Price</Trans>
              </div>
              <div className="flex justify-end text-right">
                <Tooltip
                  handle={`$${formatAmount(exitMarkPrice, USD_DECIMALS, 2, true)}`}
                  position="right-bottom"
                  renderContent={() => {
                    return (
                      <div className="text-xs font-medium">
                        If you have an existing position, the position will be closed at{" "}
                        {formatAmount(entryMarkPrice, USD_DECIMALS, 2, true)} USD.
                        <br />
                        <br />
                        This exit price will change with the price of the asset.
                        <br />
                        <br />
                        <a href="https://xdx.exchange/docs" target="_blank" rel="noopener noreferrer">
                          More Info
                        </a>
                      </div>
                    );
                  }}
                />
              </div>
            </div>
            <div className="mb-[4.65px] grid grid-cols-[auto_auto] text-xs font-medium">
              <div className="mr-2 text-xs font-medium text-slate-600">
                <Trans>Borrow Fee</Trans>
              </div>
              <div className="flex justify-end text-right">
                <Tooltip
                  handle={borrowFeeText}
                  position="right-bottom"
                  renderContent={() => {
                    return (
                      <div className="text-xs font-medium">
                        {hasZeroBorrowFee && (
                          <div>
                            {isLong && "There are more shorts than longs, borrow fees for longing is currently zero"}
                            {isShort && "There are more longs than shorts, borrow fees for shorting is currently zero"}
                          </div>
                        )}
                        {!hasZeroBorrowFee && (
                          <div>
                            The borrow fee is calculated as (assets borrowed) / (total assets in pool) * 0.01% per hour.
                            <br />
                            <br />
                            {isShort && `You can change the "Collateral In" token above to find lower fees`}
                          </div>
                        )}
                        <br />
                        <a href="https://xdx.exchange/docs" target="_blank" rel="noopener noreferrer">
                          More Info
                        </a>
                      </div>
                    );
                  }}
                >
                  {!hasZeroBorrowFee && null}
                </Tooltip>
              </div>
            </div>
            {renderAvailableLongLiquidity()}
            {isShort && toTokenInfo.hasMaxAvailableShort && (
              <div className="mb-[4.65px] grid grid-cols-[auto_auto] text-xs font-medium">
                <div className="mr-2 text-xs font-medium text-slate-600">
                  <Trans>Available Liquidity</Trans>
                </div>
                <div className="flex justify-end text-right">
                  <Tooltip
                    handle={`$${formatAmount(toTokenInfo.maxAvailableShort, USD_DECIMALS, 2, true)}`}
                    position="right-bottom"
                    renderContent={() => {
                      return (
                        <>
                          <StatsTooltipRow
                            label={`Max ${toTokenInfo.symbol} short capacity`}
                            value={formatAmount(toTokenInfo.maxGlobalShortSize, USD_DECIMALS, 0, true)}
                          />
                          <StatsTooltipRow
                            label={`Current ${toTokenInfo.symbol} shorts`}
                            value={formatAmount(toTokenInfo.globalShortSize, USD_DECIMALS, 0, true)}
                          />
                        </>
                      );
                    }}
                  ></Tooltip>
                </div>
              </div>
            )}
          </div>
        )}
        <NoLiquidityErrorModal
          chainId={chainId}
          fromToken={fromToken}
          toToken={toToken}
          shortCollateralToken={shortCollateralToken}
          isLong={isLong}
          isShort={isShort}
          modalError={modalError}
          setModalError={setModalError}
        />
        {renderOrdersToa()}
        {isConfirming && (
          <ConfirmationBox
            library={library}
            isHigherSlippageAllowed={isHigherSlippageAllowed}
            setIsHigherSlippageAllowed={setIsHigherSlippageAllowed}
            orders={orders}
            isSwap={isSwap}
            isLong={isLong}
            isMarketOrder={isMarketOrder}
            orderOption={orderOption}
            isShort={isShort}
            fromToken={fromToken}
            fromTokenInfo={fromTokenInfo}
            toToken={toToken}
            toTokenInfo={toTokenInfo}
            toAmount={toAmount}
            fromAmount={fromAmount}
            feeBps={feeBps}
            onConfirmationClick={onConfirmationClick}
            setIsConfirming={setIsConfirming}
            hasExistingPosition={hasExistingPosition}
            shortCollateralAddress={shortCollateralAddress}
            shortCollateralToken={shortCollateralToken}
            leverage={leverage}
            existingPosition={existingPosition}
            existingLiquidationPrice={existingLiquidationPrice}
            displayLiquidationPrice={displayLiquidationPrice}
            nextAveragePrice={nextAveragePrice}
            triggerPriceUsd={triggerPriceUsd}
            triggerRatio={triggerRatio}
            fees={fees}
            feesUsd={feesUsd}
            isSubmitting={isSubmitting}
            isPendingConfirmation={isPendingConfirmation}
            fromUsdMin={fromUsdMin}
            toUsdMax={toUsdMax}
            collateralTokenAddress={collateralTokenAddress}
            infoTokens={infoTokens}
            chainId={chainId}
            setPendingTxns={setPendingTxns}
            pendingTxns={pendingTxns}
            minExecutionFee={minExecutionFee}
            minExecutionFeeUSD={minExecutionFeeUSD}
            minExecutionFeeErrorMessage={minExecutionFeeErrorMessage}
          />
        )}
      </div>
    </div>
  );
}
