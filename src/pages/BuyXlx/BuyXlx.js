import React, { useEffect, useState } from "react";
import { Link, useHistory } from "react-router-dom";

import XlxSwap from "components/Xlx/XlxSwap";
import buyXlxIcon from "img/ic_buy_xlx.svg";

import { Trans } from "@lingui/macro";
import { getNativeToken } from "config/tokens";
import { useChainId } from "lib/chains";

export default function BuyXlx(props) {
  const { chainId } = useChainId();
  const history = useHistory();
  const [isBuying, setIsBuying] = useState(true);
  const nativeTokenSymbol = getNativeToken(chainId).symbol;

  useEffect(() => {
    const hash = history.location.hash.replace("#", "");
    const buying = hash === "redeem" ? false : true;
    setIsBuying(buying);
  }, [history.location.hash]);

  return (
    <div className="flex min-h-[calc(100vh-102px)] flex-col justify-between pt-[46.5px]">
      <div className="mx-auto w-full max-w-[1264px] flex-1 px-[32px] pb-[46.5px] text-slate-300">
        <div className="mb-[40.25px] flex w-full max-w-[584px]">
          <div className="hidden">
            <img src={buyXlxIcon} alt="buyXlxIcon" />
          </div>
          <div className="flex flex-col flex-start">
            <div className="mb-[8px] flex flex-row items-center text-xl font-medium text-slate-300">
              <Trans>Buy / Sell XLX</Trans>
            </div>
            <div className="text-xs font-medium text-slate-600">
              <Trans>
                Purchase{" "}
                <a
                  className="inline-flex underline cursor-pointer"
                  href="https://xdx.exchange/docs"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  XLX tokens
                </a>{" "}
                to earn {nativeTokenSymbol} fees from swaps and leverages trading.
              </Trans>
              <br />
              <Trans>Note that there is a minimum holding time of 15 minutes after a purchase.</Trans>
            </div>
          </div>
        </div>
        <XlxSwap {...props} isBuying={isBuying} setIsBuying={setIsBuying} isBuy={true} />
      </div>
    </div>
  );
}
