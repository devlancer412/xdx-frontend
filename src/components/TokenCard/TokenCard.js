import React, { useCallback } from "react";
import { Link } from "react-router-dom";
import { Trans } from "@lingui/macro";

import xdxBigIcon from "img/ic_xdx_custom.svg";
import xlxBigIcon from "img/ic_xlx_custom.svg";

import { isHomeSite } from "lib/legacy";

import { useWeb3React } from "@web3-react/core";

import APRLabel from "../APRLabel/APRLabel";
import { HeaderLink } from "../Header/HeaderLink";
import {
  // ARBITRUM,
  AVALANCHE,
} from "config/chains";
import { switchNetwork } from "lib/wallets";
import { useChainId } from "lib/chains";

export default function TokenCard({ showRedirectModal, redirectPopupTimestamp }) {
  const isHome = isHomeSite();
  const { chainId } = useChainId();
  const { active } = useWeb3React();

  const changeNetwork = useCallback(
    (network) => {
      if (network === chainId) {
        return;
      }
      if (!active) {
        setTimeout(() => {
          return switchNetwork(network, active);
        }, 500);
      } else {
        return switchNetwork(network, active);
      }
    },
    [chainId, active]
  );

  const BuyLink = ({ className, to, children, network }) => {
    if (isHome && showRedirectModal) {
      return (
        <HeaderLink
          to={to}
          className={className}
          redirectPopupTimestamp={redirectPopupTimestamp}
          showRedirectModal={showRedirectModal}
        >
          {children}
        </HeaderLink>
      );
    }

    return (
      <Link to={to} className={className} onClick={() => changeNetwork(network)}>
        {children}
      </Link>
    );
  };

  return (
    <div className="grid grid-cols-1 gap-[15px] xl:grid-cols-2">
      <div className="relative w-full rounded border border-slate-800 bg-slate-950 bg-opacity-50 p-[8.25px] xl:max-w-[592px]">
        <div className="flex items-center justify-start p-[15px] py-3.5 text-lg font-medium text-slate-300">XDX</div>
        <div className="px-[15px] pb-[10px]">
          <div className="mt-[15px] text-sm text-slate-300">
            <Trans>XDX is the utility and governance token which accrues 30% of the platform's generated fees.</Trans>
          </div>
          <div className="mt-[19.375px] text-xs font-medium text-slate-600">
            {/* <Trans>Arbitrum APR:</Trans> <APRLabel chainId={ARBITRUM} label="xdxAprTotal" />,{" "} */}
            <Trans>Avalanche APR:</Trans> <APRLabel chainId={AVALANCHE} label="xdxAprTotal" key="AVALANCHE" />
          </div>
          <div className="mt-[19.375px] flex flex-col justify-between gap-2 lg:flex-row lg:gap-0">
            <div className="flex flex-col gap-2 lg:flex-row lg:gap-0">
              {/* <BuyLink
                to="/buy_xdx"
                className="box-border inline-flex min-h-[36px] cursor-pointer items-center justify-center rounded bg-indigo-500 px-[16px] text-center text-xs leading-[20px] hover:bg-indigo-600 lg:mr-[15px]"
                network={ARBITRUM}
              >
                <Trans>Buy on Arbitrum</Trans>
              </BuyLink> */}
              <BuyLink
                to="/buy_xdx"
                className="box-border inline-flex min-h-[36px] cursor-pointer items-center justify-center rounded bg-indigo-500 px-[16px] text-center text-xs leading-[20px] hover:bg-indigo-600 lg:mr-[15px]"
                network={AVALANCHE}
              >
                <Trans>Buy on Avalanche</Trans>
              </BuyLink>
            </div>
            <a
              href="https://xdx.exchange/docs/documentation/xdx"
              target="_blank"
              rel="noreferrer"
              className="read-more box-border inline-flex cursor-pointer items-center justify-center rounded bg-slate-800 px-4 py-2 text-center text-xs hover:bg-indigo-500"
            >
              <Trans>Read more</Trans>
            </a>
          </div>
        </div>
      </div>
      <div className="relative w-full rounded border border-slate-800 bg-slate-950 bg-opacity-50 p-[8.25px] xl:max-w-[592px]">
        <div className="flex items-center justify-start p-[15px] py-3.5 text-lg font-medium text-slate-300">XLX</div>
        <div className="px-[15px] pb-[10px]">
          <div className="mt-[15px] text-sm text-slate-300">
            <Trans>XLX is the liquidity provider token which accrues 70% of the platform's generated fees.</Trans>
          </div>
          <div className="mt-[19.375px] text-xs font-medium text-slate-600">
            {/* <Trans>Arbitrum APR:</Trans> <APRLabel chainId={ARBITRUM} label="xlxAprTotal" key="ARBITRUM" />,{" "} */}
            <Trans>Avalanche APR:</Trans> <APRLabel chainId={AVALANCHE} label="xlxAprTotal" key="AVALANCHE" />
          </div>
          <div className="mt-[19.375px] flex flex-col justify-between gap-2 lg:flex-row lg:gap-0">
            <div className="flex flex-col gap-2 lg:flex-row lg:gap-0">
              {/* <BuyLink
                to="/buy_xlx"
                className="box-border inline-flex min-h-[36px] cursor-pointer items-center justify-center rounded bg-indigo-500 px-[16px] text-center text-xs leading-[20px] hover:bg-indigo-600 lg:mr-[15px]"
                network={ARBITRUM}
              >
                <Trans>Buy on Arbitrum</Trans>
              </BuyLink> */}
              <BuyLink
                to="/buy_xlx"
                className="box-border inline-flex min-h-[36px] cursor-pointer items-center justify-center rounded bg-indigo-500 px-[16px] text-center text-xs leading-[20px] hover:bg-indigo-600 lg:mr-[15px]"
                network={AVALANCHE}
              >
                <Trans>Buy on Avalanche</Trans>
              </BuyLink>
            </div>
            <a
              href="https://xdx.exchange/docs/documentation/xlx"
              target="_blank"
              rel="noreferrer"
              className="read-more box-border inline-flex cursor-pointer items-center justify-center rounded bg-slate-800 px-4 py-2 text-center text-xs hover:bg-indigo-500"
            >
              <Trans>Read more</Trans>
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
