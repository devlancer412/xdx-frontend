import { BigNumber } from "ethers";
import { USD_DECIMALS } from "lib/legacy";
import { formatAmount } from "lib/numbers";

type Props = {
  title: string;
  total?: BigNumber;
  avaxValue?: BigNumber;
  arbitrumValue?: BigNumber;
  showDollar?: boolean;
  decimalsForConversion: number;
  symbol: string;
};

export default function StatsTooltip({
  title,
  total,
  avaxValue,
  arbitrumValue,
  showDollar = true,
  decimalsForConversion = USD_DECIMALS,
  symbol,
}: Props) {
  return (
    <>
      <p className="mb-[5px] grid grid-cols-[1fr_auto]">
        <span className="mr-[5px] text-slate-500 text-xs font-medium">{title} on Arbitrum:</span>
        <span className="text-xs font-medium text-slate-300">
          {showDollar && "$"}
          {formatAmount(arbitrumValue, decimalsForConversion, 0, true)}
          {!showDollar && symbol && " " + symbol}
        </span>
      </p>
      <p className="mb-[5px] grid grid-cols-[1fr_auto]">
        <span className="mr-[5px] text-slate-500 text-xs font-medium">{title} on Avalanche:</span>
        <span className="text-xs font-medium text-slate-300">
          {showDollar && "$"}
          {formatAmount(avaxValue, decimalsForConversion, 0, true)}
          {!showDollar && symbol && " " + symbol}
        </span>
      </p>
      <div className="my-[5px] h-[1px] bg-slate-600" />
      <p className="mb-[5px] grid grid-cols-[1fr_auto]">
        <span className="mr-[5px] text-slate-500 text-xs font-medium">Total:</span>
        <span className="text-xs font-medium text-slate-300">
          {showDollar && "$"}
          {formatAmount(total, decimalsForConversion, 0, true)}
          {!showDollar && symbol && " " + symbol}
        </span>
      </p>
    </>
  );
}
