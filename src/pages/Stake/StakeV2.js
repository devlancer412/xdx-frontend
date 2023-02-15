import React, { useState, useCallback } from "react";
import { Link } from "react-router-dom";
import { Trans, t } from "@lingui/macro";
import { useWeb3React } from "@web3-react/core";

import Modal from "components/Modal/Modal";
import Checkbox from "components/Checkbox/Checkbox";
import Tooltip from "components/Tooltip/Tooltip";

import Vault from "abis/Vault.json";
import Reader from "abis/Reader.json";
import Vester from "abis/Vester.json";
import RewardRouter from "abis/RewardRouter.json";
import RewardReader from "abis/RewardReader.json";
import Token from "abis/Token.json";
import XlxManager from "abis/XlxManager.json";

import { ethers } from "ethers";
import {
  XLX_DECIMALS,
  USD_DECIMALS,
  BASIS_POINTS_DIVISOR,
  PLACEHOLDER_ACCOUNT,
  getBalanceAndSupplyData,
  getDepositBalanceData,
  getVestingData,
  getStakingData,
  getProcessedData,
  getPageTitle,
} from "lib/legacy";
import { useXdxPrice, useTotalXdxStaked, useTotalXdxSupply } from "domain/legacy";
import { AVALANCHE, getChainName, getConstant } from "config/chains";

import useSWR from "swr";

import { getContract } from "config/contracts";

import SEO from "components/Common/SEO";
import StatsTooltip from "components/StatsTooltip/StatsTooltip";
import StatsTooltipRow from "components/StatsTooltip/StatsTooltipRow";
import { getServerUrl } from "config/backend";
import { callContract, contractFetcher } from "lib/contracts";
import { useLocalStorageSerializeKey } from "lib/localStorage";
import { helperToast } from "lib/helperToast";
import { approveTokens } from "domain/tokens";
import { bigNumberify, expandDecimals, formatAmount, formatAmountFree, formatKeyAmount, parseValue } from "lib/numbers";
import { useChainId } from "lib/chains";

const { AddressZero } = ethers.constants;

function StakeModal(props) {
  const {
    isVisible,
    setIsVisible,
    chainId,
    title,
    maxAmount,
    value,
    setValue,
    active,
    account,
    library,
    stakingTokenSymbol,
    stakingTokenAddress,
    farmAddress,
    rewardRouterAddress,
    stakeMethodName,
    setPendingTxns,
  } = props;
  const [isStaking, setIsStaking] = useState(false);
  const [isApproving, setIsApproving] = useState(false);

  const { data: tokenAllowance } = useSWR(
    active && stakingTokenAddress && [active, chainId, stakingTokenAddress, "allowance", account, farmAddress],
    {
      fetcher: contractFetcher(library, Token),
    }
  );

  let amount = parseValue(value, 18);
  const needApproval = farmAddress !== AddressZero && tokenAllowance && amount && amount.gt(tokenAllowance);

  const getError = () => {
    if (!amount || amount.eq(0)) {
      return t`Enter an amount`;
    }
    if (maxAmount && amount.gt(maxAmount)) {
      return t`Max amount exceeded`;
    }
  };

  const onClickPrimary = () => {
    if (needApproval) {
      approveTokens({
        setIsApproving,
        library,
        tokenAddress: stakingTokenAddress,
        spender: farmAddress,
        chainId,
      });
      return;
    }

    setIsStaking(true);
    const contract = new ethers.Contract(rewardRouterAddress, RewardRouter.abi, library.getSigner());

    callContract(chainId, contract, stakeMethodName, [amount], {
      sentMsg: t`Stake submitted!`,
      failMsg: t`Stake failed.`,
      setPendingTxns,
    })
      .then(async (res) => {
        setIsVisible(false);
      })
      .finally(() => {
        setIsStaking(false);
      });
  };

  const isPrimaryEnabled = () => {
    const error = getError();
    if (error) {
      return false;
    }
    if (isApproving) {
      return false;
    }
    if (isStaking) {
      return false;
    }
    return true;
  };

  const getPrimaryText = () => {
    const error = getError();
    if (error) {
      return error;
    }
    if (isApproving) {
      return t`Approving ${stakingTokenSymbol}...`;
    }
    if (needApproval) {
      return t`Approve ${stakingTokenSymbol}`;
    }
    if (isStaking) {
      return t`Staking...`;
    }
    return t`Stake`;
  };

  return (
    <div className="text-xs font-medium text-slate-300">
      <Modal isVisible={isVisible} setIsVisible={setIsVisible} label={title} position="center" className="!w-[310px]">
        <div className="mb-[10.5px] rounded-[3px] border border-slate-800 bg-slate-950 bg-opacity-50 p-[15px]">
          <div className="grid grid-cols-1 pb-[12.5px] text-[14px] lg:grid-cols-2">
            <div className="text-xs font-medium text-slate-600">
              <div className="inline-block text-[14px]">
                <Trans>Stake</Trans>
              </div>
            </div>
            <div
              className="flex cursor-pointer justify-end text-right text-slate-500"
              onClick={() => setValue(formatAmountFree(maxAmount, 18, 18))}
            >
              Max: {formatAmount(maxAmount, 18, 4, true)}
            </div>
          </div>
          <div className="grid grid-cols-[1fr_auto] pb-[3.1px]">
            <div className="flex items-center justify-center">
              <input
                type="number"
                placeholder="0.0"
                className="w-full border-0 bg-transparent p-0 pr-5 text-[23.25px] outline-none focus:ring-0 focus:ring-offset-0"
                value={value}
                onChange={(e) => setValue(e.target.value)}
              />
            </div>
            <div className="text-right text-[21px] text-xs font-medium text-slate-300">{stakingTokenSymbol}</div>
          </div>
        </div>
        <div className="pt-[3.1px]">
          <button
            className="w-full rounded-[3px]  bg-slate-800 p-[15px] text-[14px] leading-none hover:bg-[#4f60fc] hover:shadow disabled:cursor-not-allowed"
            onClick={onClickPrimary}
            disabled={!isPrimaryEnabled()}
          >
            {getPrimaryText()}
          </button>
        </div>
      </Modal>
    </div>
  );
}

function UnstakeModal(props) {
  const {
    isVisible,
    setIsVisible,
    chainId,
    title,
    maxAmount,
    value,
    setValue,
    library,
    unstakingTokenSymbol,
    rewardRouterAddress,
    unstakeMethodName,
    multiplierPointsAmount,
    reservedAmount,
    bonusXdxInFeeXdx,
    setPendingTxns,
  } = props;
  const [isUnstaking, setIsUnstaking] = useState(false);

  let amount = parseValue(value, 18);
  let burnAmount;

  if (
    multiplierPointsAmount &&
    multiplierPointsAmount.gt(0) &&
    amount &&
    amount.gt(0) &&
    bonusXdxInFeeXdx &&
    bonusXdxInFeeXdx.gt(0)
  ) {
    burnAmount = multiplierPointsAmount.mul(amount).div(bonusXdxInFeeXdx);
  }

  const shouldShowReductionAmount = true;
  let rewardReductionBasisPoints;
  if (burnAmount && bonusXdxInFeeXdx) {
    rewardReductionBasisPoints = burnAmount.mul(BASIS_POINTS_DIVISOR).div(bonusXdxInFeeXdx);
  }

  const getError = () => {
    if (!amount) {
      return t`Enter an amount`;
    }
    if (amount.gt(maxAmount)) {
      return t`Max amount exceeded`;
    }
  };

  const onClickPrimary = () => {
    setIsUnstaking(true);
    const contract = new ethers.Contract(rewardRouterAddress, RewardRouter.abi, library.getSigner());
    callContract(chainId, contract, unstakeMethodName, [amount], {
      sentMsg: t`Unstake submitted!`,
      failMsg: t`Unstake failed.`,
      successMsg: t`Unstake completed!`,
      setPendingTxns,
    })
      .then(async (res) => {
        setIsVisible(false);
      })
      .finally(() => {
        setIsUnstaking(false);
      });
  };

  const isPrimaryEnabled = () => {
    const error = getError();
    if (error) {
      return false;
    }
    if (isUnstaking) {
      return false;
    }
    return true;
  };

  const getPrimaryText = () => {
    const error = getError();
    if (error) {
      return error;
    }
    if (isUnstaking) {
      return t`Unstaking...`;
    }
    return t`Unstake`;
  };

  return (
    <div className="text-xs font-medium text-slate-300">
      <Modal isVisible={isVisible} setIsVisible={setIsVisible} label={title} position="center" className="!w-[310px]">
        <div className="mb-[10.5px] rounded-[3px] border border-slate-800 bg-slate-950 bg-opacity-50 p-[15px]">
          <div className="grid grid-cols-1 pb-[12.5px] text-[14px] lg:grid-cols-2">
            <div className="text-slate-600">
              <div className="inline-block text-[14px]">
                <Trans>Unstake</Trans>
              </div>
            </div>
            <div
              className="flex cursor-pointer justify-end text-right text-slate-500"
              onClick={() => setValue(formatAmountFree(maxAmount, 18, 18))}
            >
              <Trans>Max</Trans>: {formatAmount(maxAmount, 18, 4, true)}
            </div>
          </div>
          <div className="grid grid-cols-[1fr_auto] pb-[3.1px]">
            <div className="flex items-center justify-center">
              <input
                type="number"
                placeholder="0.0"
                className="w-full border-0 bg-transparent p-0 pr-5 text-[23.25px] outline-none focus:ring-0 focus:ring-offset-0"
                value={value}
                onChange={(e) => setValue(e.target.value)}
              />
            </div>
            <div className="text-right text-[21px] text-xs font-medium text-slate-300">{unstakingTokenSymbol}</div>
          </div>
        </div>
        {reservedAmount && reservedAmount.gt(0) && (
          <div className="Modal-note">
            You have {formatAmount(reservedAmount, 18, 2, true)} tokens reserved for vesting.
          </div>
        )}
        {burnAmount && burnAmount.gt(0) && rewardReductionBasisPoints && rewardReductionBasisPoints.gt(0) && (
          <div className="Modal-note">
            Unstaking will burn&nbsp;
            <a href="https://xdx.exchange/docs" target="_blank" rel="noopener noreferrer">
              {formatAmount(burnAmount, 18, 4, true)} Multiplier Points
            </a>
            .&nbsp;
            {shouldShowReductionAmount && (
              <span>Boost Percentage: -{formatAmount(rewardReductionBasisPoints, 2, 2)}%.</span>
            )}
          </div>
        )}
        <div className="pt-[3.1px]">
          <button
            className="w-full rounded-[3px]  bg-slate-800 p-[15px] text-[14px] leading-none hover:bg-[#4f60fc] hover:shadow disabled:cursor-not-allowed"
            onClick={onClickPrimary}
            disabled={!isPrimaryEnabled()}
          >
            {getPrimaryText()}
          </button>
        </div>
      </Modal>
    </div>
  );
}

