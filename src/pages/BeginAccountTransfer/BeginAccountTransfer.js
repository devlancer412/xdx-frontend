import React, { useState } from "react";
import { Link } from "react-router-dom";
import useSWR from "swr";
import { ethers } from "ethers";
import { useWeb3React } from "@web3-react/core";

import { getContract } from "config/contracts";

import Modal from "components/Modal/Modal";
import Token from "abis/Token.json";
import Vester from "abis/Vester.json";
import RewardTracker from "abis/RewardTracker.json";
import RewardRouter from "abis/RewardRouter.json";

import { FaCheck, FaTimes } from "react-icons/fa";

import { Trans, t } from "@lingui/macro";

import { callContract, contractFetcher } from "lib/contracts";
import { approveTokens } from "domain/tokens";
import { useChainId } from "lib/chains";

function ValidationRow({ isValid, children }) {
  return (
    <div className="mb-[15px] grid grid-cols-[auto_1fr] text-[15px]">
      <div className="flex items-center justify-center">
        {isValid && <FaCheck className="mr-[15px]" />}
        {!isValid && <FaTimes className="mr-[15px]" />}
      </div>
      <div>{children}</div>
    </div>
  );
}

export default function BeginAccountTransfer(props) {
  const { setPendingTxns } = props;
  const { active, library, account } = useWeb3React();
  const { chainId } = useChainId();

  const [receiver, setReceiver] = useState("");
  const [isTransferring, setIsTransferring] = useState(false);
  const [isApproving, setIsApproving] = useState(false);
  const [isTransferSubmittedModalVisible, setIsTransferSubmittedModalVisible] = useState(false);
  let parsedReceiver = ethers.constants.AddressZero;
  if (ethers.utils.isAddress(receiver)) {
    parsedReceiver = receiver;
  }

  const xdxAddress = getContract(chainId, "XDX");
  const xdxVesterAddress = getContract(chainId, "XdxVester");
  const xlxVesterAddress = getContract(chainId, "XlxVester");

  const rewardRouterAddress = getContract(chainId, "RewardRouter");

  const { data: XdxVesterBalance } = useSWR([active, chainId, xdxVesterAddress, "balanceOf", account], {
    fetcher: contractFetcher(library, Token),
  });

  const { data: xlxVesterBalance } = useSWR([active, chainId, xlxVesterAddress, "balanceOf", account], {
    fetcher: contractFetcher(library, Token),
  });

  const stakedXdxTrackerAddress = getContract(chainId, "StakedXdxTracker");
  const { data: cumulativeXdxRewards } = useSWR(
    [active, chainId, stakedXdxTrackerAddress, "cumulativeRewards", parsedReceiver],
    {
      fetcher: contractFetcher(library, RewardTracker),
    }
  );

  const stakedXlxTrackerAddress = getContract(chainId, "StakedXlxTracker");
  const { data: cumulativeXlxRewards } = useSWR(
    [active, chainId, stakedXlxTrackerAddress, "cumulativeRewards", parsedReceiver],
    {
      fetcher: contractFetcher(library, RewardTracker),
    }
  );

  const { data: transferredCumulativeXdxRewards } = useSWR(
    [active, chainId, xdxVesterAddress, "transferredCumulativeRewards", parsedReceiver],
    {
      fetcher: contractFetcher(library, Vester),
    }
  );

  const { data: transferredCumulativeXlxRewards } = useSWR(
    [active, chainId, xlxVesterAddress, "transferredCumulativeRewards", parsedReceiver],
    {
      fetcher: contractFetcher(library, Vester),
    }
  );

  const { data: pendingReceiver } = useSWR([active, chainId, rewardRouterAddress, "pendingReceivers", account], {
    fetcher: contractFetcher(library, RewardRouter),
  });

  const { data: xdxAllowance } = useSWR([active, chainId, xdxAddress, "allowance", account, stakedXdxTrackerAddress], {
    fetcher: contractFetcher(library, Token),
  });

  const { data: xdxStaked } = useSWR(
    [active, chainId, stakedXdxTrackerAddress, "depositBalances", account, xdxAddress],
    {
      fetcher: contractFetcher(library, RewardTracker),
    }
  );

  const needApproval = xdxAllowance && xdxStaked && xdxStaked.gt(xdxAllowance);

  const hasVestedXdx = XdxVesterBalance && XdxVesterBalance.gt(0);
  const hasVestedXlx = xlxVesterBalance && xlxVesterBalance.gt(0);
  const hasStakedXdx =
    (cumulativeXdxRewards && cumulativeXdxRewards.gt(0)) ||
    (transferredCumulativeXdxRewards && transferredCumulativeXdxRewards.gt(0));
  const hasStakedXlx =
    (cumulativeXlxRewards && cumulativeXlxRewards.gt(0)) ||
    (transferredCumulativeXlxRewards && transferredCumulativeXlxRewards.gt(0));
  const hasPendingReceiver = pendingReceiver && pendingReceiver !== ethers.constants.AddressZero;

  const getError = () => {
    if (!account) {
      return t`Wallet is not connected`;
    }
    if (hasVestedXdx) {
      return t`Vested XDX not withdrawn`;
    }
    if (hasVestedXlx) {
      return t`Vested XLX not withdrawn`;
    }
    if (!receiver || receiver.length === 0) {
      return t`Enter Receiver Address`;
    }
    if (!ethers.utils.isAddress(receiver)) {
      return t`Invalid Receiver Address`;
    }
    if (hasStakedXdx || hasStakedXlx) {
      return t`Invalid Receiver`;
    }
    if ((parsedReceiver || "").toString().toLowerCase() === (account || "").toString().toLowerCase()) {
      return t`Self-transfer not supported`;
    }

    if (
      (parsedReceiver || "").length > 0 &&
      (parsedReceiver || "").toString().toLowerCase() === (pendingReceiver || "").toString().toLowerCase()
    ) {
      return t`Transfer already initiated`;
    }
  };

  const isPrimaryEnabled = () => {
    const error = getError();
    if (error) {
      return false;
    }
    if (isApproving) {
      return false;
    }
    if (isTransferring) {
      return false;
    }
    return true;
  };

  const getPrimaryText = () => {
    const error = getError();
    if (error) {
      return error;
    }
    if (needApproval) {
      return t`Approve XDX`;
    }
    if (isApproving) {
      return t`Approving...`;
    }
    if (isTransferring) {
      return t`Transferring`;
    }

    return t`Begin Transfer`;
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

    setIsTransferring(true);
    const contract = new ethers.Contract(rewardRouterAddress, RewardRouter.abi, library.getSigner());

    callContract(chainId, contract, "signalTransfer", [parsedReceiver], {
      sentMsg: t`Transfer submitted!`,
      failMsg: t`Transfer failed.`,
      setPendingTxns,
    })
      .then(async (res) => {
        setIsTransferSubmittedModalVisible(true);
      })
      .finally(() => {
        setIsTransferring(false);
      });
  };

  const completeTransferLink = `/complete_account_transfer/${account}/${parsedReceiver}`;
  const pendingTransferLink = `/complete_account_transfer/${account}/${pendingReceiver}`;

  return (
    <div className="flex min-h-[calc(100vh-102px)] flex-col justify-between pt-[46.5px]">
      <Modal
        isVisible={isTransferSubmittedModalVisible}
        setIsVisible={setIsTransferSubmittedModalVisible}
        label="Transfer Submitted"
      >
        <Trans>Your transfer has been initiated.</Trans>
        <br />
        <br />
        <Link className="App-cta" to={completeTransferLink}>
          <Trans>Continue</Trans>
        </Link>
      </Modal>
      <div className="mx-auto w-full max-w-[1085px] flex-1 px-[32px] text-slate-300">
        <div className="relative mt-0 pl-[46.5px] pr-[15px]">
          <div className="mb-[8px] flex flex-row items-center text-xl font-medium text-slate-300">
            <Trans>Transfer Account</Trans>
          </div>
          <div className="text-sm text-slate-600">
            <Trans>Please only use this for full account transfers.</Trans>
            <br />
            <Trans>This will transfer all your XDX, esXDX, XLX and Multiplier Points to your new account.</Trans>
            <br />
            <Trans>
              Transfers are only supported if the receiving account has not staked XDX or XLX tokens before.
            </Trans>
            <br />
            <Trans>
              Transfers are one-way, you will not be able to transfer staked tokens back to the sending account.
            </Trans>
          </div>
          {hasPendingReceiver && (
            <div className="text-sm text-slate-600">
              <Trans>
                You have a{" "}
                <Link className="text-slate-300" to={pendingTransferLink}>
                  pending transfer
                </Link>{" "}
                to {pendingReceiver}.
              </Trans>
            </div>
          )}
        </div>
        <div className="p-[46.5px] pt-[15px]">
          <div className="max-w-[387.5px]">
            <div className="mb-[15px]">
              <label className="mb-2 text-[15px]">
                <Trans>Receiver Address</Trans>
              </label>
              <div>
                <input
                  type="text"
                  value={receiver}
                  onChange={(e) => setReceiver(e.target.value)}
                  className="w-full overflow-hidden text-ellipsis whitespace-nowrap border border-slate-800 bg-transparent p-[12.5px] text-[15px] leading-none outline-none focus:ring-0 focus:ring-offset-0"
                />
              </div>
            </div>
            <div className="mb-[23.25px]">
              <ValidationRow isValid={!hasVestedXdx}>
                <Trans>Sender has withdrawn all tokens from XDX Vesting Vault</Trans>
              </ValidationRow>
              <ValidationRow isValid={!hasVestedXlx}>
                <Trans>Sender has withdrawn all tokens from XLX Vesting Vault</Trans>
              </ValidationRow>
              <ValidationRow isValid={!hasStakedXdx}>
                <Trans>Receiver has not staked XDX tokens before</Trans>
              </ValidationRow>
              <ValidationRow isValid={!hasStakedXlx}>
                <Trans>Receiver has not staked XLX tokens before</Trans>
              </ValidationRow>
            </div>
            <div className="mb-[15px]">
              <button
                className="w-full rounded-[3px]  bg-slate-800 p-[15px] text-[14px] leading-none hover:bg-[#4f60fc] hover:shadow disabled:cursor-not-allowed"
                disabled={!isPrimaryEnabled()}
                onClick={() => onClickPrimary()}
              >
                {getPrimaryText()}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
