import { bigNumberify, expandDecimals, formatAmount } from "lib/numbers";

export default function ExchangeWalletTokens(props) {
  const { tokens, mintingCap, infoTokens, onSelectToken } = props;

  return (
    <div className="relative min-h-full overflow-auto rounded-[4px] border border-slate-800 text-[15px]">
      {tokens.map((token, index) => {
        let info = infoTokens ? infoTokens[token.address] : {};
        let mintAmount;
        let balance = info.balance;
        if (mintingCap && info.usdgAmount) {
          mintAmount = mintingCap.sub(info.usdgAmount);
        }
        if (mintAmount && mintAmount.lt(0)) {
          mintAmount = bigNumberify(0);
        }
        let balanceUsd;
        if (balance && info.maxPrice) {
          balanceUsd = balance.mul(info.maxPrice).div(expandDecimals(1, token.decimals));
        }
        return (
          <div className="cursor-pointer py-2 px-[15px]" onClick={() => onSelectToken(token)} key={index}>
            <div className="grid grid-cols-2 text-[15px]">
              <div>{token.symbol}</div>
              {balance && (
                <div className="flex justify-end text-right">
                  {balance.gt(0) && formatAmount(balance, token.decimals, 4, true)}
                  {balance.eq(0) && "-"}
                </div>
              )}
            </div>
            <div className="mt-[3.1px] grid grid-cols-2 text-[14px] text-slate-400">
              <div className="mr-[15px]">{token.name}</div>
              {balanceUsd && balanceUsd.gt(0) && (
                <div className="flex justify-end text-right">${formatAmount(balanceUsd, 30, 2, true)}</div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
