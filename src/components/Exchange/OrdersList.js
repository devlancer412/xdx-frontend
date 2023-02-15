import React, { useState, useCallback } from "react";
import { Trans } from "@lingui/macro";
import cx from "classnames";

import {
  SWAP,
  INCREASE,
  DECREASE,
  USD_DECIMALS,
  getOrderError,
  getExchangeRateDisplay,
  getExchangeRate,
  getPositionForOrder,
} from "lib/legacy.js";
import { handleCancelOrder } from "domain/legacy";
import { getContract } from "config/contracts";

import Tooltip from "../Tooltip/Tooltip";
import OrderEditor from "./OrderEditor";

import Checkbox from "../Checkbox/Checkbox";
import StatsTooltipRow from "../StatsTooltip/StatsTooltipRow";
import { TRIGGER_PREFIX_ABOVE, TRIGGER_PREFIX_BELOW } from "config/ui";
import { getTokenInfo, getUsd } from "domain/tokens/utils";
import { formatAmount } from "lib/numbers";

export default function OrdersList(props) {
  const {
    account,
    library,
    setPendingTxns,
    pendingTxns,
    infoTokens,
    positionsMap,
    totalTokenWeights,
    usdgSupply,
    orders,
    hideActions,
    chainId,
    savedShouldDisableValidationForTesting,
    cancelOrderIdList,
    setCancelOrderIdList,
  } = props;

  const [editingOrder, setEditingOrder] = useState(null);

  const onCancelClick = useCallback(
    (order) => {
      handleCancelOrder(chainId, library, order, { pendingTxns, setPendingTxns });
    },
    [library, pendingTxns, setPendingTxns, chainId]
  );

  const onEditClick = useCallback(
    (order) => {
      setEditingOrder(order);
    },
    [setEditingOrder]
  );

  const renderHead = useCallback(() => {
    const isAllOrdersSelected = cancelOrderIdList?.length > 0 && cancelOrderIdList?.length === orders.length;
    return (
      <tr className="border-b border-slate-800 bg-slate-950 bg-opacity-50 text-left text-xs font-medium font-medium uppercase text-slate-300">
        {orders.length > 0 && (
          <th className="py-2 pl-[15px] font-normal text-slate-400">
            <div className="inline-flex">
              <Checkbox
                className="!mb-0"
                isChecked={isAllOrdersSelected}
                setIsChecked={() => {
                  if (isAllOrdersSelected) {
                    setCancelOrderIdList([]);
                  } else {
                    const allOrderIds = orders.map((o) => `${o.type}-${o.index}`);
                    setCancelOrderIdList(allOrderIds);
                  }
                }}
              />
            </div>
          </th>
        )}

        <th className={cx("py-2", { "pl-4": !orders.length })}>
          <div>
            <Trans>Type</Trans>
          </div>
        </th>
        <th className="py-2 pl-0">
          <div>
            <Trans>Order</Trans>
          </div>
        </th>
        <th className="py-2 pl-0">
          <div>
            <Trans>Price</Trans>
          </div>
        </th>
        <th className="py-2 pr-4">
          <div>
            <Trans>Mark Price</Trans>
          </div>
        </th>
        <th></th>
        <th></th>
      </tr>
    );
  }, [cancelOrderIdList, orders, setCancelOrderIdList]);

  const renderEmptyRow = useCallback(() => {
    if (orders && orders.length) {
      return null;
    }

    return (
      <tr>
        <td colSpan="5" className="p-[10.5px] px-[15px] text-center text-sm text-slate-600">
          <Trans>No open orders</Trans>
        </td>
      </tr>
    );
  }, [orders]);

  const renderActions = useCallback(
    (order) => {
      return (
        <>
          <td className="p-[10.5px] py-[14px] pl-0">
            <button
              className="mx-[3px] rounded-[3px] p-0 text-[15px] text-slate-600"
              onClick={() => onEditClick(order)}
            >
              <Trans>Edit</Trans>
            </button>
          </td>
          <td className="p-[10.5px] py-[14px] pl-0">
            <button
              className="mx-[3px] rounded-[3px] p-0 text-[15px] text-slate-600"
              onClick={() => onCancelClick(order)}
            >
              <Trans>Cancel</Trans>
            </button>
          </td>
        </>
      );
    },
    [onEditClick, onCancelClick]
  );

  const renderLargeList = useCallback(() => {
    if (!orders || !orders.length) {
      return null;
    }

    return orders.map((order) => {
      if (order.type === SWAP) {
        const nativeTokenAddress = getContract(chainId, "NATIVE_TOKEN");
        const fromTokenInfo = getTokenInfo(infoTokens, order.path[0], true, nativeTokenAddress);
        const toTokenInfo = getTokenInfo(
          infoTokens,
          order.path[order.path.length - 1],
          order.shouldUnwrap,
          nativeTokenAddress
        );

        const markExchangeRate = getExchangeRate(fromTokenInfo, toTokenInfo);
        const orderId = `${order.type}-${order.index}`;

        return (
          <tr className="border-b-none" key={orderId}>
            <td className="p-[10.5px] py-[14px] pl-[15px]">
              <div className="checkbox-inline">
                <Checkbox
                  isChecked={cancelOrderIdList?.includes(orderId)}
                  className="mb-0"
                  setIsChecked={() => {
                    setCancelOrderIdList((prevState) => {
                      if (prevState.includes(orderId)) {
                        return prevState.filter((i) => i !== orderId);
                      } else {
                        return prevState.concat(orderId);
                      }
                    });
                  }}
                />
              </div>
            </td>
            <td className="p-[10.5px] py-[14px] pl-0">Limit</td>
            <td className="p-[10.5px] py-[14px] pl-0">
              Swap{" "}
              {formatAmount(
                order.amountIn,
                fromTokenInfo.decimals,
                fromTokenInfo.isStable || fromTokenInfo.isUsdg ? 2 : 4,
                true
              )}{" "}
              {fromTokenInfo.symbol} for{" "}
              {formatAmount(
                order.minOut,
                toTokenInfo.decimals,
                toTokenInfo.isStable || toTokenInfo.isUsdg ? 2 : 4,
                true
              )}{" "}
              {toTokenInfo.symbol}
            </td>
            <td className="p-[10.5px] py-[14px] pl-0">
              <Tooltip
                handle={getExchangeRateDisplay(order.triggerRatio, fromTokenInfo, toTokenInfo)}
                renderContent={() => `
                  You will receive at least ${formatAmount(
                    order.minOut,
                    toTokenInfo.decimals,
                    toTokenInfo.isStable || toTokenInfo.isUsdg ? 2 : 4,
                    true
                  )} ${
                  toTokenInfo.symbol
                } if this order is executed. The execution price may vary depending on swap fees at the time the order is executed.
                `}
              />
            </td>
            <td className="p-[10.5px] py-[14px] pl-0">
              {getExchangeRateDisplay(markExchangeRate, fromTokenInfo, toTokenInfo, true)}
            </td>
            {!hideActions && renderActions(order)}
          </tr>
        );
      }

      const indexToken = getTokenInfo(infoTokens, order.indexToken);

      // Longs Increase: max price
      // Longs Decrease: min price
      // Short Increase: min price
      // Short Decrease: max price
      const maximisePrice = (order.type === INCREASE && order.isLong) || (order.type === DECREASE && !order.isLong);

      const markPrice = maximisePrice ? indexToken.contractMaxPrice : indexToken.contractMinPrice;
      const triggerPricePrefix = order.triggerAboveThreshold ? TRIGGER_PREFIX_ABOVE : TRIGGER_PREFIX_BELOW;
      const indexTokenSymbol = indexToken.isWrapped ? indexToken.baseSymbol : indexToken.symbol;

      const error = getOrderError(account, order, positionsMap);
      const orderId = `${order.type}-${order.index}`;
      const orderText = (
        <>
          {order.type === INCREASE ? "Increase" : "Decrease"} {indexTokenSymbol} {order.isLong ? "Long" : "Short"}
          &nbsp;by ${formatAmount(order.sizeDelta, USD_DECIMALS, 2, true)}
          {error && <div className="mt-[4.65px] text-[14px] text-[#fa3c58]">{error}</div>}
        </>
      );

      return (
        <tr className="border-b-none" key={`${order.isLong}-${order.type}-${order.index}`}>
          <td className="p-[10.5px] py-[14px] pl-[15px]">
            <div className="flex h-full flex-row items-center">
              <Checkbox
                isChecked={cancelOrderIdList?.includes(orderId)}
                className="mb-0"
                setIsChecked={() => {
                  setCancelOrderIdList((prevState) => {
                    if (prevState.includes(orderId)) {
                      return prevState.filter((i) => i !== orderId);
                    } else {
                      return prevState.concat(orderId);
                    }
                  });
                }}
              />
            </div>
          </td>
          <td className="p-[10.5px] py-[14px] pl-0">{order.type === INCREASE ? "Limit" : "Trigger"}</td>
          <td className="p-[10.5px] py-[14px] pl-0">
            {order.type === DECREASE ? (
              orderText
            ) : (
              <Tooltip
                handle={orderText}
                position="right-bottom"
                renderContent={() => {
                  const collateralTokenInfo = getTokenInfo(infoTokens, order.purchaseToken);
                  const collateralUSD = getUsd(order.purchaseTokenAmount, order.purchaseToken, false, infoTokens);
                  return (
                    <StatsTooltipRow
                      label="Collateral"
                      value={`${formatAmount(collateralUSD, USD_DECIMALS, 2, true)} (${formatAmount(
                        order.purchaseTokenAmount,
                        collateralTokenInfo.decimals,
                        4,
                        true
                      )}
                      ${collateralTokenInfo.baseSymbol || collateralTokenInfo.symbol})`}
                    />
                  );
                }}
              />
            )}
          </td>
          <td className="p-[10.5px] py-[14px] pl-0">
            {triggerPricePrefix} {formatAmount(order.triggerPrice, USD_DECIMALS, 2, true)}
          </td>
          <td className="p-[10.5px] py-[14px] pl-0">
            <Tooltip
              handle={formatAmount(markPrice, USD_DECIMALS, 2, true)}
              position="right-bottom"
              renderContent={() => {
                return (
                  <Trans>
                    The price that orders can be executed at may differ slightly from the chart price, as market orders
                    update oracle prices, while limit/trigger orders do not.
                  </Trans>
                );
              }}
            />
          </td>
          {!hideActions && renderActions(order)}
        </tr>
      );
    });
  }, [
    orders,
    renderActions,
    infoTokens,
    positionsMap,
    hideActions,
    chainId,
    account,
    cancelOrderIdList,
    setCancelOrderIdList,
  ]);

  const renderSmallList = useCallback(() => {
    if (!orders || !orders.length) {
      return null;
    }

    return orders.map((order) => {
      if (order.type === SWAP) {
        const nativeTokenAddress = getContract(chainId, "NATIVE_TOKEN");
        const fromTokenInfo = getTokenInfo(infoTokens, order.path[0], true, nativeTokenAddress);
        const toTokenInfo = getTokenInfo(
          infoTokens,
          order.path[order.path.length - 1],
          order.shouldUnwrap,
          nativeTokenAddress
        );
        const markExchangeRate = getExchangeRate(fromTokenInfo, toTokenInfo);

        return (
          <div
            key={`${order.type}-${order.index}`}
            className="relative rounded border border-slate-800 text-xs font-medium shadow"
          >
            <div className="flex items-center justify-start rounded-t bg-slate-950 p-[15px] py-3.5 text-xs font-medium font-medium uppercase text-slate-600">
              Swap {formatAmount(order.amountIn, fromTokenInfo.decimals, fromTokenInfo.isStable ? 2 : 4, true)}{" "}
              {fromTokenInfo.symbol} for{" "}
              {formatAmount(order.minOut, toTokenInfo.decimals, toTokenInfo.isStable ? 2 : 4, true)}{" "}
              {toTokenInfo.symbol}
            </div>
            <div className="mb-[10.5px] h-[1px] bg-slate-800"></div>
            <div className="grid grid-cols-1 gap-2">
              <div className="mx-[15px] grid grid-cols-[1fr_auto] gap-[15px]">
                <div className="text-slate-400">Price</div>
                <div>
                  <Tooltip
                    position="right-bottom"
                    handle={getExchangeRateDisplay(order.triggerRatio, fromTokenInfo, toTokenInfo)}
                    renderContent={() => `
                    You will receive at least ${formatAmount(
                      order.minOut,
                      toTokenInfo.decimals,
                      toTokenInfo.isStable || toTokenInfo.isUsdg ? 2 : 4,
                      true
                    )} ${
                      toTokenInfo.symbol
                    } if this order is executed. The exact execution price may vary depending on fees at the time the order is executed.
                  `}
                  />
                </div>
              </div>
              <div className="mx-[15px] grid grid-cols-[1fr_auto] gap-[15px]">
                <div className="text-slate-400">
                  <Trans>Mark Price</Trans>
                </div>
                <div>{getExchangeRateDisplay(markExchangeRate, fromTokenInfo, toTokenInfo)}</div>
              </div>
              {!hideActions && (
                <>
                  <div className="my-[10.5px] h-[1px] bg-slate-800"></div>
                  <div className="-m-[6.2px] mx-[9px] mb-[12px]">
                    <button
                      className="relative m-[6.2px] box-border inline-flex min-h-[36px] cursor-pointer items-center rounded bg-slate-700 px-4 text-[14px] leading-[20px] text-slate-300  hover:bg-[#4f60fc]"
                      onClick={() => onEditClick(order)}
                    >
                      <Trans>Edit</Trans>
                    </button>
                    <button
                      className="relative m-[6.2px] box-border inline-flex min-h-[36px] cursor-pointer items-center rounded bg-slate-700 px-4 text-[14px] leading-[20px] text-slate-300  hover:bg-[#4f60fc]"
                      onClick={() => onCancelClick(order)}
                    >
                      <Trans>Cancel</Trans>
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        );
      }

      const indexToken = getTokenInfo(infoTokens, order.indexToken);
      const maximisePrice = (order.type === INCREASE && order.isLong) || (order.type === DECREASE && !order.isLong);
      const markPrice = maximisePrice ? indexToken.contractMaxPrice : indexToken.contractMinPrice;
      const triggerPricePrefix = order.triggerAboveThreshold ? TRIGGER_PREFIX_ABOVE : TRIGGER_PREFIX_BELOW;
      const indexTokenSymbol = indexToken.isWrapped ? indexToken.baseSymbol : indexToken.symbol;

      const collateralTokenInfo = getTokenInfo(infoTokens, order.purchaseToken ?? order.collateralToken);
      const collateralUSD = getUsd(
        order.purchaseTokenAmount,
        order.purchaseToken ?? order.collateralToken,
        true,
        infoTokens
      );

      const error = getOrderError(account, order, positionsMap);

      return (
        <div
          key={`${order.isLong}-${order.type}-${order.index}`}
          className="relative border border-slate-800 text-xs font-medium shadow"
        >
          <div className="flex items-center justify-start rounded-t bg-slate-950 p-[15px] py-3.5 text-xs font-medium font-medium uppercase text-slate-600">
            {order.type === INCREASE ? "Increase" : "Decrease"} {indexTokenSymbol} {order.isLong ? "Long" : "Short"}
            &nbsp;by ${formatAmount(order.sizeDelta, USD_DECIMALS, 2, true)}
            {error && <div className="mt-[4.65px] text-[14px] text-[#fa3c58]">{error}</div>}
          </div>
          <div className="my-[10.5px] h-[1px] bg-slate-800"></div>
          <div className="grid grid-cols-1 gap-2">
            <div className="mx-[15px] grid grid-cols-[1fr_auto] gap-[15px]">
              <div className="text-slate-400">
                <Trans>Price</Trans>
              </div>
              <div>
                {triggerPricePrefix} {formatAmount(order.triggerPrice, USD_DECIMALS, 2, true)}
              </div>
            </div>
            <div className="mx-[15px] grid grid-cols-[1fr_auto] gap-[15px]">
              <div className="text-slate-400">
                <Trans>Mark Price</Trans>
              </div>
              <div>
                <Tooltip
                  handle={formatAmount(markPrice, USD_DECIMALS, 2, true)}
                  position="right-bottom"
                  renderContent={() => {
                    return (
                      <Trans>
                        The price that the order can be executed at may differ slightly from the chart price as market
                        orders can change the price while limit / trigger orders cannot.
                      </Trans>
                    );
                  }}
                />
              </div>
            </div>
            {order.type === INCREASE && (
              <div className="mx-[15px] grid grid-cols-[1fr_auto] gap-[15px]">
                <div className="text-slate-400">
                  <Trans>Collateral</Trans>
                </div>
                <div>
                  ${formatAmount(collateralUSD, USD_DECIMALS, 2, true)} (
                  {formatAmount(order.purchaseTokenAmount, collateralTokenInfo.decimals, 4, true)}{" "}
                  {collateralTokenInfo.baseSymbol || collateralTokenInfo.symbol})
                </div>
              </div>
            )}
            {!hideActions && (
              <>
                <div className="my-[10.5px] h-[1px] bg-slate-800"></div>
                <div className="-m-[6.2px] mx-[9px] mb-[12px]">
                  <button
                    className="relative m-[6.2px] box-border inline-flex min-h-[36px] cursor-pointer items-center rounded bg-slate-700 px-4 text-[14px] leading-[20px] text-slate-300  hover:bg-[#4f60fc]"
                    onClick={() => onEditClick(order)}
                  >
                    <Trans>Edit</Trans>
                  </button>
                  <button
                    className="relative m-[6.2px] box-border inline-flex min-h-[36px] cursor-pointer items-center rounded bg-slate-700 px-4 text-[14px] leading-[20px] text-slate-300  hover:bg-[#4f60fc]"
                    onClick={() => onCancelClick(order)}
                  >
                    <Trans>Cancel</Trans>
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      );
    });
  }, [orders, onEditClick, onCancelClick, infoTokens, positionsMap, hideActions, chainId, account]);

  return (
    <React.Fragment>
      <table className="relative hidden w-full border-collapse border border-slate-800 text-[15px] xl:table">
        <tbody>
          {renderHead()}
          {renderEmptyRow()}
          {renderLargeList()}
        </tbody>
      </table>
      <div className="table w-full xl:hidden">
        {(!orders || orders.length === 0) && (
          <div className="border-y border-slate-800 p-[10.5px] px-[15px] text-center text-sm text-slate-600">
            No open orders
          </div>
        )}
        {renderSmallList()}
      </div>
      {editingOrder && (
        <OrderEditor
          account={account}
          order={editingOrder}
          setEditingOrder={setEditingOrder}
          infoTokens={infoTokens}
          pendingTxns={pendingTxns}
          setPendingTxns={setPendingTxns}
          getPositionForOrder={getPositionForOrder}
          positionsMap={positionsMap}
          library={library}
          totalTokenWeights={totalTokenWeights}
          usdgSupply={usdgSupply}
          savedShouldDisableValidationForTesting={savedShouldDisableValidationForTesting}
        />
      )}
    </React.Fragment>
  );
}