function VesterDepositModal(props) {
  const {
    isVisible,
    setIsVisible,
    chainId,
    title,
    maxAmount,
    value,
    setValue,
    balance,
    vestedAmount,
    averageStakedAmount,
    maxVestableAmount,
    library,
    stakeTokenLabel,
    reserveAmount,
    maxReserveAmount,
    vesterAddress,
    setPendingTxns,
  } = props;
  const [isDepositing, setIsDepositing] = useState(false);

  let amount = parseValue(value, 18);

  let nextReserveAmount = reserveAmount;

  let nextDepositAmount = vestedAmount;
  if (amount) {
    nextDepositAmount = vestedAmount.add(amount);
  }

  let additionalReserveAmount = bigNumberify(0);
  if (amount && averageStakedAmount && maxVestableAmount && maxVestableAmount.gt(0)) {
    nextReserveAmount = nextDepositAmount.mul(averageStakedAmount).div(maxVestableAmount);
    if (nextReserveAmount.gt(reserveAmount)) {
      additionalReserveAmount = nextReserveAmount.sub(reserveAmount);
    }
  }

  const getError = () => {
    if (!amount || amount.eq(0)) {
      return t`Enter an amount`;
    }
    if (maxAmount && amount.gt(maxAmount)) {
      return t`Max amount exceeded`;
    }
    if (nextReserveAmount.gt(maxReserveAmount)) {
      return t`Insufficient staked tokens`;
    }
  };

  const onClickPrimary = () => {
    setIsDepositing(true);
    const contract = new ethers.Contract(vesterAddress, Vester.abi, library.getSigner());

    callContract(chainId, contract, "deposit", [amount], {
      sentMsg: t`Deposit submitted!`,
      failMsg: t`Deposit failed!`,
      successMsg: t`Deposited!`,
      setPendingTxns,
    })
      .then(async (res) => {
        setIsVisible(false);
      })
      .finally(() => {
        setIsDepositing(false);
      });
  };

  const isPrimaryEnabled = () => {
    const error = getError();
    if (error) {
      return false;
    }
    if (isDepositing) {
      return false;
    }
    return true;
  };

  const getPrimaryText = () => {
    const error = getError();
    if (error) {
      return error;
    }
    if (isDepositing) {
      return t`Depositing...`;
    }
    return t`Deposit`;
  };

  return (
    <SEO title={getPageTitle("Earn")}>
      <div className="text-xs font-medium text-slate-300">
        <Modal
          isVisible={isVisible}
          setIsVisible={setIsVisible}
          label={title}
          position="center"
          className="!w-[310px]"
          overflow="overflow-[unset]"
        >
          <div className="mb-[10.5px] rounded-[3px] border border-slate-800 bg-slate-950 bg-opacity-50 p-[15px]">
            <div className="grid grid-cols-1 pb-[12.5px] text-[14px] lg:grid-cols-2">
              <div className="text-slate-600">
                <div className="inline-block text-[14px]">
                  <Trans>Deposit</Trans>
                </div>
              </div>
              <div
                className="flex cursor-pointer justify-end text-right text-slate-500"
                onClick={() => setValue(formatAmountFree(maxAmount, 18, 18))}
              >
                <Trans>Max</Trans>: {formatAmount(maxAmount, 18, 4, true)}
              </div>
            </div>
            <div className="grid grid-cols-[1fr_auto] pb-[3.1px]">
              <div className="flex items-center justify-center">
                <input
                  type="number"
                  placeholder="0.0"
                  className="w-full border-0 bg-transparent p-0 pr-5 text-[23.25px] outline-none focus:ring-0 focus:ring-offset-0"
                  value={value}
                  onChange={(e) => setValue(e.target.value)}
                />
              </div>
              <div className="text-right text-[21px] text-xs font-medium text-slate-300">esXDX</div>
            </div>
          </div>
          <div className="mb-2">
            <div className="mb-1 grid grid-cols-[auto_auto] text-sm">
              <div className="mr-2 text-xs font-medium text-slate-600">Wallet</div>
              <div className="flex flex-row items-end justify-end text-right text-xs font-medium">
                {formatAmount(balance, 18, 2, true)} esXDX
              </div>
            </div>
            <div className="mb-1 grid grid-cols-[auto_auto] text-sm">
              <div className="mr-2 text-xs font-medium text-slate-600">
                <Trans>Vault Capacity</Trans>
              </div>
              <div className="flex flex-row items-end justify-end text-right text-xs font-medium">
                <Tooltip
                  handle={`${formatAmount(nextDepositAmount, 18, 2, true)} / ${formatAmount(
                    maxVestableAmount,
                    18,
                    2,
                    true
                  )}`}
                  position="right-bottom"
                  renderContent={() => {
                    return (
                      <div>
                        <p className="mb-2 text-xs font-medium text-slate-300">
                          <Trans>Vault Capacity for your Account:</Trans>
                        </p>
                        <StatsTooltipRow
                          showDollar={false}
                          label={t`Deposited`}
                          value={`${formatAmount(vestedAmount, 18, 2, true)} esXDX`}
                        />
                        <StatsTooltipRow
                          showDollar={false}
                          label={t`Max Capacity`}
                          value={`${formatAmount(maxVestableAmount, 18, 2, true)} esXDX`}
                        />
                      </div>
                    );
                  }}
                />
              </div>
            </div>
            <div className="mb-1 grid grid-cols-[auto_auto] text-sm">
              <div className="mr-2 text-xs font-medium text-slate-600">
                <Trans>Reserve Amount</Trans>
              </div>
              <div className="flex flex-row items-end justify-end text-right text-xs font-medium">
                <Tooltip
                  handle={`${formatAmount(
                    reserveAmount && reserveAmount.gte(additionalReserveAmount)
                      ? reserveAmount
                      : additionalReserveAmount,
                    18,
                    2,
                    true
                  )} / ${formatAmount(maxReserveAmount, 18, 2, true)}`}
                  position="right-bottom"
                  renderContent={() => {
                    return (
                      <>
                        <StatsTooltipRow
                          label={t`Current Reserved`}
                          value={formatAmount(reserveAmount, 18, 2, true)}
                          showDollar={false}
                        />
                        <StatsTooltipRow
                          label={t`Additional reserve required`}
                          value={formatAmount(additionalReserveAmount, 18, 2, true)}
                          showDollar={false}
                        />
                        {amount && nextReserveAmount.gt(maxReserveAmount) && (
                          <>
                            <br />
                            <Trans>
                              You need a total of at least {formatAmount(nextReserveAmount, 18, 2, true)}{" "}
                              {stakeTokenLabel} to vest {formatAmount(amount, 18, 2, true)} esXDX.
                            </Trans>
                          </>
                        )}
                      </>
                    );
                  }}
                />
              </div>
            </div>
          </div>
          <div className="pt-[3.1px]">
            <button
              className="w-full rounded-[3px]  bg-slate-800 p-[15px] text-[14px] leading-none hover:bg-[#4f60fc] hover:shadow disabled:cursor-not-allowed"
              onClick={onClickPrimary}
              disabled={!isPrimaryEnabled()}
            >
              {getPrimaryText()}
            </button>
          </div>
        </Modal>
      </div>
    </SEO>
  );
}

function VesterWithdrawModal(props) {
  const { isVisible, setIsVisible, chainId, title, library, vesterAddress, setPendingTxns } = props;
  const [isWithdrawing, setIsWithdrawing] = useState(false);

  const onClickPrimary = () => {
    setIsWithdrawing(true);
    const contract = new ethers.Contract(vesterAddress, Vester.abi, library.getSigner());

    callContract(chainId, contract, "withdraw", [], {
      sentMsg: t`Withdraw submitted.`,
      failMsg: t`Withdraw failed.`,
      successMsg: t`Withdrawn!`,
      setPendingTxns,
    })
      .then(async (res) => {
        setIsVisible(false);
      })
      .finally(() => {
        setIsWithdrawing(false);
      });
  };

  return (
    <div className="text-xs font-medium text-slate-300">
      <Modal isVisible={isVisible} setIsVisible={setIsVisible} label={title} position="center" className="!w-[310px]">
        <Trans>
          <div>
            This will withdraw and unreserve all tokens as well as pause vesting.
            <br />
            <br />
            esXDX tokens that have been converted to XDX will remain as XDX tokens.
            <br />
            <br />
            To claim XDX tokens without withdrawing, use the "Claim" button under the Total Rewards section.
            <br />
            <br />
          </div>
        </Trans>
        <div className="pt-[3.1px]">
          <button
            className="w-full rounded-[3px]  bg-slate-800 p-[15px] text-[14px] leading-none hover:bg-[#4f60fc] hover:shadow disabled:cursor-not-allowed"
            onClick={onClickPrimary}
            disabled={isWithdrawing}
          >
            {!isWithdrawing && "Confirm Withdraw"}
            {isWithdrawing && "Confirming..."}
          </button>
        </div>
      </Modal>
    </div>
  );
}

function CompoundModal(props) {
  const {
    isVisible,
    setIsVisible,
    rewardRouterAddress,
    active,
    account,
    library,
    chainId,
    setPendingTxns,
    totalVesterRewards,
    nativeTokenSymbol,
    wrappedTokenSymbol,
  } = props;
  const [isCompounding, setIsCompounding] = useState(false);
  const [shouldClaimXdx, setShouldClaimXdx] = useLocalStorageSerializeKey(
    [chainId, "StakeV2-compound-should-claim-xdx"],
    true
  );
  const [shouldStakeXdx, setShouldStakeXdx] = useLocalStorageSerializeKey(
    [chainId, "StakeV2-compound-should-stake-xdx"],
    true
  );
  const [shouldClaimEsXdx, setShouldClaimEsXdx] = useLocalStorageSerializeKey(
    [chainId, "StakeV2-compound-should-claim-es-xdx"],
    true
  );
  const [shouldStakeEsXdx, setShouldStakeEsXdx] = useLocalStorageSerializeKey(
    [chainId, "StakeV2-compound-should-stake-es-xdx"],
    true
  );
  const [shouldStakeMultiplierPoints, setShouldStakeMultiplierPoints] = useState(true);
  const [shouldClaimWeth, setShouldClaimWeth] = useLocalStorageSerializeKey(
    [chainId, "StakeV2-compound-should-claim-weth"],
    true
  );
  const [shouldConvertWeth, setShouldConvertWeth] = useLocalStorageSerializeKey(
    [chainId, "StakeV2-compound-should-convert-weth"],
    true
  );

  const xdxAddress = getContract(chainId, "XDX");
  const stakedXdxTrackerAddress = getContract(chainId, "StakedXdxTracker");

  const [isApproving, setIsApproving] = useState(false);

  const { data: tokenAllowance } = useSWR(
    active && [active, chainId, xdxAddress, "allowance", account, stakedXdxTrackerAddress],
    {
      fetcher: contractFetcher(library, Token),
    }
  );

  const needApproval = shouldStakeXdx && tokenAllowance && totalVesterRewards && totalVesterRewards.gt(tokenAllowance);

  const isPrimaryEnabled = () => {
    return !isCompounding && !isApproving && !isCompounding;
  };

  const getPrimaryText = () => {
    if (isApproving) {
      return t`Approving XDX...`;
    }
    if (needApproval) {
      return t`Approve XDX`;
    }
    if (isCompounding) {
      return t`Compounding...`;
    }
    return t`Compound`;
  };

  const onClickPrimary = () => {
    if (needApproval) {
      approveTokens({
        setIsApproving,
        library,
        tokenAddress: xdxAddress,
        spender: stakedXdxTrackerAddress,
        chainId,
      });
      return;
    }

    setIsCompounding(true);

    const contract = new ethers.Contract(rewardRouterAddress, RewardRouter.abi, library.getSigner());
    callContract(
      chainId,
      contract,
      "handleRewards",
      [
        shouldClaimXdx || shouldStakeXdx,
        shouldStakeXdx,
        shouldClaimEsXdx || shouldStakeEsXdx,
        shouldStakeEsXdx,
        shouldStakeMultiplierPoints,
        shouldClaimWeth || shouldConvertWeth,
        shouldConvertWeth,
      ],
      {
        sentMsg: t`Compound submitted!`,
        failMsg: t`Compound failed.`,
        successMsg: t`Compound completed!`,
        setPendingTxns,
      }
    )
      .then(async (res) => {
        setIsVisible(false);
      })
      .finally(() => {
        setIsCompounding(false);
      });
  };

  const toggleShouldStakeXdx = (value) => {
    if (value) {
      setShouldClaimXdx(true);
    }
    setShouldStakeXdx(value);
  };

  const toggleShouldStakeEsXdx = (value) => {
    if (value) {
      setShouldClaimEsXdx(true);
    }
    setShouldStakeEsXdx(value);
  };

  const toggleConvertWeth = (value) => {
    if (value) {
      setShouldClaimWeth(true);
    }
    setShouldConvertWeth(value);
  };

  return (
    <div className="text-xs font-medium text-slate-300">
      <Modal
        isVisible={isVisible}
        setIsVisible={setIsVisible}
        label="Compound Rewards"
        position="center"
        className="w-[310px]"
      >
        <div className="mb-2">
          <div>
            <Checkbox
              isChecked={shouldStakeMultiplierPoints}
              setIsChecked={setShouldStakeMultiplierPoints}
              disabled={true}
            >
              <Trans>Stake Multiplier Points</Trans>
            </Checkbox>
          </div>
          <div>
            <Checkbox isChecked={shouldClaimXdx} setIsChecked={setShouldClaimXdx} disabled={shouldStakeXdx}>
              <Trans>Claim XDX Rewards</Trans>
            </Checkbox>
          </div>
          <div>
            <Checkbox isChecked={shouldStakeXdx} setIsChecked={toggleShouldStakeXdx}>
              <Trans>Stake XDX Rewards</Trans>
            </Checkbox>
          </div>
          <div>
            <Checkbox isChecked={shouldClaimEsXdx} setIsChecked={setShouldClaimEsXdx} disabled={shouldStakeEsXdx}>
              <Trans>Claim esXDX Rewards</Trans>
            </Checkbox>
          </div>
          <div>
            <Checkbox isChecked={shouldStakeEsXdx} setIsChecked={toggleShouldStakeEsXdx}>
              <Trans>Stake esXDX Rewards</Trans>
            </Checkbox>
          </div>
          <div>
            <Checkbox isChecked={shouldClaimWeth} setIsChecked={setShouldClaimWeth} disabled={shouldConvertWeth}>
              <Trans>Claim {wrappedTokenSymbol} Rewards</Trans>
            </Checkbox>
          </div>
          <div>
            <Checkbox isChecked={shouldConvertWeth} setIsChecked={toggleConvertWeth}>
              Convert {wrappedTokenSymbol} to {nativeTokenSymbol}
            </Checkbox>
          </div>
        </div>
        <div className="pt-[3.1px]">
          <button
            className="w-full rounded-[3px]  bg-slate-800 p-[15px] text-[14px] leading-none hover:bg-[#4f60fc] hover:shadow disabled:cursor-not-allowed"
            onClick={onClickPrimary}
            disabled={!isPrimaryEnabled()}
          >
            {getPrimaryText()}
          </button>
        </div>
      </Modal>
    </div>
  );
}

