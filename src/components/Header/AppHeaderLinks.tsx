import { FiX } from "react-icons/fi";
import { HeaderLink } from "./HeaderLink";
import logoImg from "img/logo_XDX.svg";

import { isHomeSite } from "lib/legacy";
import { Trans } from "@lingui/macro";
import { Link } from "react-router-dom";

type Props = {
  small?: boolean;
  clickCloseIcon?: () => void;
  openSettings?: () => void;
  redirectPopupTimestamp: number;
  showRedirectModal: (to: string) => void;
};

export function AppHeaderLinks({ openSettings, clickCloseIcon, redirectPopupTimestamp, showRedirectModal }: Props) {
  return (
    <div className="hidden flex-row items-center md:flex">
      <div className="py-[18px] px-[17px] text-xs font-medium leading-[18px] text-slate-600 transition duration-200 hover:text-slate-200">
        <HeaderLink
          to="/dashboard"
          redirectPopupTimestamp={redirectPopupTimestamp}
          showRedirectModal={showRedirectModal}
        >
          <Trans>Dashboard</Trans>
        </HeaderLink>
      </div>
      <div className="py-[18px] px-[17px] text-xs font-medium leading-[18px] text-slate-600 transition duration-200 hover:text-slate-200">
        <HeaderLink to="/earn" redirectPopupTimestamp={redirectPopupTimestamp} showRedirectModal={showRedirectModal}>
          <Trans>Earn</Trans>
        </HeaderLink>
      </div>
      <div className="py-[18px] px-[17px] text-xs font-medium leading-[18px] text-slate-600 transition duration-200 hover:text-slate-200">
        <HeaderLink to="/buy" redirectPopupTimestamp={redirectPopupTimestamp} showRedirectModal={showRedirectModal}>
          <Trans>Buy</Trans>
        </HeaderLink>
      </div>
      <div className="py-[18px] px-[17px] text-xs font-medium leading-[18px] text-slate-600 transition duration-200 hover:text-slate-200">
        <HeaderLink
          to="/referrals"
          redirectPopupTimestamp={redirectPopupTimestamp}
          showRedirectModal={showRedirectModal}
        >
          <Trans>Referrals</Trans>
        </HeaderLink>
      </div>
      <div className="py-[18px] px-[17px] text-xs font-medium leading-[18px] text-slate-600 transition duration-200 hover:text-slate-200">
        <a href="https://xdx.exchange/docs" target="_blank" rel="noopener noreferrer">
          <Trans>Docs</Trans>
        </a>
      </div>
    </div>
  );
}
