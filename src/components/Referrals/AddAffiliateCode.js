import { useEffect, useRef, useState } from "react";
import { Trans, t } from "@lingui/macro";
import { getCodeError, getReferralCodeTakenStatus, getSampleReferrarStat } from "./referralsHelper";
import { useWeb3React } from "@web3-react/core";
// import { ARBITRUM } from "config/chains";
import { helperToast } from "lib/helperToast";
import { useDebounce } from "lib/useDebounce";

function AddAffiliateCode({
  handleCreateReferralCode,
  active,
  connectWallet,
  setRecentlyAddedCodes,
  recentlyAddedCodes,
}) {
  return (
    <div className="relative mx-auto mt-[15px] max-w-[475px] rounded border border-slate-800 bg-slate-950 bg-opacity-50 p-[23.25px] text-center shadow">
      <h2 className="mb-[8px] gap-2 text-center text-lg font-medium text-slate-300">
        <Trans>Generate Referral Code</Trans>
      </h2>
      <p className="mt-[11.625px] text-xs font-medium text-slate-600">
        <Trans>
          Looks like you don't have a referral code to share. <br /> Create one now and start earning rebates!
        </Trans>
      </p>
      <div className="mt-[31px]">
        {active ? (
          <AffiliateCodeForm
            handleCreateReferralCode={handleCreateReferralCode}
            recentlyAddedCodes={recentlyAddedCodes}
            setRecentlyAddedCodes={setRecentlyAddedCodes}
          />
        ) : (
          <button
            className="flex w-full cursor-pointer items-center justify-center rounded bg-indigo-500 p-3 text-center text-xs text-slate-200 hover:bg-indigo-600 disabled:cursor-not-allowed disabled:bg-slate-800 disabled:text-slate-200"
            type="button"
            onClick={connectWallet}
          >
            <Trans>Connect Wallet</Trans>
          </button>
        )}
      </div>
    </div>
  );
}

export function AffiliateCodeForm({
  handleCreateReferralCode,
  recentlyAddedCodes,
  setRecentlyAddedCodes,
  callAfterSuccess,
}) {
  const [referralCode, setReferralCode] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState("");
  const inputRef = useRef("");
  const [referralCodeCheckStatus, setReferralCodeCheckStatus] = useState("ok");
  const debouncedReferralCode = useDebounce(referralCode, 300);
  const { account, chainId } = useWeb3React();
  useEffect(() => {
    inputRef.current.focus();
  }, []);

  useEffect(() => {
    let cancelled = false;
    const checkCodeTakenStatus = async () => {
      if (error) {
        setReferralCodeCheckStatus("ok");
        return;
      }
      const { status: takenStatus } = await getReferralCodeTakenStatus(account, debouncedReferralCode, chainId);
      // ignore the result if the referral code to check has changed
      if (cancelled) {
        return;
      }
      if (takenStatus === "none") {
        setReferralCodeCheckStatus("ok");
      } else {
        setReferralCodeCheckStatus("taken");
      }
    };
    setReferralCodeCheckStatus("checking");
    checkCodeTakenStatus();
    return () => {
      cancelled = true;
    };
  }, [account, debouncedReferralCode, error, chainId]);

  function getButtonError() {
    if (!debouncedReferralCode) {
      return t`Enter a code`;
    }
    if (referralCodeCheckStatus === "taken") {
      return t`Code already taken`;
    }
    if (referralCodeCheckStatus === "checking") {
      return t`Checking code...`;
    }

    return false;
  }

  const buttonError = getButtonError();

  function getPrimaryText() {
    if (buttonError) {
      return buttonError;
    }

    if (isProcessing) {
      return t`Creating...`;
    }

    return t`Create`;
  }
  function isPrimaryEnabled() {
    if (buttonError) {
      return false;
    }
    if (error || isProcessing) {
      return false;
    }
    return true;
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setIsProcessing(true);
    const { status: takenStatus, info: takenInfo } = await getReferralCodeTakenStatus(account, referralCode, chainId);
    if (["all", "current", "other"].includes(takenStatus)) {
      setIsProcessing(false);
    }

    if (takenStatus === "none" || takenStatus === "other") {
      // const ownerOnOtherNetwork = takenInfo[chainId === ARBITRUM ? "ownerAvax" : "ownerArbitrum"];
      const ownerOnOtherNetwork = takenInfo["ownerArbitrum"];

      try {
        const tx = await handleCreateReferralCode(referralCode);
        if (callAfterSuccess) {
          callAfterSuccess();
        }
        const receipt = await tx.wait();
        if (receipt.status === 1) {
          recentlyAddedCodes.push(getSampleReferrarStat(referralCode, ownerOnOtherNetwork, account));

          helperToast.success("Referral code created!");
          setRecentlyAddedCodes(recentlyAddedCodes);
          setReferralCode("");
        }
      } catch (err) {
        console.error(err);
      } finally {
        setIsProcessing(false);
      }
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      <input
        type="text"
        ref={inputRef}
        value={referralCode}
        disabled={isProcessing}
        className="mr-[15px] mb-[15px] w-full overflow-hidden text-ellipsis whitespace-nowrap rounded border border-slate-800 bg-transparent p-[10px] text-xs outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
        placeholder="Enter a code"
        onChange={({ target }) => {
          const { value } = target;
          setReferralCode(value);
          setError(getCodeError(value));
        }}
      />
      {error && <p className="error">{error}</p>}
      <button
        className="flex w-full cursor-pointer items-center justify-center rounded bg-indigo-500 p-3 text-center text-xs text-slate-200 hover:bg-indigo-600 disabled:cursor-not-allowed disabled:bg-slate-800 disabled:text-slate-200"
        type="button"
        disabled={!isPrimaryEnabled()}
      >
        {getPrimaryText()}
      </button>
    </form>
  );
}

export default AddAffiliateCode;
