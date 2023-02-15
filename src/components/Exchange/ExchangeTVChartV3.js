import { useEffect, useState, useRef, useMemo } from "react";
import cx from "classnames";

import { USD_DECIMALS, SWAP, INCREASE, CHART_PERIODS, getLiquidationPrice } from "lib/legacy";
import { useChartPrices } from "domain/legacy";

import { useLocalStorageSerializeKey } from "lib/localStorage";
import { getTokenInfo } from "domain/tokens/utils";
import { formatAmount, numberWithCommas } from "lib/numbers";
import { getToken, getTokens } from "config/tokens";
import { LANGUAGE_LOCALSTORAGE_KEY } from "config/localStorage";
import { defaultLocale } from "lib/i18n";
import { Orderbook } from "./Orderbook";
import { TradeList } from "./TradeList";
import { ChevronLeftIcon, ChevronRightIcon } from "@heroicons/react/24/outline";
import { TVChartContainer } from "./chart/TVProChartContainer";

const PRICE_LINE_TEXT_WIDTH = 15;

export function getChartToken(swapOption, fromToken, toToken, chainId) {
  if (!fromToken || !toToken) {
    return;
  }

  if (swapOption !== SWAP) {
    return toToken;
  }

  if (fromToken.isUsdg && toToken.isUsdg) {
    return getTokens(chainId).find((t) => t.isStable);
  }
  if (fromToken.isUsdg) {
    return toToken;
  }
  if (toToken.isUsdg) {
    return fromToken;
  }

  if (fromToken.isStable && toToken.isStable) {
    return toToken;
  }
  if (fromToken.isStable) {
    return toToken;
  }
  if (toToken.isStable) {
    return fromToken;
  }

  return toToken;
}

const DEFAULT_PERIOD = "4h";

