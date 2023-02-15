import classNames from "classnames";
import React, { useMemo } from "react";
import { Link } from "react-router-dom";
import logoImg from "img/logo.svg";

import {
  ArrowTrendingUpIcon,
  BuildingLibraryIcon,
  ChartPieIcon,
  CurrencyDollarIcon,
  NewspaperIcon,
  UsersIcon,
} from "@heroicons/react/24/outline";

type Props = {};

const navigation = [
  { name: "Trade", to: "trade", icon: ArrowTrendingUpIcon, current: false },
  { name: "Dashboard", to: "dashboard", icon: ChartPieIcon, current: false },
  { name: "Earn", to: "earn", icon: CurrencyDollarIcon, current: false },
  { name: "Buy", to: "buy", icon: BuildingLibraryIcon, current: false },
  { name: "Referrals", to: "referrals", icon: UsersIcon, current: false },
];

const Sidebar: React.FC<Props> = ({}) => {
  const currentLocation = useMemo(() => {
    const substrings = window.location.href.split("/");
    return substrings[substrings.length - 1];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [window.location.href]);

  return (
    <nav aria-label="Sidebar" className="hidden border-r border-slate-800 md:block md:flex-shrink-0 md:overflow-y-auto">
      <div className="flex flex-col items-stretch w-full h-full overflow-hidden divide-y divide-slate-800">
        {navigation.map((item) => (
          <a
            key={item.name}
            href={`#/${item.to}`}
            className={classNames(
              currentLocation === item.to ? "border-l-2 !border-l-indigo-500 text-slate-200 bg-slate-950 bg-opacity-50" : "text-slate-600",
              "flex w-full cursor-pointer items-center justify-start gap-x-2 px-6 py-3 text-xs font-medium leading-[18px] transition duration-200 hover:bg-slate-950 hover:text-slate-200 hover:bg-opacity-50"
            )}
          >
            <span className="sr-only">{item.name}</span>
            <item.icon className="w-4 h-4" aria-hidden="true" />
            <span className="">{item.name}</span>
          </a>
        ))}
        <a
          href="https://xdx.exchange/docs"
          className="flex w-full cursor-pointer items-center justify-start gap-x-2 px-6 py-3 text-xs font-medium leading-[18px] text-slate-600 transition duration-200 hover:bg-slate-950 hover:text-slate-200 hover:bg-opacity-50"
        >
          <span className="sr-only">Docs</span>
          <NewspaperIcon className="w-4 h-4" aria-hidden="true" />
          <span className="">Docs</span>
        </a>
      </div>
    </nav>
  );
};

export default Sidebar;
