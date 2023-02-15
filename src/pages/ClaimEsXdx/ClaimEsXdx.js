import React, { useState } from "react";
import useSWR from "swr";
import { ethers } from "ethers";
import { useWeb3React } from "@web3-react/core";
import { PLACEHOLDER_ACCOUNT } from "lib/legacy";

import { getContract } from "config/contracts";

import Token from "abis/Token.json";
import RewardReader from "abis/RewardReader.json";

import Checkbox from "components/Checkbox/Checkbox";

import arbitrumIcon from "img/ic_arbitrum_96.svg";
import avaIcon from "img/ic_avalanche_96.svg";

import { Trans, t } from "@lingui/macro";
import {
  // ARBITRUM,
  AVALANCHE,
} from "config/chains";
import { callContract, contractFetcher } from "lib/contracts";
import { bigNumberify, formatAmount, formatAmountFree, parseValue } from "lib/numbers";
import { useChainId } from "lib/chains";

const VEST_WITH_XDX_ARB = "VEST_WITH_XDX_ARB";
const VEST_WITH_XLX_ARB = "VEST_WITH_XLX_ARB";
const VEST_WITH_XDX_AVAX = "VEST_WITH_XDX_AVAX";
const VEST_WITH_XLX_AVAX = "VEST_WITH_XLX_AVAX";

export function getVestingDataV2(vestingInfo) {
  if (!vestingInfo || vestingInfo.length === 0) {
    return;
  }

  const keys = ["xdxVester", "xlxVester"];
  const data = {};
  const propsLength = 12;

  for (let i = 0; i < keys.length; i++) {
    const key = keys[i];
    data[key] = {
      pairAmount: vestingInfo[i * propsLength],
      vestedAmount: vestingInfo[i * propsLength + 1],
      escrowedBalance: vestingInfo[i * propsLength + 2],
      claimedAmounts: vestingInfo[i * propsLength + 3],
      claimable: vestingInfo[i * propsLength + 4],
      maxVestableAmount: vestingInfo[i * propsLength + 5],
      combinedAverageStakedAmount: vestingInfo[i * propsLength + 6],
      cumulativeReward: vestingInfo[i * propsLength + 7],
      transferredCumulativeReward: vestingInfo[i * propsLength + 8],
      bonusReward: vestingInfo[i * propsLength + 9],
      averageStakedAmount: vestingInfo[i * propsLength + 10],
      transferredAverageStakedAmount: vestingInfo[i * propsLength + 11],
    };

    data[key + "PairAmount"] = data[key].pairAmount;
    data[key + "VestedAmount"] = data[key].vestedAmount;
    data[key + "EscrowedBalance"] = data[key].escrowedBalance;
    data[key + "ClaimSum"] = data[key].claimedAmounts.add(data[key].claimable);
    data[key + "Claimable"] = data[key].claimable;
    data[key + "MaxVestableAmount"] = data[key].maxVestableAmount;
    data[key + "CombinedAverageStakedAmount"] = data[key].combinedAverageStakedAmount;
    data[key + "CumulativeReward"] = data[key].cumulativeReward;
    data[key + "TransferredCumulativeReward"] = data[key].transferredCumulativeReward;
    data[key + "BonusReward"] = data[key].bonusReward;
    data[key + "AverageStakedAmount"] = data[key].averageStakedAmount;
    data[key + "TransferredAverageStakedAmount"] = data[key].transferredAverageStakedAmount;
  }

  return data;
}

