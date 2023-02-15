import { Link } from "react-router-dom";
import { useWeb3React } from "@web3-react/core";
import { Trans, t } from "@lingui/macro";
import useSWR from "swr";
import TooltipComponent from "components/Tooltip/Tooltip";
import { ethers } from "ethers";
import cx from "classnames";

import {
  USD_DECIMALS,
  BASIS_POINTS_DIVISOR,
  DEFAULT_MAX_USDG_AMOUNT,
  getPageTitle,
  importImage,
  arrayURLFetcher,
  XLX_DECIMALS,
} from "lib/legacy";
import { useXdxPrice } from "domain/legacy";

import { getContract } from "config/contracts";

import Vault from "abis/Vault.json";
import Reader from "abis/Reader.json";
import XlxManager from "abis/XlxManager.json";

import avalanche16Icon from "img/ic_avalanche_24.svg";
import AssetDropdown from "./AssetDropdown";
import SEO from "components/Common/SEO";
import StatsTooltipRow from "components/StatsTooltip/StatsTooltipRow";
import {
  // ARBITRUM,
  AVALANCHE,
} from "config/chains";
import { getServerUrl } from "config/backend";
import { contractFetcher } from "lib/contracts";
import { useInfoTokens } from "domain/tokens";
import { getWhitelistedTokens } from "config/tokens";
import { bigNumberify, expandDecimals, formatAmount, formatAmountWithUnit, formatKeyAmount } from "lib/numbers";
import { useChainId } from "lib/chains";

const ACTIVE_CHAIN_IDS = [
  // ARBITRUM,
  AVALANCHE,
];
const { AddressZero } = ethers.constants;

function getVolumeInfo(hourlyVolumes) {
  if (!hourlyVolumes || hourlyVolumes.length === 0) {
    return {};
  }
  const dailyVolumes = hourlyVolumes.map((hourlyVolume) => {
    const secondsPerHour = 60 * 60;
    const minTime = parseInt(Date.now() / 1000 / secondsPerHour) * secondsPerHour - 24 * secondsPerHour;
    const info = {};
    let totalVolume = bigNumberify(0);
    for (let i = 0; i < hourlyVolume.length; i++) {
      const item = hourlyVolume[i].data;
      if (parseInt(item.timestamp) < minTime) {
        break;
      }

      if (!info[item.token]) {
        info[item.token] = bigNumberify(0);
      }

      info[item.token] = info[item.token].add(item.volume);
      totalVolume = totalVolume.add(item.volume);
    }
    info.totalVolume = totalVolume;
    return info;
  });
  return dailyVolumes.reduce(
    (acc, cv, index) => {
      acc.totalVolume = acc.totalVolume.add(cv.totalVolume);
      acc[ACTIVE_CHAIN_IDS[index]] = cv;
      return acc;
    },
    { totalVolume: bigNumberify(0) }
  );
}

function getPositionStats(positionStats) {
  if (!positionStats || positionStats.length === 0) {
    return null;
  }
  return positionStats.reduce(
    (acc, cv, i) => {
      acc.totalLongPositionSizes = acc.totalLongPositionSizes.add(cv.totalLongPositionSizes);
      acc.totalShortPositionSizes = acc.totalShortPositionSizes.add(cv.totalShortPositionSizes);
      acc[ACTIVE_CHAIN_IDS[i]] = cv;
      return acc;
    },
    {
      totalLongPositionSizes: bigNumberify(0),
      totalShortPositionSizes: bigNumberify(0),
    }
  );
}