function ClaimModal(props) {
  const {
    isVisible,
    setIsVisible,
    rewardRouterAddress,
    library,
    chainId,
    setPendingTxns,
    nativeTokenSymbol,
    wrappedTokenSymbol,
  } = props;
  const [isClaiming, setIsClaiming] = useState(false);
  const [shouldClaimXdx, setShouldClaimXdx] = useLocalStorageSerializeKey(
    [chainId, "StakeV2-claim-should-claim-xdx"],
    true
  );
  const [shouldClaimEsXdx, setShouldClaimEsXdx] = useLocalStorageSerializeKey(
    [chainId, "StakeV2-claim-should-claim-es-xdx"],
    true
  );
  const [shouldClaimWeth, setShouldClaimWeth] = useLocalStorageSerializeKey(
    [chainId, "StakeV2-claim-should-claim-weth"],
    true
  );
  const [shouldConvertWeth, setShouldConvertWeth] = useLocalStorageSerializeKey(
    [chainId, "StakeV2-claim-should-convert-weth"],
    true
  );

  const isPrimaryEnabled = () => {
    return !isClaiming;
  };

  const getPrimaryText = () => {
    if (isClaiming) {
      return t`Claiming...`;
    }
    return t`Claim`;
  };

  const onClickPrimary = () => {
    setIsClaiming(true);

    const contract = new ethers.Contract(rewardRouterAddress, RewardRouter.abi, library.getSigner());
    callContract(
      chainId,
      contract,
      "handleRewards",
      [
        shouldClaimXdx,
        false, // shouldStakeXdx
        shouldClaimEsXdx,
        false, // shouldStakeEsXdx
        false, // shouldStakeMultiplierPoints
        shouldClaimWeth,
        shouldConvertWeth,
      ],
      {
        sentMsg: t`Claim submitted.`,
        failMsg: t`Claim failed.`,
        successMsg: t`Claim completed!`,
        setPendingTxns,
      }
    )
      .then(async (res) => {
        setIsVisible(false);
      })
      .finally(() => {
        setIsClaiming(false);
      });
  };

  const toggleConvertWeth = (value) => {
    if (value) {
      setShouldClaimWeth(true);
    }
    setShouldConvertWeth(value);
  };

  return (
    <div className="text-xs font-medium text-slate-300">
      <Modal
        isVisible={isVisible}
        setIsVisible={setIsVisible}
        label="Claim Rewards"
        position="center"
        className="w-[310px]"
      >
        <div className="CompoundModal-menu">
          <div>
            <Checkbox isChecked={shouldClaimXdx} setIsChecked={setShouldClaimXdx}>
              <Trans>Claim XDX Rewards</Trans>
            </Checkbox>
          </div>
          <div>
            <Checkbox isChecked={shouldClaimEsXdx} setIsChecked={setShouldClaimEsXdx}>
              <Trans>Claim esXDX Rewards</Trans>
            </Checkbox>
          </div>
          <div>
            <Checkbox isChecked={shouldClaimWeth} setIsChecked={setShouldClaimWeth} disabled={shouldConvertWeth}>
              <Trans>Claim {wrappedTokenSymbol} Rewards</Trans>
            </Checkbox>
          </div>
          <div>
            <Checkbox isChecked={shouldConvertWeth} setIsChecked={toggleConvertWeth}>
              <Trans>
                Convert {wrappedTokenSymbol} to {nativeTokenSymbol}
              </Trans>
            </Checkbox>
          </div>
        </div>
        <div className="pt-[3.1px]">
          <button
            className="w-full rounded-[3px]  bg-slate-800 p-[15px] text-[14px] leading-none hover:bg-[#4f60fc] hover:shadow disabled:cursor-not-allowed"
            onClick={onClickPrimary}
            disabled={!isPrimaryEnabled()}
          >
            {getPrimaryText()}
          </button>
        </div>
      </Modal>
    </div>
  );
}

