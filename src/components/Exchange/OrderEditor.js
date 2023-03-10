import React, { useState, useMemo } from "react";
import { BsArrowRight } from "react-icons/bs";

import {
  PRECISION,
  USD_DECIMALS,
  SWAP,
  MIN_PROFIT_TIME,
  DECREASE,
  INCREASE,
  isTriggerRatioInverted,
  getNextToAmount,
  getExchangeRate,
  getExchangeRateDisplay,
  calculatePositionDelta,
  getLiquidationPrice,
  getDeltaStr,
  getProfitPrice,
} from "lib/legacy";
import { updateSwapOrder, updateIncreaseOrder, updateDecreaseOrder } from "domain/legacy";
import Modal from "../Modal/Modal";
import ExchangeInfoRow from "./ExchangeInfoRow";
import { getContract } from "config/contracts";
import { TRIGGER_PREFIX_ABOVE, TRIGGER_PREFIX_BELOW } from "config/ui";
import { getTokenInfo } from "domain/tokens/utils";
import { bigNumberify, formatAmount, formatAmountFree, parseValue } from "lib/numbers";
import { useChainId } from "lib/chains";
import { formatDateTime, getTimeRemaining } from "lib/dates";

export default function OrderEditor(props) {
  const {
    account,
    order,
    setEditingOrder,
    infoTokens,
    pendingTxns,
    setPendingTxns,
    library,
    totalTokenWeights,
    usdgSupply,
    getPositionForOrder,
    positionsMap,
    savedShouldDisableValidationForTesting,
  } = props;

  const { chainId } = useChainId();

  const position = order.type !== SWAP ? getPositionForOrder(account, order, positionsMap) : null;
  const liquidationPrice = order.type === DECREASE && position ? getLiquidationPrice(position) : null;

  const [isSubmitting, setIsSubmitting] = useState(false);

  const nativeTokenAddress = getContract(chainId, "NATIVE_TOKEN");
  const fromTokenInfo = order.type === SWAP ? getTokenInfo(infoTokens, order.path[0], true, nativeTokenAddress) : null;
  const toTokenInfo =
    order.type === SWAP
      ? getTokenInfo(infoTokens, order.path[order.path.length - 1], order.shouldUnwrap, nativeTokenAddress)
      : null;

  const triggerRatioInverted = useMemo(() => {
    if (order.type !== SWAP) {
      return null;
    }

    return isTriggerRatioInverted(fromTokenInfo, toTokenInfo);
  }, [toTokenInfo, fromTokenInfo, order.type]);

  let initialRatio = 0;
  if (order.triggerRatio) {
    initialRatio = triggerRatioInverted ? PRECISION.mul(PRECISION).div(order.triggerRatio) : order.triggerRatio;
  }
  const [triggerRatioValue, setTriggerRatioValue] = useState(formatAmountFree(initialRatio, USD_DECIMALS, 6));

  const [triggerPriceValue, setTriggerPriceValue] = useState(formatAmountFree(order.triggerPrice, USD_DECIMALS, 4));
  const triggerPrice = useMemo(() => {
    return triggerPriceValue ? parseValue(triggerPriceValue, USD_DECIMALS) : 0;
  }, [triggerPriceValue]);

  const triggerRatio = useMemo(() => {
    if (!triggerRatioValue) {
      return bigNumberify(0);
    }
    let ratio = parseValue(triggerRatioValue, USD_DECIMALS);
    if (triggerRatioInverted) {
      ratio = PRECISION.mul(PRECISION).div(ratio);
    }
    return ratio;
  }, [triggerRatioValue, triggerRatioInverted]);

  const indexTokenMarkPrice = useMemo(() => {
    if (order.type === SWAP) {
      return;
    }
    const toTokenInfo = getTokenInfo(infoTokens, order.indexToken);
    return order.isLong ? toTokenInfo.maxPrice : toTokenInfo.minPrice;
  }, [infoTokens, order]);

  let toAmount;
  if (order.type === SWAP) {
    const { amount } = getNextToAmount(
      chainId,
      order.amountIn,
      order.path[0],
      order.path[order.path.length - 1],
      infoTokens,
      undefined,
      triggerRatio,
      usdgSupply,
      totalTokenWeights
    );
    toAmount = amount;
  }

  const onClickPrimary = () => {
    setIsSubmitting(true);

    let func;
    let params;

    if (order.type === SWAP) {
      func = updateSwapOrder;
      params = [chainId, library, order.index, toAmount, triggerRatio, order.triggerAboveThreshold];
    } else if (order.type === DECREASE) {
      func = updateDecreaseOrder;
      params = [
        chainId,
        library,
        order.index,
        order.collateralDelta,
        order.sizeDelta,
        triggerPrice,
        order.triggerAboveThreshold,
      ];
    } else if (order.type === INCREASE) {
      func = updateIncreaseOrder;
      params = [chainId, library, order.index, order.sizeDelta, triggerPrice, order.triggerAboveThreshold];
    }

    params.push({
      successMsg: "Order updated!",
      failMsg: "Order update failed.",
      sentMsg: "Order update submitted!",
      pendingTxns,
      setPendingTxns,
    });

    return func(...params)
      .then(() => {
        setEditingOrder(null);
      })
      .finally(() => {
        setIsSubmitting(false);
      });
  };

  const onTriggerRatioChange = (evt) => {
    setTriggerRatioValue(evt.target.value || "");
  };

  const onTriggerPriceChange = (evt) => {
    setTriggerPriceValue(evt.target.value || "");
  };

  const getError = () => {
    if ((!triggerRatio || triggerRatio.eq(0)) && (!triggerPrice || triggerPrice.eq(0))) {
      return "Enter Price";
    }
    if (order.type === SWAP && triggerRatio.eq(order.triggerRatio)) {
      return "Enter new Price";
    }
    if (order.type !== SWAP && triggerPrice.eq(order.triggerPrice)) {
      return "Enter new Price";
    }
    if (position) {
      if (order.type === DECREASE) {
        if (position.isLong && triggerPrice.lte(liquidationPrice)) {
          return "Price below Liq. Price";
        }
        if (!position.isLong && triggerPrice.gte(liquidationPrice)) {
          return "Price above Liq. Price";
        }
      }

      const { delta, hasProfit } = calculatePositionDelta(triggerPrice, position);
      if (hasProfit && delta.eq(0)) {
        return "Invalid price, see warning";
      }
    }

    if (order.type !== SWAP && indexTokenMarkPrice && !savedShouldDisableValidationForTesting) {
      if (order.triggerAboveThreshold && indexTokenMarkPrice.gt(triggerPrice)) {
        return "Price below Mark Price";
      }
      if (!order.triggerAboveThreshold && indexTokenMarkPrice.lt(triggerPrice)) {
        return "Price above Mark Price";
      }
    }

    if (order.type === SWAP) {
      const currentRate = getExchangeRate(fromTokenInfo, toTokenInfo);
      if (currentRate && !currentRate.gte(triggerRatio)) {
        return `Price is ${triggerRatioInverted ? "below" : "above"} Mark Price`;
      }
    }
  };

  const renderMinProfitWarning = () => {
    if (MIN_PROFIT_TIME === 0 || order.type === SWAP || !position || !triggerPrice || triggerPrice.eq(0)) {
      return null;
    }

    const { delta, pendingDelta, pendingDeltaPercentage, hasProfit } = calculatePositionDelta(triggerPrice, position);
    if (hasProfit && delta.eq(0)) {
      const { deltaStr } = getDeltaStr({
        delta: pendingDelta,
        deltaPercentage: pendingDeltaPercentage,
        hasProfit,
      });
      const profitPrice = getProfitPrice(triggerPrice, position);
      const minProfitExpiration = position.lastIncreasedTime + MIN_PROFIT_TIME;
      return (
        <div className="mt-[10px] mb-[15px] px-[10px] text-center text-[14px]">
          This order will forfeit a&nbsp;
          <a
            className="text-slate-300 underline"
            href="https://xdx.exchange/docs"
            target="_blank"
            rel="noopener noreferrer"
          >
            profit
          </a>{" "}
          of {deltaStr}. <br />
          Profit price: {position.isLong ? ">" : "<"} ${formatAmount(profitPrice, USD_DECIMALS, 2, true)}. This rule
          only applies for the next {getTimeRemaining(minProfitExpiration)}, until {formatDateTime(minProfitExpiration)}
          .
        </div>
      );
    }
  };

  const isPrimaryEnabled = () => {
    if (isSubmitting) {
      return false;
    }
    const error = getError();
    if (error) {
      return false;
    }

    return true;
  };

  const getPrimaryText = () => {
    const error = getError();
    if (error) {
      return error;
    }

    if (isSubmitting) {
      return "Updating Order...";
    }
    return "Update Order";
  };

  if (order.type !== SWAP) {
    const triggerPricePrefix = order.triggerAboveThreshold ? TRIGGER_PREFIX_ABOVE : TRIGGER_PREFIX_BELOW;
    return (
      <Modal
        isVisible={true}
        className="!w-[360px] text-white"
        setIsVisible={() => setEditingOrder(null)}
        label="Edit order"
      >
        {renderMinProfitWarning()}
        <div className="mb-2 rounded bg-slate-700 p-4 shadow">
          <div className="grid grid-cols-2 pb-[12.5px] text-[14px]">
            <div className="opacity-70">Price</div>
            <div
              className="flex cursor-pointer items-end justify-end text-end opacity-70"
              onClick={() => {
                setTriggerPriceValue(formatAmountFree(indexTokenMarkPrice, USD_DECIMALS, 2));
              }}
            >
              Mark: {formatAmount(indexTokenMarkPrice, USD_DECIMALS, 2)}
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
        <ExchangeInfoRow label="Price">
          {triggerPrice && !triggerPrice.eq(order.triggerPrice) ? (
            <>
              <span className="opacity-70">
                {triggerPricePrefix} {formatAmount(order.triggerPrice, USD_DECIMALS, 2, true)}
              </span>
              &nbsp;
              <BsArrowRight />
              &nbsp;
              {triggerPricePrefix} {formatAmount(triggerPrice, USD_DECIMALS, 2, true)}
            </>
          ) : (
            <span>
              {triggerPricePrefix} {formatAmount(order.triggerPrice, USD_DECIMALS, 2, true)}
            </span>
          )}
        </ExchangeInfoRow>
        {liquidationPrice && (
          <div className="mb-[4.65px] grid grid-cols-[auto_auto] text-xs text-slate-200 font-medium">
            <div className="mr-2 text-slate-600 text-xs font-medium font-medium">Liq. Price</div>
            <div className="flex items-end justify-end text-end">{`$${formatAmount(
              liquidationPrice,
              USD_DECIMALS,
              2,
              true
            )}`}</div>
          </div>
        )}
        <div className="pt-[3.1px]">
          <button
            className="w-full  rounded-[3px] bg-slate-800 p-[15px] text-[14px] leading-none hover:bg-[#4f60fc] hover:shadow disabled:cursor-not-allowed"
            onClick={onClickPrimary}
            disabled={!isPrimaryEnabled()}
          >
            {getPrimaryText()}
          </button>
        </div>
      </Modal>
    );
  }

  return (
    <Modal
      isVisible={true}
      className="!w-[360px] text-white"
      setIsVisible={() => setEditingOrder(null)}
      label="Edit order"
    >
      <div className="mb-2 rounded bg-slate-700 p-4 shadow">
        <div className="grid grid-cols-2 pb-[12.5px] text-[14px]">
          <div className="opacity-70">Price</div>
          {fromTokenInfo && toTokenInfo && (
            <div
              className="flex cursor-pointer items-end justify-end text-end opacity-70"
              onClick={() => {
                setTriggerRatioValue(
                  formatAmountFree(getExchangeRate(fromTokenInfo, toTokenInfo, triggerRatioInverted), USD_DECIMALS, 10)
                );
              }}
            >
              Mark Price:{" "}
              {formatAmount(getExchangeRate(fromTokenInfo, toTokenInfo, triggerRatioInverted), USD_DECIMALS, 2)}
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
              value={triggerRatioValue}
              onChange={onTriggerRatioChange}
            />
          </div>
          {(() => {
            if (!toTokenInfo) return;
            if (!fromTokenInfo) return;
            const [tokenA, tokenB] = triggerRatioInverted ? [toTokenInfo, fromTokenInfo] : [fromTokenInfo, toTokenInfo];
            return (
              <div className="text-right text-[21px]">
                {tokenA.symbol}&nbsp;/&nbsp;{tokenB.symbol}
              </div>
            );
          })()}
        </div>
      </div>
      <ExchangeInfoRow label="Minimum received">
        {triggerRatio && !triggerRatio.eq(order.triggerRatio) ? (
          <>
            <span className="opacity-70">{formatAmount(order.minOut, toTokenInfo.decimals, 4, true)}</span>
            &nbsp;
            <BsArrowRight />
            &nbsp;
            {formatAmount(toAmount, toTokenInfo.decimals, 4, true)}
          </>
        ) : (
          formatAmount(order.minOut, toTokenInfo.decimals, 4, true)
        )}
        &nbsp;{toTokenInfo.symbol}
      </ExchangeInfoRow>
      <ExchangeInfoRow label="Price">
        {triggerRatio && !triggerRatio.eq(0) && !triggerRatio.eq(order.triggerRatio) ? (
          <>
            <span className="opacity-70">
              {getExchangeRateDisplay(order.triggerRatio, fromTokenInfo, toTokenInfo, {
                omitSymbols: !triggerRatio || !triggerRatio.eq(order.triggerRatio),
              })}
            </span>
            &nbsp;
            <BsArrowRight />
            &nbsp;
            {getExchangeRateDisplay(triggerRatio, fromTokenInfo, toTokenInfo)}
          </>
        ) : (
          getExchangeRateDisplay(order.triggerRatio, fromTokenInfo, toTokenInfo, {
            omitSymbols: !triggerRatio || !triggerRatio.eq(order.triggerRatio),
          })
        )}
      </ExchangeInfoRow>
      {fromTokenInfo && (
        <div className="mb-[4.65px] grid grid-cols-[auto_auto] text-xs text-slate-200 font-medium">
          <div className="mr-2 text-slate-600 text-xs font-medium font-medium">{fromTokenInfo.symbol} price</div>
          <div className="flex items-end justify-end text-end">
            {formatAmount(fromTokenInfo.minPrice, USD_DECIMALS, 2, true)} USD
          </div>
        </div>
      )}
      {toTokenInfo && (
        <div className="mb-[4.65px] grid grid-cols-[auto_auto] text-xs text-slate-200 font-medium">
          <div className="mr-2 text-slate-600 text-xs font-medium font-medium">{toTokenInfo.symbol} price</div>
          <div className="flex items-end justify-end text-end">
            {formatAmount(toTokenInfo.maxPrice, USD_DECIMALS, 2, true)} USD
          </div>
        </div>
      )}
      <div className="pt-[3.1px]">
        <button
          className="w-full rounded-[3px] bg-slate-800 p-[15px] text-[14px] leading-none hover:bg-[#4f60fc] hover:shadow disabled:cursor-not-allowed"
          onClick={onClickPrimary}
          disabled={!isPrimaryEnabled()}
        >
          {getPrimaryText()}
        </button>
      </div>
    </Modal>
  );
}
