import React, { useCallback } from "react";
import { Trans } from "@lingui/macro";
import TokenCard from "components/TokenCard/TokenCard";
import buyXdxIcon from "img/buy_xdx.svg";
import SEO from "components/Common/SEO";
import { getPageTitle } from "lib/legacy";
import { useChainId } from "lib/chains";
import { switchNetwork } from "lib/wallets";
import { useWeb3React } from "@web3-react/core";
import { AVALANCHE } from "config/chains";

export default function BuyXDXXLX() {
  const { chainId } = useChainId();
  const { active } = useWeb3React();

  const onNetworkSelect = useCallback(
    (value) => {
      if (value === chainId) {
        return;
      }
      return switchNetwork(value, active);
    },
    [chainId, active]
  );

  return (
    <SEO title={getPageTitle("Buy XLX or XDX")}>
      <div className="flex min-h-[calc(100vh-102px)] flex-col justify-between pt-[46.5px]">
        <div className="my-0 mx-auto w-full max-w-[1264px] p-0 px-4 pb-[31px] text-slate-300 md:px-[32px]">
          <div className="mb-[40.25px] flex w-full max-w-[584px]">
            <div className="flex flex-col flex-start">
              <div className="mb-[8px] flex flex-row items-center text-xl font-medium text-slate-300">
                <Trans>Buy XDX or XLX</Trans>
              </div>
              <div className="text-xs font-medium text-slate-600">
                XDX and XLX can be purchased on the{" "}
                <span className="inline-flex underline cursor-pointer" onClick={() => onNetworkSelect(AVALANCHE)}>
                  Avalanche
                </span>{" "}
                Network.
              </div>
            </div>
          </div>
          <TokenCard />
        </div>
      </div>
    </SEO>
  );
}
