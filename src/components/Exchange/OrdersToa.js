import React, { useState } from "react";
import { Trans, t } from "@lingui/macro";
import Modal from "../Modal/Modal";
import Checkbox from "../Checkbox/Checkbox";

export default function OrdersToa(props) {
  const { setIsVisible, isPluginApproving, approveOrderBook } = props;

  const [isChecked, setIsChecked] = useState(false);

  const onConfirmationClick = () => {
    approveOrderBook().then(() => {
      setIsVisible(false);
    });
  };

  const getPrimaryText = () => {
    if (isPluginApproving) {
      return t`Enabling Orders...`;
    }
    if (!isChecked) {
      return t`Accept terms to enable orders`;
    }
    return t`Enable Orders`;
  };

  const isPrimaryEnabled = () => {
    if (isPluginApproving) {
      return false;
    }
    return isChecked;
  };

  return (
    <Modal setIsVisible={setIsVisible} isVisible={true} label={t`Enable Orders`} className="!w-[360px]" zIndex="1000">
      <Trans>
        Note that orders are not guaranteed to be executed.
        <br />
        <br />
        This can occur in a few situations including but not exclusive to:
      </Trans>
      <br />
      <ul className="mb-0 mt-[10px] list-outside list-disc pl-[23.25px]">
        <Trans>
          <li className="pb-[15px]">Insufficient liquidity to execute the order</li>
          <li className="pb-[15px]">
            The mark price which is an aggregate of exchange prices did not reach the specified price
          </li>
          <li className="pb-[15px]">The specified price was reached but not long enough for it to be executed</li>
          <li className="pb-[15px]">No keeper picked up the order for execution</li>
        </Trans>
      </ul>
      <div>
        <Trans>
          Additionally, trigger orders are market orders and are not guaranteed to settle at the trigger price.
        </Trans>
      </div>
      <br />
      <div className="mt-[3.1px]">
        <Checkbox isChecked={isChecked} setIsChecked={setIsChecked} className="!flex-row-reverse !justify-between">
          <span className="opacity-70">
            <Trans>
              Accept that orders are not guaranteed to execute and trigger orders may not settle at the trigger price
            </Trans>
          </span>
        </Checkbox>
      </div>
      <button
        disabled={!isPrimaryEnabled()}
        className="mt-[10px] inline-block w-full cursor-pointer rounded bg-slate-800 p-3 text-center text-sm text-slate-300 hover:bg-indigo-500 disabled:cursor-not-allowed"
        onClick={onConfirmationClick}
      >
        {getPrimaryText()}
      </button>
    </Modal>
  );
}
