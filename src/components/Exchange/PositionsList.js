import React, { useState } from "react";
import cx from "classnames";
import { Trans, t } from "@lingui/macro";
import Tooltip from "../Tooltip/Tooltip";
import PositionSeller from "./PositionSeller";
import PositionEditor from "./PositionEditor";
import OrdersToa from "./OrdersToa";

import { ImSpinner2 } from "react-icons/im";

import {
  getLiquidationPrice,
  getLeverage,
  getOrderError,
  USD_DECIMALS,
  FUNDING_RATE_PRECISION,
  SWAP,
  LONG,
  SHORT,
  INCREASE,
  DECREASE,
} from "lib/legacy";
import PositionShare from "./PositionShare";
import PositionDropdown from "./PositionDropdown";
import StatsTooltipRow from "../StatsTooltip/StatsTooltipRow";
import { helperToast } from "lib/helperToast";
import { getUsd } from "domain/tokens/utils";
import { bigNumberify, formatAmount } from "lib/numbers";

const getOrdersForPosition = (account, position, orders, nativeTokenAddress) => {
  if (!orders || orders.length === 0) {
    return [];
  }
  /* eslint-disable array-callback-return */
  return orders
    .filter((order) => {
      if (order.type === SWAP) {
        return false;
      }
      const hasMatchingIndexToken =
        order.indexToken === nativeTokenAddress
          ? position.indexToken.isNative
          : order.indexToken === position.indexToken.address;
      const hasMatchingCollateralToken =
        order.collateralToken === nativeTokenAddress
          ? position.collateralToken.isNative
          : order.collateralToken === position.collateralToken.address;
      if (order.isLong === position.isLong && hasMatchingIndexToken && hasMatchingCollateralToken) {
        return true;
      }
    })
    .map((order) => {
      order.error = getOrderError(account, order, undefined, position);
      if (order.type === DECREASE && order.sizeDelta.gt(position.size)) {
        order.error = "Order size is bigger than position, will only be executable if position increases";
      }
      return order;
    });
};

