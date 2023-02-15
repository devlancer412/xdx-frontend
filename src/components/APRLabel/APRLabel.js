import React from "react";

import useSWR from "swr";

import {
  PLACEHOLDER_ACCOUNT,
  getBalanceAndSupplyData,
  getDepositBalanceData,
  getVestingData,
  getStakingData,
  getProcessedData,
} from "lib/legacy";

import Vault from "abis/Vault.json";
import Reader from "abis/Reader.json";
import RewardReader from "abis/RewardReader.json";
import Token from "abis/Token.json";
import XlxManager from "abis/XlxManager.json";

import { useWeb3React } from "@web3-react/core";

import { useXdxPrice } from "domain/legacy";

import { getContract } from "config/contracts";
import { getServerUrl } from "config/backend";
import { contractFetcher } from "lib/contracts";
import { formatKeyAmount } from "lib/numbers";

export default function APRLabel({ chainId, label }) {
  let { active } = useWeb3React();

  const rewardReaderAddress = getContract(chainId, "RewardReader");
  const readerAddress = getContract(chainId, "Reader");

  const vaultAddress = getContract(chainId, "Vault");
  const nativeTokenAddress = getContract(chainId, "NATIVE_TOKEN");
  const xdxAddress = getContract(chainId, "XDX");
  const esXdxAddress = getContract(chainId, "EsXDX");
  const bnXdxAddress = getContract(chainId, "BN_XDX");
  const xlxAddress = getContract(chainId, "XLX");

  const stakedXdxTrackerAddress = getContract(chainId, "StakedXdxTracker");
  const bonusXdxTrackerAddress = getContract(chainId, "BonusXdxTracker");
  const feeXdxTrackerAddress = getContract(chainId, "FeeXdxTracker");

  const stakedXlxTrackerAddress = getContract(chainId, "StakedXlxTracker");
  const feeXlxTrackerAddress = getContract(chainId, "FeeXlxTracker");

  const xlxManagerAddress = getContract(chainId, "XlxManager");

  const xdxVesterAddress = getContract(chainId, "XdxVester");
  const xlxVesterAddress = getContract(chainId, "XlxVester");

  const vesterAddresses = [xdxVesterAddress, xlxVesterAddress];

  const walletTokens = [xdxAddress, esXdxAddress, xlxAddress, stakedXdxTrackerAddress];
  const depositTokens = [
    xdxAddress,
    esXdxAddress,
    stakedXdxTrackerAddress,
    bonusXdxTrackerAddress,
    bnXdxAddress,
    xlxAddress,
  ];
  const rewardTrackersForDepositBalances = [
    stakedXdxTrackerAddress,
    stakedXdxTrackerAddress,
    bonusXdxTrackerAddress,
    feeXdxTrackerAddress,
    feeXdxTrackerAddress,
    feeXlxTrackerAddress,
  ];
  const rewardTrackersForStakingInfo = [
    stakedXdxTrackerAddress,
    bonusXdxTrackerAddress,
    feeXdxTrackerAddress,
    stakedXlxTrackerAddress,
    feeXlxTrackerAddress,
  ];

  const { data: walletBalances } = useSWR(
    [`StakeV2:walletBalances:${active}`, chainId, readerAddress, "getTokenBalancesWithSupplies", PLACEHOLDER_ACCOUNT],
    {
      fetcher: contractFetcher(undefined, Reader, [walletTokens]),
    }
  );

  const { data: depositBalances } = useSWR(
    [`StakeV2:depositBalances:${active}`, chainId, rewardReaderAddress, "getDepositBalances", PLACEHOLDER_ACCOUNT],
    {
      fetcher: contractFetcher(undefined, RewardReader, [depositTokens, rewardTrackersForDepositBalances]),
    }
  );

  const { data: stakingInfo } = useSWR(
    [`StakeV2:stakingInfo:${active}`, chainId, rewardReaderAddress, "getStakingInfo", PLACEHOLDER_ACCOUNT],
    {
      fetcher: contractFetcher(undefined, RewardReader, [rewardTrackersForStakingInfo]),
    }
  );

  const { data: stakedXdxSupply } = useSWR(
    [`StakeV2:stakedXdxSupply:${active}`, chainId, xdxAddress, "balanceOf", stakedXdxTrackerAddress],
    {
      fetcher: contractFetcher(undefined, Token),
    }
  );

  const { data: aums } = useSWR([`StakeV2:getAums:${active}`, chainId, xlxManagerAddress, "getAums"], {
    fetcher: contractFetcher(undefined, XlxManager),
  });

  const { data: nativeTokenPrice } = useSWR(
    [`StakeV2:nativeTokenPrice:${active}`, chainId, vaultAddress, "getMinPrice", nativeTokenAddress],
    {
      fetcher: contractFetcher(undefined, Vault),
    }
  );

  const { data: vestingInfo } = useSWR(
    [`StakeV2:vestingInfo:${active}`, chainId, readerAddress, "getVestingInfo", PLACEHOLDER_ACCOUNT],
    {
      fetcher: contractFetcher(undefined, Reader, [vesterAddresses]),
    }
  );

  const { xdxPrice } = useXdxPrice(chainId, {}, active);

  const xdxSupplyUrl = getServerUrl(chainId, "/gmx_supply");
  const { data: xdxSupply } = useSWR([xdxSupplyUrl], {
    fetcher: (...args) => fetch(...args).then((res) => res.text()),
  });

  let aum;
  if (aums && aums.length > 0) {
    aum = aums[0].add(aums[1]).div(2);
  }

  const { balanceData, supplyData } = getBalanceAndSupplyData(walletBalances);
  const depositBalanceData = getDepositBalanceData(depositBalances);
  const stakingData = getStakingData(stakingInfo);
  const vestingData = getVestingData(vestingInfo);

  const processedData = getProcessedData(
    balanceData,
    supplyData,
    depositBalanceData,
    stakingData,
    vestingData,
    aum,
    nativeTokenPrice,
    stakedXdxSupply,
    xdxPrice,
    xdxSupply
  );

  return <>{`${formatKeyAmount(processedData, label, 2, 2, true)}%`}</>;
}
