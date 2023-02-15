import { useRef } from "react";
import { Menu } from "@headlessui/react";
import ModalWithPortal from "../Modal/ModalWithPortal";
import { t } from "@lingui/macro";
import cx from "classnames";
import { HiDotsVertical } from "react-icons/hi";
import language24Icon from "img/ic_language24.svg";
import settingsIcon from "img/ic_settings_16.svg";
import arbitrumIcon from "img/ic_arbitrum_24.svg";
import avaxIcon from "img/ic_avalanche_24.svg";
import checkedIcon from "img/ic_checked.svg";
import { importImage } from "lib/legacy";
import { defaultLocale, dynamicActivate, locales } from "lib/i18n";
import { LANGUAGE_LOCALSTORAGE_KEY } from "config/localStorage";

const LANGUAGE_MODAL_KEY = "LANGUAGE";
const NETWORK_MODAL_KEY = "NETWORK";

export default function NetworkDropdown(props) {
  const currentLanguage = useRef(localStorage.getItem(LANGUAGE_LOCALSTORAGE_KEY) || defaultLocale);
  const { networkOptions, selectorLabel, onNetworkSelect, openSettings, activeModal, setActiveModal, small } = props;

  function getModalContent(modalName) {
    switch (modalName) {
      case LANGUAGE_MODAL_KEY:
        return <LanguageModalContent currentLanguage={currentLanguage} />;
      case NETWORK_MODAL_KEY:
        return (
          <NetworkModalContent
            setActiveModal={setActiveModal}
            networkOptions={networkOptions}
            onNetworkSelect={onNetworkSelect}
            selectorLabel={selectorLabel}
            openSettings={openSettings}
          />
        );
      default:
        return;
    }
  }

  function getModalProps(modalName) {
    switch (modalName) {
      case LANGUAGE_MODAL_KEY:
        return {
          className: "w-[310px] text-slate-300",
          isVisible: activeModal === LANGUAGE_MODAL_KEY,
          setIsVisible: () => setActiveModal(null),
          label: t`Select Language`,
          position: "center",
        };
      case NETWORK_MODAL_KEY:
        return {
          className: "w-[310px] text-slate-300",
          isVisible: activeModal === NETWORK_MODAL_KEY,
          setIsVisible: () => setActiveModal(null),
          label: t`Networks and Settings`,
          position: "center",
        };
      default:
        return {};
    }
  }

  return (
    <>
      {small ? (
        <div
          className="relative ml-4 inline-flex h-8 items-center rounded border-2 border-slate-800 text-slate-300"
          onClick={() => setActiveModal(NETWORK_MODAL_KEY)}
        >
          <div className="inline-flex">
            <NavIcons selectorLabel={selectorLabel} />
          </div>
        </div>
      ) : (
        <DesktopDropdown
          currentLanguage={currentLanguage}
          activeModal={activeModal}
          setActiveModal={setActiveModal}
          {...props}
        />
      )}
      <ModalWithPortal {...getModalProps(activeModal)}>{getModalContent(activeModal)}</ModalWithPortal>
    </>
  );
}

function NavIcons({ selectorLabel }) {
  return (
    <>
      <button className={cx("inline-flex h-8 cursor-pointer items-center justify-center rounded px-2")}>
        <img
          className="h-4 w-4 rounded-full"
          src={selectorLabel === "Arbitrum" ? arbitrumIcon : avaxIcon}
          alt={selectorLabel}
        />
      </button>
      <div className="my-2 w-[1px] bg-slate-700" />
      <button className={cx("inline-flex h-8 cursor-pointer items-center justify-center rounded px-2")}>
        <HiDotsVertical color="white" size={20} />
      </button>
    </>
  );
}

function DesktopDropdown({ setActiveModal, selectorLabel, networkOptions, onNetworkSelect, openSettings }) {
  return (
    <div className="relative ml-4 inline-flex h-8 items-center rounded border border-slate-800 text-slate-400 hover:text-slate-200">
      <Menu>
        <Menu.Button as="div" className="inline-flex">
          <NavIcons selectorLabel={selectorLabel} />
        </Menu.Button>
        <Menu.Items
          as="div"
          className="absolute right-0 top-[36px] z-50 w-full min-w-[170px] origin-top-right cursor-pointer list-none rounded border border-slate-800 bg-slate-900 pb-0 outline-none"
        >
          <div className="p-2 text-[12.5px] text-slate-500">Networks</div>
          <div className="grid grid-cols-1 text-slate-400 hover:text-slate-200">
            <NetworkMenuItems
              networkOptions={networkOptions}
              selectorLabel={selectorLabel}
              onNetworkSelect={onNetworkSelect}
            />
          </div>
          <div className="mb-1 h-[1px] w-full bg-slate-700" />
          <Menu.Item>
            <div
              className="flex items-center justify-between rounded p-2 text-xs font-medium text-slate-400 hover:text-slate-200"
              onClick={openSettings}
            >
              <div className="mb-1 flex items-center">
                <div className="inline-flex w-5 items-center justify-center">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                    strokeWidth="1.5"
                    stroke="currentColor"
                    className="h-5 w-5"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M4.5 12a7.5 7.5 0 0015 0m-15 0a7.5 7.5 0 1115 0m-15 0H3m16.5 0H21m-1.5 0H12m-8.457 3.077l1.41-.513m14.095-5.13l1.41-.513M5.106 17.785l1.15-.964m11.49-9.642l1.149-.964M7.501 19.795l.75-1.3m7.5-12.99l.75-1.3m-6.063 16.658l.26-1.477m2.605-14.772l.26-1.477m0 17.726l-.26-1.477M10.698 4.614l-.26-1.477M16.5 19.794l-.75-1.299M7.5 4.205L12 12m6.894 5.785l-1.149-.964M6.256 7.178l-1.15-.964m15.352 8.864l-1.41-.513M4.954 9.435l-1.41-.514M12.002 12l-3.75 6.495"
                    />
                  </svg>
                </div>
                <span className="ml-2 text-slate-400 hover:text-slate-200">Settings</span>
              </div>
            </div>
          </Menu.Item>
        </Menu.Items>
      </Menu>
    </div>
  );
}