function getVestingValues({ minRatio, amount, vestingDataItem }) {
  if (!vestingDataItem || !amount || amount.eq(0)) {
    return;
  }

  let currentRatio = bigNumberify(0);

  const ratioMultiplier = 10000;
  const maxVestableAmount = vestingDataItem.maxVestableAmount;
  const nextMaxVestableEsXdx = maxVestableAmount.add(amount);

  const combinedAverageStakedAmount = vestingDataItem.combinedAverageStakedAmount;
  if (maxVestableAmount.gt(0)) {
    currentRatio = combinedAverageStakedAmount.mul(ratioMultiplier).div(maxVestableAmount);
  }

  const transferredCumulativeReward = vestingDataItem.transferredCumulativeReward;
  const nextTransferredCumulativeReward = transferredCumulativeReward.add(amount);
  const cumulativeReward = vestingDataItem.cumulativeReward;
  const totalCumulativeReward = cumulativeReward.add(nextTransferredCumulativeReward);

  let nextCombinedAverageStakedAmount = combinedAverageStakedAmount;

  if (combinedAverageStakedAmount.lt(totalCumulativeReward.mul(minRatio))) {
    const averageStakedAmount = vestingDataItem.averageStakedAmount;
    let nextTransferredAverageStakedAmount = totalCumulativeReward.mul(minRatio);
    nextTransferredAverageStakedAmount = nextTransferredAverageStakedAmount.sub(
      averageStakedAmount.mul(cumulativeReward).div(totalCumulativeReward)
    );
    nextTransferredAverageStakedAmount = nextTransferredAverageStakedAmount
      .mul(totalCumulativeReward)
      .div(nextTransferredCumulativeReward);

    nextCombinedAverageStakedAmount = averageStakedAmount
      .mul(cumulativeReward)
      .div(totalCumulativeReward)
      .add(nextTransferredAverageStakedAmount.mul(nextTransferredCumulativeReward).div(totalCumulativeReward));
  }

  const nextRatio = nextCombinedAverageStakedAmount.mul(ratioMultiplier).div(nextMaxVestableEsXdx);

  const initialStakingAmount = currentRatio.mul(maxVestableAmount);
  const nextStakingAmount = nextRatio.mul(nextMaxVestableEsXdx);

  return {
    maxVestableAmount,
    currentRatio,
    nextMaxVestableEsXdx,
    nextRatio,
    initialStakingAmount,
    nextStakingAmount,
  };
}

