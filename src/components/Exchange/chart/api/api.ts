import { makeApiRequest } from "./helper";
import { subscribeOnStream, unsubscribeFromStream } from "./stream";
import { BarData, ConfigurationData, SymbolInfo } from "./types";
import { Backend_API } from "./urls";

const lastBarsCache = new Map();
export let currentResolution: string;

const configurationData: ConfigurationData = {
  supported_resolutions: ["1", "5", "15"],
  exchanges: [
    {
      value: "Binary",
      name: "Binary",
      desc: "Binary",
    },
  ],
  symbols_types: [
    {
      name: "ALL",
      value: "ALL",
    },
    {
      name: "BTC/USD",
      value: "BTC/USD",
    },
    {
      name: "ETH/USD",
      value: "ETH/USD",
    },
    {
      name: "AVAX/USD",
      value: "AVAX/USD",
    },
    {
      name: "LINK/USD",
      value: "LINK/USD",
    },
  ],
};

async function getAllSymbols() {
  return [
    {
      description: "BTC/USD",
      symbol: "BTC/USD",
      full_name: "BTC/USD",
      exchange: "",
      type: "BTC/USD",
    },
    {
      description: "ETH/USD",
      symbol: "ETH/USD",
      full_name: "ETH/USD",
      exchange: "",
      type: "ETH/USD",
    },
    {
      description: "AVAX/USD",
      symbol: "AVAX/USD",
      full_name: "AVAX/USD",
      exchange: "",
      type: "AVAX/USD",
    },
    {
      description: "LINK/USD",
      symbol: "LINK/USD",
      full_name: "LINK/USD",
      exchange: "",
      type: "LINK/USD",
    },
  ];
}

export default {
  onReady: (callback: (data: ConfigurationData) => void) => {
    console.log("[onReady]: Method call");
    callback(configurationData);
  },
  resolveSymbol: async (
    symbolName: string,
    onSymbolResolvedCallback: (data: any) => void, // TODO: data type
    onResolveErrorCallback: (error: string) => void
  ) => {
    const symbols = await getAllSymbols();
    console.log("symbols: ", symbols);
    const symbolItem = symbols.find(({ full_name }) => full_name === symbolName);
    if (!symbolItem) {
      console.log("[resolveSymbol]: Cannot resolve symbol", symbolName);
      onResolveErrorCallback("cannot resolve symbol");
      return;
    }
    const symbolInfo = {
      ticker: symbolItem.full_name,
      name: symbolItem.symbol,
      description: symbolItem.description,
      type: symbolItem.type,
      session: "24x7",
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      exchange: symbolItem.exchange,
      minmov: 1,
      pricescale: 100,
      has_intraday: true,
      has_no_volume: false,
      has_weekly_and_monthly: true,
      supported_resolutions: configurationData.supported_resolutions,
      volume_precision: 2,
      data_status: "streaming",
    };

    console.log("[resolveSymbol]: Symbol resolved", symbolName);
    onSymbolResolvedCallback(symbolInfo);
  },

  getBars: async (
    symbolInfo: SymbolInfo,
    resolution: string,
    periodParams: any,
    onHistoryCallback: (data: any[], option: { noData: boolean }) => void,
    onErrorCallback: (error: any) => void
  ) => {
    const { from, to, firstDataRequest } = periodParams;
    console.log("[getBars]: Method call", symbolInfo, resolution, from, to);

    const symbol = symbolInfo.full_name.split("/")[0] + symbolInfo.full_name.split("/")[1].slice(0, 3);

    try {
      const data = await makeApiRequest(
        `${Backend_API}/ohlc?symbol=${symbol}&resolution=${resolution}&from=${from * 1000}&to=${to * 1000}`
      );
      if ((data.Response && data.Response === "Error") || data.o.length === 0) {
        // "noData" should be set if there is no data in the requested period.
        onHistoryCallback([], { noData: true });
        return;
      }

      const { o, h, l, c, v, t } = data;
      const bars: BarData[] = [];
      for (let i = 0; i < o.length; i++) {
        if (t[i] < from * 1000 || t[i] >= to * 1000) {
          continue;
        }
        if (!t[i] || !l[i] || !h[i] || !o[i] || !c[i] || !v[i]) continue;

        bars.push({
          time: data.t[i],
          low: data.l[i],
          high: data.h[i],
          open: data.o[i],
          close: data.c[i],
          volume: data.v[i],
        });
      }

      if (firstDataRequest) {
        lastBarsCache.set(symbolInfo.full_name, bars[bars.length - 1]);
      }

      console.log(`[getBars]: returned ${bars.length} bar(s)`);
      console.log(`GetBars: ${bars[0].volume}`);
      onHistoryCallback(bars, { noData: false });
    } catch (error) {
      console.log("[getBars]: Get error", error);
      onErrorCallback(error);
    }
  },

  searchSymbols: async (
    userInput: string,
    exchange: string,
    symbolType: string,
    onResultReadyCallback: (result: SymbolInfo[]) => void
  ) => {
    if (userInput !== "" || symbolType !== "") {
      const symbols = (await getAllSymbols()) as SymbolInfo[];
      if (symbols.length) {
        const filteredSymbols = symbols.filter(
          (symbol) => symbol.type === userInput || symbol.type === symbolType || symbolType === "ALL"
        );
        onResultReadyCallback(filteredSymbols);
        return;
      }
    }
    onResultReadyCallback([] as SymbolInfo[]);
  },

  subscribeBars: (
    symbolInfo: SymbolInfo,
    resolution: string,
    onRealtimeCallback: () => void,
    subscriberUID: string,
    onResetCacheNeededCallback: () => void
  ) => {
    console.log("[subscribeBars]: Method call with subscriberUID:", subscriberUID, onRealtimeCallback);
    currentResolution = resolution;
    subscribeOnStream(
      symbolInfo,
      resolution,
      onRealtimeCallback,
      subscriberUID,
      onResetCacheNeededCallback,
      lastBarsCache.get(symbolInfo.full_name)
    );
  },

  unsubscribeBars: (subscriberUID: string) => {
    console.log("[unsubscribeBars]: Method call with subscriberUID:", subscriberUID);
    unsubscribeFromStream(subscriberUID);
  },
};
