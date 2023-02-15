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
      <div className="relative flex flex-col p-2 space-y-3">
        <div className="flex-shrink-0 py-2">
          <Link to="/">
            <img className="w-auto h-5 mx-auto" src={logoImg} alt="XDX"></img>
          </Link>
        </div>
        {navigation.map((item) => (
          <a
            key={item.name}
            href={`#/${item.to}`}
            className={classNames(
              currentLocation === item.to ? "text-slate-200" : "text-slate-600 hover:text-slate-200",
              "relative inline-flex h-10 w-10 flex-shrink-0 items-center justify-center rounded"
            )}
          >
            <span className="sr-only">{item.name}</span>
            <item.icon className="w-6 h-6" aria-hidden="true" />
          </a>
        ))}
        <a
          href="https://xdx.exchange/docs"
          className="relative inline-flex items-center justify-center flex-shrink-0 w-10 h-10 rounded text-slate-600 hover:text-slate-200"
        >
          <span className="sr-only">Docs</span>
          <NewspaperIcon className="w-6 h-6" aria-hidden="true" />
        </a>
      </div>
    </nav>
  );
};

export default Sidebar;
