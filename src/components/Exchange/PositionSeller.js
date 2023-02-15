import React, { useState, useCallback, useEffect, useMemo } from "react";
import { ethers } from "ethers";
import cx from "classnames";
import { Trans, t } from "@lingui/macro";
import { BsArrowRight } from "react-icons/bs";

import {
  DEFAULT_SLIPPAGE_AMOUNT,
  DEFAULT_HIGHER_SLIPPAGE_AMOUNT,
  USD_DECIMALS,
  DUST_USD,
  BASIS_POINTS_DIVISOR,
  MIN_PROFIT_TIME,
  getLiquidationPrice,
  getLeverage,
  getMarginFee,
  PRECISION,
  MARKET,
  STOP,
  DECREASE,
  calculatePositionDelta,
  getDeltaStr,
  getProfitPrice,
  getNextToAmount,
  USDG_DECIMALS,
  adjustForDecimals,
} from "lib/legacy";
import {
  // ARBITRUM,
  getChainName,
  getConstant,
  IS_NETWORK_DISABLED,
} from "config/chains";
import {
  createDecreaseOrder,
  // useHasOutdatedUi
} from "domain/legacy";
import { getContract } from "config/contracts";
import PositionRouter from "abis/PositionRouter.json";
import Checkbox from "../Checkbox/Checkbox";
import Tab from "../Tab/Tab";
import Modal from "../Modal/Modal";
import ExchangeInfoRow from "./ExchangeInfoRow";
import Tooltip from "../Tooltip/Tooltip";
import TokenSelector from "./TokenSelectorV2";
import StatsTooltipRow from "../StatsTooltip/StatsTooltipRow";
import { callContract } from "lib/contracts";
import { getTokenAmountFromUsd } from "domain/tokens";
import { TRIGGER_PREFIX_ABOVE, TRIGGER_PREFIX_BELOW } from "config/ui";
import { useLocalStorageByChainId, useLocalStorageSerializeKey } from "lib/localStorage";
import { CLOSE_POSITION_RECEIVE_TOKEN_KEY, SLIPPAGE_BPS_KEY } from "config/localStorage";
import { getTokenInfo, getUsd } from "domain/tokens/utils";
import { usePrevious } from "lib/usePrevious";
import { bigNumberify, expandDecimals, formatAmount, formatAmountFree, parseValue } from "lib/numbers";
import { getTokens } from "config/tokens";
import { formatDateTime, getTimeRemaining } from "lib/dates";

const { AddressZero } = ethers.constants;
const ORDER_SIZE_DUST_USD = expandDecimals(1, USD_DECIMALS - 1); // $0.10

const orderOptionLabels = {
  [MARKET]: "Market",
  [STOP]: "Trigger",
};

function shouldSwap(collateralToken, receiveToken) {
  // If position collateral is WETH in contract, then position.collateralToken is { symbol: “ETH”, isNative: true, … }
  // @see https://github.com/gmx-io/gmx-interface/blob/master/src/pages/Exchange/Exchange.js#L162
  // meaning if collateralToken.isNative === true in reality position has WETH as a collateral
  // and if collateralToken.isNative === true and receiveToken.isNative === true then position’s WETH will be unwrapped and user will receive native ETH
  const isCollateralWrapped = collateralToken.isNative;

  const isSameToken =
    collateralToken.address === receiveToken.address || (isCollateralWrapped && receiveToken.isWrapped);

  const isUnwrap = isCollateralWrapped && receiveToken.isNative;

  return !isSameToken && !isUnwrap;
}

function getSwapLimits(infoTokens, fromTokenAddress, toTokenAddress) {
  const fromInfo = getTokenInfo(infoTokens, fromTokenAddress);
  const toInfo = getTokenInfo(infoTokens, toTokenAddress);

  let maxInUsd;
  let maxIn;
  let maxOut;
  let maxOutUsd;

  if (!fromInfo?.maxUsdgAmount) {
    maxInUsd = bigNumberify(0);
    maxIn = bigNumberify(0);
  } else {
    maxInUsd = fromInfo.maxUsdgAmount
      .sub(fromInfo.usdgAmount)
      .mul(expandDecimals(1, USD_DECIMALS))
      .div(expandDecimals(1, USDG_DECIMALS));

    maxIn = maxInUsd.mul(expandDecimals(1, fromInfo.decimals)).div(fromInfo.maxPrice).toString();
  }

  if (!toInfo?.poolAmount || !toInfo?.bufferAmount) {
    maxOut = bigNumberify(0);
    maxOutUsd = bigNumberify(0);
  } else {
    maxOut = toInfo.availableAmount.gt(toInfo.poolAmount.sub(toInfo.bufferAmount))
      ? toInfo.poolAmount.sub(toInfo.bufferAmount)
      : toInfo.availableAmount;

    maxOutUsd = getUsd(maxOut, toInfo.address, false, infoTokens);
  }

  return {
    maxIn,
    maxInUsd,
    maxOut,
    maxOutUsd,
  };
}

