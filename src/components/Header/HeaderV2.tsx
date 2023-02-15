import { useMemo, useEffect, useState, useCallback } from "react";
import { Disclosure } from "@headlessui/react";
import { Bars3Icon, XMarkIcon } from "@heroicons/react/24/outline";
import ConnectWalletButton from "components/Common/ConnectWalletButton";
import { useWeb3React } from "@web3-react/core";
import AddressDropdown from "components/AddressDropdown/AddressDropdown";
import { getAccountUrl } from "lib/legacy";
import { useChainId } from "lib/chains";
import { Link } from "react-router-dom";
import logoImg from "img/logo.svg";
import avaxIcon from "img/ic_avalanche_24.svg";
import cx from "classnames";

import NetworkDropdown from "components/NetworkDropdown/NetworkDropdown";
import { getChainName, AVALANCHE, AVALANCHE_TESTNET } from "./../../config/chains";
import { switchNetwork } from "lib/wallets";
import { AppHeaderLinks } from "./AppHeaderLinks";

const navigation = [
  { name: "Trade", to: "trade", current: false },
  { name: "Dashboard", to: "dashboard", current: false },
  { name: "Earn", to: "earn", current: false },
  { name: "Buy", to: "buy", current: false },
  { name: "Referrals", to: "referrals", current: false },
];

const networkOptions = [
  // {
  //   label: getChainName(ARBITRUM),
  //   value: ARBITRUM,
  //   icon: "ic_arbitrum_24.svg",
  //   color: "#264f79",
  // },
  {
    label: getChainName(AVALANCHE),
    value: AVALANCHE,
    icon: "ic_avalanche_24.svg",
    color: "#E841424D",
  },
  {
    label: getChainName(AVALANCHE_TESTNET),
    value: AVALANCHE_TESTNET,
    icon: "ic_avalanche_24.svg",
    color: "#264f79",
  },
];

export function Header({
  disconnectAccountAndCloseSettings,
  openSettings,
  setWalletModalVisible,
  redirectPopupTimestamp,
  showRedirectModal,
}) {
  const { chainId } = useChainId();
  const { active, account } = useWeb3React();
  // const [marketSearch, setMarketSearch] = useState<string>("");
  const [activeModal, setActiveModal] = useState<string | null>(null);

  const currentLocation = useMemo(() => {
    const substrings = window.location.href.split("/");
    return substrings[substrings.length - 1];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [window.location.href]);

  const accountUrl = getAccountUrl(chainId, account);

  useEffect(() => {
    if (active) {
      setWalletModalVisible(false);
    }
  }, [active, setWalletModalVisible]);

  const onNetworkSelect = useCallback(
    (option) => {
      if (option.value === chainId) {
        return;
      }
      return switchNetwork(option.value, active);
    },
    [chainId, active]
  );

  const selectorLabel = getChainName(chainId);

  return (
    <>
      <div>
        <div className="">
          <Disclosure as="nav" className="">
            {({ open }) => (
              <>
                <div className="mx-auto max-w-full">
                  <div className="border-b border-slate-800">
                    <div className="grid h-14 grid-cols-1 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6">
                      <div className="col-span-1 flex flex-row items-center gap-5 pl-4 md:col-span-2 lg:col-span-3 xl:col-span-4 2xl:col-span-5">
                        <div className="flex-shrink-0">
                          <Link to="/">
                            <img className="-mt-1 h-5 w-auto" src={logoImg} alt="XDX"></img>
                          </Link>
                        </div>
                        {currentLocation === "trade" && (
                          <AppHeaderLinks
                            redirectPopupTimestamp={redirectPopupTimestamp}
                            showRedirectModal={showRedirectModal}
                          />
                        )}
                      </div>
                      <div className={cx("flex flex-row items-center justify-between pr-4")}>
                        {active ? (
                          <div className="relative inline-flex h-8 flex-1 items-center rounded border border-slate-800 text-xs font-medium">
                            <AddressDropdown
                              account={account}
                              accountUrl={accountUrl}
                              disconnectAccountAndCloseSettings={disconnectAccountAndCloseSettings}
                            />
                          </div>
                        ) : (
                          <ConnectWalletButton onClick={() => setWalletModalVisible(true)}>
                            <span>Connect Wallet</span>
                          </ConnectWalletButton>
                        )}
                        <div className="hidden md:block">
                          <div className="flex items-center">
                            <NetworkDropdown
                              networkOptions={networkOptions}
                              selectorLabel={selectorLabel}
                              onNetworkSelect={onNetworkSelect}
                              openSettings={openSettings}
                              activeModal={activeModal}
                              setActiveModal={setActiveModal}
                            />
                          </div>
                        </div>
                        <div className="ml-2 -mr-2 flex md:hidden">
                          {/* Mobile menu button */}
                          <Disclosure.Button className="inline-flex h-8 items-center justify-center rounded bg-gray-800 p-2 text-slate-400 hover:bg-gray-700 hover:text-slate-300 focus:outline-none focus:ring-2 focus:ring-white focus:ring-offset-2 focus:ring-offset-gray-800">
                            <span className="sr-only">Open main menu</span>
                            {open ? (
                              <XMarkIcon className="block h-6 w-6" aria-hidden="true" />
                            ) : (
                              <Bars3Icon className="block h-6 w-6" aria-hidden="true" />
                            )}
                          </Disclosure.Button>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                <Disclosure.Panel className="border-b border-gray-700 md:hidden">
                  <div className="space-y-1 px-2 py-3 sm:px-3">
                    {navigation.map((item) => (
                      <Disclosure.Button
                        key={item.name}
                        as="a"
                        href={`#/${item.to}`}
                        className={cx(
                          currentLocation === item.to
                            ? "bg-gray-900 text-slate-300"
                            : "text-gray-300 hover:bg-gray-700 hover:text-slate-300",
                          "block rounded px-3 py-2 text-base font-medium"
                        )}
                        aria-current={currentLocation === item.to ? "page" : undefined}
                      >
                        {item.name}
                      </Disclosure.Button>
                    ))}
                    <Disclosure.Button
                      as="a"
                      href="https://xdx.exchange/docs"
                      className="block rounded px-3 py-2 text-base font-medium text-gray-300 hover:bg-gray-700 hover:text-slate-300"
                    >
                      Docs
                    </Disclosure.Button>
                  </div>
                  <div className="border-t border-gray-700 py-4">
                    <button className="flex w-full items-center px-5" onClick={() => setActiveModal("NETWORK")}>
                      <div className="flex-shrink-0">
                        <img className="h-7 w-7 rounded-full" src={avaxIcon} alt="" />
                      </div>
                      <div className="ml-3">
                        <div className="text-base font-medium leading-none text-slate-300">Networks and Settings</div>
                      </div>
                    </button>
                  </div>
                </Disclosure.Panel>
              </>
            )}
          </Disclosure>
        </div>
      </div>
    </>
  );
}