export default function DashboardV2() {
  const { active, library } = useWeb3React();
  const { chainId } = useChainId();

  const whitelistedTokens = getWhitelistedTokens(chainId);
  const tokenList = whitelistedTokens.filter((t) => !t.isWrapped);
  const visibleTokens = tokenList.filter((t) => !t.isTempHidden);

  const vaultAddress = getContract(chainId, "Vault");
  const xlxManagerAddress = getContract(chainId, "XlxManager");
  const readerAddress = getContract(chainId, "Reader");
  const xdxAddress = getContract(chainId, "XDX");
  const xlxAddress = getContract(chainId, "XLX");
  const usdgAddress = getContract(chainId, "USDG");

  const { data: totalTokenWeights } = useSWR(
    [`XlxSwap:totalTokenWeights:${active}`, chainId, vaultAddress, "totalTokenWeights"],
    {
      fetcher: contractFetcher(library, Vault),
    }
  );

  const { infoTokens } = useInfoTokens(library, chainId, active, undefined, undefined);

  let adjustedUsdgSupply = bigNumberify(0);

  for (let i = 0; i < tokenList.length; i++) {
    const token = tokenList[i];
    const tokenInfo = infoTokens[token.address];
    if (tokenInfo && tokenInfo.usdgAmount) {
      adjustedUsdgSupply = adjustedUsdgSupply.add(tokenInfo.usdgAmount);
    }
  }

  const getWeightText = (tokenInfo) => {
    if (
      !tokenInfo.weight ||
      !tokenInfo.usdgAmount ||
      !adjustedUsdgSupply ||
      adjustedUsdgSupply.eq(0) ||
      !totalTokenWeights
    ) {
      return "...";
    }

    const currentWeightBps = tokenInfo.usdgAmount.mul(BASIS_POINTS_DIVISOR).div(adjustedUsdgSupply);
    // use add(1).div(10).mul(10) to round numbers up
    const targetWeightBps = tokenInfo.weight.mul(BASIS_POINTS_DIVISOR).div(totalTokenWeights).add(1).div(10).mul(10);

    const weightText = `${formatAmount(currentWeightBps, 2, 2, false)}% / ${formatAmount(
      targetWeightBps,
      2,
      2,
      false
    )}%`;

    return (
      <TooltipComponent
        handle={weightText}
        position="right-bottom"
        renderContent={() => {
          return (
            <>
              <StatsTooltipRow
                label={t`Current Weight`}
                value={`${formatAmount(currentWeightBps, 2, 2, false)}%`}
                showDollar={false}
              />
              <StatsTooltipRow
                label={t`Target Weight`}
                value={`${formatAmount(targetWeightBps, 2, 2, false)}%`}
                showDollar={false}
              />
              <br />
              {currentWeightBps.lt(targetWeightBps) && (
                <div className="text-xs font-medium text-slate-300">
                  <Trans>
                    {tokenInfo.symbol} is below its target weight.
                    <br />
                    <br />
                    Get lower fees to{" "}
                    <Link
                      className="text-xs font-medium text-slate-300 underline"
                      to="/buy_xlx"
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      Buy XLX
                    </Link>{" "}
                    with {tokenInfo.symbol},&nbsp; and to{" "}
                    <Link
                      className="text-xs font-medium text-slate-300 underline"
                      to="/trade"
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      swap
                    </Link>{" "}
                    {tokenInfo.symbol} for other tokens.
                  </Trans>
                </div>
              )}
              {currentWeightBps.gt(targetWeightBps) && (
                <div className="text-xs font-medium text-slate-300">
                  <Trans>
                    {tokenInfo.symbol} is above its target weight.
                    <br />
                    <br />
                    Get lower fees to{" "}
                    <Link
                      className="text-slate-30 text-xs font-medium underline"
                      to="/trade"
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      swap
                    </Link>{" "}
                    tokens for {tokenInfo.symbol}.
                  </Trans>
                </div>
              )}
              <br />
              <div>
                <a
                  className="text-xs font-medium text-slate-300 underline"
                  href="https://xdx.exchange/docs"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <Trans>More Info</Trans>
                </a>
              </div>
            </>
          );
        }}
      />
    );
  };

  const { xdxPrice } = useXdxPrice(chainId, { avalanche: chainId === AVALANCHE ? library : undefined }, active);

  const { data: hourlyVolumes } = useSWR(
    ACTIVE_CHAIN_IDS.map((chainId) => getServerUrl(chainId, "/hourly_volume")),
    {
      fetcher: arrayURLFetcher,
    }
  );

  const currentVolumeInfo = getVolumeInfo(hourlyVolumes);

  const { data: positionStats } = useSWR(
    ACTIVE_CHAIN_IDS.map((chainId) => getServerUrl(chainId, "/position_stats")),
    {
      fetcher: arrayURLFetcher,
    }
  );

  const positionStatsInfo = getPositionStats(positionStats);

  const tokensForSupplyQuery = [xdxAddress, xlxAddress, usdgAddress];

  const { data: aums } = useSWR([`Dashboard:getAums:${active}`, chainId, xlxManagerAddress, "getAums"], {
    fetcher: contractFetcher(library, XlxManager),
  });

  const { data: totalSupplies } = useSWR(
    [`Dashboard:totalSupplies:${active}`, chainId, readerAddress, "getTokenBalancesWithSupplies", AddressZero],
    {
      fetcher: contractFetcher(library, Reader, [tokensForSupplyQuery]),
    }
  );

  let aum;
  if (aums && aums.length > 0) {
    aum = aums[0].add(aums[1]).div(2);
  }

  let xlxPrice;
  let xlxSupply;
  if (aum && totalSupplies && totalSupplies[3]) {
    xlxSupply = totalSupplies[3];
    xlxPrice =
      aum && aum.gt(0) && xlxSupply.gt(0)
        ? aum.mul(expandDecimals(1, XLX_DECIMALS)).div(xlxSupply)
        : expandDecimals(1, USD_DECIMALS);
  }

  return (
    <SEO title={getPageTitle("Dashboard")}>
      <div className="flex min-h-[calc(100vh-102px)] flex-col justify-between pt-[46.5px]">
        <div className="mx-auto w-full max-w-[1264px] flex-1 px-4 pb-[46.5px] text-slate-300 md:px-[32px]">
          <div className="mb-[40.25px] flex w-full max-w-[584px]">
            <div className="hidden"></div>
            <div className="flex flex-col justify-end">
              <div className="mb-[8px] flex flex-row items-center text-xl font-medium text-slate-300">
                <Trans>Dashboard</Trans>
              </div>
              <div className="text-xs font-medium text-slate-600">Overview of the XDX exchange protocol.</div>
            </div>
          </div>
          <div className="DashboardV2-content">
            <div className="flex flex-col items-center justify-center lg:grid lg:grid-cols-5">
              <div className="mb-2 flex w-full flex-col items-center rounded border border-slate-800 bg-slate-950 bg-opacity-50 p-4 py-4 lg:mb-0 lg:w-[210px] lg:items-start">
                <div className="mb-2 text-xs font-medium text-slate-600">Trading Volume</div>
                <div className="mb-2 text-lg font-medium text-slate-300">
                  ${formatAmountWithUnit(currentVolumeInfo?.[chainId]?.totalVolume, USD_DECIMALS, 2)}
                </div>
                <div className="text-xs font-medium text-slate-600">exchanged in last 24h</div>
              </div>
              <div className="mb-2 flex w-full flex-col items-center rounded border border-slate-800 bg-slate-950 bg-opacity-50 p-4 py-4 lg:mb-0 lg:w-[210px] lg:items-start">
                <div className="mb-2 text-xs font-medium text-slate-600">Open Interest</div>
                <div className="mb-2 text-lg font-medium text-slate-300">
                  $
                  {formatAmountWithUnit(
                    (positionStatsInfo?.[chainId]?.totalLongPositionSizes ?? 0) +
                      (positionStatsInfo?.[chainId]?.totalShortPositionSizes ?? 0),
                    USD_DECIMALS,
                    2
                  )}
                </div>
                <div className="text-xs font-medium text-slate-600">in open positions on XDX</div>
              </div>
              <div className="mb-2 flex w-full flex-col items-center rounded border border-slate-800 bg-slate-950 bg-opacity-50 p-4 py-4 lg:mb-0 lg:w-[210px] lg:items-start">
                <div className="mb-2 text-xs font-medium text-slate-600">Trades</div>
                <div className="mb-2 text-lg font-medium text-slate-300">
                  {formatAmountWithUnit(bigNumberify("9999999999999999999999999999"))}
                </div>
                <div className="text-xs font-medium text-slate-600">exchanged in last 24h</div>
              </div>
              <div className="mb-2 flex w-full flex-col items-center rounded border border-slate-800 bg-slate-950 bg-opacity-50 p-4 py-4 lg:mb-0 lg:w-[210px] lg:items-start">
                <div className="mb-2 text-xs font-medium text-slate-600">XDX Price</div>
                <div className="mb-2 text-lg font-medium text-slate-300">
                  ${formatAmount(xdxPrice, USD_DECIMALS, 2, true)}
                </div>
                <div className="text-xs font-medium text-slate-600">Last traded price of XDX</div>
              </div>
              <div className="mb-2 flex w-full flex-col items-center rounded border border-slate-800 bg-slate-950 bg-opacity-50 p-4 py-4 lg:mb-0 lg:w-[210px] lg:items-start">
                <div className="mb-2 text-xs font-medium text-slate-600">XLX Price</div>
                <div className="mb-2 text-lg font-medium text-slate-300">
                  ${formatAmount(xlxPrice, USD_DECIMALS, 3, true)}
                </div>
                <div className="text-xs font-medium text-slate-600">Last traded price of XDX</div>
              </div>
            </div>
            <div className="DashboardV2-token-cards">
              <div className="mb-[24px] flex flex-col justify-end pt-[50px]">
                <div className="mb-[8px] flex flex-row items-center text-xl font-medium text-slate-300">
                  XLX Index Composition{" "}
                  {chainId === AVALANCHE && (
                    <img width="20px" className="ml-2" src={avalanche16Icon} alt="avalanche16Icon" />
                  )}
                </div>
                <div className="text-xs font-medium text-slate-600">
                  <Trans>Platform and XLX index tokens.</Trans>
                </div>
              </div>
              <div className="relative hidden rounded border border-slate-800 text-left text-xs font-medium lg:block">
                <table className="w-full whitespace-nowrap text-white">
                  <thead>
                    <tr className="text-slate-200">
                      <th className="rounded-tl bg-slate-950 bg-opacity-50 py-3 pl-4 pr-3 text-left text-xs font-medium sm:pl-6">
                        <Trans>TOKEN</Trans>
                      </th>
                      <th className="bg-slate-950 bg-opacity-50 px-3 py-2 text-left text-xs font-medium">
                        <Trans>PRICE</Trans>
                      </th>
                      <th className="bg-slate-950 bg-opacity-50 px-3 py-2 text-left text-xs font-medium">
                        <Trans>POOL</Trans>
                      </th>
                      <th className="bg-slate-950 bg-opacity-50 px-3 py-2 text-left text-xs font-medium">
                        <Trans>WEIGHT</Trans>
                      </th>
                      <th className="rounded-tr bg-slate-950 bg-opacity-50 px-3 py-2 pr-6 text-right text-xs font-medium">
                        <Trans>UTILIZATION</Trans>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {visibleTokens.map((token, index) => {
                      const tokenInfo = infoTokens[token.address];
                      let utilization = bigNumberify(0);
                      if (tokenInfo && tokenInfo.reservedAmount && tokenInfo.poolAmount && tokenInfo.poolAmount.gt(0)) {
                        utilization = tokenInfo.reservedAmount.mul(BASIS_POINTS_DIVISOR).div(tokenInfo.poolAmount);
                      }
                      let maxUsdgAmount = DEFAULT_MAX_USDG_AMOUNT;
                      if (tokenInfo.maxUsdgAmount && tokenInfo.maxUsdgAmount.gt(0)) {
                        maxUsdgAmount = tokenInfo.maxUsdgAmount;
                      }
                      const tokenImage = importImage("ic_" + token.symbol.toLowerCase() + "_40.svg");

                      return (
                        <tr
                          key={token.symbol}
                          className={cx(index === 0 ? "border-slate-800" : "border-slate-800", "border-t")}
                        >
                          <td className="whitespace-nowrap py-2.5 pl-4 pr-3 text-sm font-medium sm:pl-6">
                            <div className="flex items-center justify-between pr-[46.5px]">
                              <div className="flex">
                                <div className="mr-2 flex">
                                  <img src={tokenImage} alt={token.symbol} width="20px" />
                                </div>
                                <div>
                                  <div className="text-xs font-medium text-slate-300">{token.name}</div>
                                  <div className="text-xs font-medium text-slate-600">{token.symbol}</div>
                                </div>
                                <div>
                                  <AssetDropdown assetSymbol={token.symbol} assetInfo={token} />
                                </div>
                              </div>
                            </div>
                          </td>
                          <td className="whitespace-nowrap px-3 py-4 text-xs font-medium text-slate-300">
                            ${formatKeyAmount(tokenInfo, "minPrice", USD_DECIMALS, 2, true)}
                          </td>
                          <td className="whitespace-nowrap px-3 py-4 text-xs font-medium text-slate-300">
                            <TooltipComponent
                              handle={`$${formatKeyAmount(tokenInfo, "managedUsd", USD_DECIMALS, 0, true)}`}
                              position="right-bottom"
                              renderContent={() => {
                                return (
                                  <>
                                    <StatsTooltipRow
                                      label="Pool Amount"
                                      value={`${formatKeyAmount(tokenInfo, "managedAmount", token.decimals, 0, true)} ${
                                        token.symbol
                                      }`}
                                      showDollar={false}
                                    />
                                    <StatsTooltipRow
                                      label="Target Min Amount"
                                      value={`${formatKeyAmount(tokenInfo, "bufferAmount", token.decimals, 0, true)} ${
                                        token.symbol
                                      }`}
                                      showDollar={false}
                                    />
                                    <StatsTooltipRow
                                      label={`Max ${tokenInfo.symbol} Capacity`}
                                      value={formatAmount(maxUsdgAmount, 18, 0, true)}
                                      showDollar={true}
                                    />
                                  </>
                                );
                              }}
                            />
                          </td>
                          <td className="whitespace-nowrap px-3 py-4 text-xs font-medium text-slate-300">
                            {getWeightText(tokenInfo)}
                          </td>
                          <td className="relative whitespace-nowrap py-4 pl-3 pr-4 text-right text-xs font-medium sm:pr-6">
                            {formatAmount(utilization, 2, 2, false)}%
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <div className="mt-2 grid grid-cols-1 gap-[15px] lg:hidden">
                {visibleTokens.map((token) => {
                  const tokenInfo = infoTokens[token.address];
                  let utilization = bigNumberify(0);
                  if (tokenInfo && tokenInfo.reservedAmount && tokenInfo.poolAmount && tokenInfo.poolAmount.gt(0)) {
                    utilization = tokenInfo.reservedAmount.mul(BASIS_POINTS_DIVISOR).div(tokenInfo.poolAmount);
                  }
                  let maxUsdgAmount = DEFAULT_MAX_USDG_AMOUNT;
                  if (tokenInfo.maxUsdgAmount && tokenInfo.maxUsdgAmount.gt(0)) {
                    maxUsdgAmount = tokenInfo.maxUsdgAmount;
                  }

                  const tokenImage = importImage("ic_" + token.symbol.toLowerCase() + "_24.svg");
                  return (
                    <div
                      className="relative rounded border border-slate-800 text-xs font-medium shadow"
                      key={token.symbol}
                    >
                      <div className="flex items-center justify-start rounded-t bg-slate-950 p-[15px] py-2 text-xs font-medium uppercase text-slate-600">
                        <img src={tokenImage} alt={token.symbol} className="mr-2 w-5" />
                        <div>{token.symbol}</div>
                        <div>
                          <AssetDropdown assetSymbol={token.symbol} assetInfo={token} />
                        </div>
                      </div>
                      <div className="mb-[10.5px] h-[1px] bg-slate-800"></div>
                      <div className="mb-4 grid grid-cols-1 gap-2">
                        <div className="mx-[15px] grid grid-cols-[1fr_auto] gap-[15px]">
                          <div className="text-slate-300">Price</div>
                          <div>${formatKeyAmount(tokenInfo, "minPrice", USD_DECIMALS, 2, true)}</div>
                        </div>
                        <div className="mx-[15px] grid grid-cols-[1fr_auto] gap-[15px]">
                          <div className="text-slate-400">Pool</div>
                          <div>
                            <TooltipComponent
                              handle={`$${formatKeyAmount(tokenInfo, "managedUsd", USD_DECIMALS, 0, true)}`}
                              position="right-bottom"
                              renderContent={() => {
                                return (
                                  <>
                                    <StatsTooltipRow
                                      label="Pool Amount"
                                      value={`${formatKeyAmount(tokenInfo, "managedAmount", token.decimals, 0, true)} ${
                                        token.symbol
                                      }`}
                                      showDollar={false}
                                    />
                                    <StatsTooltipRow
                                      label="Target Min Amount"
                                      value={`${formatKeyAmount(tokenInfo, "bufferAmount", token.decimals, 0, true)} ${
                                        token.symbol
                                      }`}
                                      showDollar={false}
                                    />
                                    <StatsTooltipRow
                                      label={`Max ${tokenInfo.symbol} Capacity`}
                                      value={formatAmount(maxUsdgAmount, 18, 0, true)}
                                    />
                                  </>
                                );
                              }}
                            />
                          </div>
                        </div>
                        <div className="mx-[15px] grid grid-cols-[1fr_auto] gap-[15px]">
                          <div className="text-slate-400">Weight</div>
                          <div>{getWeightText(tokenInfo)}</div>
                        </div>
                        <div className="mx-[15px] grid grid-cols-[1fr_auto] gap-[15px]">
                          <div className="text-slate-400">Utilization</div>
                          <div>{formatAmount(utilization, 2, 2, false)}%</div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </div>
    </SEO>
  );
}
