import { FC, useState, useEffect } from "react";
import cx from "classnames";

type Props = {
  className?: string;
};

const TAB_OPTIONS = ["Orders", "Trades"] as const;
type TabOption = typeof TAB_OPTIONS[number];
type Data = {
  isSale: boolean;
  size: number;
  price: number;
  time: string;
};

const tradeData: Data[] = [
  {
    isSale: true,
    size: 0.948,
    price: 1328.1,
    time: "12:20:28",
  },
  {
    isSale: false,
    size: 22.379,
    price: 1327.6,
    time: "12:20:23",
  },
  {
    isSale: true,
    size: 2.379,
    price: 1327.6,
    time: "12:21:23",
  },
  {
    isSale: true,
    size: 25.379,
    price: 1327.6,
    time: "12:22:23",
  },
  {
    isSale: false,
    size: 2.379,
    price: 1327.6,
    time: "12:23:23",
  },
];

const bookData: Data[] = [
  {
    isSale: false,
    size: 140.37,
    price: 1320.6,
    time: "12:23:23",
  },
  {
    isSale: true,
    size: 25.379,
    price: 1327.6,
    time: "12:22:23",
  },
  {
    isSale: false,
    size: 7.379,
    price: 1327.6,
    time: "12:23:23",
  },
  {
    isSale: false,
    size: 20.37,
    price: 1320.6,
    time: "12:23:23",
  },
  {
    isSale: true,
    size: 5.379,
    price: 1327.6,
    time: "12:22:23",
  },
  {
    isSale: false,
    size: 11.379,
    price: 1327.6,
    time: "12:23:23",
  },
  {
    isSale: false,
    size: 202.37,
    price: 1320.6,
    time: "12:23:23",
  },
  {
    isSale: true,
    size: 17.4,
    price: 1327.6,
    time: "12:22:23",
  },
  {
    isSale: false,
    size: 11.932,
    price: 1327.6,
    time: "12:23:23",
  },
  {
    isSale: false,
    size: 2.37,
    price: 1320.6,
    time: "12:23:23",
  },
  {
    isSale: true,
    size: 250.379,
    price: 1327.6,
    time: "12:22:23",
  },
  {
    isSale: false,
    size: 1.32,
    price: 1327.6,
    time: "12:23:23",
  },
  {
    isSale: false,
    size: 5.37,
    price: 1320.6,
    time: "12:23:23",
  },
  {
    isSale: true,
    size: 900.2,
    price: 1327.6,
    time: "12:22:23",
  },
  {
    isSale: false,
    size: 2.379,
    price: 1327.6,
    time: "12:23:23",
  },
  {
    isSale: false,
    size: 2.37,
    price: 1320.6,
    time: "12:23:23",
  },
  {
    isSale: true,
    size: 25.379,
    price: 1327.6,
    time: "12:22:23",
  },
  {
    isSale: false,
    size: 2.379,
    price: 1327.6,
    time: "12:23:23",
  },
  {
    isSale: false,
    size: 2.37,
    price: 1320.6,
    time: "12:23:23",
  },
  {
    isSale: true,
    size: 25.379,
    price: 1327.6,
    time: "12:22:23",
  },
  {
    isSale: false,
    size: 2.379,
    price: 1327.6,
    time: "12:23:23",
  },
  {
    isSale: false,
    size: 2.37,
    price: 1320.6,
    time: "12:23:23",
  },
  {
    isSale: true,
    size: 25.379,
    price: 1327.6,
    time: "12:22:23",
  },
];

const BooksAndTrades: FC<Props> = ({ className = "" }) => {
  const [currentTab] = useState<TabOption>(TAB_OPTIONS[0]);
  const [tableData, setTableData] = useState<Data[]>([]);
  const [maxSize, setMaxSize] = useState<number>(0);

  useEffect(() => {
    if (currentTab === "Orders") {
      setTableData(bookData.map((item) => item));
      setMaxSize(bookData.reduce((a: Data, b: Data) => (a.size > b.size ? a : b), tradeData[0]).size);
    } else {
      setTableData(tradeData.map((item) => item));
      setMaxSize(tradeData.reduce((a: Data, b: Data) => (a.size > b.size ? a : b), tradeData[0]).size);
    }
  }, [currentTab]);

  return (
    <div
      className={cx(
        "flex flex-col items-center border-l border-slate-800 md:border-b xl:my-0 xl:max-h-[496px] xl:w-[14rem]",
        className
      )}
    >
      <div className="relative w-full flex-1 overflow-y-auto scrollbar-hide xl:max-h-[496px]">
        <table className="relative w-full border-collapse p-0 text-left text-sm xl:table">
          <thead>
            <tr className="border-b border-slate-800">
              <th className="py-2 pl-4 text-xs font-medium text-slate-300">Trades</th>
            </tr>
          </thead>
          <tbody>
            {tableData.length > 0 ? (
              tableData.map((data: Data, index: number) => (
                <tr className="text-center" key={index}>
                  <td className="w-10 py-2 pl-4 font-normal text-slate-400">
                    <div
                      className={cx("h-4", data.isSale ? "bg-red-500" : "bg-green-500")}
                      style={{ width: `${(data.size * 90) / maxSize}%` }}
                    />
                  </td>
                  <td className={cx("py-2 pl-0 text-xs font-medium", data.isSale ? "text-red-500" : "text-green-500")}>
                    {data.size}
                  </td>
                  <td className="py-2 pl-0 text-xs font-medium text-slate-400">{data.price}</td>
                </tr>
              ))
            ) : (
              <td className="col-span-4 p-2 text-slate-400">No data</td>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default BooksAndTrades;
