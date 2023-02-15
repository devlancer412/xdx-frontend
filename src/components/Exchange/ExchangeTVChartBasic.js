import { useEffect, useState, useRef, useCallback, useMemo } from "react";
import cx from "classnames";

import { createChart } from "krasulya-lightweight-charts";

import { USD_DECIMALS, SWAP, INCREASE, CHART_PERIODS, getLiquidationPrice } from "../../lib/legacy";
import { useChartPrices } from "../../domain/legacy";
import Tab from "../Tab/Tab";

import ChartTokenSelector from "./ChartTokenSelectorV2";
import { Orderbook } from "./Orderbook";
import { TradeList } from "./TradeList";
import { getTokens, getToken } from "config/tokens";
import { useLocalStorageSerializeKey } from "lib/localStorage";
import { getTokenInfo } from "domain/tokens";
import { usePrevious } from "react-use";
import { formatAmount, numberWithCommas } from "lib/numbers";
import { formatDateTime } from "lib/dates";
import Checkbox from "./../Checkbox/Checkbox";
import { SHOW_CHART_POSITION } from "config/localStorage";

const PRICE_LINE_TEXT_WIDTH = 15;

const timezoneOffset = -new Date().getTimezoneOffset() * 60;

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

const getSeriesOptions = () => ({
  // https://github.com/tradingview/lightweight-charts/blob/master/docs/area-series.md
  lineColor: "#5472cc",
  topColor: "rgba(49, 69, 131, 0.4)",
  bottomColor: "rgba(42, 64, 103, 0.0)",
  lineWidth: 2,
  priceLineColor: "#3a3e5e",
  downColor: "#fa3c58",
  wickDownColor: "#fa3c58",
  upColor: "#0ecc83",
  wickUpColor: "#0ecc83",
  borderVisible: false,
});

const getChartOptions = (width, height) => ({
  width,
  height,
  layout: {
    backgroundColor: "rgba(255, 255, 255, 0)",
    textColor: "#ccc",
    fontFamily: "Relative",
  },
  localization: {
    // https://github.com/tradingview/lightweight-charts/blob/master/docs/customization.md#time-format
    timeFormatter: (businessDayOrTimestamp) => {
      return formatDateTime(businessDayOrTimestamp - timezoneOffset);
    },
  },
  grid: {
    vertLines: {
      visible: true,
      color: "#1e293b",
      style: 1,
    },
    horzLines: {
      visible: true,
      color: "#1e293b",
      style: 1,
    },
  },
  // https://github.com/tradingview/lightweight-charts/blob/master/docs/time-scale.md#time-scale
  timeScale: {
    rightOffset: 5,
    borderVisible: false,
    barSpacing: 5,
    timeVisible: true,
    fixLeftEdge: true,
  },
  // https://github.com/tradingview/lightweight-charts/blob/master/docs/customization.md#price-axis
  priceScale: {
    borderVisible: false,
  },
  crosshair: {
    horzLine: {
      color: "#aaa",
    },
    vertLine: {
      color: "#aaa",
    },
    mode: 0,
  },
});