function NetworkMenuItems({ networkOptions, selectorLabel, onNetworkSelect }) {
  async function handleNetworkSelect(option) {
    await onNetworkSelect(option);
  }
  return networkOptions.map((network) => {
    const networkIcon = importImage(network.icon);
    return (
      <Menu.Item key={network.value}>
        <div
          className="flex items-center justify-between rounded p-2 text-xs font-medium text-slate-400 hover:text-slate-200"
          onClick={() => handleNetworkSelect({ value: network.value })}
        >
          <div className="flex items-center">
            <div className="inline-flex w-5 items-center justify-center">
              <img className="h-4 w-4 rounded-full" src={networkIcon} alt={network.label} />
            </div>
            <span className="ml-2 text-slate-400 hover:text-slate-200">{network.label}</span>
          </div>
          <div>
            {selectorLabel === network.label ? (
              selectorLabel === "Avalanche" ? (
                <div className="h-2 w-2 rounded-full bg-[#e84142]" />
              ) : (
                <div className="h-2 w-2 rounded-full bg-[#4275a8]" />
              )
            ) : (
              <></>
            )}
          </div>
        </div>
      </Menu.Item>
    );
  });
}

function LanguageModalContent({ currentLanguage }) {
  return (
    <div className="grid grid-cols-2 gap-[10px]">
      {Object.keys(locales).map((item) => {
        const image = importImage(`flag_${item}.svg`);
        return (
          <div
            key={item}
            className={cx(
              "flex cursor-pointer justify-between rounded border border-slate-600 p-2 text-center text-[14px] text-slate-500",
              {
                "border-slate-400": currentLanguage.current === item,
              }
            )}
            onClick={() => {
              localStorage.setItem(LANGUAGE_LOCALSTORAGE_KEY, item);
              dynamicActivate(item);
            }}
          >
            <div className="flex items-center">
              <div className="inline-flex w-5 items-center justify-center">
                <img className="h-4 w-4 rounded-full" src={image} alt="language-menu-open-icon" />
              </div>
              <span className="network-dropdown-item-label menu-item-label">{locales[item]}</span>
            </div>
            <div>{currentLanguage.current === item && <img src={checkedIcon} alt={locales[item]} />}</div>
          </div>
        );
      })}
    </div>
  );
}

function NetworkModalContent({ networkOptions, onNetworkSelect, selectorLabel, setActiveModal, openSettings }) {
  async function handleNetworkSelect(option) {
    await onNetworkSelect(option);
  }
  return (
    <div className="min-w-[170px] pb-0">
      <div className="grid grid-cols-1">
        <span className="mb-2 text-[12.5px] opacity-70">Networks</span>

        {networkOptions.map((network) => {
          const networkIcon = importImage(network.icon);
          return (
            <div
              className="relative mb-2 flex cursor-pointer items-center justify-between rounded-[4px] border border-slate-600 py-2 px-[15px]"
              onClick={() => handleNetworkSelect({ value: network.value })}
              key={network.value}
            >
              <div className="flex items-center">
                <div className="inline-flex w-5 items-center justify-center">
                  <img className="h-4 w-4 rounded-full" src={networkIcon} alt={network.label} />
                </div>
                <span className="ml-2 text-slate-400 hover:text-slate-200">{network.label}</span>
              </div>
              <div>
                {selectorLabel === network.label ? (
                  selectorLabel === "Avalanche" ? (
                    <div className="h-2 w-2 rounded-full bg-[#e84142]" />
                  ) : (
                    <div className="h-2 w-2 rounded-full bg-[#4275a8]" />
                  )
                ) : (
                  <></>
                )}
              </div>
            </div>
          );
        })}
        <span className="mt-[10px] mb-2 text-[12.5px] opacity-70">More Options</span>
        <div
          className="relative mb-2 flex cursor-pointer items-center justify-between rounded-[4px] border border-slate-600 py-2 px-[15px]"
          onClick={() => {
            setActiveModal(LANGUAGE_MODAL_KEY);
          }}
        >
          <div className="flex items-center">
            <img className="mr-[15px] w-[25px]" src={language24Icon} alt="Select Language" />
            <span className="text-[15px] tracking-[0.29px] text-white">Language</span>
          </div>
        </div>
        <div
          className="relative mb-2 flex cursor-pointer items-center justify-between rounded-[4px] border border-slate-600 py-2 px-[15px]"
          onClick={() => {
            openSettings();
            setActiveModal(null);
          }}
        >
          <div className="flex items-center">
            <img className="mr-[15px] w-[25px]" src={settingsIcon} alt="" />
            <span className="text-[15px] tracking-[0.29px] text-white">Settings</span>
          </div>
        </div>
      </div>
    </div>
  );
}
