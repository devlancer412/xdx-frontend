import cx from "classnames";
import { FC } from "react";
const formatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
});

const lists = [
  {
    isBuy: true,
    price: 1162.76,
    size: 2.4234,
  },
  {
    isBuy: false,
    price: 1162.76,
    size: 2.4234,
  },
  {
    isBuy: true,
    price: 1162.76,
    size: 2.4234,
  },
  {
    isBuy: false,
    price: 1162.76,
    size: 2.4234,
  },
  {
    isBuy: true,
    price: 1162.76,
    size: 2.4234,
  },
  {
    isBuy: false,
    price: 1162.76,
    size: 2.4234,
  },
  {
    isBuy: true,
    price: 1162.76,
    size: 2.4234,
  },
  {
    isBuy: false,
    price: 1162.76,
    size: 2.4234,
  },
  {
    isBuy: true,
    price: 1162.76,
    size: 2.4234,
  },
  {
    isBuy: false,
    price: 1162.76,
    size: 2.4234,
  },
  {
    isBuy: true,
    price: 1162.76,
    size: 2.4234,
  },
  {
    isBuy: false,
    price: 1162.76,
    size: 2.4234,
  },
  {
    isBuy: true,
    price: 1162.76,
    size: 2.4234,
  },
  {
    isBuy: false,
    price: 1162.76,
    size: 2.4234,
  },
  {
    isBuy: true,
    price: 1162.76,
    size: 2.4234,
  },
  {
    isBuy: false,
    price: 1162.76,
    size: 2.4234,
  },
  {
    isBuy: true,
    price: 1162.76,
    size: 2.4234,
  },
  {
    isBuy: false,
    price: 1162.76,
    size: 2.4234,
  },
  {
    isBuy: true,
    price: 1162.76,
    size: 2.4234,
  },
  {
    isBuy: false,
    price: 1162.76,
    size: 2.4234,
  },
  {
    isBuy: true,
    price: 1162.76,
    size: 2.4234,
  },
  {
    isBuy: false,
    price: 1162.76,
    size: 2.4234,
  },
  {
    isBuy: true,
    price: 1162.76,
    size: 2.4234,
  },
  {
    isBuy: false,
    price: 1162.76,
    size: 2.4234,
  },
  {
    isBuy: true,
    price: 1162.76,
    size: 2.4234,
  },
  {
    isBuy: false,
    price: 1162.76,
    size: 2.4234,
  },
  {
    isBuy: true,
    price: 1162.76,
    size: 2.4234,
  },
  {
    isBuy: false,
    price: 1162.76,
    size: 2.4234,
  },
  {
    isBuy: true,
    price: 1162.76,
    size: 2.4234,
  },
  {
    isBuy: false,
    price: 1162.76,
    size: 2.4234,
  },
  {
    isBuy: true,
    price: 1162.76,
    size: 2.4234,
  },
  {
    isBuy: false,
    price: 1162.76,
    size: 2.4234,
  },
  {
    isBuy: true,
    price: 1162.76,
    size: 2.4234,
  },
  {
    isBuy: false,
    price: 1162.76,
    size: 2.4234,
  },
];

type Props = {
  toTokenAddress: string;
};
export const TradeList: FC<Props> = ({ toTokenAddress }) => {
  return (
    <div className="flex w-full flex-col items-center justify-start overflow-hidden text-[10px]">
      <div className="flex w-full items-center justify-start py-2.5">
        <div className="px-4 text-left text-xs font-medium leading-[18px] text-slate-300">Market Trades</div>
      </div>
      <div className="text-2xs grid w-full grid-cols-3 border-t border-slate-800 px-4 py-1 text-center font-medium lg:py-1">
        <div className="flex items-center justify-start">Price</div>
        <div className="flex items-center justify-center">Size</div>
        <div className="flex items-center justify-end">Time</div>
      </div>
      <div className="no-scrollbar hidden w-full flex-col items-center justify-start pt-0 md:block">
        {lists.map((item, index) => (
          <div
            key={index}
            className="z-10 grid w-full cursor-default grid-cols-3 items-start justify-start py-1.5 px-4 hover:bg-slate-900"
          >
            <div
              className={cx(
                "text-2xs xl:text-2xs flex w-full items-center justify-start pr-2 text-left font-mono",
                item.isBuy ? "text-green-500" : "text-red-300"
              )}
            >
              {formatter.format(item.price)}
            </div>
            <div className="text-2xs xl:text-2xs flex w-full items-center justify-end text-right font-normal">
              {item.size}
            </div>
            <div className="text-2xs xl:text-2xs flex w-full items-center justify-end text-left font-normal">
              07:50:23
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