export default function PositionSeller(props) {
  const {
    pendingPositions,
    setPendingPositions,
    positionsMap,
    positionKey,
    isVisible,
    setIsVisible,
    account,
    library,
    infoTokens,
    setPendingTxns,
    flagOrdersEnabled,
    savedIsPnlInLeverage,
    chainId,
    nativeTokenAddress,
    orders,
    isWaitingForPluginApproval,
    isPluginApproving,
    orderBookApproved,
    setOrdersToaOpen,
    positionRouterApproved,
    isWaitingForPositionRouterApproval,
    isPositionRouterApproving,
    approvePositionRouter,
    isHigherSlippageAllowed,
    setIsHigherSlippageAllowed,
    minExecutionFee,
    minExecutionFeeErrorMessage,
    usdgSupply,
    totalTokenWeights,
  } = props;
  const [savedSlippageAmount] = useLocalStorageSerializeKey([chainId, SLIPPAGE_BPS_KEY], DEFAULT_SLIPPAGE_AMOUNT);
  const [keepLeverage, setKeepLeverage] = useLocalStorageSerializeKey([chainId, "Exchange-keep-leverage"], true);
  const position = positionsMap && positionKey ? positionsMap[positionKey] : undefined;
  const [fromValue, setFromValue] = useState("");
  const [isProfitWarningAccepted, setIsProfitWarningAccepted] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const prevIsVisible = usePrevious(isVisible);
  const positionRouterAddress = getContract(chainId, "PositionRouter");
  const nativeTokenSymbol = getConstant(chainId, "nativeTokenSymbol");
  const toTokens = getTokens(chainId);

  const [savedRecieveTokenAddress, setSavedRecieveTokenAddress] = useLocalStorageByChainId(
    chainId,
    `${CLOSE_POSITION_RECEIVE_TOKEN_KEY}-${position?.indexToken?.symbol}-${position.isLong ? "long" : "short"}`
  );

  const [swapToToken, setSwapToToken] = useState(() =>
    savedRecieveTokenAddress ? toTokens.find((token) => token.address === savedRecieveTokenAddress) : undefined
  );

  let allowedSlippage = savedSlippageAmount;
  if (isHigherSlippageAllowed) {
    allowedSlippage = DEFAULT_HIGHER_SLIPPAGE_AMOUNT;
  }

  const orderOptions = [MARKET, STOP];
  let [orderOption, setOrderOption] = useState(MARKET);

  if (!flagOrdersEnabled) {
    orderOption = MARKET;
  }

  const needPositionRouterApproval = !positionRouterApproved && orderOption === MARKET;

  const onOrderOptionChange = (option) => {
    setOrderOption(option);
  };

  const onTriggerPriceChange = (evt) => {
    setTriggerPriceValue(evt.target.value || "");
  };

  const [triggerPriceValue, setTriggerPriceValue] = useState("");
  const triggerPriceUsd = orderOption === MARKET ? 0 : parseValue(triggerPriceValue, USD_DECIMALS);

  const [nextDelta, nextHasProfit = bigNumberify(0)] = useMemo(() => {
    if (!position) {
      return [bigNumberify(0), false];
    }

    if (orderOption !== STOP) {
      return [position.delta, position.hasProfit, position.deltaPercentage];
    }

    if (!triggerPriceUsd) {
      return [bigNumberify(0), false];
    }

    const { delta, hasProfit, deltaPercentage } = calculatePositionDelta(triggerPriceUsd, position);
    return [delta, hasProfit, deltaPercentage];
  }, [position, orderOption, triggerPriceUsd]);

  const existingOrders = useMemo(() => {
    if (orderOption === STOP && (!triggerPriceUsd || triggerPriceUsd.eq(0))) {
      return [];
    }
    if (!orders || !position) {
      return [];
    }

    const ret = [];
    for (const order of orders) {
      // only Stop orders can't be executed without corresponding opened position
      if (order.type !== DECREASE) continue;

      // if user creates Stop-Loss we need only Stop-Loss orders and vice versa
      if (orderOption === STOP) {
        const triggerAboveThreshold = triggerPriceUsd.gt(position.markPrice);
        if (triggerAboveThreshold !== order.triggerAboveThreshold) continue;
      }

      const sameToken =
        order.indexToken === nativeTokenAddress
          ? position.indexToken.isNative
          : order.indexToken === position.indexToken.address;
      if (order.isLong === position.isLong && sameToken) {
        ret.push(order);
      }
    }
    return ret;
  }, [position, orders, triggerPriceUsd, orderOption, nativeTokenAddress]);

  const existingOrder = existingOrders[0];

  const needOrderBookApproval = orderOption === STOP && !orderBookApproved;

  const isSwapAllowed = orderOption === MARKET;

  // const { data: hasOutdatedUi } = useHasOutdatedUi();

  let collateralToken;
  let receiveToken;
  let maxAmount;
  let maxAmountFormatted;
  let maxAmountFormattedFree;
  let fromAmount;

  let convertedAmount;
  let convertedAmountFormatted;

  let nextLeverage;
  let liquidationPrice;
  let nextLiquidationPrice;
  let isClosing;
  let sizeDelta;

  let nextCollateral;
  let collateralDelta = bigNumberify(0);
  let receiveAmount = bigNumberify(0);
  let convertedReceiveAmount = bigNumberify(0);
  let adjustedDelta = bigNumberify(0);

  let isNotEnoughReceiveTokenLiquidity;
  let isCollateralPoolCapacityExceeded;

  let title;
  let fundingFee;
  let positionFee;
  let swapFeeToken;
  let swapFee;
  let totalFees = bigNumberify(0);

  let executionFee = orderOption === STOP ? getConstant(chainId, "DECREASE_ORDER_EXECUTION_GAS_FEE") : minExecutionFee;

  let executionFeeUsd = getUsd(executionFee, nativeTokenAddress, false, infoTokens) || bigNumberify(0);

  if (position) {
    fundingFee = position.fundingFee;
    fromAmount = parseValue(fromValue, USD_DECIMALS);
    sizeDelta = fromAmount;

    title = `Close ${position.isLong ? "Long" : "Short"} ${position.indexToken.symbol}`;
    collateralToken = position.collateralToken;
    liquidationPrice = getLiquidationPrice(position);

    if (fromAmount) {
      isClosing = position.size.sub(fromAmount).lt(DUST_USD);
      positionFee = getMarginFee(fromAmount);
    }

    if (isClosing) {
      sizeDelta = position.size;
      receiveAmount = position.collateral;
    } else if (orderOption === STOP && sizeDelta && existingOrders.length > 0) {
      let residualSize = position.size;
      for (const order of existingOrders) {
        residualSize = residualSize.sub(order.sizeDelta);
      }
      if (residualSize.sub(sizeDelta).abs().lt(ORDER_SIZE_DUST_USD)) {
        sizeDelta = residualSize;
      }
    }

    if (sizeDelta) {
      adjustedDelta = nextDelta.mul(sizeDelta).div(position.size);
    }

    if (nextHasProfit) {
      receiveAmount = receiveAmount.add(adjustedDelta);
    } else {
      if (receiveAmount.gt(adjustedDelta)) {
        receiveAmount = receiveAmount.sub(adjustedDelta);
      } else {
        receiveAmount = bigNumberify(0);
      }
    }

    if (keepLeverage && sizeDelta && !isClosing) {
      collateralDelta = sizeDelta.mul(position.collateral).div(position.size);
      // if the position will be realising a loss then reduce collateralDelta by the realised loss
      if (!nextHasProfit) {
        const deductions = adjustedDelta.add(positionFee).add(fundingFee);
        if (collateralDelta.gt(deductions)) {
          collateralDelta = collateralDelta = collateralDelta.sub(deductions);
        } else {
          collateralDelta = bigNumberify(0);
        }
      }
    }

    maxAmount = position.size;
    maxAmountFormatted = formatAmount(maxAmount, USD_DECIMALS, 2, true);
    maxAmountFormattedFree = formatAmountFree(maxAmount, USD_DECIMALS, 2);

    if (fromAmount && collateralToken.maxPrice) {
      convertedAmount = fromAmount.mul(expandDecimals(1, collateralToken.decimals)).div(collateralToken.maxPrice);
      convertedAmountFormatted = formatAmount(convertedAmount, collateralToken.decimals, 4, true);
    }

    totalFees = totalFees.add(positionFee || bigNumberify(0)).add(fundingFee || bigNumberify(0));

    receiveAmount = receiveAmount.add(collateralDelta);

    if (sizeDelta) {
      if (receiveAmount.gt(totalFees)) {
        receiveAmount = receiveAmount.sub(totalFees);
      } else {
        receiveAmount = bigNumberify(0);
      }
    }

    receiveToken = isSwapAllowed && swapToToken ? swapToToken : collateralToken;

    // Calculate swap fees
    if (isSwapAllowed && swapToToken) {
      const { feeBasisPoints } = getNextToAmount(
        chainId,
        convertedAmount,
        collateralToken.address,
        receiveToken.address,
        infoTokens,
        undefined,
        undefined,
        usdgSupply,
        totalTokenWeights,
        true
      );

      if (feeBasisPoints) {
        swapFee = receiveAmount.mul(feeBasisPoints).div(BASIS_POINTS_DIVISOR);
        swapFeeToken = getTokenAmountFromUsd(infoTokens, collateralToken.address, swapFee);
        totalFees = totalFees.add(swapFee || bigNumberify(0));
        receiveAmount = receiveAmount.sub(swapFee);
      }
    }

    if (orderOption === STOP) {
      convertedReceiveAmount = getTokenAmountFromUsd(infoTokens, receiveToken.address, receiveAmount, {
        overridePrice: triggerPriceUsd,
      });
    } else {
      convertedReceiveAmount = getTokenAmountFromUsd(infoTokens, receiveToken.address, receiveAmount);
    }

    // Check swap limits (max in / max out)
    if (isSwapAllowed && shouldSwap(collateralToken, receiveToken)) {
      const collateralInfo = getTokenInfo(infoTokens, collateralToken.address);
      const receiveTokenInfo = getTokenInfo(infoTokens, receiveToken.address);

      isNotEnoughReceiveTokenLiquidity =
        receiveTokenInfo.availableAmount.lt(convertedReceiveAmount) ||
        receiveTokenInfo.bufferAmount.gt(receiveTokenInfo.poolAmount.sub(convertedReceiveAmount));

      if (
        collateralInfo.maxUsdgAmount &&
        collateralInfo.maxUsdgAmount.gt(0) &&
        collateralInfo.usdgAmount &&
        collateralInfo.maxPrice
      ) {
        const usdgFromAmount = adjustForDecimals(receiveAmount, USD_DECIMALS, USDG_DECIMALS);
        const nextUsdgAmount = collateralInfo.usdgAmount.add(usdgFromAmount);

        if (nextUsdgAmount.gt(collateralInfo.maxUsdgAmount)) {
          isCollateralPoolCapacityExceeded = true;
        }
      }
    }

    if (isClosing) {
      nextCollateral = bigNumberify(0);
    } else {
      if (position.collateral) {
        nextCollateral = position.collateral;
        if (collateralDelta && collateralDelta.gt(0)) {
          nextCollateral = position.collateral.sub(collateralDelta);
        } else if (position.delta && position.delta.gt(0) && sizeDelta) {
          if (!position.hasProfit) {
            nextCollateral = nextCollateral.sub(adjustedDelta);
          }
        }
      }
    }

    if (fromAmount) {
      if (!isClosing && !keepLeverage) {
        nextLeverage = getLeverage({
          size: position.size,
          sizeDelta,
          collateral: position.collateral,
          entryFundingRate: position.entryFundingRate,
          cumulativeFundingRate: position.cumulativeFundingRate,
          hasProfit: nextHasProfit,
          delta: nextDelta,
          includeDelta: savedIsPnlInLeverage,
        });
        nextLiquidationPrice = getLiquidationPrice({
          isLong: position.isLong,
          size: position.size,
          sizeDelta,
          collateral: position.collateral,
          averagePrice: position.averagePrice,
          entryFundingRate: position.entryFundingRate,
          cumulativeFundingRate: position.cumulativeFundingRate,
          delta: nextDelta,
          hasProfit: nextHasProfit,
          includeDelta: true,
        });
      }
    }
  }

  const [deltaStr, deltaPercentageStr] = useMemo(() => {
    if (!position || !position.markPrice) {
      return ["-", "-"];
    }
    if (orderOption !== STOP) {
      const { pendingDelta, pendingDeltaPercentage, hasProfit } = calculatePositionDelta(
        position.markPrice,
        position,
        fromAmount
      );
      const { deltaStr, deltaPercentageStr } = getDeltaStr({
        delta: pendingDelta,
        deltaPercentage: pendingDeltaPercentage,
        hasProfit,
      });
      return [deltaStr, deltaPercentageStr];
    }
    if (!triggerPriceUsd || triggerPriceUsd.eq(0)) {
      return ["-", "-"];
    }

    const { pendingDelta, pendingDeltaPercentage, hasProfit } = calculatePositionDelta(
      triggerPriceUsd,
      position,
      fromAmount
    );

    const { deltaStr, deltaPercentageStr } = getDeltaStr({
      delta: pendingDelta,
      deltaPercentage: pendingDeltaPercentage,
      hasProfit,
    });
    return [deltaStr, deltaPercentageStr];
  }, [position, triggerPriceUsd, orderOption, fromAmount]);

  const getError = () => {
    if (IS_NETWORK_DISABLED[chainId]) {
      if (orderOption === STOP) return [t`Trigger order disabled, pending ${getChainName(chainId)} upgrade`];
      return [t`Position close disabled, pending ${getChainName(chainId)} upgrade`];
    }
    // if (hasOutdatedUi) {
    //   return t`Page outdated, please refresh`;
    // }
    if (!fromAmount) {
      return t`Enter an amount`;
    }
    if (nextLeverage && nextLeverage.eq(0)) {
      return t`Enter an amount`;
    }
    if (orderOption === STOP) {
      if (!triggerPriceUsd || triggerPriceUsd.eq(0)) {
        return t`Enter Price`;
      }
      if (position.isLong && triggerPriceUsd.lte(liquidationPrice)) {
        return t`Price below Liq. Price`;
      }
      if (!position.isLong && triggerPriceUsd.gte(liquidationPrice)) {
        return t`Price above Liq. Price`;
      }

      if (profitPrice && nextDelta.eq(0) && nextHasProfit) {
        return t`Invalid price, see warning`;
      }
    }

    if (isNotEnoughReceiveTokenLiquidity) {
      return "Insufficient receive token liquidity";
    }

    if (isCollateralPoolCapacityExceeded) {
      return `${collateralToken.symbol} pool exceeded, can only Receive ${collateralToken.symbol}`;
    }

    if (!isClosing && position && position.size && fromAmount) {
      if (position.size.sub(fromAmount).lt(expandDecimals(10, USD_DECIMALS))) {
        return t`Leftover position below 10 USD`;
      }
      if (nextCollateral && nextCollateral.lt(expandDecimals(5, USD_DECIMALS))) {
        return t`Leftover collateral below 5 USD`;
      }
    }

    if (position && position.size && position.size.lt(fromAmount)) {
      return t`Max close amount exceeded`;
    }

    if (nextLeverage && nextLeverage.lt(1.1 * BASIS_POINTS_DIVISOR)) {
      return t`Min leverage: 1.1x`;
    }

    if (nextLeverage && nextLeverage.gt(50 * BASIS_POINTS_DIVISOR)) {
      return t`Max leverage: 50xt`;
    }

    if (hasPendingProfit && orderOption !== STOP && !isProfitWarningAccepted) {
      return t`Forfeit profit not checked`;
    }
  };

  const isPrimaryEnabled = () => {
    const error = getError();
    if (error) {
      return false;
    }
    if (isSubmitting) {
      return false;
    }
    if (needOrderBookApproval && isWaitingForPluginApproval) {
      return false;
    }
    if (isPluginApproving) {
      return false;
    }
    if (needPositionRouterApproval && isWaitingForPositionRouterApproval) {
      return false;
    }
    if (isPositionRouterApproving) {
      return false;
    }

    return true;
  };

  const hasPendingProfit = MIN_PROFIT_TIME > 0 && position.delta.eq(0) && position.pendingDelta.gt(0);

  const getPrimaryText = () => {
    const error = getError();
    if (error) {
      return error;
    }

    if (orderOption === STOP) {
      if (isSubmitting) return t`Creating Order...`;

      if (needOrderBookApproval && isWaitingForPluginApproval) {
        return t`Enabling Orders...`;
      }
      if (isPluginApproving) {
        return t`Enabling Orders...`;
      }
      if (needOrderBookApproval) {
        return t`Enable Orders`;
      }

      return t`Create Order`;
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

    if (hasPendingProfit) {
      return t`Close without profit`;
    }
    return isSubmitting ? t`Closing...` : t`Close`;
  };

  const resetForm = () => {
    setFromValue("");
    setIsProfitWarningAccepted(false);
  };

  useEffect(() => {
    if (prevIsVisible !== isVisible) {
      resetForm();
    }
  }, [prevIsVisible, isVisible]);

  const onClickPrimary = async () => {
    if (needOrderBookApproval) {
      setOrdersToaOpen(true);
      return;
    }

    if (needPositionRouterApproval) {
      approvePositionRouter({
        sentMsg: t`Enable leverage sent.`,
        failMsg: t`Enable leverage failed.`,
      });
      return;
    }

    setIsSubmitting(true);

    const collateralTokenAddress = position.collateralToken.isNative
      ? nativeTokenAddress
      : position.collateralToken.address;
    const indexTokenAddress = position.indexToken.isNative ? nativeTokenAddress : position.indexToken.address;

    if (orderOption === STOP) {
      const triggerAboveThreshold = triggerPriceUsd.gt(position.markPrice);

      createDecreaseOrder(
        chainId,
        library,
        indexTokenAddress,
        sizeDelta,
        collateralTokenAddress,
        collateralDelta,
        position.isLong,
        triggerPriceUsd,
        triggerAboveThreshold,
        {
          sentMsg: t`Order submitted!`,
          successMsg: t`Order created!`,
          failMsg: t`Order creation failed.`,
          setPendingTxns,
        }
      )
        .then(() => {
          setFromValue("");
          setIsVisible(false);
        })
        .finally(() => {
          setIsSubmitting(false);
        });
      return;
    }

    const priceBasisPoints = position.isLong
      ? BASIS_POINTS_DIVISOR - allowedSlippage
      : BASIS_POINTS_DIVISOR + allowedSlippage;
    const refPrice = position.isLong ? position.indexToken.minPrice : position.indexToken.maxPrice;
    let priceLimit = refPrice.mul(priceBasisPoints).div(BASIS_POINTS_DIVISOR);
    const minProfitExpiration = position.lastIncreasedTime + MIN_PROFIT_TIME;
    const minProfitTimeExpired = parseInt(Date.now() / 1000) > minProfitExpiration;

    if (nextHasProfit && !minProfitTimeExpired && !isProfitWarningAccepted) {
      if ((position.isLong && priceLimit.lt(profitPrice)) || (!position.isLong && priceLimit.gt(profitPrice))) {
        priceLimit = profitPrice;
      }
    }

    const tokenAddress0 = collateralTokenAddress === AddressZero ? nativeTokenAddress : collateralTokenAddress;

    const path = [tokenAddress0];

    const isUnwrap = receiveToken.address === AddressZero;
    const isSwap = receiveToken.address !== tokenAddress0;

    if (isSwap) {
      if (isUnwrap && tokenAddress0 !== nativeTokenAddress) {
        path.push(nativeTokenAddress);
      } else if (!isUnwrap) {
        path.push(receiveToken.address);
      }
    }

    const withdrawETH = isUnwrap;

    const params = [
      path, // _path
      indexTokenAddress, // _indexToken
      collateralDelta, // _collateralDelta
      sizeDelta, // _sizeDelta
      position.isLong, // _isLong
      account, // _receiver
      priceLimit, // _acceptablePrice
      0, // _minOut
      minExecutionFee, // _executionFee
      withdrawETH, // _withdrawETH
      AddressZero, // callback
    ];

    const successMsg = t`Requested decrease of ${position.indexToken.symbol} ${
      position.isLong ? "Long" : "Short"
    } by ${formatAmount(sizeDelta, USD_DECIMALS, 2)} USD.`;

    const contract = new ethers.Contract(positionRouterAddress, PositionRouter.abi, library.getSigner());

    callContract(chainId, contract, "createDecreasePosition", params, {
      value: minExecutionFee,
      sentMsg: t`Close submitted!`,
      successMsg,
      failMsg: t`Close failed.`,
      setPendingTxns,
      // for Arbitrum, sometimes the successMsg shows after the position has already been executed
      // hide the success message for Arbitrum as a workaround
      hideSuccessMsg: false,
    })
      .then(async (res) => {
        setFromValue("");
        setIsVisible(false);

        let nextSize = position.size.sub(sizeDelta);

        pendingPositions[position.key] = {
          updatedAt: Date.now(),
          pendingChanges: {
            size: nextSize,
          },
        };

        setPendingPositions({ ...pendingPositions });
      })
      .finally(() => {
        setIsSubmitting(false);
      });
  };

  const renderExistingOrderWarning = useCallback(() => {
    if (!existingOrder) {
      return;
    }
    const indexToken = getTokenInfo(infoTokens, existingOrder.indexToken);
    const sizeInToken = formatAmount(
      existingOrder.sizeDelta.mul(PRECISION).div(existingOrder.triggerPrice),
      USD_DECIMALS,
      4,
      true
    );
    const prefix = existingOrder.triggerAboveThreshold ? TRIGGER_PREFIX_ABOVE : TRIGGER_PREFIX_BELOW;
    return (
      <div className="mt-[10px] mb-[15px] px-[10px] text-center text-[14px]">
        You have an active order to decrease {existingOrder.isLong ? "Long" : "Short"} {sizeInToken} {indexToken.symbol}{" "}
        ($
        {formatAmount(existingOrder.sizeDelta, USD_DECIMALS, 2, true)}) at {prefix}{" "}
        {formatAmount(existingOrder.triggerPrice, USD_DECIMALS, 2, true)}
      </div>
    );
  }, [existingOrder, infoTokens]);

  function renderMinProfitWarning() {
    if (MIN_PROFIT_TIME === 0) {
      return null;
    }

    if (profitPrice && nextDelta.eq(0) && nextHasProfit) {
      const minProfitExpiration = position.lastIncreasedTime + MIN_PROFIT_TIME;

      if (orderOption === MARKET) {
        return (
          <div className="mt-[10px] mb-[15px] px-[10px] text-center text-[14px]">
            Reducing the position at the current price will forfeit a&nbsp;
            <a href="https://xdx.exchange/docs" target="_blank" rel="noopener noreferrer">
              pending profit
            </a>{" "}
            of {deltaStr}. <br />
            <br />
            Profit price: {position.isLong ? ">" : "<"} ${formatAmount(profitPrice, USD_DECIMALS, 2, true)}. This rule
            applies for the next {getTimeRemaining(minProfitExpiration)}, until {formatDateTime(minProfitExpiration)}.
          </div>
        );
      }
      return (
        <div className="mt-[10px] mb-[15px] px-[10px] text-center text-[14px]">
          This order will forfeit a&nbsp;
          <a href="https://xdx.exchange/docs" target="_blank" rel="noopener noreferrer">
            profit
          </a>{" "}
          of {deltaStr}. <br />
          Profit price: {position.isLong ? ">" : "<"} ${formatAmount(profitPrice, USD_DECIMALS, 2, true)}. This rule
          applies for the next {getTimeRemaining(minProfitExpiration)}, until {formatDateTime(minProfitExpiration)}.
        </div>
      );
    }
  }

  const profitPrice = getProfitPrice(orderOption === MARKET ? position.markPrice : triggerPriceUsd, position);

  let triggerPricePrefix;
  if (triggerPriceUsd) {
    triggerPricePrefix = triggerPriceUsd.gt(position.markPrice) ? TRIGGER_PREFIX_ABOVE : TRIGGER_PREFIX_BELOW;
  }

  const shouldShowExistingOrderWarning = false;

  return (
    <div className="PositionEditor">
      {position && (
        <Modal
          isVisible={isVisible}
          setIsVisible={setIsVisible}
          label={title}
          allowContentTouchMove
          className="!mr-[7px] max-h-[80px] !w-[380px] !pr-[7px]"
          position="center"
        >
          {flagOrdersEnabled && (
            <Tab
              options={orderOptions}
              option={orderOption}
              optionLabels={orderOptionLabels}
              onChange={onOrderOptionChange}
              className="mb-[10.5px]"
            />
          )}
          <div className="mb-2 rounded bg-slate-700 p-4 shadow">
            <div className="grid grid-cols-2 pb-[12.5px] text-[14px]">
              <div className="opacity-70">
                {convertedAmountFormatted && (
                  <div className="inline-block text-[14px]">
                    Close: {convertedAmountFormatted} {position.collateralToken.symbol}
                  </div>
                )}
                {!convertedAmountFormatted && "Close"}
              </div>
              {maxAmount && (
                <div
                  className="flex cursor-pointer items-end justify-end text-end opacity-70"
                  onClick={() => setFromValue(maxAmountFormattedFree)}
                >
                  Max: {maxAmountFormatted}
                </div>
              )}
            </div>
            <div className="grid grid-cols-[1fr_auto] pb-[3.1px]">
              <div className="relative overflow-hidden">
                <input
                  type="number"
                  min="0"
                  placeholder="0.0"
                  className="w-full overflow-hidden text-ellipsis whitespace-nowrap border-none bg-transparent p-0 pr-5 text-xl text-slate-200 placeholder-slate-400 ring-offset-0 focus:outline-none focus:ring-0"
                  value={fromValue}
                  onChange={(e) => setFromValue(e.target.value)}
                />
                {fromValue !== maxAmountFormattedFree && (
                  <div
                    className="absolute right-[12.5px] top-0 cursor-pointer rounded bg-slate-700 py-1 px-2 text-xs font-medium hover:bg-indigo-500"
                    onClick={() => {
                      setFromValue(maxAmountFormattedFree);
                    }}
                  >
                    MAX
                  </div>
                )}
              </div>
              <div className="text-right text-[21px]">USD</div>
            </div>
          </div>
          {orderOption === STOP && (
            <div className="mb-2 rounded bg-slate-700 p-4 shadow">
              <div className="grid grid-cols-2 pb-[12.5px] text-[14px]">
                <div className="opacity-70">
                  <Trans>Price</Trans>
                </div>
                <div
                  className="flex cursor-pointer items-end justify-end text-end opacity-70"
                  onClick={() => {
                    setTriggerPriceValue(formatAmountFree(position.markPrice, USD_DECIMALS, 2));
                  }}
                >
                  Mark: {formatAmount(position.markPrice, USD_DECIMALS, 2, true)}
                </div>
              </div>
              <div className="grid grid-cols-[1fr_auto] pb-[3.1px]">
                <div className="relative overflow-hidden">
                  <input
                    type="number"
                    min="0"
                    placeholder="0.0"
                    className="w-full overflow-hidden text-ellipsis whitespace-nowrap border-none bg-transparent p-0 pr-5 text-xl text-slate-200 placeholder-slate-400 ring-offset-0 focus:outline-none focus:ring-0"
                    value={triggerPriceValue}
                    onChange={onTriggerPriceChange}
                  />
                </div>
                <div className="text-right text-[21px]">USD</div>
              </div>
            </div>
          )}
          {renderMinProfitWarning()}
          {shouldShowExistingOrderWarning && renderExistingOrderWarning()}
          <div className="mb-[10.5px]">
            {minExecutionFeeErrorMessage && (
              <div className="mt-[10px] mb-[15px] px-[10px] text-center text-[14px]">{minExecutionFeeErrorMessage}</div>
            )}
            {hasPendingProfit && orderOption !== STOP && (
              <div>
                <Checkbox
                  isChecked={isProfitWarningAccepted}
                  setIsChecked={setIsProfitWarningAccepted}
                  className="rtl-grid mb-[4.65px] !grid w-full grid-cols-[1fr_auto] text-[14px]"
                >
                  <span className="opacity-70">Forfeit profit</span>
                </Checkbox>
              </div>
            )}
            <div>
              <Checkbox
                isChecked={keepLeverage}
                setIsChecked={setKeepLeverage}
                className="rtl-grid mb-[4.65px] !grid w-full grid-cols-[1fr_auto] text-[14px]"
              >
                <span className="font-sm opacity-70">Keep leverage at {formatAmount(position.leverage, 4, 2)}x</span>
              </Checkbox>
            </div>
            {orderOption === MARKET && (
              <div>
                <Checkbox
                  isChecked={isHigherSlippageAllowed}
                  setIsChecked={setIsHigherSlippageAllowed}
                  className="rtl-grid mb-[4.65px] !grid w-full grid-cols-[1fr_auto] text-[14px]"
                >
                  <span className="font-sm opacity-70">Allow up to 1% slippage</span>
                </Checkbox>
              </div>
            )}
            {orderOption === MARKET && (
              <div>
                <ExchangeInfoRow label="Allowed Slippage">
                  <Tooltip
                    handle={`${formatAmount(allowedSlippage, 2, 2)}%`}
                    position="right-bottom"
                    renderContent={() => {
                      return (
                        <>
                          You can change this in the settings menu on the top right of the page.
                          <br />
                          <br />
                          Note that a low allowed slippage, e.g. less than 0.5%, may result in failed orders if prices
                          are volatile.
                        </>
                      );
                    }}
                  />
                </ExchangeInfoRow>
              </div>
            )}
            {orderOption === STOP && (
              <div className="mb-[4.65px] grid grid-cols-[auto_auto] text-xs font-medium text-slate-200">
                <div className="mr-2 text-xs font-medium text-slate-600">
                  <Trans>Trigger Price</Trans>
                </div>
                <div className="flex items-end justify-end text-end">
                  {!triggerPriceUsd && "-"}
                  {triggerPriceUsd && `${triggerPricePrefix} ${formatAmount(triggerPriceUsd, USD_DECIMALS, 2, true)}`}
                </div>
              </div>
            )}
            <div className="mt-[15px] mb-[4.65px] grid grid-cols-2 border border-slate-800 p-[8px] text-[14px]">
              <div className="mr-2 text-xs font-medium text-slate-600">
                <Trans>Mark Price</Trans>
              </div>
              <div className="flex items-end justify-end text-end">
                ${formatAmount(position.markPrice, USD_DECIMALS, 2, true)}
              </div>
            </div>
            <div className="mb-[4.65px] grid grid-cols-[auto_auto] text-xs font-medium text-slate-200">
              <div className="mr-2 text-xs font-medium text-slate-600">
                <Trans>Entry Price</Trans>
              </div>
              <div className="flex items-end justify-end text-end">
                ${formatAmount(position.averagePrice, USD_DECIMALS, 2, true)}
              </div>
            </div>
            <div className="mb-[4.65px] grid grid-cols-[auto_auto] text-xs font-medium text-slate-200">
              <div className="mr-2 text-xs font-medium text-slate-600">
                <Trans>Liq. Price</Trans>
              </div>
              <div className="flex items-end justify-end text-end">
                {isClosing && orderOption !== STOP && "-"}
                {(!isClosing || orderOption === STOP) && (
                  <div>
                    {(!nextLiquidationPrice || nextLiquidationPrice.eq(liquidationPrice)) && (
                      <div>{`$${formatAmount(liquidationPrice, USD_DECIMALS, 2, true)}`}</div>
                    )}
                    {nextLiquidationPrice && !nextLiquidationPrice.eq(liquidationPrice) && (
                      <div>
                        <div className="inline-flex flex-row items-center opacity-70">
                          ${formatAmount(liquidationPrice, USD_DECIMALS, 2, true)}
                          <BsArrowRight className="-mt-[3.1px] align-middle" />
                        </div>
                        ${formatAmount(nextLiquidationPrice, USD_DECIMALS, 2, true)}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
            <div className="mt-[15px] mb-[4.65px] grid grid-cols-2 border border-slate-800 p-[8px] text-[14px]">
              <div className="mr-2 text-xs font-medium text-slate-600">
                <Trans>Size</Trans>
              </div>
              <div className="flex items-end justify-end text-end">
                {position && position.size && fromAmount && (
                  <div>
                    <div className="inline-flex flex-row items-center opacity-70">
                      ${formatAmount(position.size, USD_DECIMALS, 2, true)}
                      <BsArrowRight className="-mt-[3.1px] align-middle" />
                    </div>
                    ${formatAmount(position.size.sub(fromAmount), USD_DECIMALS, 2, true)}
                  </div>
                )}
                {position && position.size && !fromAmount && (
                  <div>${formatAmount(position.size, USD_DECIMALS, 2, true)}</div>
                )}
              </div>
            </div>
            <div className="mb-[4.65px] grid grid-cols-[auto_auto] text-xs font-medium text-slate-200">
              <div className="mr-2 text-xs font-medium text-slate-600">
                <Trans>Collateral ({collateralToken.symbol})</Trans>
              </div>
              <div className="flex items-end justify-end text-end">
                {nextCollateral && !nextCollateral.eq(position.collateral) ? (
                  <div>
                    <div className="inline-flex flex-row items-center opacity-70">
                      ${formatAmount(position.collateral, USD_DECIMALS, 2, true)}
                      <BsArrowRight className="-mt-[3.1px] align-middle" />
                    </div>
                    ${formatAmount(nextCollateral, USD_DECIMALS, 2, true)}
                  </div>
                ) : (
                  `$${formatAmount(position.collateral, USD_DECIMALS, 4, true)}`
                )}
              </div>
            </div>
            {!keepLeverage && (
              <div className="mb-[4.65px] grid grid-cols-[auto_auto] text-xs font-medium text-slate-200">
                <div className="mr-2 text-xs font-medium text-slate-600">
                  <Trans>Leverage</Trans>
                </div>
                <div className="flex items-end justify-end text-end">
                  {isClosing && "-"}
                  {!isClosing && (
                    <div>
                      {!nextLeverage && <div>{formatAmount(position.leverage, 4, 2)}x</div>}
                      {nextLeverage && (
                        <div>
                          <div className="inline-flex flex-row items-center opacity-70">
                            {formatAmount(position.leverage, 4, 2)}x
                            <BsArrowRight className="-mt-[3.1px] align-middle" />
                          </div>
                          {formatAmount(nextLeverage, 4, 2)}x
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )}
            <div className="mb-[4.65px] grid grid-cols-[auto_auto] text-xs font-medium text-slate-200">
              <div className="mr-2 text-xs font-medium text-slate-600">
                <Trans>PnL</Trans>
              </div>
              <div className="flex items-end justify-end text-end">
                {deltaStr} ({deltaPercentageStr})
              </div>
            </div>

            <div className="mb-[4.65px] grid grid-cols-[auto_auto] text-xs font-medium text-slate-200">
              <div className="mr-2 text-xs font-medium text-slate-600">
                <Trans>Fees</Trans>
              </div>
              <div className="flex items-end justify-end text-end">
                <Tooltip
                  position="right-top"
                  className="PositionSeller-fees-tooltip"
                  handle={
                    <div>
                      {totalFees ? `$${formatAmount(totalFees.add(executionFeeUsd), USD_DECIMALS, 2, true)}` : "-"}
                    </div>
                  }
                  renderContent={() => (
                    <div>
                      {fundingFee && (
                        <StatsTooltipRow label="Borrow fee" value={formatAmount(fundingFee, USD_DECIMALS, 2, true)} />
                      )}

                      {positionFee && (
                        <StatsTooltipRow label="Closing fee" value={formatAmount(positionFee, USD_DECIMALS, 2, true)} />
                      )}

                      {swapFee && (
                        <StatsTooltipRow
                          label="Swap fee"
                          showDollar={false}
                          value={`${formatAmount(swapFeeToken, collateralToken.decimals, 5)} ${collateralToken.symbol}
                           ($${formatAmount(swapFee, USD_DECIMALS, 2, true)})`}
                        />
                      )}

                      <StatsTooltipRow
                        label="Execution fee"
                        showDollar={false}
                        value={`${formatAmount(executionFee, 18, 5, true)} ${nativeTokenSymbol} ($${formatAmount(
                          executionFeeUsd,
                          USD_DECIMALS,
                          2
                        )})`}
                      />

                      <br />

                      <div className="mb-1">
                        <a
                          className="text-slate-300 underline"
                          href="https://xdx.exchange/docs"
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          More Info
                        </a>{" "}
                        about fees.
                      </div>
                    </div>
                  )}
                />
              </div>
            </div>
            <div className="mt-[15px] mb-[4.65px] flex flex-row items-center justify-between border border-slate-800 p-[8px] text-[14px]">
              <div className="mr-2 text-xs font-medium text-slate-600">
                <Trans>Receive</Trans>
              </div>

              {!isSwapAllowed && receiveToken && (
                <div className="inline-block flex-1 items-end justify-end whitespace-normal text-end">
                  {formatAmount(convertedReceiveAmount, receiveToken.decimals, 4, true)}&nbsp;{receiveToken.symbol} ($
                  {formatAmount(receiveAmount, USD_DECIMALS, 2, true)})
                </div>
              )}

              {isSwapAllowed && receiveToken && (
                <div className="flex items-end justify-end text-end">
                  <TokenSelector
                    // Scroll lock lead to side effects
                    // if it applied on modal inside another modal
                    disableBodyScrollLock={true}
                    className={cx("PositionSeller-token-selector", {
                      "text-[#f7931a]": isNotEnoughReceiveTokenLiquidity || isCollateralPoolCapacityExceeded,
                    })}
                    label={"Receive"}
                    showBalances={false}
                    chainId={chainId}
                    tokenAddress={receiveToken.address}
                    onSelectToken={(token) => {
                      setSwapToToken(token);
                      setSavedRecieveTokenAddress(token.address);
                    }}
                    tokens={toTokens}
                    getTokenState={(tokenOptionInfo) => {
                      if (!shouldSwap(collateralToken, tokenOptionInfo)) {
                        return;
                      }

                      const convertedTokenAmount = getTokenAmountFromUsd(
                        infoTokens,
                        tokenOptionInfo.address,
                        receiveAmount
                      );

                      const isNotEnoughLiquidity =
                        tokenOptionInfo.availableAmount.lt(convertedTokenAmount) ||
                        tokenOptionInfo.bufferAmount.gt(tokenOptionInfo.poolAmount.sub(convertedTokenAmount));

                      if (isNotEnoughLiquidity) {
                        const { maxIn, maxOut, maxInUsd, maxOutUsd } = getSwapLimits(
                          infoTokens,
                          collateralToken.address,
                          tokenOptionInfo.address
                        );

                        const collateralInfo = getTokenInfo(infoTokens, collateralToken.address);

                        return {
                          disabled: true,
                          message: (
                            <div>
                              Insufficient Available Liquidity to swap to {tokenOptionInfo.symbol}:
                              <br />
                              <br />
                              <StatsTooltipRow
                                label={`Max ${collateralInfo.symbol} in`}
                                value={[
                                  `${formatAmount(maxIn, collateralInfo.decimals, 0, true)} ${collateralInfo.symbol}`,
                                  `($${formatAmount(maxInUsd, USD_DECIMALS, 0, true)})`,
                                ]}
                              />
                              <br />
                              <br />
                              Max {tokenOptionInfo.symbol} out:{" "}
                              {formatAmount(maxOut, tokenOptionInfo.decimals, 2, true)} {tokenOptionInfo.symbol}
                              <br />
                              (${formatAmount(maxOutUsd, USD_DECIMALS, 2, true)})
                            </div>
                          ),
                        };
                      }
                    }}
                    infoTokens={infoTokens}
                    showTokenImgInDropdown={true}
                    selectedTokenLabel={
                      <span className="inline-block flex-1 whitespace-normal">
                        {formatAmount(convertedReceiveAmount, receiveToken.decimals, 4, true)}&nbsp;
                        {receiveToken.symbol} (${formatAmount(receiveAmount, USD_DECIMALS, 2, true)})
                      </span>
                    }
                  />
                </div>
              )}
            </div>
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
      )}
    </div>
  );
}
