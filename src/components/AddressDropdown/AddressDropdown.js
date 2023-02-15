import { Menu } from "@headlessui/react";
import { Trans } from "@lingui/macro";
import { shortenAddress, useENS } from "lib/legacy";
import { useCopyToClipboard } from "react-use";
import externalLink from "img/ic_new_link_16.svg";
import copy from "img/ic_copy_16.svg";
import disconnect from "img/ic_sign_out_16.svg";

import Davatar from "@davatar/react";
import { helperToast } from "lib/helperToast";
import { ArrowDownIcon } from "components/Icons";

function AddressDropdown({ account, accountUrl, disconnectAccountAndCloseSettings }) {
  const [, copyToClipboard] = useCopyToClipboard();
  const { ensName } = useENS(account);

  return (
    <Menu>
      <Menu.Button as="div" className="w-full">
        <button className="inline-flex w-full cursor-pointer items-center justify-center rounded-[3px] py-2 px-3 text-[14px]">
          <div>
            <Davatar size={20} address={account} className="h-5 w-5 overflow-hidden rounded-full bg-[#fc7e00]" />
          </div>
          <span className="mx-[10px] text-xs font-medium">{ensName || shortenAddress(account, 13)}</span>
          {/* <FaChevronDown /> */}
          <ArrowDownIcon />
        </button>
      </Menu.Button>
      <div>
        <Menu.Items
          as="div"
          className="absolute right-0 top-[36px] z-[1000] w-full min-w-[155px] origin-top-right cursor-pointer rounded border border-slate-800 bg-slate-900"
        >
          <Menu.Item>
            <div
              className="flex items-center rounded py-[8.5px] px-2 text-slate-400 hover:text-slate-200"
              onClick={() => {
                copyToClipboard(account);
                helperToast.success("Address copied to your clipboard");
              }}
            >
              <img src={copy} alt="Copy user address" />
              <p className="pl-[10px]">
                <Trans>Copy Address</Trans>
              </p>
            </div>
          </Menu.Item>
          <Menu.Item>
            <a
              href={accountUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center rounded py-[8.5px] px-2 text-slate-400 hover:text-slate-200"
            >
              <img src={externalLink} alt="Open address in explorer" />
              <p className="pl-[10px]">
                <Trans>View in Explorer</Trans>
              </p>
            </a>
          </Menu.Item>
          <Menu.Item>
            <div
              className="flex items-center rounded py-[8.5px] px-2 text-slate-400 hover:text-slate-200"
              onClick={disconnectAccountAndCloseSettings}
            >
              <img src={disconnect} alt="Disconnect the wallet" />
              <p className="pl-[10px]">
                <Trans>Disconnect</Trans>
              </p>
            </div>
          </Menu.Item>
        </Menu.Items>
      </div>
    </Menu>
  );
}

export default AddressDropdown;
