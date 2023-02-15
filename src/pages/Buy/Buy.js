import React from "react";
import { Trans } from "@lingui/macro";
import "./Buy.css";
import TokenCard from "components/TokenCard/TokenCard";
import buyXDXIcon from "img/buy_xdx.svg";
import SEO from "components/Common/SEO";
import { getPageTitle } from "lib/legacy";

export default function BuyXDXXLX() {
  return (
    <SEO title={getPageTitle("Buy XLX or XDX")}>
      <div className="BuyXDXXLX page-layout">
        <div className="BuyXDXXLX-container default-container">
          <div className="mb-[40.25px] flex w-full max-w-[584px]">
            <div className="section-title-icon">
              <img src={buyXDXIcon} alt="buyXDXIcon" />
            </div>
            <div className="flex-start flex flex-col">
              <div className="mb-[8px] flex flex-row items-center text-xl font-medium text-slate-300">
                <Trans>Buy XDX or XLX</Trans>
              </div>
            </div>
          </div>
          <TokenCard />
        </div>
      </div>
    </SEO>
  );
}