export default function ClaimEsXdx({ setPendingTxns }) {
  const { active, account, library } = useWeb3React();
  const { chainId } = useChainId();
  const [selectedOption, setSelectedOption] = useState("");
  const [isClaiming, setIsClaiming] = useState(false);
  const [value, setValue] = useState("");

  // const isArbitrum = chainId === ARBITRUM;
  const isArbitrum = false;

  const esXdxIouAddress = getContract(chainId, "ES_XDX_IOU");

  const { data: esXdxIouBalance } = useSWR(
    isArbitrum && [
      `ClaimEsXdx:esXdxIouBalance:${active}`,
      chainId,
      esXdxIouAddress,
      "balanceOf",
      account || PLACEHOLDER_ACCOUNT,
    ],
    {
      fetcher: contractFetcher(library, Token),
    }
  );

  // const arbRewardReaderAddress = getContract(ARBITRUM, "RewardReader");
  const avaxRewardReaderAddress = getContract(AVALANCHE, "RewardReader");

  // const arbVesterAdddresses = [getContract(ARBITRUM, "GmxVester"), getContract(ARBITRUM, "GlpVester")];
  const avaxVesterAdddresses = [getContract(AVALANCHE, "XdxVester"), getContract(AVALANCHE, "XlxVester")];

  // const { data: arbVestingInfo } = useSWR(
  //   [
  //     `StakeV2:vestingInfo:${active}`,
  //     ARBITRUM,
  //     arbRewardReaderAddress,
  //     "getVestingInfoV2",
  //     account || PLACEHOLDER_ACCOUNT,
  //   ],
  //   {
  //     fetcher: contractFetcher(undefined, RewardReader, [arbVesterAdddresses]),
  //   }
  // );

  const { data: avaxVestingInfo } = useSWR(
    [
      `StakeV2:vestingInfo:${active}`,
      AVALANCHE,
      avaxRewardReaderAddress,
      "getVestingInfoV2",
      account || PLACEHOLDER_ACCOUNT,
    ],
    {
      fetcher: contractFetcher(undefined, RewardReader, [avaxVesterAdddresses]),
    }
  );

  // const arbVestingData = getVestingDataV2(arbVestingInfo);
  const avaxVestingData = getVestingDataV2(avaxVestingInfo);

  let amount = parseValue(value, 18);

  let maxVestableAmount;
  let currentRatio;

  let nextMaxVestableEsXdx;
  let nextRatio;

  let initialStakingAmount;
  let nextStakingAmount;

  let stakingToken = "staked XDX";

  const shouldShowStakingAmounts = false;

  // if (selectedOption === VEST_WITH_XDX_ARB && arbVestingData) {
  //   const result = getVestingValues({
  //     minRatio: bigNumberify(4),
  //     amount,
  //     vestingDataItem: arbVestingData.xdxVester,
  //   });

  //   if (result) {
  //     ({ maxVestableAmount, currentRatio, nextMaxVestableEsXdx, nextRatio, initialStakingAmount, nextStakingAmount } =
  //       result);
  //   }
  // }

  // if (selectedOption === VEST_WITH_XLX_ARB && arbVestingData) {
  //   const result = getVestingValues({
  //     minRatio: bigNumberify(320),
  //     amount,
  //     vestingDataItem: arbVestingData.xdxVester,
  //   });

  //   if (result) {
  //     ({ maxVestableAmount, currentRatio, nextMaxVestableEsXdx, nextRatio, initialStakingAmount, nextStakingAmount } =
  //       result);
  //   }

  //   stakingToken = "XLX";
  // }

  if (selectedOption === VEST_WITH_XDX_AVAX && avaxVestingData) {
    const result = getVestingValues({
      minRatio: bigNumberify(4),
      amount,
      vestingDataItem: avaxVestingData.xdxVester,
    });

    if (result) {
      ({ maxVestableAmount, currentRatio, nextMaxVestableEsXdx, nextRatio, initialStakingAmount, nextStakingAmount } =
        result);
    }
  }

  if (selectedOption === VEST_WITH_XLX_AVAX && avaxVestingData) {
    const result = getVestingValues({
      minRatio: bigNumberify(320),
      amount,
      vestingDataItem: avaxVestingData.xdxVester,
    });

    if (result) {
      ({ maxVestableAmount, currentRatio, nextMaxVestableEsXdx, nextRatio, initialStakingAmount, nextStakingAmount } =
        result);
    }

    stakingToken = "XLX";
  }

  const getError = () => {
    if (!active) {
      return t`Wallet not connected`;
    }

    if (esXdxIouBalance && esXdxIouBalance.eq(0)) {
      return t`No esXDX to claim`;
    }

    if (!amount || amount.eq(0)) {
      return t`Enter an amount`;
    }

    if (selectedOption === "") {
      return t`Select an option`;
    }

    return false;
  };

  const error = getError();

  const getPrimaryText = () => {
    if (error) {
      return error;
    }

    if (isClaiming) {
      return t`Claiming...`;
    }

    return t`Claim`;
  };

  const isPrimaryEnabled = () => {
    return !error && !isClaiming;
  };

  const claim = () => {
    setIsClaiming(true);

    let receiver;

    if (selectedOption === VEST_WITH_XDX_ARB) {
      receiver = "0x544a6ec142Aa9A7F75235fE111F61eF2EbdC250a";
    }

    if (selectedOption === VEST_WITH_XLX_ARB) {
      receiver = "0x9d8f6f6eE45275A5Ca3C6f6269c5622b1F9ED515";
    }

    if (selectedOption === VEST_WITH_XDX_AVAX) {
      receiver = "0x171a321A78dAE0CDC0Ba3409194df955DEEcA746";
    }

    if (selectedOption === VEST_WITH_XLX_AVAX) {
      receiver = "0x28863Dd19fb52DF38A9f2C6dfed40eeB996e3818";
    }

    const contract = new ethers.Contract(esXdxIouAddress, Token.abi, library.getSigner());
    callContract(chainId, contract, "transfer", [receiver, amount], {
      sentMsg: t`Claim submitted!`,
      failMsg: t`Claim failed.`,
      successMsg: t`Claim completed!`,
      setPendingTxns,
    })
      .then(async (res) => {})
      .finally(() => {
        setIsClaiming(false);
      });
  };

  return (
    <div className="ClaimEsXdx Page page-layout">
      <div className="Page-title-section mt-0">
        <div className="mb-[8px] flex flex-row items-center text-xl font-medium text-slate-300">
          <Trans>Claim esXDX</Trans>
        </div>
        {!isArbitrum && (
          <div className="text-sm text-slate-600">
            <br />
            <Trans>Please switch your network to Arbitrum.</Trans>
          </div>
        )}
        {isArbitrum && (
          <div>
            <div className="text-sm text-slate-600">
              <br />
              <Trans>You have {formatAmount(esXdxIouBalance, 18, 2, true)} esXDX (IOU) tokens.</Trans>
              <br />
              <br />
              <Trans>The address of the esXDX (IOU) token is {esXdxIouAddress}.</Trans>
              <br />
              <Trans>
                The esXDX (IOU) token is transferrable. You can add the token to your wallet and send it to another
                address to claim if you'd like.
              </Trans>
              <br />
              <br />
              <Trans>Select your vesting option below then click "Claim".</Trans>
              <br />
              <Trans>
                After claiming, the esXDX tokens will be airdropped to your account on the selected network within 7
                days.
              </Trans>
              <br />
              <Trans>The esXDX tokens can be staked or vested at any time.</Trans>
              <br />
              <Trans>
                Your esXDX (IOU) balance will decrease by your claim amount after claiming, this is expected behaviour.
              </Trans>
              <br />
              <Trans>
                You can check your claim history{" "}
                <a
                  href={`https://arbiscan.io/token/${esXdxIouAddress}?a=${account}`}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  here
                </a>
                .
              </Trans>
            </div>
            <br />
            <div className="ClaimEsXdx-vesting-options">
              <Checkbox
                className="arbitrum btn btn-primary btn-left btn-lg"
                isChecked={selectedOption === VEST_WITH_XDX_ARB}
                setIsChecked={() => setSelectedOption(VEST_WITH_XDX_ARB)}
              >
                <div className="ClaimEsXdx-option-label">
                  <Trans>Vest with XDX on Arbitrum</Trans>
                </div>
                <img src={arbitrumIcon} alt="arbitrum" />
              </Checkbox>
              <Checkbox
                className="arbitrum btn btn-primary btn-left btn-lg"
                isChecked={selectedOption === VEST_WITH_XLX_ARB}
                setIsChecked={() => setSelectedOption(VEST_WITH_XLX_ARB)}
              >
                <div className="ClaimEsXdx-option-label">
                  <Trans>Vest with XLX on Arbitrum</Trans>
                </div>
                <img src={arbitrumIcon} alt="arbitrum" />
              </Checkbox>
              <Checkbox
                className="avalanche btn btn-primary btn-left btn-lg"
                isChecked={selectedOption === VEST_WITH_XDX_AVAX}
                setIsChecked={() => setSelectedOption(VEST_WITH_XDX_AVAX)}
              >
                <div className="ClaimEsXdx-option-label">
                  <Trans>Vest with XDX on Avalanche</Trans>
                </div>
                <img src={avaIcon} alt="avalanche" />
              </Checkbox>
              <Checkbox
                className="avalanche btn btn-primary btn-left btn-lg"
                isChecked={selectedOption === VEST_WITH_XLX_AVAX}
                setIsChecked={() => setSelectedOption(VEST_WITH_XLX_AVAX)}
              >
                <div className="ClaimEsXdx-option-label avalanche">
                  <Trans>Vest with XLX on Avalanche</Trans>
                </div>
                <img src={avaIcon} alt="avalanche" />
              </Checkbox>
            </div>
            <br />
            {!error && (
              <div className="opacity-70">
                <Trans>
                  You can currently vest a maximum of {formatAmount(maxVestableAmount, 18, 2, true)} esXDX tokens at a
                  ratio of {formatAmount(currentRatio, 4, 2, true)} {stakingToken} to 1 esXDX.
                </Trans>
                {shouldShowStakingAmounts && `${formatAmount(initialStakingAmount, 18, 2, true)}.`}
                <br />
                <Trans>
                  After claiming you will be able to vest a maximum of {formatAmount(nextMaxVestableEsXdx, 18, 2, true)}{" "}
                  esXDX at a ratio of {formatAmount(nextRatio, 4, 2, true)} {stakingToken} to 1 esXDX.
                </Trans>
                {shouldShowStakingAmounts && `${formatAmount(nextStakingAmount, 18, 2, true)}.`}
                <br />
                <br />
              </div>
            )}
            <div>
              <div className="ClaimEsXdx-input-label opacity-70">
                <Trans>Amount to claim</Trans>
              </div>
              <div className="ClaimEsXdx-input-container">
                <input type="number" placeholder="0.0" value={value} onChange={(e) => setValue(e.target.value)} />
                {value !== formatAmountFree(esXdxIouBalance, 18, 18) && (
                  <div
                    className="ClaimEsXdx-max-button"
                    onClick={() => setValue(formatAmountFree(esXdxIouBalance, 18, 18))}
                  >
                    <Trans>MAX</Trans>
                  </div>
                )}
              </div>
            </div>
            <br />
            <div>
              <button
                className="w-full rounded-[3px]  bg-slate-800 p-[15px] text-[14px] leading-none hover:bg-[#4f60fc] hover:shadow disabled:cursor-not-allowed"
                disabled={!isPrimaryEnabled()}
                onClick={() => claim()}
              >
                {getPrimaryText()}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
