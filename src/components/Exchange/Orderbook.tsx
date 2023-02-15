import { useState, Fragment, FC } from "react";
import { Listbox, Transition } from "@headlessui/react";
import cx from "classnames";
import { Order, useOrders } from "lib/orders/useOrders";
import { InfoTokens } from "domain/tokens";

type Props = {
  toTokenAddress: string;
  infoTokens: InfoTokens;
};

const ViewOptions = ["All", "Buy", "Sell"] as const;
type Option = typeof ViewOptions[number];
const tickSizes = [
  { name: "0.01", value: 2 },
  { name: "0.1", value: 1 },
  { name: "1", value: 0 },
];

export const Orderbook: FC<Props> = ({ toTokenAddress, infoTokens }) => {
  const [currentOption, setCurrentOption] = useState<Option>("All");
  const [selectedTick, setSelectedTick] = useState(tickSizes[0]);
  const { buyOrders, sellOrders } = useOrders(toTokenAddress, infoTokens, 20);

  return (
    <div className="flex h-full w-full flex-col divide-y divide-slate-800 border-r border-slate-800 text-[10px]">
      <div className="flex items-center justify-between px-4">
        <div className="py-2.5 text-xs font-medium leading-[18px] text-slate-300">Orderbook</div>
        <div className="flex items-center justify-center gap-x-2 py-[5px]">
          <button
            className={cx(
              "relative grid h-7 w-7 cursor-pointer grid-cols-2 items-center justify-center gap-x-0.5 rounded border border-slate-800 bg-slate-700 p-1.5 text-white transition duration-200 hover:opacity-90",
              currentOption === "All" ? "opacity-100" : "opacity-50"
            )}
            onClick={() => setCurrentOption("All")}
          >
            <div className="col-span-1 grid h-full w-full grid-rows-2 gap-y-0.5">
              <div className="row-span-1 w-full rounded-[1px] bg-red-500"></div>
              <div className="row-span-1 w-full rounded-[1px] bg-green-500"></div>
            </div>
            <div className="col-span-1 flex h-full flex-col gap-y-0.5">
              <div className="row-span-1 h-full w-full rounded-[1px] bg-slate-400"></div>
              <div className="row-span-1 h-full w-full rounded-[1px] bg-slate-400"></div>
              <div className="row-span-1 h-full w-full rounded-[1px] bg-slate-400"></div>
            </div>
          </button>
          <button
            className={cx(
              "relative grid h-7 w-7 cursor-pointer grid-cols-2 items-center justify-center gap-x-0.5 rounded border border-slate-800 bg-slate-700 p-1.5 text-white transition duration-200 hover:opacity-90",
              currentOption === "Buy" ? "opacity-100" : "opacity-50"
            )}
            onClick={() => setCurrentOption("Buy")}
          >
            <div className="col-span-1 grid h-full w-full grid-rows-2">
              <div className="row-span-2 w-full rounded-[1px] bg-green-500"></div>
              <div className="row-span-1 w-full rounded-[1px] bg-green-500"></div>
            </div>
            <div className="col-span-1 flex h-full flex-col gap-y-0.5">
              <div className="row-span-1 h-full w-full rounded-[1px] bg-slate-400"></div>
              <div className="row-span-1 h-full w-full rounded-[1px] bg-slate-400"></div>
              <div className="row-span-1 h-full w-full rounded-[1px] bg-slate-400"></div>
            </div>
          </button>
          <button
            className={cx(
              "relative grid h-7 w-7 cursor-pointer grid-cols-2 items-center justify-center gap-x-0.5 rounded border border-slate-800 bg-slate-700 p-1.5 text-white transition duration-200 hover:opacity-90",
              currentOption === "Sell" ? "opacity-100" : "opacity-50"
            )}
            onClick={() => setCurrentOption("Sell")}
          >
            <div className="col-span-1 grid h-full w-full grid-rows-2">
              <div className="row-span-2 w-full rounded-[1px] bg-red-500"></div>
            </div>
            <div className="col-span-1 flex h-full flex-col gap-y-0.5">
              <div className="row-span-1 h-full w-full rounded-[1px] bg-slate-400"></div>
              <div className="row-span-1 h-full w-full rounded-[1px] bg-slate-400"></div>
              <div className="row-span-1 h-full w-full rounded-[1px] bg-slate-400"></div>
            </div>
          </button>
        </div>
      </div>
      {currentOption === "All" ? (
        <AllOrder decimals={selectedTick.value} buyOrders={buyOrders} sellOrders={sellOrders} />
      ) : currentOption === "Buy" ? (
        <BuyOrder decimals={selectedTick.value} buyOrders={buyOrders} sellOrders={sellOrders} />
      ) : (
        <SellOrder decimals={selectedTick.value} buyOrders={buyOrders} sellOrders={sellOrders} />
      )}
      <div className="grid w-full grid-cols-3 divide-x divide-slate-800 text-[10px] text-slate-400 md:h-8 2xl:mt-0.5">
        <span className="col-span-2 flex h-full w-full items-center justify-start px-4">Tick Size</span>
        <Listbox value={selectedTick} onChange={setSelectedTick}>
          <div className="relative col-span-1 h-full w-full">
            <Listbox.Button className="relative flex h-full w-full items-center justify-between px-4">
              {selectedTick.name}
              <svg
                stroke="currentColor"
                fill="currentColor"
                strokeWidth="0"
                viewBox="0 0 16 16"
                className="text-[10px] font-medium"
                height="1em"
                width="1em"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  fillRule="evenodd"
                  d="M7.646 4.646a.5.5 0 0 1 .708 0l6 6a.5.5 0 0 1-.708.708L8 5.707l-5.646 5.647a.5.5 0 0 1-.708-.708l6-6z"
                ></path>
              </svg>
            </Listbox.Button>
            <Transition
              as={Fragment}
              leave="transition ease-in duration-100"
              leaveFrom="opacity-100"
              leaveTo="opacity-0"
            >
              <Listbox.Options className="absolute bottom-full left-0 z-10 flex w-full -translate-y-0.5 select-none flex-col items-end justify-center bg-slate-950 py-1 px-2 backdrop-blur-sm">
                {tickSizes.map((tick) => (
                  <Listbox.Option
                    key={tick.value}
                    className={cx(
                      tick === selectedTick ? "opacity-100" : "opacity-50",
                      "w-full cursor-pointer py-0.5 text-right opacity-100 transition hover:text-slate-300 hover:opacity-100"
                    )}
                    value={tick}
                  >
                    {tick.name}
                  </Listbox.Option>
                ))}
              </Listbox.Options>
            </Transition>
          </div>
        </Listbox>
      </div>
    </div>
  );
};

