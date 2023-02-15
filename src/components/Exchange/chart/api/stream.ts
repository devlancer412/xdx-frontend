import { parseFullSymbol } from "./helper";
import { currentResolution } from "./api";
import { BarData } from "./types";
import io from "socket.io-client";
import { SOCKET_URL } from "./urls";

const socket = io(SOCKET_URL);

const channelToSubscription = new Map();

let baseVolume = 0;

socket.on("connect", () => {
  console.log("[tradingview socket] Connected");
});

socket.on("disconnect", (reason) => {
  console.log("[tradingview socket] Disconnected:", reason);
});

socket.on("error", (error) => {
  console.log("[tradingview socket] Error:", error);
});

socket.on("latest-price-ethusd", (data: { price: number; volume: number; timestamp: number }) => {
  updateTradingView("ETH", "USDT", data);
});

socket.on("latest-price-btcusd", (data: { price: number; volume: number; timestamp: number }) => {
  updateTradingView("BTC", "USDT", data);
});

const updateTradingView = (
  fromSymbol: string,
  toSymbol: string,
  data: { price: number; volume: number; timestamp: number }
) => {
  const { price, volume, timestamp } = data;

  const tradePrice = price;
  const tradeTime = timestamp;
  const channelString = `0~${fromSymbol}~${toSymbol}`;
  const subscriptionItem = channelToSubscription.get(channelString);
  if (subscriptionItem === undefined) {
    return;
  }
  const lastDailyBar = subscriptionItem.lastDailyBar;
  const nextDailyBarTime = getNextCandleTime(currentResolution, lastDailyBar.time);

  let bar: BarData;
  if (tradeTime >= nextDailyBarTime) {
    bar = {
      time: nextDailyBarTime,
      open: tradePrice,
      high: tradePrice,
      low: tradePrice,
      close: tradePrice,
      volume,
    };
    baseVolume = volume;
  } else {
    bar = {
      ...lastDailyBar,
      high: Math.max(lastDailyBar.high, tradePrice),
      low: Math.min(lastDailyBar.low, tradePrice),
      close: tradePrice,
      volume: baseVolume + volume,
    };
    if (tradeTime % (60 * 1000) === 0) {
      baseVolume += volume;
    }
  }
  subscriptionItem.lastDailyBar = bar;

  // send data to every subscriber of that symbol
  subscriptionItem.handlers.forEach((handler: any) => handler.callback(bar));
};

function getNextCandleTime(resolution: string, barTime: number) {
  return barTime + parseInt(resolution) * 60 * 1000;
}

export function subscribeOnStream(
  symbolInfo: any,
  resolution: any,
  onRealtimeCallback: () => void,
  subscriberUID: any,
  onResetCacheNeededCallback: () => void,
  lastDailyBar: any
) {
  const parsedSymbol: any = parseFullSymbol(symbolInfo.full_name);
  const channelString = `0~${parsedSymbol.fromSymbol}~${parsedSymbol.toSymbol}`;
  const handler = {
    id: subscriberUID,
    callback: onRealtimeCallback,
  };
  let subscriptionItem = channelToSubscription.get(channelString);
  if (subscriptionItem) {
    // already subscribed to the channel, use the existing subscription
    subscriptionItem.handlers.push(handler);
    return;
  }
  subscriptionItem = {
    subscriberUID,
    resolution,
    lastDailyBar,
    handlers: [handler],
  };
  channelToSubscription.set(channelString, subscriptionItem);
  // socket.emit('SubAdd', { subs: [channelString] });
}

export function unsubscribeFromStream(subscriberUID: any) {
  // find a subscription with id === subscriberUID
  for (const channelString of channelToSubscription.keys()) {
    const subscriptionItem = channelToSubscription.get(channelString);
    const handlerIndex = subscriptionItem.handlers.findIndex((handler: any) => handler.id === subscriberUID);

    if (handlerIndex !== -1) {
      // remove from handlers
      subscriptionItem.handlers.splice(handlerIndex, 1);

      if (subscriptionItem.handlers.length === 0) {
        // unsubscribe from the channel, if it was the last handler
        console.log("[unsubscribeBars]: Unsubscribe from streaming. Channel:", channelString);
        // socket.emit('SubRemove', { subs: [channelString] });
        channelToSubscription.delete(channelString);
        break;
      }
    }
  }
}