export default function StakeV2({ setPendingTxns, connectWallet }) {
  const { active, library, account } = useWeb3React();
  const { chainId } = useChainId();

  const chainName = getChainName(chainId);

  const [isStakeModalVisible, setIsStakeModalVisible] = useState(false);
  const [stakeModalTitle, setStakeModalTitle] = useState("");
  const [stakeModalMaxAmount, setStakeModalMaxAmount] = useState(undefined);
  const [stakeValue, setStakeValue] = useState("");
  const [stakingTokenSymbol, setStakingTokenSymbol] = useState("");
  const [stakingTokenAddress, setStakingTokenAddress] = useState("");
  const [stakingFarmAddress, setStakingFarmAddress] = useState("");
  const [stakeMethodName, setStakeMethodName] = useState("");

  const [isUnstakeModalVisible, setIsUnstakeModalVisible] = useState(false);
  const [unstakeModalTitle, setUnstakeModalTitle] = useState("");
  const [unstakeModalMaxAmount, setUnstakeModalMaxAmount] = useState(undefined);
  const [unstakeModalReservedAmount, setUnstakeModalReservedAmount] = useState(undefined);
  const [unstakeValue, setUnstakeValue] = useState("");
  const [unstakingTokenSymbol, setUnstakingTokenSymbol] = useState("");
  const [unstakeMethodName, setUnstakeMethodName] = useState("");

  const [isVesterDepositModalVisible, setIsVesterDepositModalVisible] = useState(false);
  const [vesterDepositTitle, setVesterDepositTitle] = useState("");
  const [vesterDepositStakeTokenLabel, setVesterDepositStakeTokenLabel] = useState("");
  const [vesterDepositMaxAmount, setVesterDepositMaxAmount] = useState("");
  const [vesterDepositBalance, setVesterDepositBalance] = useState("");
  const [vesterDepositEscrowedBalance, setVesterDepositEscrowedBalance] = useState("");
  const [vesterDepositVestedAmount, setVesterDepositVestedAmount] = useState("");
  const [vesterDepositAverageStakedAmount, setVesterDepositAverageStakedAmount] = useState("");
  const [vesterDepositMaxVestableAmount, setVesterDepositMaxVestableAmount] = useState("");
  const [vesterDepositValue, setVesterDepositValue] = useState("");
  const [vesterDepositReserveAmount, setVesterDepositReserveAmount] = useState("");
  const [vesterDepositMaxReserveAmount, setVesterDepositMaxReserveAmount] = useState("");
  const [vesterDepositAddress, setVesterDepositAddress] = useState("");

  const [isVesterWithdrawModalVisible, setIsVesterWithdrawModalVisible] = useState(false);
  const [vesterWithdrawTitle, setVesterWithdrawTitle] = useState(false);
  const [vesterWithdrawAddress, setVesterWithdrawAddress] = useState("");

  const [isCompoundModalVisible, setIsCompoundModalVisible] = useState(false);
  const [isClaimModalVisible, setIsClaimModalVisible] = useState(false);

  const rewardRouterAddress = getContract(chainId, "RewardRouter");
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

  const stakedXdxDistributorAddress = getContract(chainId, "StakedXdxDistributor");
  const stakedXlxDistributorAddress = getContract(chainId, "StakedXlxDistributor");

  const xdxVesterAddress = getContract(chainId, "XdxVester");
  const xlxVesterAddress = getContract(chainId, "XlxVester");

  const vesterAddresses = [xdxVesterAddress, xlxVesterAddress];

  const excludedEsXdxAccounts = [stakedXdxDistributorAddress, stakedXlxDistributorAddress];

  const nativeTokenSymbol = getConstant(chainId, "nativeTokenSymbol");
  const wrappedTokenSymbol = getConstant(chainId, "wrappedTokenSymbol");

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
    [
      `StakeV2:walletBalances:${active}`,
      chainId,
      readerAddress,
      "getTokenBalancesWithSupplies",
      account || PLACEHOLDER_ACCOUNT,
    ],
    {
      fetcher: contractFetcher(library, Reader, [walletTokens]),
    }
  );

  const { data: depositBalances } = useSWR(
    [
      `StakeV2:depositBalances:${active}`,
      chainId,
      rewardReaderAddress,
      "getDepositBalances",
      account || PLACEHOLDER_ACCOUNT,
    ],
    {
      fetcher: contractFetcher(library, RewardReader, [depositTokens, rewardTrackersForDepositBalances]),
    }
  );

  const { data: stakingInfo } = useSWR(
    [`StakeV2:stakingInfo:${active}`, chainId, rewardReaderAddress, "getStakingInfo", account || PLACEHOLDER_ACCOUNT],
    {
      fetcher: contractFetcher(library, RewardReader, [rewardTrackersForStakingInfo]),
    }
  );

  const { data: stakedXdxSupply } = useSWR(
    [`StakeV2:stakedXdxSupply:${active}`, chainId, xdxAddress, "balanceOf", stakedXdxTrackerAddress],
    {
      fetcher: contractFetcher(library, Token),
    }
  );

  const { data: aums } = useSWR([`StakeV2:getAums:${active}`, chainId, xlxManagerAddress, "getAums"], {
    fetcher: contractFetcher(library, XlxManager),
  });

  const { data: nativeTokenPrice } = useSWR(
    [`StakeV2:nativeTokenPrice:${active}`, chainId, vaultAddress, "getMinPrice", nativeTokenAddress],
    {
      fetcher: contractFetcher(library, Vault),
    }
  );

  const { data: esXdxSupply } = useSWR(
    [`StakeV2:esXdxSupply:${active}`, chainId, readerAddress, "getTokenSupply", esXdxAddress],
    {
      fetcher: contractFetcher(library, Reader, [excludedEsXdxAccounts]),
    }
  );

  const { data: vestingInfo } = useSWR(
    [`StakeV2:vestingInfo:${active}`, chainId, readerAddress, "getVestingInfo", account || PLACEHOLDER_ACCOUNT],
    {
      fetcher: contractFetcher(library, Reader, [vesterAddresses]),
    }
  );

  const { xdxPrice, xdxPriceFromArbitrum, xdxPriceFromAvalanche } = useXdxPrice(
    chainId,
    { arbitrum: chainId === AVALANCHE ? library : undefined },
    active
  );

  let { total: totalXdxSupply } = useTotalXdxSupply();

  let { avax: avaxXdxStaked, arbitrum: arbitrumXdxStaked, total: totalXdxStaked } = useTotalXdxStaked();

  const xdxSupplyUrl = getServerUrl(chainId, "/gmx_supply");
  const { data: xdxSupply } = useSWR([xdxSupplyUrl], {
    fetcher: (...args) => fetch(...args).then((res) => res.text()),
  });

  const isXdxTransferEnabled = true;

  let esXdxSupplyUsd;
  if (esXdxSupply && xdxPrice) {
    esXdxSupplyUsd = esXdxSupply.mul(xdxPrice).div(expandDecimals(1, 18));
  }

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

  let hasMultiplierPoints = false;
  let multiplierPointsAmount;
  if (processedData && processedData.bonusXdxTrackerRewards && processedData.bnXdxInFeeXdx) {
    multiplierPointsAmount = processedData.bonusXdxTrackerRewards.add(processedData.bnXdxInFeeXdx);
    if (multiplierPointsAmount.gt(0)) {
      hasMultiplierPoints = true;
    }
  }
  let totalRewardTokens;
  if (processedData && processedData.bnXdxInFeeXdx && processedData.bonusXdxInFeeXdx) {
    totalRewardTokens = processedData.bnXdxInFeeXdx.add(processedData.bonusXdxInFeeXdx);
  }

  let totalRewardTokensAndXlx;
  if (totalRewardTokens && processedData && processedData.xlxBalance) {
    totalRewardTokensAndXlx = totalRewardTokens.add(processedData.xlxBalance);
  }

  const bonusXdxInFeeXdx = processedData ? processedData.bonusXdxInFeeXdx : undefined;

  let stakedXdxSupplyUsd;
  if (!totalXdxStaked.isZero() && xdxPrice) {
    stakedXdxSupplyUsd = totalXdxStaked.mul(xdxPrice).div(expandDecimals(1, 18));
  }

  let totalSupplyUsd;
  if (totalXdxSupply && !totalXdxSupply.isZero() && xdxPrice) {
    totalSupplyUsd = totalXdxSupply.mul(xdxPrice).div(expandDecimals(1, 18));
  }

  let maxUnstakeableXdx = bigNumberify(0);
  if (
    totalRewardTokens &&
    vestingData &&
    vestingData.xdxVesterPairAmount &&
    multiplierPointsAmount &&
    processedData.bonusXdxInFeeXdx
  ) {
    const availableTokens = totalRewardTokens.sub(vestingData.xdxVesterPairAmount);
    const stakedTokens = processedData.bonusXdxInFeeXdx;
    const divisor = multiplierPointsAmount.add(stakedTokens);
    if (divisor.gt(0)) {
      maxUnstakeableXdx = availableTokens.mul(stakedTokens).div(divisor);
    }
  }

  const showStakeXdxModal = () => {
    if (!isXdxTransferEnabled) {
      helperToast.error(t`XDX transfers not yet enabled`);
      return;
    }

    setIsStakeModalVisible(true);
    setStakeModalTitle("Stake XDX");
    setStakeModalMaxAmount(processedData.xdxBalance);
    setStakeValue("");
    setStakingTokenSymbol("XDX");
    setStakingTokenAddress(xdxAddress);
    setStakingFarmAddress(stakedXdxTrackerAddress);
    setStakeMethodName("stakeXdx");
  };

  const showStakeEsXdxModal = () => {
    setIsStakeModalVisible(true);
    setStakeModalTitle("Stake esXDX");
    setStakeModalMaxAmount(processedData.esXdxBalance);
    setStakeValue("");
    setStakingTokenSymbol("esXDX");
    setStakingTokenAddress(esXdxAddress);
    setStakingFarmAddress(AddressZero);
    setStakeMethodName("stakeEsXdx");
  };

  const showXdxVesterDepositModal = () => {
    let remainingVestableAmount = vestingData.xdxVester.maxVestableAmount.sub(vestingData.xdxVester.vestedAmount);
    if (processedData.esXdxBalance.lt(remainingVestableAmount)) {
      remainingVestableAmount = processedData.esXdxBalance;
    }

    setIsVesterDepositModalVisible(true);
    setVesterDepositTitle("XDX Vault");
    setVesterDepositStakeTokenLabel("staked XDX + esXDX + Multiplier Points");
    setVesterDepositMaxAmount(remainingVestableAmount);
    setVesterDepositBalance(processedData.esXdxBalance);
    setVesterDepositEscrowedBalance(vestingData.xdxVester.escrowedBalance);
    setVesterDepositVestedAmount(vestingData.xdxVester.vestedAmount);
    setVesterDepositMaxVestableAmount(vestingData.xdxVester.maxVestableAmount);
    setVesterDepositAverageStakedAmount(vestingData.xdxVester.averageStakedAmount);
    setVesterDepositReserveAmount(vestingData.xdxVester.pairAmount);
    setVesterDepositMaxReserveAmount(totalRewardTokens);
    setVesterDepositValue("");
    setVesterDepositAddress(xdxVesterAddress);
  };

  const showXlxVesterDepositModal = () => {
    let remainingVestableAmount = vestingData.xlxVester.maxVestableAmount.sub(vestingData.xlxVester.vestedAmount);
    if (processedData.esXdxBalance.lt(remainingVestableAmount)) {
      remainingVestableAmount = processedData.esXdxBalance;
    }

    setIsVesterDepositModalVisible(true);
    setVesterDepositTitle("XLX Vault");
    setVesterDepositStakeTokenLabel("staked XLX");
    setVesterDepositMaxAmount(remainingVestableAmount);
    setVesterDepositBalance(processedData.esXdxBalance);
    setVesterDepositEscrowedBalance(vestingData.xlxVester.escrowedBalance);
    setVesterDepositVestedAmount(vestingData.xlxVester.vestedAmount);
    setVesterDepositMaxVestableAmount(vestingData.xlxVester.maxVestableAmount);
    setVesterDepositAverageStakedAmount(vestingData.xlxVester.averageStakedAmount);
    setVesterDepositReserveAmount(vestingData.xlxVester.pairAmount);
    setVesterDepositMaxReserveAmount(processedData.xlxBalance);
    setVesterDepositValue("");
    setVesterDepositAddress(xlxVesterAddress);
  };

  const showXdxVesterWithdrawModal = () => {
    if (!vestingData || !vestingData.xdxVesterVestedAmount || vestingData.xdxVesterVestedAmount.eq(0)) {
      helperToast.error(t`You have not deposited any tokens for vesting.`);
      return;
    }

    setIsVesterWithdrawModalVisible(true);
    setVesterWithdrawTitle(t`Withdraw from XDX Vault`);
    setVesterWithdrawAddress(xdxVesterAddress);
  };

  const showXlxVesterWithdrawModal = () => {
    if (!vestingData || !vestingData.xlxVesterVestedAmount || vestingData.xlxVesterVestedAmount.eq(0)) {
      helperToast.error(t`You have not deposited any tokens for vesting.`);
      return;
    }

    setIsVesterWithdrawModalVisible(true);
    setVesterWithdrawTitle(t`Withdraw from XLX Vault`);
    setVesterWithdrawAddress(xlxVesterAddress);
  };

  const showUnstakeXdxModal = () => {
    if (!isXdxTransferEnabled) {
      helperToast.error(t`XDX transfers not yet enabled`);
      return;
    }
    setIsUnstakeModalVisible(true);
    setUnstakeModalTitle(t`Unstake XDX`);
    let maxAmount = processedData.xdxInStakedXdx;
    if (
      processedData.xdxInStakedXdx &&
      vestingData &&
      vestingData.xdxVesterPairAmount.gt(0) &&
      maxUnstakeableXdx &&
      maxUnstakeableXdx.lt(processedData.xdxInStakedXdx)
    ) {
      maxAmount = maxUnstakeableXdx;
    }
    setUnstakeModalMaxAmount(maxAmount);
    setUnstakeModalReservedAmount(vestingData.xdxVesterPairAmount);
    setUnstakeValue("");
    setUnstakingTokenSymbol("XDX");
    setUnstakeMethodName("unstakeXdx");
  };

  const showUnstakeEsXdxModal = () => {
    setIsUnstakeModalVisible(true);
    setUnstakeModalTitle("Unstake esXDX");
    let maxAmount = processedData.esXdxInStakedXdx;
    if (
      processedData.esXdxInStakedXdx &&
      vestingData &&
      vestingData.xdxVesterPairAmount.gt(0) &&
      maxUnstakeableXdx &&
      maxUnstakeableXdx.lt(processedData.esXdxInStakedXdx)
    ) {
      maxAmount = maxUnstakeableXdx;
    }
    setUnstakeModalMaxAmount(maxAmount);
    setUnstakeModalReservedAmount(vestingData.xdxVesterPairAmount);
    setUnstakeValue("");
    setUnstakingTokenSymbol("esXDX");
    setUnstakeMethodName("unstakeEsXdx");
  };

  const renderMultiplierPointsLabel = useCallback(() => {
    return t`Multiplier Points APR`;
  }, []);

  const renderMultiplierPointsValue = useCallback(() => {
    return (
      <Tooltip
        handle={`100.00%`}
        position="right-bottom"
        renderContent={() => {
          return (
            <Trans>
              Boost your rewards with Multiplier Points.&nbsp;
              <a href="https://xdx.exchange/docs" rel="noreferrer" target="_blank">
                More info
              </a>
              .
            </Trans>
          );
        }}
      />
    );
  }, []);

  let earnMsg;
  if (totalRewardTokensAndXlx && totalRewardTokensAndXlx.gt(0)) {
    let xdxAmountStr;
    if (processedData.xdxInStakedXdx && processedData.xdxInStakedXdx.gt(0)) {
      xdxAmountStr = formatAmount(processedData.xdxInStakedXdx, 18, 2, true) + " XDX";
    }
    let esXdxAmountStr;
    if (processedData.esXdxInStakedXdx && processedData.esXdxInStakedXdx.gt(0)) {
      esXdxAmountStr = formatAmount(processedData.esXdxInStakedXdx, 18, 2, true) + " esXDX";
    }
    let mpAmountStr;
    if (processedData.bonusXdxInFeeXdx && processedData.bnXdxInFeeXdx.gt(0)) {
      mpAmountStr = formatAmount(processedData.bnXdxInFeeXdx, 18, 2, true) + " MP";
    }
    let xlxStr;
    if (processedData.xlxBalance && processedData.xlxBalance.gt(0)) {
      xlxStr = formatAmount(processedData.xlxBalance, 18, 2, true) + " XLX";
    }
    const amountStr = [xdxAmountStr, esXdxAmountStr, mpAmountStr, xlxStr].filter((s) => s).join(", ");
    earnMsg = (
      <div>
        <Trans>
          You are earning {nativeTokenSymbol} rewards with {formatAmount(totalRewardTokensAndXlx, 18, 2, true)} tokens.
          <br />
          Tokens: {amountStr}.
        </Trans>
      </div>
    );
  }

  return (
    <>
      <StakeModal
        isVisible={isStakeModalVisible}
        setIsVisible={setIsStakeModalVisible}
        chainId={chainId}
        title={stakeModalTitle}
        maxAmount={stakeModalMaxAmount}
        value={stakeValue}
        setValue={setStakeValue}
        active={active}
        account={account}
        library={library}
        stakingTokenSymbol={stakingTokenSymbol}
        stakingTokenAddress={stakingTokenAddress}
        farmAddress={stakingFarmAddress}
        rewardRouterAddress={rewardRouterAddress}
        stakeMethodName={stakeMethodName}
        hasMultiplierPoints={hasMultiplierPoints}
        setPendingTxns={setPendingTxns}
        nativeTokenSymbol={nativeTokenSymbol}
        wrappedTokenSymbol={wrappedTokenSymbol}
      />
      <UnstakeModal
        setPendingTxns={setPendingTxns}
        isVisible={isUnstakeModalVisible}
        setIsVisible={setIsUnstakeModalVisible}
        chainId={chainId}
        title={unstakeModalTitle}
        maxAmount={unstakeModalMaxAmount}
        reservedAmount={unstakeModalReservedAmount}
        value={unstakeValue}
        setValue={setUnstakeValue}
        library={library}
        unstakingTokenSymbol={unstakingTokenSymbol}
        rewardRouterAddress={rewardRouterAddress}
        unstakeMethodName={unstakeMethodName}
        multiplierPointsAmount={multiplierPointsAmount}
        bonusXdxInFeeXdx={bonusXdxInFeeXdx}
      />
      <VesterDepositModal
        isVisible={isVesterDepositModalVisible}
        setIsVisible={setIsVesterDepositModalVisible}
        chainId={chainId}
        title={vesterDepositTitle}
        stakeTokenLabel={vesterDepositStakeTokenLabel}
        maxAmount={vesterDepositMaxAmount}
        balance={vesterDepositBalance}
        escrowedBalance={vesterDepositEscrowedBalance}
        vestedAmount={vesterDepositVestedAmount}
        averageStakedAmount={vesterDepositAverageStakedAmount}
        maxVestableAmount={vesterDepositMaxVestableAmount}
        reserveAmount={vesterDepositReserveAmount}
        maxReserveAmount={vesterDepositMaxReserveAmount}
        value={vesterDepositValue}
        setValue={setVesterDepositValue}
        library={library}
        vesterAddress={vesterDepositAddress}
        setPendingTxns={setPendingTxns}
      />
      <VesterWithdrawModal
        isVisible={isVesterWithdrawModalVisible}
        setIsVisible={setIsVesterWithdrawModalVisible}
        vesterAddress={vesterWithdrawAddress}
        chainId={chainId}
        title={vesterWithdrawTitle}
        library={library}
        setPendingTxns={setPendingTxns}
      />
      <CompoundModal
        active={active}
        account={account}
        setPendingTxns={setPendingTxns}
        isVisible={isCompoundModalVisible}
        setIsVisible={setIsCompoundModalVisible}
        rewardRouterAddress={rewardRouterAddress}
        totalVesterRewards={processedData.totalVesterRewards}
        wrappedTokenSymbol={wrappedTokenSymbol}
        nativeTokenSymbol={nativeTokenSymbol}
        library={library}
        chainId={chainId}
      />
      <ClaimModal
        active={active}
        account={account}
        setPendingTxns={setPendingTxns}
        isVisible={isClaimModalVisible}
        setIsVisible={setIsClaimModalVisible}
        rewardRouterAddress={rewardRouterAddress}
        totalVesterRewards={processedData.totalVesterRewards}
        wrappedTokenSymbol={wrappedTokenSymbol}
        nativeTokenSymbol={nativeTokenSymbol}
        library={library}
        chainId={chainId}
      />
      <div className="flex min-h-[calc(100vh-102px)] flex-col justify-between pt-[46.5px]">
        <div className="mx-auto w-full max-w-[1264px] flex-1 px-4 pb-[46.5px] text-lg text-slate-300 md:px-[32px]">
          <div className="mb-[40.25px] flex w-full max-w-[584px]">
            <div className="hidden"></div>
            <div className="flex flex-col justify-end">
              <div className="mb-[8px] flex flex-row items-center text-xl font-medium text-slate-300">
                <Trans>Earn</Trans>
              </div>
              <div className="text-xs font-medium text-slate-600">
                <Trans>
                  Stake{" "}
                  <a className="underline" href="https://xdx.exchange/docs" target="_blank" rel="noopener noreferrer">
                    XDX
                  </a>{" "}
                  and{" "}
                  <a className="underline" href="https://xdx.exchange/docs" target="_blank" rel="noopener noreferrer">
                    XLX
                  </a>{" "}
                  to earn rewards.
                </Trans>
              </div>
              {earnMsg && <div className="text-xs font-medium text-slate-600">{earnMsg}</div>}
            </div>
          </div>
          <div className="">
            <div className="mb-8 flex flex-col items-center justify-center lg:grid lg:grid-cols-5">
              <div className="mb-2 flex w-full flex-col items-center rounded border border-slate-800 bg-slate-950 bg-opacity-50 p-4 py-4 lg:mb-0 lg:w-[210px] lg:items-start">
                <div className="mb-2 text-xs font-medium text-slate-600">Wallet</div>
                <div className="mb-2 text-lg font-medium text-slate-300">
                  ${formatKeyAmount(processedData, "xdxBalanceUsd", USD_DECIMALS, 2, true)}
                </div>
                <div className="text-xs font-medium text-slate-600">Your XDX Balance</div>
              </div>
              <div className="mb-2 flex w-full flex-col items-center rounded border border-slate-800 bg-slate-950 bg-opacity-50 p-4 py-4 lg:mb-0 lg:w-[210px] lg:items-start">
                <div className="mb-2 text-xs font-medium text-slate-600">Staked</div>
                <div className="mb-2 text-lg font-medium text-slate-300">
                  ${formatKeyAmount(processedData, "xdxInStakedXdxUsd", USD_DECIMALS, 2, true)}
                </div>
                <div className="text-xs font-medium text-slate-600">Your Staked XDX</div>
              </div>
              <div className="mb-2 flex w-full flex-col items-center rounded border border-slate-800 bg-slate-950 bg-opacity-50 p-4 py-4 lg:mb-0 lg:w-[210px] lg:items-start">
                <div className="mb-2 text-xs font-medium text-slate-600">AVAX Rewards</div>
                <div className="mb-2 text-lg font-medium text-slate-300">
                  ${formatKeyAmount(processedData, "totalNativeTokenRewardsUsd", USD_DECIMALS, 2, true)}
                </div>
                <div className="text-xs font-medium text-slate-600">AVAX rewards to date</div>
              </div>
              <div className="mb-2 flex w-full flex-col items-center rounded border border-slate-800 bg-slate-950 bg-opacity-50 p-4 py-4 lg:mb-0 lg:w-[210px] lg:items-start">
                <div className="mb-2 text-xs font-medium text-slate-600">XDX Rewards</div>
                <div className="mb-2 text-lg font-medium text-slate-300">
                  ${formatKeyAmount(processedData, "totalVesterRewardsUsd", USD_DECIMALS, 2, true)}
                </div>
                <div className="text-xs font-medium text-slate-600">XDX rewards to date</div>
              </div>
              <div className="mb-2 flex w-full flex-col items-center rounded border border-slate-800 bg-slate-950 bg-opacity-50 p-4 py-4 lg:mb-0 lg:w-[210px] lg:items-start">
                <div className="mb-2 text-xs font-medium text-slate-600">EsXDX Rewards</div>
                <div className="mb-2 text-lg font-medium text-slate-300">
                  ${formatKeyAmount(processedData, "totalEsXdxRewardsUsd", USD_DECIMALS, 2, true)}
                </div>
                <div className="text-xs font-medium text-slate-600">Escrowed rewards to date</div>
              </div>
            </div>
            <div className="grid grid-cols-1 gap-[15px] pt-[20px] text-xs font-medium text-slate-300 xl:grid-cols-2">
              <div className="relative rounded border border-slate-800 shadow">
                <div className="flex items-center justify-between rounded-t bg-slate-950 bg-opacity-50 py-3 pl-4 text-xs font-medium uppercase text-slate-200">
                  XDX
                </div>
                <div className="mb-[10.5px] h-[1px] bg-slate-800"></div>
                <div className="grid gap-2">
                  <div className="mx-[15px] grid grid-cols-[1fr_auto] gap-[15px]">
                    <div className="text-xs font-medium text-slate-600">
                      <Trans>Price</Trans>
                    </div>
                    <div className="text-right text-xs font-medium text-slate-300">
                      {!xdxPrice && "..."}
                      {xdxPrice && (
                        <Tooltip
                          position="right-bottom"
                          className="nowrap relative inline-flex cursor-help text-xs font-medium text-slate-300"
                          handle={"$" + formatAmount(xdxPrice, USD_DECIMALS, 2, true)}
                          renderContent={() => (
                            <>
                              <StatsTooltipRow
                                label="Price on Avalanche"
                                value={formatAmount(xdxPriceFromAvalanche, USD_DECIMALS, 2, true)}
                              />
                              <StatsTooltipRow
                                label="Price on Arbitrum"
                                value={formatAmount(xdxPriceFromArbitrum, USD_DECIMALS, 2, true)}
                              />
                            </>
                          )}
                        />
                      )}
                    </div>
                  </div>
                  <div className="mx-[15px] grid grid-cols-[1fr_auto] gap-[15px]">
                    <div className="text-xs font-medium text-slate-600">
                      <Trans>Wallet</Trans>
                    </div>
                    <div className="text-right text-xs font-medium text-slate-300">
                      {formatKeyAmount(processedData, "xdxBalance", 18, 2, true)} XDX ($
                      {formatKeyAmount(processedData, "xdxBalanceUsd", USD_DECIMALS, 2, true)})
                    </div>
                  </div>
                  <div className="mx-[15px] grid grid-cols-[1fr_auto] gap-[15px]">
                    <div className="text-xs font-medium text-slate-600">
                      <Trans>Staked</Trans>
                    </div>
                    <div className="text-right text-xs font-medium text-slate-300">
                      {formatKeyAmount(processedData, "xdxInStakedXdx", 18, 2, true)} XDX ($
                      {formatKeyAmount(processedData, "xdxInStakedXdxUsd", USD_DECIMALS, 2, true)})
                    </div>
                  </div>
                  <div className="my-[10.5px] h-[1px] bg-slate-800"></div>
                  <div className="mx-[15px] grid grid-cols-[1fr_auto] gap-[15px]">
                    <div className="text-xs font-medium text-slate-600">APR</div>
                    <div>
                      <Tooltip
                        className="text-xs font-medium text-slate-300"
                        handle={`${formatKeyAmount(processedData, "xdxAprTotalWithBoost", 2, 2, true)}%`}
                        position="right-bottom"
                        renderContent={() => {
                          return (
                            <>
                              <StatsTooltipRow
                                label="Escrowed XDX APR"
                                showDollar={false}
                                value={`${formatKeyAmount(processedData, "xdxAprForEsXdx", 2, 2, true)}%`}
                              />
                              {(!processedData.xdxBoostAprForNativeToken ||
                                processedData.xdxBoostAprForNativeToken.eq(0)) && (
                                <StatsTooltipRow
                                  label={`${nativeTokenSymbol} APR`}
                                  showDollar={false}
                                  value={`${formatKeyAmount(processedData, "xdxAprForNativeToken", 2, 2, true)}%`}
                                />
                              )}
                              {processedData.xdxBoostAprForNativeToken &&
                                processedData.xdxBoostAprForNativeToken.gt(0) && (
                                  <div>
                                    <br />

                                    <StatsTooltipRow
                                      label={`${nativeTokenSymbol} Base APR`}
                                      showDollar={false}
                                      value={`${formatKeyAmount(processedData, "xdxAprForNativeToken", 2, 2, true)}%`}
                                    />
                                    <StatsTooltipRow
                                      label={`${nativeTokenSymbol} Boosted APR`}
                                      showDollar={false}
                                      value={`${formatKeyAmount(
                                        processedData,
                                        "xdxBoostAprForNativeToken",
                                        2,
                                        2,
                                        true
                                      )}%`}
                                    />
                                    <div className="my-[5px] h-[1px] bg-slate-600" />
                                    <StatsTooltipRow
                                      label={`${nativeTokenSymbol} Total APR`}
                                      showDollar={false}
                                      value={`${formatKeyAmount(
                                        processedData,
                                        "xdxAprForNativeTokenWithBoost",
                                        2,
                                        2,
                                        true
                                      )}%`}
                                    />

                                    <br />

                                    <Trans>The Boosted APR is from your staked Multiplier Points.</Trans>
                                  </div>
                                )}
                              <div>
                                <br />
                                <Trans>
                                  APRs are updated weekly on Wednesday and will depend on the fees collected for the
                                  week.
                                </Trans>
                              </div>
                            </>
                          );
                        }}
                      />
                    </div>
                  </div>
                  <div className="mx-[15px] grid grid-cols-[1fr_auto] gap-[15px]">
                    <div className="text-xs font-medium text-slate-600">
                      <Trans>Rewards</Trans>
                    </div>
                    <div className="text-right text-xs font-medium text-slate-300">
                      <Tooltip
                        handle={`$${formatKeyAmount(processedData, "totalXdxRewardsUsd", USD_DECIMALS, 2, true)}`}
                        position="right-bottom"
                        renderContent={() => {
                          return (
                            <>
                              <StatsTooltipRow
                                label={`${nativeTokenSymbol} (${wrappedTokenSymbol})`}
                                value={`${formatKeyAmount(
                                  processedData,
                                  "feeXdxTrackerRewards",
                                  18,
                                  4
                                )} ($${formatKeyAmount(
                                  processedData,
                                  "feeXdxTrackerRewardsUsd",
                                  USD_DECIMALS,
                                  2,
                                  true
                                )})`}
                                showDollar={false}
                              />
                              <StatsTooltipRow
                                label="Escrowed XDX"
                                value={`${formatKeyAmount(
                                  processedData,
                                  "stakedXdxTrackerRewards",
                                  18,
                                  4
                                )} ($${formatKeyAmount(
                                  processedData,
                                  "stakedXdxTrackerRewardsUsd",
                                  USD_DECIMALS,
                                  2,
                                  true
                                )})`}
                                showDollar={false}
                              />
                            </>
                          );
                        }}
                      />
                    </div>
                  </div>
                  <div className="mx-[15px] grid grid-cols-[1fr_auto] gap-[15px]">
                    <div className="text-xs font-medium text-slate-600">{renderMultiplierPointsLabel()}</div>
                    <div className="text-xs font-medium text-slate-300">{renderMultiplierPointsValue()}</div>
                  </div>
                  <div className="mx-[15px] grid grid-cols-[1fr_auto] gap-[15px]">
                    <div className="text-xs font-medium text-slate-600">
                      <Trans>Boost Percentage</Trans>
                    </div>
                    <div className="text-right text-xs font-medium text-slate-300">
                      <Tooltip
                        handle={`${formatAmount(processedData.boostBasisPoints, 2, 2, false)}%`}
                        position="right-bottom"
                        renderContent={() => {
                          return (
                            <div>
                              You are earning {formatAmount(processedData.boostBasisPoints, 2, 2, false)}% more{" "}
                              {nativeTokenSymbol} rewards using{" "}
                              {formatAmount(processedData.bnXdxInFeeXdx, 18, 4, 2, true)} Staked Multiplier Points.
                              <br />
                              <br />
                              Use the "Compound" button to stake your Multiplier Points.
                            </div>
                          );
                        }}
                      />
                    </div>
                  </div>
                  <div className="my-[10.5px] h-[1px] bg-slate-800"></div>
                  <div className="mx-[15px] grid grid-cols-[1fr_auto] gap-[15px]">
                    <div className="text-xs font-medium text-slate-600">
                      <Trans>Total Staked</Trans>
                    </div>
                    <div className="text-right text-xs font-medium text-slate-300">
                      {!totalXdxStaked && "..."}
                      {totalXdxStaked && (
                        <Tooltip
                          position="right-bottom"
                          className="nowrap"
                          handle={
                            formatAmount(totalXdxStaked, 18, 0, true) +
                            " XDX" +
                            ` ($${formatAmount(stakedXdxSupplyUsd, USD_DECIMALS, 0, true)})`
                          }
                          renderContent={() => (
                            <StatsTooltip
                              showDollar={false}
                              title="Staked"
                              avaxValue={avaxXdxStaked}
                              arbitrumValue={arbitrumXdxStaked}
                              total={totalXdxStaked}
                              decimalsForConversion={18}
                              symbol="XDX"
                            />
                          )}
                        />
                      )}
                    </div>
                  </div>
                  <div className="mx-[15px] grid grid-cols-[1fr_auto] gap-[15px]">
                    <div className="text-xs font-medium text-slate-600">
                      <Trans>Total Supply</Trans>
                    </div>
                    {!totalXdxSupply && "..."}
                    {totalXdxSupply && (
                      <div className="text-sm font-medium text-slate-300">
                        {formatAmount(totalXdxSupply, 18, 0, true)} XDX ($
                        {formatAmount(totalSupplyUsd, USD_DECIMALS, 0, true)})
                      </div>
                    )}
                  </div>
                  <div className="my-[10.5px] h-[1px] bg-slate-800"></div>
                  <div className="-m-[6.2px] mx-[9px] mb-[12px]">
                    <Link
                      className="relative m-[6.2px] box-border inline-flex cursor-pointer items-center rounded bg-indigo-500 p-2 px-4 text-xs text-slate-200 hover:bg-indigo-600"
                      to="/buy_xdx"
                    >
                      Buy XDX
                    </Link>
                    {active && (
                      <button
                        className="relative m-[6.2px] box-border inline-flex cursor-pointer items-center rounded bg-indigo-500 p-2 px-4 text-xs text-slate-200 hover:bg-indigo-600"
                        onClick={() => showStakeXdxModal()}
                      >
                        Stake
                      </button>
                    )}
                    {active && (
                      <button
                        className="relative m-[6.2px] box-border inline-flex cursor-pointer items-center rounded bg-indigo-500 p-2 px-4 text-xs text-slate-200 hover:bg-indigo-600"
                        onClick={() => showUnstakeXdxModal()}
                      >
                        Unstake
                      </button>
                    )}
                    {active && (
                      <Link
                        className="relative m-[6.2px] box-border inline-flex cursor-pointer items-center rounded bg-indigo-500 p-2 px-4 text-xs text-slate-200 hover:bg-indigo-600"
                        to="/begin_account_transfer"
                      >
                        Transfer Account
                      </Link>
                    )}
                  </div>
                </div>
              </div>
              <div className="relative rounded border border-slate-800 shadow">
                <div className="flex items-center justify-between rounded-t bg-slate-950 bg-opacity-50 py-3 pl-4 text-xs font-medium uppercase text-slate-200">
                  <Trans>Total Rewards</Trans>
                </div>
                <div className="mb-[10.5px] h-[1px] bg-slate-800"></div>
                <div className="grid gap-2">
                  <div className="mx-[15px] grid grid-cols-[1fr_auto] gap-[15px]">
                    <div className="text-xs font-medium text-slate-600">
                      {nativeTokenSymbol} ({wrappedTokenSymbol})
                    </div>
                    <div>
                      {formatKeyAmount(processedData, "totalNativeTokenRewards", 18, 4, true)} ($
                      {formatKeyAmount(processedData, "totalNativeTokenRewardsUsd", USD_DECIMALS, 2, true)})
                    </div>
                  </div>
                  <div className="mx-[15px] grid grid-cols-[1fr_auto] gap-[15px]">
                    <div className="text-xs font-medium text-slate-600">XDX</div>
                    <div>
                      {formatKeyAmount(processedData, "totalVesterRewards", 18, 4, true)} ($
                      {formatKeyAmount(processedData, "totalVesterRewardsUsd", USD_DECIMALS, 2, true)})
                    </div>
                  </div>
                  <div className="mx-[15px] grid grid-cols-[1fr_auto] gap-[15px]">
                    <div className="text-xs font-medium text-slate-600">Escrowed XDX</div>
                    <div>
                      {formatKeyAmount(processedData, "totalEsXdxRewards", 18, 4, true)} ($
                      {formatKeyAmount(processedData, "totalEsXdxRewardsUsd", USD_DECIMALS, 2, true)})
                    </div>
                  </div>
                  <div className="mx-[15px] grid grid-cols-[1fr_auto] gap-[15px]">
                    <div className="text-xs font-medium text-slate-600">Multiplier Points</div>
                    <div>{formatKeyAmount(processedData, "bonusXdxTrackerRewards", 18, 4, true)}</div>
                  </div>
                  <div className="mx-[15px] grid grid-cols-[1fr_auto] gap-[15px]">
                    <div className="text-xs font-medium text-slate-600">Staked Multiplier Points</div>
                    <div>{formatKeyAmount(processedData, "bnXdxInFeeXdx", 18, 4, true)}</div>
                  </div>
                  <div className="mx-[15px] grid grid-cols-[1fr_auto] gap-[15px]">
                    <div className="text-xs font-medium text-slate-600">
                      <Trans>Total</Trans>
                    </div>
                    <div className="text-right text-xs font-medium text-slate-300">
                      ${formatKeyAmount(processedData, "totalRewardsUsd", USD_DECIMALS, 2, true)}
                    </div>
                  </div>
                  <div className="invisible">
                    <div className="my-[10.5px] h-[1px] bg-slate-800"></div>
                    <div className="-m-[6.2px] mx-[9px] mb-[12px]">
                      {active && (
                        <button className="relative m-[6.2px] box-border inline-flex cursor-pointer items-center rounded bg-indigo-500 p-2 px-4 text-xs text-slate-200 hover:bg-indigo-600">
                          <Trans>Compound</Trans>
                        </button>
                      )}
                      {active && (
                        <button className="relative m-[6.2px] box-border inline-flex cursor-pointer items-center rounded bg-indigo-500 p-2 px-4 text-xs text-slate-200 hover:bg-indigo-600">
                          <Trans>Claim</Trans>
                        </button>
                      )}
                      {!active && (
                        <button
                          className="relative m-[6.2px] box-border inline-flex cursor-pointer items-center rounded bg-indigo-500 p-2 px-4 text-xs text-slate-200 hover:bg-indigo-600"
                          onClick={() => connectWallet()}
                        >
                          Connect Wallet
                        </button>
                      )}
                    </div>
                  </div>
                  <div className="absolute bottom-0 left-0 right-0 p-[15px] pb-[18px]">
                    <div className="my-[10.5px] -mx-[15px] mb-[18px] h-[1px] bg-slate-800"></div>
                    <div className="-m-[6.2px]">
                      {active && (
                        <button
                          className="relative m-[6.2px] box-border inline-flex cursor-pointer items-center rounded bg-indigo-500 p-2 px-4 text-xs text-slate-200 hover:bg-indigo-600"
                          onClick={() => setIsCompoundModalVisible(true)}
                        >
                          <Trans>Compound</Trans>
                        </button>
                      )}
                      {active && (
                        <button
                          className="relative m-[6.2px] box-border inline-flex cursor-pointer items-center rounded bg-indigo-500 p-2 px-4 text-xs text-slate-200 hover:bg-indigo-600"
                          onClick={() => setIsClaimModalVisible(true)}
                        >
                          <Trans>Claim</Trans>
                        </button>
                      )}
                      {!active && (
                        <button
                          className="relative m-[6.2px] box-border inline-flex cursor-pointer items-center rounded bg-indigo-500 p-2 px-4 text-xs text-slate-200 hover:bg-indigo-600"
                          onClick={() => connectWallet()}
                        >
                          <Trans>Connect Wallet</Trans>
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
              <div className="relative rounded border border-slate-800 shadow">
                <div className="flex items-center justify-between rounded-t bg-slate-950 bg-opacity-50 py-3 pl-4 text-xs font-medium uppercase text-slate-200">
                  XLX ({chainName})
                </div>
                <div className="mb-[10.5px] h-[1px] bg-slate-800"></div>
                <div className="grid gap-2">
                  <div className="mx-[15px] grid grid-cols-[1fr_auto] gap-[15px]">
                    <div className="text-xs font-medium text-slate-600">
                      <Trans>Price</Trans>
                    </div>
                    <div className="text-right text-xs font-medium text-slate-300">
                      ${formatKeyAmount(processedData, "xlxPrice", USD_DECIMALS, 3, true)}
                    </div>
                  </div>
                  <div className="mx-[15px] grid grid-cols-[1fr_auto] gap-[15px]">
                    <div className="text-xs font-medium text-slate-600">
                      <Trans>Wallet</Trans>
                    </div>
                    <div className="text-right text-xs font-medium text-slate-300">
                      {formatKeyAmount(processedData, "xlxBalance", XLX_DECIMALS, 2, true)} XLX ($
                      {formatKeyAmount(processedData, "xlxBalanceUsd", USD_DECIMALS, 2, true)})
                    </div>
                  </div>
                  <div className="mx-[15px] grid grid-cols-[1fr_auto] gap-[15px]">
                    <div className="text-xs font-medium text-slate-600">
                      <Trans>Staked</Trans>
                    </div>
                    <div className="text-right text-xs font-medium text-slate-300">
                      {formatKeyAmount(processedData, "xlxBalance", XLX_DECIMALS, 2, true)} XLX ($
                      {formatKeyAmount(processedData, "xlxBalanceUsd", USD_DECIMALS, 2, true)})
                    </div>
                  </div>
                  <div className="my-[10.5px] h-[1px] bg-slate-800"></div>
                  <div className="mx-[15px] grid grid-cols-[1fr_auto] gap-[15px]">
                    <div className="text-xs font-medium text-slate-600">APR</div>
                    <div>
                      <Tooltip
                        handle={`${formatKeyAmount(processedData, "xlxAprTotal", 2, 2, true)}%`}
                        position="right-bottom"
                        renderContent={() => {
                          return (
                            <>
                              <StatsTooltipRow
                                label={`${nativeTokenSymbol} (${wrappedTokenSymbol}) APR`}
                                value={`${formatKeyAmount(processedData, "xlxAprForNativeToken", 2, 2, true)}%`}
                                showDollar={false}
                              />
                              <StatsTooltipRow
                                label="Escrowed XDX APR"
                                value={`${formatKeyAmount(processedData, "xlxAprForEsXdx", 2, 2, true)}%`}
                                showDollar={false}
                              />
                              <br />

                              <Trans>
                                APRs are updated weekly on Wednesday and will depend on the fees collected for the week.
                              </Trans>
                            </>
                          );
                        }}
                      />
                    </div>
                  </div>
                  <div className="mx-[15px] grid grid-cols-[1fr_auto] gap-[15px]">
                    <div className="text-xs font-medium text-slate-600">
                      <Trans>Rewards</Trans>
                    </div>
                    <div className="text-right text-xs font-medium text-slate-300">
                      <Tooltip
                        handle={`$${formatKeyAmount(processedData, "totalXlxRewardsUsd", USD_DECIMALS, 2, true)}`}
                        position="right-bottom"
                        renderContent={() => {
                          return (
                            <>
                              <StatsTooltipRow
                                label={`${nativeTokenSymbol} (${wrappedTokenSymbol})`}
                                value={`${formatKeyAmount(
                                  processedData,
                                  "feeXlxTrackerRewards",
                                  18,
                                  4
                                )} ($${formatKeyAmount(
                                  processedData,
                                  "feeXlxTrackerRewardsUsd",
                                  USD_DECIMALS,
                                  2,
                                  true
                                )})`}
                                showDollar={false}
                              />
                              <StatsTooltipRow
                                label="Escrowed XDX"
                                value={`${formatKeyAmount(
                                  processedData,
                                  "stakedXlxTrackerRewards",
                                  18,
                                  4
                                )} ($${formatKeyAmount(
                                  processedData,
                                  "stakedXlxTrackerRewardsUsd",
                                  USD_DECIMALS,
                                  2,
                                  true
                                )})`}
                                showDollar={false}
                              />
                            </>
                          );
                        }}
                      />
                    </div>
                  </div>
                  <div className="my-[10.5px] h-[1px] bg-slate-800"></div>
                  <div className="mx-[15px] grid grid-cols-[1fr_auto] gap-[15px]">
                    <div className="text-xs font-medium text-slate-600">
                      <Trans>Total Staked</Trans>
                    </div>
                    <div className="text-right text-xs font-medium text-slate-300">
                      {formatKeyAmount(processedData, "xlxSupply", 18, 2, true)} XLX ($
                      {formatKeyAmount(processedData, "xlxSupplyUsd", USD_DECIMALS, 2, true)})
                    </div>
                  </div>
                  <div className="mx-[15px] grid grid-cols-[1fr_auto] gap-[15px]">
                    <div className="text-xs font-medium text-slate-600">
                      <Trans>Total Supply</Trans>
                    </div>
                    <div className="text-right text-xs font-medium text-slate-300">
                      {formatKeyAmount(processedData, "xlxSupply", 18, 2, true)} XLX ($
                      {formatKeyAmount(processedData, "xlxSupplyUsd", USD_DECIMALS, 2, true)})
                    </div>
                  </div>
                  <div className="my-[10.5px] h-[1px] bg-slate-800"></div>
                  <div className="-m-[6.2px] mx-[9px] mb-[12px]">
                    <Link
                      className="relative m-[6.2px] box-border inline-flex cursor-pointer items-center rounded bg-indigo-500 p-2 px-4 text-xs text-slate-200 hover:bg-indigo-600"
                      to="/buy_xlx"
                    >
                      <Trans>Buy XLX</Trans>
                    </Link>
                    <Link
                      className="relative m-[6.2px] box-border inline-flex cursor-pointer items-center rounded bg-indigo-500 p-2 px-4 text-xs text-slate-200 hover:bg-indigo-600"
                      to="/buy_xlx#redeem"
                    >
                      <Trans>Sell XLX</Trans>
                    </Link>
                    {/* {hasInsurance && (
                      <a
                        className="relative m-[6.2px] p-2 box-border inline-flex cursor-pointer items-center rounded bg-indigo-500 px-4 text-slate-200 text-xs hover:bg-indigo-600"
                        href="https://app.insurace.io/Insurance/Cart?id=124&referrer=545066382753150189457177837072918687520318754040"
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        <Trans>Purchase Insurance</Trans>
                      </a>
                    )} */}
                  </div>
                </div>
              </div>
              <div className="relative rounded border border-slate-800 shadow">
                <div className="flex items-center justify-between rounded-t bg-slate-950 bg-opacity-50 py-3 pl-4 text-xs font-medium uppercase text-slate-200">
                  Escrowed XDX
                </div>
                <div className="mb-[10.5px] h-[1px] bg-slate-800"></div>
                <div className="grid gap-2">
                  <div className="mx-[15px] grid grid-cols-[1fr_auto] gap-[15px]">
                    <div className="text-xs font-medium text-slate-600">
                      <Trans>Price</Trans>
                    </div>
                    <div className="text-right text-xs font-medium text-slate-300">
                      ${formatAmount(xdxPrice, USD_DECIMALS, 2, true)}
                    </div>
                  </div>
                  <div className="mx-[15px] grid grid-cols-[1fr_auto] gap-[15px]">
                    <div className="text-xs font-medium text-slate-600">
                      <Trans>Wallet</Trans>
                    </div>
                    <div className="text-right text-xs font-medium text-slate-300">
                      {formatKeyAmount(processedData, "esXdxBalance", 18, 2, true)} esXDX ($
                      {formatKeyAmount(processedData, "esXdxBalanceUsd", USD_DECIMALS, 2, true)})
                    </div>
                  </div>
                  <div className="mx-[15px] grid grid-cols-[1fr_auto] gap-[15px]">
                    <div className="text-xs font-medium text-slate-600">
                      <Trans>Staked</Trans>
                    </div>
                    <div className="text-right text-xs font-medium text-slate-300">
                      {formatKeyAmount(processedData, "esXdxInStakedXdx", 18, 2, true)} esXDX ($
                      {formatKeyAmount(processedData, "esXdxInStakedXdxUsd", USD_DECIMALS, 2, true)})
                    </div>
                  </div>
                  <div className="my-[10.5px] h-[1px] bg-slate-800"></div>
                  <div className="mx-[15px] grid grid-cols-[1fr_auto] gap-[15px]">
                    <div className="text-xs font-medium text-slate-600">APR</div>
                    <div>
                      <div>
                        <Tooltip
                          handle={`${formatKeyAmount(processedData, "xdxAprTotalWithBoost", 2, 2, true)}%`}
                          position="right-bottom"
                          renderContent={() => {
                            return (
                              <>
                                <StatsTooltipRow
                                  label={`${nativeTokenSymbol} (${wrappedTokenSymbol}) Base APR`}
                                  value={`${formatKeyAmount(processedData, "xdxAprForNativeToken", 2, 2, true)}%`}
                                  showDollar={false}
                                />
                                {processedData.bnXdxInFeeXdx && processedData.bnXdxInFeeXdx.gt(0) && (
                                  <StatsTooltipRow
                                    label={`${nativeTokenSymbol} (${wrappedTokenSymbol}) Boosted APR`}
                                    value={`${formatKeyAmount(
                                      processedData,
                                      "xdxBoostAprForNativeToken",
                                      2,
                                      2,
                                      true
                                    )}%`}
                                    showDollar={false}
                                  />
                                )}
                                <StatsTooltipRow
                                  label="Escrowed XDX APR"
                                  value={`${formatKeyAmount(processedData, "xdxAprForEsXdx", 2, 2, true)}%`}
                                  showDollar={false}
                                />
                              </>
                            );
                          }}
                        />
                      </div>
                    </div>
                  </div>
                  <div className="mx-[15px] grid grid-cols-[1fr_auto] gap-[15px]">
                    <div className="text-xs font-medium text-slate-600">{renderMultiplierPointsLabel()}</div>
                    <div>{renderMultiplierPointsValue()}</div>
                  </div>
                  <div className="my-[10.5px] h-[1px] bg-slate-800"></div>
                  <div className="mx-[15px] grid grid-cols-[1fr_auto] gap-[15px]">
                    <div className="text-xs font-medium text-slate-600">
                      <Trans>Total Staked</Trans>
                    </div>
                    <div className="text-right text-xs font-medium text-slate-300">
                      {formatKeyAmount(processedData, "stakedEsXdxSupply", 18, 0, true)} esXDX ($
                      {formatKeyAmount(processedData, "stakedEsXdxSupplyUsd", USD_DECIMALS, 0, true)})
                    </div>
                  </div>
                  <div className="mx-[15px] grid grid-cols-[1fr_auto] gap-[15px]">
                    <div className="text-xs font-medium text-slate-600">
                      <Trans>Total Supply</Trans>
                    </div>
                    <div className="text-right text-xs font-medium text-slate-300">
                      {formatAmount(esXdxSupply, 18, 0, true)} esXDX ($
                      {formatAmount(esXdxSupplyUsd, USD_DECIMALS, 0, true)})
                    </div>
                  </div>
                  <div className="my-[10.5px] h-[1px] bg-slate-800"></div>
                  <div className="-m-[6.2px] mx-[9px] mb-[12px]">
                    {active && (
                      <button
                        className="relative m-[6.2px] box-border inline-flex cursor-pointer items-center rounded bg-indigo-500 p-2 px-4 text-xs text-slate-200 hover:bg-indigo-600"
                        onClick={() => showStakeEsXdxModal()}
                      >
                        <Trans>Stake</Trans>
                      </button>
                    )}
                    {active && (
                      <button
                        className="relative m-[6.2px] box-border inline-flex cursor-pointer items-center rounded bg-indigo-500 p-2 px-4 text-xs text-slate-200 hover:bg-indigo-600"
                        onClick={() => showUnstakeEsXdxModal()}
                      >
                        <Trans>Unstake</Trans>
                      </button>
                    )}
                    {!active && (
                      <button
                        className="relative m-[6.2px] box-border inline-flex cursor-pointer items-center rounded bg-indigo-500 p-2 px-4 text-xs text-slate-200 hover:bg-indigo-600"
                        onClick={() => connectWallet()}
                      >
                        <Trans> Connect Wallet</Trans>
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div>
            <div className="mb-[24px] pt-[31px] text-xs font-medium text-slate-300">
              <div className="mb-[8px] flex flex-row items-center text-lg font-medium text-slate-300">Vest</div>
              <div className="text-xs font-medium text-slate-600">
                <Trans>
                  Convert esXDX tokens to XDX tokens.
                  <br />
                  Please read the{" "}
                  <a href="https://xdx.exchange/docs" target="_blank" rel="noopener noreferrer">
                    vesting details
                  </a>{" "}
                  before using the vaults.
                </Trans>
              </div>
            </div>
            <div>
              <div className="grid grid-cols-1 gap-[15px] text-xs font-medium text-slate-300 xl:grid-cols-2">
                <div className="relative rounded border border-slate-800 shadow">
                  <div className="flex items-center justify-between rounded-t bg-slate-950 bg-opacity-50 py-3 pl-4 text-xs font-medium uppercase text-slate-200">
                    XDX Vault
                  </div>
                  <div className="mb-[10.5px] h-[1px] bg-slate-800"></div>
                  <div className="grid gap-2">
                    <div className="mx-[15px] grid grid-cols-[1fr_auto] gap-[15px]">
                      <div className="text-xs font-medium text-slate-600">
                        <Trans>Staked Tokens</Trans>
                      </div>
                      <div>
                        <Tooltip
                          handle={formatAmount(totalRewardTokens, 18, 2, true)}
                          position="right-bottom"
                          renderContent={() => {
                            return (
                              <>
                                <StatsTooltipRow
                                  showDollar={false}
                                  label="XDX"
                                  value={formatAmount(processedData.xdxInStakedXdx, 18, 2, true)}
                                />

                                <StatsTooltipRow
                                  showDollar={false}
                                  label="esXDX"
                                  value={formatAmount(processedData.esXdxInStakedXdx, 18, 2, true)}
                                />
                                <StatsTooltipRow
                                  showDollar={false}
                                  label="Multiplier Points"
                                  value={formatAmount(processedData.bnXdxInFeeXdx, 18, 2, true)}
                                />
                              </>
                            );
                          }}
                        />
                      </div>
                    </div>
                    <div className="mx-[15px] grid grid-cols-[1fr_auto] gap-[15px]">
                      <div className="text-xs font-medium text-slate-600">
                        <Trans>Reserved for Vesting</Trans>
                      </div>
                      <div>
                        {formatKeyAmount(vestingData, "xdxVesterPairAmount", 18, 2, true)} /{" "}
                        {formatAmount(totalRewardTokens, 18, 2, true)}
                      </div>
                    </div>
                    <div className="mx-[15px] grid grid-cols-[1fr_auto] gap-[15px]">
                      <div className="text-xs font-medium text-slate-600">
                        <Trans>Vesting Status</Trans>
                      </div>
                      <div>
                        <Tooltip
                          handle={`${formatKeyAmount(
                            vestingData,
                            "xdxVesterClaimSum",
                            18,
                            4,
                            true
                          )} / ${formatKeyAmount(vestingData, "xdxVesterVestedAmount", 18, 4, true)}`}
                          position="right-bottom"
                          renderContent={() => {
                            return (
                              <div>
                                {formatKeyAmount(vestingData, "xdxVesterClaimSum", 18, 4, true)} tokens have been
                                converted to XDX from the{" "}
                                {formatKeyAmount(vestingData, "xdxVesterVestedAmount", 18, 4, true)} esXDX deposited for
                                vesting.
                              </div>
                            );
                          }}
                        />
                      </div>
                    </div>
                    <div className="mx-[15px] grid grid-cols-[1fr_auto] gap-[15px]">
                      <div className="text-xs font-medium text-slate-600">
                        <Trans>Claimable</Trans>
                      </div>
                      <div>
                        <Tooltip
                          handle={`${formatKeyAmount(vestingData, "xdxVesterClaimable", 18, 4, true)} XDX`}
                          position="right-bottom"
                          renderContent={() => (
                            <Trans>
                              {formatKeyAmount(vestingData, "xdxVesterClaimable", 18, 4, true)} XDX tokens can be
                              claimed, use the options under the Total Rewards section to claim them.
                            </Trans>
                          )}
                        />
                      </div>
                    </div>
                    <div className="my-[10.5px] h-[1px] bg-slate-800"></div>
                    <div className="-m-[6.2px] mx-[9px] mb-[12px]">
                      {!active && (
                        <button
                          className="relative m-[6.2px] box-border inline-flex cursor-pointer items-center rounded bg-indigo-500 p-2 px-4 text-xs text-slate-200 hover:bg-indigo-600"
                          onClick={() => connectWallet()}
                        >
                          <Trans>Connect Wallet</Trans>
                        </button>
                      )}
                      {active && (
                        <button
                          className="relative m-[6.2px] box-border inline-flex cursor-pointer items-center rounded bg-indigo-500 p-2 px-4 text-xs text-slate-200 hover:bg-indigo-600"
                          onClick={() => showXdxVesterDepositModal()}
                        >
                          <Trans>Deposit</Trans>
                        </button>
                      )}
                      {active && (
                        <button
                          className="relative m-[6.2px] box-border inline-flex cursor-pointer items-center rounded bg-indigo-500 p-2 px-4 text-xs text-slate-200 hover:bg-indigo-600"
                          onClick={() => showXdxVesterWithdrawModal()}
                        >
                          <Trans>Withdraw</Trans>
                        </button>
                      )}
                    </div>
                  </div>
                </div>
                <div className="relative rounded border border-slate-800 shadow">
                  <div className="flex items-center justify-between rounded-t bg-slate-950 bg-opacity-50 py-3 pl-4 text-xs font-medium uppercase text-slate-200">
                    XLX Vault
                  </div>
                  <div className="mb-[10.5px] h-[1px] bg-slate-800"></div>
                  <div className="grid gap-2">
                    <div className="mx-[15px] grid grid-cols-[1fr_auto] gap-[15px]">
                      <div className="text-xs font-medium text-slate-600">
                        <Trans>Staked Tokens</Trans>
                      </div>
                      <div>{formatAmount(processedData.xlxBalance, 18, 2, true)} XLX</div>
                    </div>
                    <div className="mx-[15px] grid grid-cols-[1fr_auto] gap-[15px]">
                      <div className="text-xs font-medium text-slate-600">
                        <Trans>Reserved for Vesting</Trans>
                      </div>
                      <div>
                        {formatKeyAmount(vestingData, "xlxVesterPairAmount", 18, 2, true)} /{" "}
                        {formatAmount(processedData.xlxBalance, 18, 2, true)}
                      </div>
                    </div>
                    <div className="mx-[15px] grid grid-cols-[1fr_auto] gap-[15px]">
                      <div className="text-xs font-medium text-slate-600">
                        <Trans>Vesting Status</Trans>
                      </div>
                      <div>
                        <Tooltip
                          handle={`${formatKeyAmount(
                            vestingData,
                            "xlxVesterClaimSum",
                            18,
                            4,
                            true
                          )} / ${formatKeyAmount(vestingData, "xlxVesterVestedAmount", 18, 4, true)}`}
                          position="right-bottom"
                          renderContent={() => {
                            return (
                              <div>
                                {formatKeyAmount(vestingData, "xlxVesterClaimSum", 18, 4, true)} tokens have been
                                converted to XDX from the{" "}
                                {formatKeyAmount(vestingData, "xlxVesterVestedAmount", 18, 4, true)} esXdx deposited for
                                vesting.
                              </div>
                            );
                          }}
                        />
                      </div>
                    </div>
                    <div className="mx-[15px] grid grid-cols-[1fr_auto] gap-[15px]">
                      <div className="text-xs font-medium text-slate-600">Claimable</div>
                      <div>
                        <Tooltip
                          handle={`${formatKeyAmount(vestingData, "xlxVesterClaimable", 18, 4, true)} XDX`}
                          position="right-bottom"
                          renderContent={() => (
                            <Trans>
                              {formatKeyAmount(vestingData, "xlxVesterClaimable", 18, 4, true)} XDX tokens can be
                              claimed, use the options under the Total Rewards section to claim them.
                            </Trans>
                          )}
                        />
                      </div>
                    </div>
                    <div className="my-[10.5px] h-[1px] bg-slate-800"></div>
                    <div className="-m-[6.2px] mx-[9px] mb-[12px]">
                      {!active && (
                        <button
                          className="relative m-[6.2px] box-border inline-flex cursor-pointer items-center rounded bg-indigo-500 p-2 px-4 text-xs text-slate-200 hover:bg-indigo-600"
                          onClick={() => connectWallet()}
                        >
                          <Trans>Connect Wallet</Trans>
                        </button>
                      )}
                      {active && (
                        <button
                          className="relative m-[6.2px] box-border inline-flex cursor-pointer items-center rounded bg-indigo-500 p-2 px-4 text-xs text-slate-200 hover:bg-indigo-600"
                          onClick={() => showXlxVesterDepositModal()}
                        >
                          <Trans>Deposit</Trans>
                        </button>
                      )}
                      {active && (
                        <button
                          className="relative m-[6.2px] box-border inline-flex cursor-pointer items-center rounded bg-indigo-500 p-2 px-4 text-xs text-slate-200 hover:bg-indigo-600"
                          onClick={() => showXlxVesterWithdrawModal()}
                        >
                          <Trans>Withdraw</Trans>
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
