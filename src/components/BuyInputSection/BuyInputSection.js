import React from "react";
import { Trans } from "@lingui/macro";

export default function BuyInputSection(props) {
  const {
    topLeftLabel,
    topRightLabel,
    onClickTopRightLabel,
    inputValue,
    onInputValueChange,
    onClickMax,
    showMaxButton,
    staticInput,
    balance,
    tokenBalance,
  } = props;

  return (
    <div className="p-4 mb-2 rounded shadow bg-slate-700">
      <div className="grid grid-cols-2 pb-4 text-sm">
        <div className="text-slate-300">
          {topLeftLabel}: {balance}
        </div>
        <div className="flex justify-end text-right cursor-pointer text-slate-600" onClick={onClickTopRightLabel}>
          <span>{topRightLabel}</span>&nbsp;
          <span>
            {tokenBalance} {/*(selectedToken && selectedToken.symbol) || defaultTokenName*/}
          </span>
        </div>
      </div>
      <div className="grid grid-cols-[1fr_auto]">
        <div className="relative overflow-hidden">
          {!staticInput && (
            <input
              type="number"
              min="0"
              placeholder="0.0"
              className="w-full p-0 pr-5 overflow-hidden bg-transparent border-none text-md text-ellipsis whitespace-nowrap text-slate-200 placeholder-slate-400 ring-offset-0 focus:outline-none focus:ring-0"
              value={inputValue}
              onChange={onInputValueChange}
            />
          )}
          {staticInput && <div className="InputSection-static-input">{inputValue}</div>}
          {showMaxButton && (
            <div
              className="absolute right-[12.5px] top-0 cursor-pointer rounded bg-slate-700 py-1 px-2 text-xs font-medium hover:bg-indigo-500"
              onClick={onClickMax}
            >
              <Trans>MAX</Trans>
            </div>
          )}
        </div>
        <div className="ml-[14px] flex items-center text-right text-[21px] text-slate-300">{props.children}</div>
      </div>
    </div>
  );
}