export default function ExchangeTVChart(props) {
  const {
    swapOption,
    fromTokenAddress,
    toTokenAddress,
    infoTokens,
    chainId,
    positions,
    savedShouldShowPositionLines,
    setSavedShouldShowPositionLines,
    orders,
    setToTokenAddress,
    TAB_OPTIONS,
    activeTab,
    setActiveTab,
  } = props;
  const [currentChart, setCurrentChart] = useState();
  const [currentSeries, setCurrentSeries] = useState();

  let [period, setPeriod] = useLocalStorageSerializeKey([chainId, "Chart-period"], DEFAULT_PERIOD);
  if (!(period in CHART_PERIODS)) {
    period = DEFAULT_PERIOD;
  }

  const [hoveredCandlestick, setHoveredCandlestick] = useState();

  const fromToken = getTokenInfo(infoTokens, fromTokenAddress);
  const toToken = getTokenInfo(infoTokens, toTokenAddress);

  const [chartToken, setChartToken] = useState({
    maxPrice: null,
    minPrice: null,
  });
  useEffect(() => {
    const tmp = getChartToken(swapOption, fromToken, toToken, chainId);
    setChartToken(tmp);
  }, [swapOption, fromToken, toToken, chainId]);

  const symbol = chartToken ? (chartToken.isWrapped ? chartToken.baseSymbol : chartToken.symbol) : undefined;
  const marketName = chartToken ? symbol + "_USD" : undefined;
  const previousMarketName = usePrevious(marketName);

  const currentOrders = useMemo(() => {
    if (swapOption === SWAP || !chartToken) {
      return [];
    }

    return orders.filter((order) => {
      if (order.type === SWAP) {
        // we can't show non-stable to non-stable swap orders with existing charts
        // so to avoid users confusion we'll show only long/short orders
        return false;
      }

      const indexToken = getToken(chainId, order.indexToken);
      return order.indexToken === chartToken.address || (chartToken.isNative && indexToken.isWrapped);
    });
  }, [orders, chartToken, swapOption, chainId]);

  const ref = useRef(null);
  const chartRef = useRef(null);

  const currentAveragePrice =
    chartToken.maxPrice && chartToken.minPrice ? chartToken.maxPrice.add(chartToken.minPrice).div(2) : null;
  const [priceData, updatePriceData] = useChartPrices(
    chainId,
    chartToken.symbol,
    chartToken.isStable,
    period,
    currentAveragePrice
  );

  const [chartInited, setChartInited] = useState(false);
  useEffect(() => {
    if (marketName !== previousMarketName) {
      setChartInited(false);
    }
  }, [marketName, previousMarketName]);

  const scaleChart = useCallback(() => {
    const from = Date.now() / 1000 - (7 * 24 * CHART_PERIODS[period]) / 2 + timezoneOffset;
    const to = Date.now() / 1000 + timezoneOffset;
    currentChart.timeScale().setVisibleRange({ from, to });
  }, [currentChart, period]);

  const onCrosshairMove = useCallback(
    (evt) => {
      if (!evt.time) {
        setHoveredCandlestick(null);
        return;
      }

      for (const point of evt.seriesPrices.values()) {
        setHoveredCandlestick((hoveredCandlestick) => {
          if (hoveredCandlestick && hoveredCandlestick.time === evt.time) {
            // rerender optimisations
            return hoveredCandlestick;
          }
          return {
            time: evt.time,
            ...point,
          };
        });
        break;
      }
    },
    [setHoveredCandlestick]
  );

  useEffect(() => {
    if (!ref.current || !priceData || !priceData.length || currentChart || !chartRef.current) {
      return;
    }

    const chart = createChart(
      chartRef.current,
      getChartOptions(chartRef.current.offsetWidth, chartRef.current.offsetHeight)
    );

    chart.subscribeCrosshairMove(onCrosshairMove);

    const series = chart.addCandlestickSeries(getSeriesOptions());

    setCurrentChart(chart);
    setCurrentSeries(series);
  }, [ref, priceData, currentChart, onCrosshairMove]);

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
    const resizeChart = () => {
      currentChart.resize(chartRef.current.offsetWidth, chartRef.current.offsetHeight);
    };
    window.addEventListener("resize", resizeChart);
    return () => window.removeEventListener("resize", resizeChart);
  }, [currentChart]);

  useEffect(() => {
    if (currentSeries && priceData && priceData.length) {
      currentSeries.setData(priceData);

      if (!chartInited) {
        scaleChart();
        setChartInited(true);
      }
    }
  }, [priceData, currentSeries, chartInited, scaleChart]);

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

  const candleStatsHtml = useMemo(() => {
    if (!priceData) {
      return null;
    }
    const candlestick = hoveredCandlestick || priceData[priceData.length - 1];
    if (!candlestick) {
      return null;
    }

    const className = cx({
      "text-sm py-2 ml-4": true,
      "text-[#0ecc83]": candlestick.open <= candlestick.close,
      "text-[#fa3c58]": candlestick.open > candlestick.close,
      [`length-${String(parseInt(candlestick.close)).length}`]: true,
    });

    const toFixedNumbers = 2;

    return (
      <div className={className}>
        <span className="text-xs font-medium text-slate-300">O</span>
        <span className="ml-1 mr-2 inline-block text-xs font-medium">{candlestick.open.toFixed(toFixedNumbers)}</span>
        <span className="text-xs font-medium text-slate-300">H</span>
        <span className="ml-1 mr-2 inline-block text-xs font-medium">{candlestick.high.toFixed(toFixedNumbers)}</span>
        <span className="text-xs font-medium text-slate-300">L</span>
        <span className="ml-1 mr-2 inline-block text-xs font-medium">{candlestick.low.toFixed(toFixedNumbers)}</span>
        <span className="text-xs font-medium text-slate-300">C</span>
        <span className="ml-1 mr-2 inline-block text-xs font-medium">{candlestick.close.toFixed(toFixedNumbers)}</span>
      </div>
    );
  }, [hoveredCandlestick, priceData]);

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

  const onSelectToken = (token) => {
    const tmp = getTokenInfo(infoTokens, token.address);
    setChartToken(tmp);
    setToTokenAddress(swapOption, token.address);
  };

  if (!chartToken) {
    return null;
  }

  return (
    <div className="relative h-[520px] md:h-[594px] 2xl:h-[650px]" ref={ref}>
      <div className="relative z-20 flex flex-row justify-between border-b border-slate-800 px-2 py-1 text-xs font-medium">
        <div className="grid grid-cols-4 items-center justify-start gap-3 py-2 pl-[3px] md:flex md:flex-row md:gap-[46.5px] md:py-0">
          <div className="col-span-4">
            <div className="hidden text-sm font-normal md:block">
              <span className="flex flex-row items-center px-4 text-sm font-medium lg:text-xs">
                <img src={toToken.imageUrl} className="mr-1 w-5" alt="Icon" />
                {toToken.name}
              </span>
            </div>
            <div className="md:hidden">
              <ChartTokenSelector
                chainId={chainId}
                selectedToken={chartToken}
                swapOption={swapOption}
                infoTokens={infoTokens}
                onSelectToken={onSelectToken}
                className="chart-token-selector"
              />
            </div>
          </div>
          <div className="-mx-2 -my-2 hidden h-10 w-[1px] bg-slate-800 md:block" />
          <div className="col-span-4 -mx-2 -my-2 h-[1px] bg-slate-800 md:hidden" />
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
        <div className="m-0 flex justify-center">
          <Checkbox
            className="mb-0 mr-5 !w-auto"
            isChecked={savedShouldShowPositionLines}
            setIsChecked={setSavedShouldShowPositionLines}
          >
            Chart Positions
          </Checkbox>
          <Tab
            options={TAB_OPTIONS}
            option={activeTab}
            setOption={setActiveTab}
            onChange={setActiveTab}
            disabled={false}
          />
        </div>
      </div>
      <div className="absolute bottom-0 top-[100px] left-0 right-0 z-10 grid grid-cols-1 overflow-hidden border-b border-slate-800 text-[15px] md:top-[40px] xl:grid-cols-5">
        <div className="relative col-span-5" ref={chartRef}>
          <div className="absolute top-4 left-4 right-4 z-10 flex flex-col items-start lg:flex-row lg:items-center">
            <div className="inline-block">
              <Tab options={Object.keys(CHART_PERIODS)} option={period} setOption={setPeriod} />
            </div>
            {candleStatsHtml}
          </div>
        </div>
      </div>
    </div>
  );
}