type OrderListProps = {
  decimals: number;
  buyOrders: Order[];
  sellOrders: Order[];
};

const AllOrder: React.FC<OrderListProps> = ({ decimals, buyOrders, sellOrders }) => {
  console.log({ buyOrders, sellOrders });
  const formatter = new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
  const maxItem = sellOrders.reduce((prev, cur) => (prev.size > cur.size ? prev : cur), {
    price: 0,
    size: 0,
  });
  const maxAmount = buyOrders.reduce((prev, cur) => (prev.size > cur.size ? prev : cur), maxItem).size;

  return (
    <div className="flex h-full w-full flex-col">
      <div className="grid w-full grid-cols-2 px-4 text-center text-[10px] md:py-1">
        <div className="flex items-center justify-start">Price</div>
        <div className="flex items-center justify-end">Amount</div>
      </div>
      <div className="max-h-[449px] overflow-hidden xl:max-h-[568px]">
        <div className="bg-black-transparent-900 mt-0.5 flex w-full flex-col-reverse items-center justify-start gap-y-0.5 overflow-hidden">
          {sellOrders.slice(0, 6).map((order, index) => (
            <button
              key={index}
              className="group relative z-10 grid w-full cursor-pointer select-none grid-cols-2 items-center justify-center gap-x-2  px-4 text-[10px] font-medium text-slate-300 opacity-100 transition duration-200 before:absolute before:top-0 before:left-0.5 before:-z-10 before:flex before:h-full before:w-0.5 before:bg-red-400 hover:opacity-90 md:h-[18px] 2xl:h-[24px]"
            >
              <div
                className="absolute top-0 left-0 h-full bg-red-400 opacity-20 transition-all duration-150"
                style={{ width: `${(order.size * 100) / maxAmount}%` }}
              ></div>
              <div className="flex w-full items-center justify-start font-mono">{formatter.format(order.price)}</div>
              <div className="flex w-full items-center justify-end font-mono">{order.size}</div>
            </button>
          ))}
        </div>
        <div className="mt-0.5 flex w-full items-center justify-between border-y border-slate-800 px-4 text-center font-mono text-[10px] font-medium leading-snug text-slate-300 md:h-[27px]">
          <div className="font-app-sans">Spread</div>
          <div>0.10</div>
          <div>0.01%</div>
        </div>
        <div className="bg-black-transparent-900 mt-0.5 flex w-full flex-col items-center justify-start gap-y-0.5 overflow-hidden">
          {buyOrders[0]?.price}
          {buyOrders.slice(0, 6).map((order, index) => (
            <button
              key={index + 1}
              className="group relative z-10 grid w-full cursor-pointer grid-cols-2 items-center justify-center gap-x-2  px-4 text-[10px] font-medium text-slate-300 opacity-100 transition duration-200 before:absolute before:top-0 before:left-0.5 before:-z-10 before:flex before:h-full before:w-0.5 before:bg-green-500 hover:opacity-90 md:h-[18px] 2xl:h-[24px]"
            >
              <div
                className="absolute top-0 left-0 h-full bg-green-500 opacity-20 transition-all duration-150"
                style={{ width: `${(order.size * 100) / maxAmount}%` }}
              ></div>
              <div className="flex w-full items-center justify-start font-mono">{formatter.format(order.price)}</div>
              <div className="flex w-full items-center justify-end font-mono">{order.size}</div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};

const BuyOrder: React.FC<OrderListProps> = ({ decimals, buyOrders, sellOrders }) => {
  const formatter = new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
  const maxAmount = buyOrders.reduce((prev, cur) => (prev.size > cur.size ? prev : cur), {
    price: 0,
    size: 0,
  }).size;

  return (
    <div className="flex h-full w-full flex-col">
      <div className="grid w-full grid-cols-2 px-4 text-center text-[10px] md:py-1">
        <div className="flex items-center justify-start">Price</div>
        <div className="flex items-center justify-end">Amount</div>
      </div>
      <div className="max-h-[449px] overflow-hidden xl:max-h-[568px]">
        <div className="bg-black-transparent-900 mt-0.5 flex w-full flex-col items-center justify-start gap-y-0.5 overflow-hidden">
          {[...buyOrders].slice(0, 22).map((order, index) => (
            <button
              key={index}
              className="group relative z-10 grid w-full cursor-pointer grid-cols-2 items-center justify-center gap-x-2 px-4 text-[10px] font-medium text-slate-300 opacity-100 transition duration-200 before:absolute before:top-0 before:left-0.5 before:-z-10 before:flex before:h-full before:w-0.5 before:bg-green-500 hover:opacity-90 md:h-[18px] 2xl:h-[24px]"
            >
              <div
                className="absolute top-0 left-0 h-full bg-green-500 opacity-20 transition-all duration-150"
                style={{ width: `${(order.size * 100) / maxAmount}%` }}
              ></div>
              <div className="flex w-full items-center justify-start font-mono">{formatter.format(order.price)}</div>
              <div className="flex w-full items-center justify-end font-mono">{order.size}</div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};

const SellOrder: React.FC<OrderListProps> = ({ decimals, buyOrders, sellOrders }) => {
  const formatter = new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
  const maxAmount = sellOrders.reduce((prev, cur) => (prev.size > cur.size ? prev : cur), {
    price: 0,
    size: 0,
  }).size;

  return (
    <div className="flex h-full w-full flex-col">
      <div className="grid w-full grid-cols-2 px-4 text-center text-[10px] md:py-1">
        <div className="flex items-center justify-start">Price</div>
        <div className="flex items-center justify-end">Amount</div>
      </div>
      <div className="max-h-[449px] overflow-hidden xl:max-h-[568px]">
        <div className="bg-black-transparent-900 mt-0.5 flex w-full flex-col-reverse items-center justify-start gap-y-0.5 overflow-hidden">
          {[...sellOrders].slice(0, 22).map((order, index) => (
            <button
              key={index}
              className="relative z-10 grid w-full cursor-pointer select-none grid-cols-2 items-center justify-center gap-x-2 px-4 text-[10px] font-medium text-slate-300 opacity-100 transition duration-200 before:absolute before:top-0 before:left-0.5 before:-z-10 before:flex before:h-full before:w-0.5 before:bg-red-400 hover:opacity-90 md:h-[18px] lg:py-0 2xl:h-[24px]"
            >
              <div
                className="absolute top-0 left-0 h-full bg-red-400 opacity-20 transition-all duration-150"
                style={{ width: `${(order.size * 100) / maxAmount}%` }}
              ></div>
              <div className="flex w-full items-center justify-start font-mono">{formatter.format(order.price)}</div>
              <div className="flex w-full items-center justify-end font-mono">{order.size}</div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};