export default function PositionsList(props) {
  const {
    pendingPositions,
    setPendingPositions,
    positions,
    positionsDataIsLoading,
    positionsMap,
    infoTokens,
    active,
    account,
    library,
    pendingTxns,
    setPendingTxns,
    setListSection,
    flagOrdersEnabled,
    savedIsPnlInLeverage,
    chainId,
    nativeTokenAddress,
    orders,
    setIsWaitingForPluginApproval,
    approveOrderBook,
    isPluginApproving,
    isWaitingForPluginApproval,
    orderBookApproved,
    positionRouterApproved,
    isWaitingForPositionRouterApproval,
    isPositionRouterApproving,
    approvePositionRouter,
    showPnlAfterFees,
    setMarket,
    minExecutionFee,
    minExecutionFeeUSD,
    minExecutionFeeErrorMessage,
    usdgSupply,
    totalTokenWeights,
  } = props;

  const [positionToEditKey, setPositionToEditKey] = useState(undefined);
  const [positionToSellKey, setPositionToSellKey] = useState(undefined);
  const [positionToShare, setPositionToShare] = useState(null);
  const [isPositionEditorVisible, setIsPositionEditorVisible] = useState(undefined);
  const [isPositionSellerVisible, setIsPositionSellerVisible] = useState(undefined);
  const [collateralTokenAddress, setCollateralTokenAddress] = useState(undefined);
  const [isPositionShareModalOpen, setIsPositionShareModalOpen] = useState(false);
  const [ordersToaOpen, setOrdersToaOpen] = useState(false);
  const [isHigherSlippageAllowed, setIsHigherSlippageAllowed] = useState(false);

  const editPosition = (position) => {
    setCollateralTokenAddress(position.collateralToken.address);
    setPositionToEditKey(position.key);
    setIsPositionEditorVisible(true);
  };

  const sellPosition = (position) => {
    setPositionToSellKey(position.key);
    setIsPositionSellerVisible(true);
    setIsHigherSlippageAllowed(false);
  };

  const onPositionClick = (position) => {
    helperToast.success(`${position.isLong ? "Long" : "Short"} ${position.indexToken.symbol} market selected`);
    setMarket(position.isLong ? LONG : SHORT, position.indexToken.address);
  };

  return (
    <div className="PositionsList">
      <PositionEditor
        pendingPositions={pendingPositions}
        setPendingPositions={setPendingPositions}
        positionsMap={positionsMap}
        positionKey={positionToEditKey}
        isVisible={isPositionEditorVisible}
        setIsVisible={setIsPositionEditorVisible}
        infoTokens={infoTokens}
        active={active}
        account={account}
        library={library}
        collateralTokenAddress={collateralTokenAddress}
        pendingTxns={pendingTxns}
        setPendingTxns={setPendingTxns}
        getUsd={getUsd}
        getLeverage={getLeverage}
        savedIsPnlInLeverage={savedIsPnlInLeverage}
        positionRouterApproved={positionRouterApproved}
        isPositionRouterApproving={isPositionRouterApproving}
        isWaitingForPositionRouterApproval={isWaitingForPositionRouterApproval}
        approvePositionRouter={approvePositionRouter}
        chainId={chainId}
        minExecutionFee={minExecutionFee}
        minExecutionFeeUSD={minExecutionFeeUSD}
        minExecutionFeeErrorMessage={minExecutionFeeErrorMessage}
      />
      {ordersToaOpen && (
        <OrdersToa
          setIsVisible={setOrdersToaOpen}
          approveOrderBook={approveOrderBook}
          isPluginApproving={isPluginApproving}
        />
      )}
      {true && (
        <PositionShare
          setIsPositionShareModalOpen={setIsPositionShareModalOpen}
          isPositionShareModalOpen={isPositionShareModalOpen}
          positionToShare={positionToShare}
          chainId={chainId}
          account={account}
        />
      )}
      {ordersToaOpen && (
        <OrdersToa
          setIsVisible={setOrdersToaOpen}
          approveOrderBook={approveOrderBook}
          isPluginApproving={isPluginApproving}
        />
      )}
      {isPositionSellerVisible && (
        <PositionSeller
          pendingPositions={pendingPositions}
          setPendingPositions={setPendingPositions}
          setIsWaitingForPluginApproval={setIsWaitingForPluginApproval}
          approveOrderBook={approveOrderBook}
          isPluginApproving={isPluginApproving}
          isWaitingForPluginApproval={isWaitingForPluginApproval}
          orderBookApproved={orderBookApproved}
          positionsMap={positionsMap}
          positionKey={positionToSellKey}
          isVisible={isPositionSellerVisible}
          setIsVisible={setIsPositionSellerVisible}
          infoTokens={infoTokens}
          active={active}
          account={account}
          orders={orders}
          library={library}
          pendingTxns={pendingTxns}
          setPendingTxns={setPendingTxns}
          flagOrdersEnabled={flagOrdersEnabled}
          savedIsPnlInLeverage={savedIsPnlInLeverage}
          chainId={chainId}
          nativeTokenAddress={nativeTokenAddress}
          setOrdersToaOpen={setOrdersToaOpen}
          positionRouterApproved={positionRouterApproved}
          isPositionRouterApproving={isPositionRouterApproving}
          isWaitingForPositionRouterApproval={isWaitingForPositionRouterApproval}
          approvePositionRouter={approvePositionRouter}
          isHigherSlippageAllowed={isHigherSlippageAllowed}
          setIsHigherSlippageAllowed={setIsHigherSlippageAllowed}
          minExecutionFee={minExecutionFee}
          minExecutionFeeUSD={minExecutionFeeUSD}
          minExecutionFeeErrorMessage={minExecutionFeeErrorMessage}
          usdgSupply={usdgSupply}
          totalTokenWeights={totalTokenWeights}
        />
      )}
      {positions && (
        <div className="table w-full xl:hidden">
          <div>
            {positions.length === 0 && positionsDataIsLoading && (
              <div className="relative mb-[15px] border-y border-slate-800 p-[15px] pb-[18.6px] text-[15px]">
                <Trans>Loading...</Trans>
              </div>
            )}
            {positions.length === 0 && !positionsDataIsLoading && (
              <div className="mb-[15px] border-y border-slate-800 p-[10.5px] px-[15px] text-center text-sm text-slate-600">
                <Trans>You have no open positions</Trans>
              </div>
            )}

            {positions.map((position) => {
              const positionOrders = getOrdersForPosition(account, position, orders, nativeTokenAddress);
              const liquidationPrice = getLiquidationPrice(position);
              const hasPositionProfit = position[showPnlAfterFees ? "hasProfitAfterFees" : "hasProfit"];
              const positionDelta =
                position[showPnlAfterFees ? "pendingDeltaAfterFees" : "pendingDelta"] || bigNumberify(0);
              let borrowFeeUSD;
              if (position.collateralToken && position.collateralToken.fundingRate) {
                const borrowFeeRate = position.collateralToken.fundingRate
                  .mul(position.size)
                  .mul(24)
                  .div(FUNDING_RATE_PRECISION);
                borrowFeeUSD = formatAmount(borrowFeeRate, USD_DECIMALS, 2);
              }

              return (
                <div key={position.key} className="relative border border-slate-800 shadow">
                  <div className="flex items-center justify-between bg-slate-950 p-[15px] py-3.5 text-xs font-medium font-medium uppercase text-slate-600">
                    <span className="inline-block w-[31px] whitespace-nowrap">{position.indexToken.symbol}</span>
                  </div>
                  <div className="mb-[10.5px] h-[1px] bg-slate-800"></div>
                  <div className="grid grid-cols-1 gap-[8px]">
                    <div className="mx-[15px] grid grid-cols-[1fr_auto] gap-[15px]">
                      <div className="text-sm text-slate-600">
                        <Trans>Leverage</Trans>
                      </div>
                      <div className="text-right text-sm text-slate-300">
                        {formatAmount(position.leverage, 4, 2, true)}x&nbsp;
                        <span
                          className={cx("text-right", {
                            "text-green-500": position.isLong,
                            "text-[#fa3c58]": !position.isLong,
                          })}
                        >
                          {position.isLong ? t`Long` : t`Short`}
                        </span>
                      </div>
                    </div>
                    <div className="mx-[15px] grid grid-cols-[1fr_auto] gap-[15px]">
                      <div className="text-sm text-slate-600">
                        <Trans>Size</Trans>
                      </div>
                      <div className="text-right text-sm text-slate-300">
                        ${formatAmount(position.size, USD_DECIMALS, 2, true)}
                      </div>
                    </div>
                    <div className="mx-[15px] grid grid-cols-[1fr_auto] gap-[15px]">
                      <div className="text-sm text-slate-600">
                        <Trans>Collateral</Trans>
                      </div>
                      <div className="text-right text-sm text-slate-300">
                        <Tooltip
                          handle={`$${formatAmount(position.collateralAfterFee, USD_DECIMALS, 2, true)}`}
                          position="right-bottom"
                          handleClassName={cx("no-underline", { "text-[#fa3c58]": position.hasLowCollateral })}
                          renderContent={() => {
                            return (
                              <>
                                {position.hasLowCollateral && (
                                  <div>
                                    WARNING: This position has a low amount of collateral after deducting borrowing
                                    fees, deposit more collateral to reduce the position's liquidation risk.
                                    <br />
                                    <br />
                                  </div>
                                )}
                                <StatsTooltipRow
                                  label="Initial Collateral"
                                  value={formatAmount(position.collateral, USD_DECIMALS, 2, true)}
                                />
                                <StatsTooltipRow
                                  label="Borrow Fee"
                                  showDollar={false}
                                  value={`-$${formatAmount(position.fundingFee, USD_DECIMALS, 2, true)}`}
                                />
                                <StatsTooltipRow
                                  showDollar={false}
                                  label={t`Borrow Fee / Day`}
                                  value={`-$${borrowFeeUSD}`}
                                />
                                <span>Use the "Edit" button to deposit or withdraw collateral.</span>
                              </>
                            );
                          }}
                        />
                      </div>
                    </div>
                    <div className="mx-[15px] grid grid-cols-[1fr_auto] gap-[15px]">
                      <div className="text-sm text-slate-600">
                        <Trans>PnL</Trans>
                      </div>
                      <div className="text-right text-sm text-slate-300">
                        <span
                          className={cx("mt-[3.1px] text-[14px]", {
                            "text-green-500": hasPositionProfit,
                            "text-[#fa3c58]": !hasPositionProfit && positionDelta.gt(0),
                            "opacity-70": positionDelta.eq(0),
                          })}
                        >
                          {position.deltaStr} ({position.deltaPercentageStr})
                        </span>
                      </div>
                    </div>
                    <div className="mx-[15px] grid grid-cols-[1fr_auto] gap-[15px]">
                      <div className="text-sm text-slate-600">
                        <Trans>Net Value</Trans>
                      </div>
                      <div className="text-right text-sm text-slate-300">
                        <Tooltip
                          handle={`$${formatAmount(position.netValue, USD_DECIMALS, 2, true)}`}
                          position="right-bottom"
                          handleClassName="no-underline"
                          renderContent={() => {
                            return (
                              <>
                                Net Value:{" "}
                                {showPnlAfterFees
                                  ? "Initial Collateral - Fees + PnL"
                                  : "Initial Collateral - Borrow Fee + PnL"}
                                <br />
                                <br />
                                <StatsTooltipRow
                                  label="Initial Collateral"
                                  value={formatAmount(position.collateral, USD_DECIMALS, 2, true)}
                                />
                                <StatsTooltipRow label="PnL" value={position.deltaBeforeFeesStr} showDollar={false} />
                                <StatsTooltipRow
                                  label="Borrow Fee"
                                  showDollar={false}
                                  value={`-$${formatAmount(position.fundingFee, USD_DECIMALS, 2, true)}`}
                                />
                                <StatsTooltipRow
                                  label="Open + Close fee"
                                  showDollar={false}
                                  value={`-$${formatAmount(position.positionFee, USD_DECIMALS, 2, true)}`}
                                />
                                <StatsTooltipRow
                                  label="PnL After Fees"
                                  value={`${position.deltaAfterFeesStr} (${position.deltaAfterFeesPercentageStr})`}
                                  showDollar={false}
                                />
                              </>
                            );
                          }}
                        />
                      </div>
                    </div>
                    <div className="mx-[15px] grid grid-cols-[1fr_auto] gap-[15px]">
                      <div className="text-sm text-slate-600">
                        <Trans>Orders</Trans>
                      </div>
                      <div className="text-right text-sm text-slate-300">
                        {positionOrders.length === 0 && "None"}
                        {positionOrders.map((order) => {
                          const orderText = () => (
                            <>
                              {order.triggerAboveThreshold ? ">" : "<"} {formatAmount(order.triggerPrice, 30, 2, true)}:
                              {order.type === INCREASE ? " +" : " -"}${formatAmount(order.sizeDelta, 30, 2, true)}
                            </>
                          );
                          if (order.error) {
                            return (
                              <div
                                key={`${order.isLong}-${order.type}-${order.index}`}
                                className="mt-2 whitespace-nowrap"
                              >
                                <Tooltip
                                  className="order-error"
                                  handle={orderText()}
                                  position="right-bottom"
                                  handleClassName="no-underline"
                                  renderContent={() => <span className="text-[#fa3c58]">{order.error}</span>}
                                />
                              </div>
                            );
                          } else {
                            return (
                              <div
                                key={`${order.isLong}-${order.type}-${order.index}`}
                                className="mt-2 whitespace-nowrap"
                              >
                                {orderText()}
                              </div>
                            );
                          }
                        })}
                      </div>
                    </div>
                  </div>
                  <div className="my-[10.5px] h-[1px] bg-slate-800"></div>
                  <div className="grid grid-cols-1 gap-[8px]">
                    <div className="mx-[15px] grid grid-cols-[1fr_auto] gap-[15px]">
                      <div className="text-sm text-slate-600">
                        <Trans>Mark Price</Trans>
                      </div>
                      <div className="text-right text-sm text-slate-300">
                        ${formatAmount(position.markPrice, USD_DECIMALS, 2, true)}
                      </div>
                    </div>
                    <div className="mx-[15px] grid grid-cols-[1fr_auto] gap-[15px]">
                      <div className="text-sm text-slate-600">
                        <Trans>Entry Price</Trans>
                      </div>
                      <div className="text-right text-sm text-slate-300">
                        ${formatAmount(position.averagePrice, USD_DECIMALS, 2, true)}
                      </div>
                    </div>
                    <div className="mx-[15px] grid grid-cols-[1fr_auto] gap-[15px]">
                      <div className="text-sm text-slate-600">
                        <Trans>Liq. Price</Trans>
                      </div>
                      <div className="text-right text-sm text-slate-300">
                        ${formatAmount(liquidationPrice, USD_DECIMALS, 2, true)}
                      </div>
                    </div>
                  </div>
                  <div className="my-[10.5px] h-[1px] bg-slate-800"></div>
                  <div className="-m-[6.2px] mx-[9px] mb-[12px]">
                    <button
                      className="relative m-[6.2px] box-border inline-flex min-h-[36px] cursor-pointer items-center rounded bg-slate-700 px-4 text-[14px] leading-[20px] text-slate-300  hover:bg-[#4f60fc] disabled:cursor-not-allowed disabled:text-slate-500"
                      disabled={position.size.eq(0)}
                      onClick={() => sellPosition(position)}
                    >
                      Close
                    </button>
                    <button
                      className="relative m-[6.2px] box-border inline-flex min-h-[36px] cursor-pointer items-center rounded bg-slate-700 px-4 text-[14px] leading-[20px] text-slate-300  hover:bg-[#4f60fc] disabled:cursor-not-allowed disabled:text-slate-500"
                      disabled={position.size.eq(0)}
                      onClick={() => editPosition(position)}
                    >
                      <Trans> Edit</Trans>
                    </button>
                    <button
                      className="relative m-[6.2px] box-border inline-flex min-h-[36px] cursor-pointer items-center rounded bg-slate-700 px-4 text-[14px] leading-[20px] text-slate-300  hover:bg-[#4f60fc] disabled:cursor-not-allowed disabled:text-slate-500"
                      onClick={() => {
                        setPositionToShare(position);
                        setIsPositionShareModalOpen(true);
                      }}
                      disabled={position.size.eq(0)}
                    >
                      <Trans>Share</Trans>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
      <table className="relative hidden w-full border-collapse border border-slate-800 text-left text-sm xl:table">
        <tbody>
          <tr className="border-b border-slate-800 bg-slate-950 bg-opacity-50 text-left text-xs font-medium font-medium uppercase text-slate-300">
            <th className="py-2 pl-4">
              <Trans>Position</Trans>
            </th>
            <th className="py-2 pl-0">
              <Trans>Net Value</Trans>
            </th>
            <th className="py-2 pl-0">
              <Trans>Size</Trans>
            </th>
            <th className="py-2 pl-0">
              <Trans>Collateral</Trans>
            </th>
            <th className="py-2 pl-0">
              <Trans>Mark Price</Trans>
            </th>
            <th className="py-2 pl-0">
              <Trans>Entry Price</Trans>
            </th>
            <th className="py-2 pl-0">
              <Trans>Liq. Price</Trans>
            </th>
            <th className="py-2 pl-0 text-sm"></th>
            <th className="py-2 pl-0 text-sm"></th>
          </tr>
          {positions.length === 0 && positionsDataIsLoading && (
            <tr>
              <td className="p-[10.5px] px-[15px] text-center text-slate-600" colSpan="15">
                <div className="pb-[4.65px]">Loading...</div>
              </td>
            </tr>
          )}
          {positions.length === 0 && !positionsDataIsLoading && (
            <tr>
              <td className="p-[10.5px] px-[15px] text-center text-slate-600" colSpan="15">
                <div className="">You have no open positions</div>
              </td>
            </tr>
          )}
          {positions.map((position) => {
            const liquidationPrice = getLiquidationPrice(position) || bigNumberify(0);
            const positionOrders = getOrdersForPosition(account, position, orders, nativeTokenAddress);
            const hasOrderError = !!positionOrders.find((order) => order.error);
            const hasPositionProfit = position[showPnlAfterFees ? "hasProfitAfterFees" : "hasProfit"];
            const positionDelta =
              position[showPnlAfterFees ? "pendingDeltaAfterFees" : "pendingDelta"] || bigNumberify(0);
            let borrowFeeUSD;
            if (position.collateralToken && position.collateralToken.fundingRate) {
              const borrowFeeRate = position.collateralToken.fundingRate
                .mul(position.size)
                .mul(24)
                .div(FUNDING_RATE_PRECISION);
              borrowFeeUSD = formatAmount(borrowFeeRate, USD_DECIMALS, 2);
            }

            return (
              <tr key={position.key}>
                <td className="cursor-pointer p-[10.5px] pl-[15px] text-left" onClick={() => onPositionClick(position)}>
                  <div className="inline-block w-[31px] whitespace-nowrap">
                    {position.indexToken.symbol}
                    {position.hasPendingChanges && (
                      <ImSpinner2 className="ml-2 -mt-[3.1px] inline-block animate-spin align-middle text-[12.5px] text-indigo-600" />
                    )}
                  </div>
                  <div className="mt-[3.1px] text-[14px]">
                    {true && <span className="opacity-70">{formatAmount(position.leverage, 4, 2, true)}x&nbsp;</span>}
                    <span className={cx({ "text-green-500": position.isLong, "text-[#fa3c58]": !position.isLong })}>
                      {position.isLong ? "Long" : "Short"}
                    </span>
                  </div>
                </td>
                <td className="p-[10.5px] pl-[15px] text-left">
                  <div>
                    {!position.netValue && "Opening..."}
                    {position.netValue && (
                      <Tooltip
                        handle={`$${formatAmount(position.netValue, USD_DECIMALS, 2, true)}`}
                        position="left-bottom"
                        handleClassName="no-underline"
                        renderContent={() => {
                          return (
                            <>
                              Net Value:{" "}
                              {showPnlAfterFees
                                ? t`Initial Collateral - Fees + PnL`
                                : t`Initial Collateral - Borrow Fee + PnL`}
                              <br />
                              <br />
                              <StatsTooltipRow
                                label={t`Initial Collateral`}
                                value={formatAmount(position.collateral, USD_DECIMALS, 2, true)}
                              />
                              <StatsTooltipRow label={`PnL`} value={position.deltaBeforeFeesStr} showDollar={false} />
                              <StatsTooltipRow
                                label={t`Borrow Fee`}
                                showDollar={false}
                                value={`-$${formatAmount(position.fundingFee, USD_DECIMALS, 2, true)}`}
                              />
                              <StatsTooltipRow
                                label={`Open + Close fee`}
                                showDollar={false}
                                value={`-$${formatAmount(position.positionFee, USD_DECIMALS, 2, true)}`}
                              />
                              <StatsTooltipRow
                                label={`PnL After Fees`}
                                value={`${position.deltaAfterFeesStr} (${position.deltaAfterFeesPercentageStr})`}
                                showDollar={false}
                              />
                            </>
                          );
                        }}
                      />
                    )}
                  </div>
                  {position.deltaStr && (
                    <div
                      className={cx("mt-[3.1px] text-[14px]", {
                        "text-green-500": hasPositionProfit && positionDelta.gt(0),
                        "text-[#fa3c58]": !hasPositionProfit && positionDelta.gt(0),
                        "opacity-70": positionDelta.eq(0),
                      })}
                    >
                      {position.deltaStr} ({position.deltaPercentageStr})
                    </div>
                  )}
                </td>
                <td className="p-[10.5px] pl-[15px] text-left">
                  <div>${formatAmount(position.size, USD_DECIMALS, 2, true)}</div>
                  {positionOrders.length > 0 && (
                    <div onClick={() => setListSection && setListSection("Orders")}>
                      <Tooltip
                        handle={`Orders (${positionOrders.length})`}
                        position="left-bottom"
                        handleClassName={cx(
                          ["text-[14px] mt-[3.1px]", "whitespace-nowrap", "no-underline", "cursor-pointer"],
                          { "opacity-70": !hasOrderError, "text-[#fa3c58]": hasOrderError }
                        )}
                        renderContent={() => {
                          return (
                            <>
                              <strong>Active Orders</strong>
                              {positionOrders.map((order) => {
                                return (
                                  <div
                                    key={`${order.isLong}-${order.type}-${order.index}`}
                                    className="mt-2 whitespace-nowrap"
                                  >
                                    {order.triggerAboveThreshold ? ">" : "<"}{" "}
                                    {formatAmount(order.triggerPrice, 30, 2, true)}:
                                    {order.type === INCREASE ? " +" : " -"}${formatAmount(order.sizeDelta, 30, 2, true)}
                                    {order.error && (
                                      <>
                                        , <span className="text-[#fa3c58]">{order.error}</span>
                                      </>
                                    )}
                                  </div>
                                );
                              })}
                            </>
                          );
                        }}
                      />
                    </div>
                  )}
                </td>
                <td className="p-[10.5px] pl-[15px] text-left">
                  <Tooltip
                    handle={`$${formatAmount(position.collateralAfterFee, USD_DECIMALS, 2, true)}`}
                    position="left-bottom"
                    handleClassName={cx("no-underline", { "text-[#fa3c58]": position.hasLowCollateral })}
                    renderContent={() => {
                      return (
                        <>
                          {position.hasLowCollateral && (
                            <div>
                              <Trans>
                                WARNING: This position has a low amount of collateral after deducting borrowing fees,
                                deposit more collateral to reduce the position's liquidation risk.
                              </Trans>
                              <br />
                              <br />
                            </div>
                          )}

                          <StatsTooltipRow
                            label={t`Initial Collateral`}
                            value={formatAmount(position.collateral, USD_DECIMALS, 2, true)}
                          />
                          <StatsTooltipRow
                            label={t`Borrow Fee`}
                            showDollar={false}
                            value={`-$${formatAmount(position.fundingFee, USD_DECIMALS, 2, true)}`}
                          />
                          <StatsTooltipRow showDollar={false} label={t`Borrow Fee / Day`} value={`-$${borrowFeeUSD}`} />
                          <br />
                          <Trans>Use the "Edit" button to deposit or withdraw collateral.</Trans>
                        </>
                      );
                    }}
                  />
                </td>
                <td className="cursor-pointer p-[10.5px] pl-[15px] text-left" onClick={() => onPositionClick(position)}>
                  <Tooltip
                    handle={`$${formatAmount(position.markPrice, USD_DECIMALS, 2, true)}`}
                    position="left-bottom"
                    handleClassName="no-underline cursor-pointer"
                    renderContent={() => {
                      return (
                        <div>
                          Click on a row to select the position's market, then use the swap box to increase your
                          position size if needed.
                          <br />
                          <br />
                          Use the "Close" button to reduce your position size, or to set stop-loss / take-profit orders.
                        </div>
                      );
                    }}
                  />
                </td>
                <td className="cursor-pointer p-[10.5px] pl-[15px] text-left" onClick={() => onPositionClick(position)}>
                  ${formatAmount(position.averagePrice, USD_DECIMALS, 2, true)}
                </td>
                <td className="cursor-pointer p-[10.5px] pl-[15px] text-left" onClick={() => onPositionClick(position)}>
                  ${formatAmount(liquidationPrice, USD_DECIMALS, 2, true)}
                </td>

                <td className="p-[10.5px] pl-[15px] text-left">
                  <button
                    className="mx-[3px] rounded-[3px] p-0 text-[15px] text-slate-600"
                    onClick={() => sellPosition(position)}
                    disabled={position.size.eq(0)}
                  >
                    Close
                  </button>
                </td>
                <td>
                  <PositionDropdown
                    handleEditCollateral={() => {
                      editPosition(position);
                    }}
                    handleShare={() => {
                      setPositionToShare(position);
                      setIsPositionShareModalOpen(true);
                    }}
                    handleMarketSelect={() => {
                      onPositionClick(position);
                    }}
                  />
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