export default function ExchangeTVChart(props) {
  const {
    swapOption,
    fromTokenAddress,
    toTokenAddress,
    infoTokens,
    chainId,
    positions,
    savedShouldShowPositionLines,
    orders,
    setToTokenAddress,
  } = props;

  const [currentChart, setCurrentChart] = useState();
  const [currentSeries, setCurrentSeries] = useState();
  // const [hideOrderList, setHideOrderList] = useLocalStorageSerializeKey("hide-order-list", false);
  const [hideOrderList, setHideOrderList] = useState(true);

  let [period, setPeriod] = useLocalStorageSerializeKey([chainId, "Chart-period"], DEFAULT_PERIOD);
  if (!(period in CHART_PERIODS)) {
    period = DEFAULT_PERIOD;
  }

  // const [hoveredCandlestick, setHoveredCandlestick] = useState();

  // const fromToken = getTokenInfo(infoTokens, fromTokenAddress);
  const toToken = getTokenInfo(infoTokens, toTokenAddress);

  const symbol = toToken ? (toToken.isWrapped ? toToken.baseSymbol : toToken.symbol?.split(".")?.at(0)) : undefined;
  const currentOrders = useMemo(() => {
    if (swapOption === SWAP || !toToken) {
      return [];
    }

    return orders.filter((order) => {
      if (order.type === SWAP) {
        // we can't show non-stable to non-stable swap orders with existing charts
        // so to avoid users confusion we'll show only long/short orders
        return false;
      }

      const indexToken = getToken(chainId, order.indexToken);
      return order.indexToken === toToken.address || (toToken.isNative && indexToken.isWrapped);
    });
  }, [orders, toToken, swapOption, chainId]);

  const ref = useRef(null);

  const currentAveragePrice =
    toToken.maxPrice && toToken.minPrice ? toToken.maxPrice.add(toToken.minPrice).div(2) : null;
  const [priceData, updatePriceData] = useChartPrices(
    chainId,
    toToken.symbol,
    toToken.isStable,
    period,
    currentAveragePrice
  );

  const [tradingViewSetting, setTradingViewSetting] = useState({
    symbol: "BTC/USD",
    locale: "en",
  });
  const currentLanguage = useRef(localStorage.getItem(LANGUAGE_LOCALSTORAGE_KEY) || defaultLocale);

  useEffect(() => {
    if (toToken.isStable) {
      return;
    }

    const toSymbol = symbol ? `${symbol}/USD` : "BTC/USD";

    // eslint-disable-next-line eqeqeq
    if (toSymbol != tradingViewSetting.symbol || currentLanguage.current !== tradingViewSetting.locale) {
      setTradingViewSetting({
        symbol: toSymbol,
        locale: currentLanguage.current === "ko" ? "kr" : currentLanguage.current,
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [toToken, currentLanguage]);

  const tradingView = useMemo(() => {
    return <TVChartContainer symbol={tradingViewSetting.symbol} locale={tradingViewSetting.locale} interval="1" />;
  }, [tradingViewSetting.symbol, tradingViewSetting.locale]);

  useEffect(() => {
    const interval = setInterval(() => {
      updatePriceData(undefined, true);
    }, 60 * 1000);
    return () => clearInterval(interval);
  }, [updatePriceData]);

  useEffect(() => {
    if (!currentChart) {
      return;
    }
  }, [currentChart]);

  useEffect(() => {
    const lines = [];
    if (currentSeries && savedShouldShowPositionLines) {
      if (currentOrders && currentOrders.length > 0) {
        currentOrders.forEach((order) => {
          const indexToken = getToken(chainId, order.indexToken);
          let tokenSymbol;
          if (indexToken && indexToken.symbol) {
            tokenSymbol = indexToken.isWrapped ? indexToken.baseSymbol : indexToken.symbol;
          }
          const title = `${order.type === INCREASE ? "Inc." : "Dec."} ${tokenSymbol} ${
            order.isLong ? "Long" : "Short"
          }`;
          const color = "#3a3e5e";
          lines.push(
            currentSeries.createPriceLine({
              price: parseFloat(formatAmount(order.triggerPrice, USD_DECIMALS, 2)),
              color,
              title: title.padEnd(PRICE_LINE_TEXT_WIDTH, " "),
            })
          );
        });
      }
      if (positions && positions.length > 0) {
        const color = "#3a3e5e";

        positions.forEach((position) => {
          lines.push(
            currentSeries.createPriceLine({
              price: parseFloat(formatAmount(position.averagePrice, USD_DECIMALS, 2)),
              color,
              title: `Open ${position.indexToken.symbol} ${position.isLong ? "Long" : "Short"}`.padEnd(
                PRICE_LINE_TEXT_WIDTH,
                " "
              ),
            })
          );

          const liquidationPrice = getLiquidationPrice(position);
          lines.push(
            currentSeries.createPriceLine({
              price: parseFloat(formatAmount(liquidationPrice, USD_DECIMALS, 2)),
              color,
              title: `Liq. ${position.indexToken.symbol} ${position.isLong ? "Long" : "Short"}`.padEnd(
                PRICE_LINE_TEXT_WIDTH,
                " "
              ),
            })
          );
        });
      }
    }
    return () => {
      lines.forEach((line) => currentSeries.removePriceLine(line));
    };
  }, [currentOrders, positions, currentSeries, chainId, savedShouldShowPositionLines]);

  let high;
  let low;
  let deltaPrice;
  let delta;
  let deltaPercentage;
  let deltaPercentageStr;

  const now = parseInt(Date.now() / 1000);
  const timeThreshold = now - 24 * 60 * 60;

  if (priceData) {
    for (let i = priceData.length - 1; i > 0; i--) {
      const price = priceData[i];
      if (price.time < timeThreshold) {
        break;
      }
      if (!low) {
        low = price.low;
      }
      if (!high) {
        high = price.high;
      }

      if (price.high > high) {
        high = price.high;
      }
      if (price.low < low) {
        low = price.low;
      }

      deltaPrice = price.open;
    }
  }

  if (deltaPrice && currentAveragePrice) {
    const average = parseFloat(formatAmount(currentAveragePrice, USD_DECIMALS, 2));
    delta = average - deltaPrice;
    deltaPercentage = (delta * 100) / average;
    if (deltaPercentage > 0) {
      deltaPercentageStr = `+${deltaPercentage.toFixed(2)}%`;
    } else {
      deltaPercentageStr = `${deltaPercentage.toFixed(2)}%`;
    }
    if (deltaPercentage === 0) {
      deltaPercentageStr = "0.00";
    }
  }

  if (!toToken) {
    return null;
  }

  return (
    <div className="relative h-[520px] md:h-[594px] 2xl:h-[650px]" ref={ref}>
      <div className="relative z-20 border-b border-slate-800 px-2 py-1 text-xs font-medium">
        <div className="grid grid-cols-4 items-center justify-start gap-3 pl-[3px] md:flex md:flex-row md:gap-[46.5px]">
          <div className="col-span-4">
            <div className="text-sm font-normal">
              <span className="flex flex-row items-center text-sm font-medium lg:text-xs">
                <img src={toToken.imageUrl} className="mr-1 w-4" alt="Icon" />
                {toToken.name}
              </span>
            </div>
          </div>
          <div className="-mx-2 -my-2 h-10 w-[1px] bg-slate-800" />
          <div className="flex flex-col items-center md:items-start">
            <div className="text-xs font-medium text-slate-600">
              {toToken.maxPrice && formatAmount(toToken.maxPrice, USD_DECIMALS, 2, true)}
            </div>
            <div className="text-xs font-medium text-slate-300">
              ${toToken.minPrice && formatAmount(toToken.minPrice, USD_DECIMALS, 2, true)}
            </div>
          </div>
          <div className="flex flex-col items-center md:items-start">
            <div className="text-xs font-medium text-slate-600">24h Change</div>
            <div className={cx({ "text-green-500": deltaPercentage > 0, "text-[#fa3c58]": deltaPercentage < 0 })}>
              {!deltaPercentageStr && "-"}
              {deltaPercentageStr && deltaPercentageStr}
            </div>
          </div>
          <div className="flex flex-col items-center md:items-start">
            <div className="text-xs font-medium text-slate-600">24h High</div>
            <div>
              {!high && "-"}
              {high && numberWithCommas(high.toFixed(2))}
            </div>
          </div>
          <div className="flex flex-col items-center md:items-start">
            <div className="text-xs font-medium text-slate-600">24h Low</div>
            <div>
              {!low && "-"}
              {low && numberWithCommas(low.toFixed(2))}
            </div>
          </div>
        </div>
      </div>
      <div className="absolute bottom-0 top-[84px] left-0 right-0 z-10 grid grid-cols-1 overflow-hidden border-b border-slate-800 text-[15px] md:top-[40px] xl:grid-cols-5">
        <div className={cx("relative", hideOrderList ? "col-span-5" : "col-span-4")} id="trading_view_custom_container">
          {tradingView}
        </div>
        {/* <div className="col-span-1 hidden xl:flex xl:h-[540px] 2xl:h-[660px]">
          <TradeList />
        </div> */}
        {hideOrderList ? (
          <></>
        ) : (
          <div className="col-span-1 hidden grid-rows-3 border-l border-slate-800 xl:grid xl:h-[552px] 2xl:h-[610px]">
            <div className="row-span-2 w-full overflow-auto border-b border-slate-800">
              <Orderbook />
            </div>
            <div className="row-span-1 w-full overflow-auto">
              <TradeList />
            </div>
          </div>
        )}
        {/* <div
          className="absolute right-0 bottom-5 flex h-[38px] cursor-pointer items-center justify-center rounded-tl-md rounded-bl-md border-l border-t border-b border-slate-800 bg-slate-950 px-1 text-white"
          onClick={() => setHideOrderList(!hideOrderList)}
        >
          {hideOrderList ? <ChevronLeftIcon width={12} high={12} /> : <ChevronRightIcon width={12} high={12} />}
        </div> */}
      </div>
    </div>
  );
}
