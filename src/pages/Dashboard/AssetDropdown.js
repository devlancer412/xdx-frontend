import { Menu } from "@headlessui/react";
import coingeckoIcon from "img/ic_coingecko_16.svg";
import arbitrumIcon from "img/ic_arbitrum_16.svg";
import avalancheIcon from "img/ic_avalanche_16.svg";
import metamaskIcon from "img/ic_metamask_16.svg";
import { useWeb3React } from "@web3-react/core";

import { Trans } from "@lingui/macro";
import { ICONLINKS, PLATFORM_TOKENS } from "config/tokens";
import { addTokenToMetamask } from "lib/wallets";
import { useChainId } from "lib/chains";
import { ArrowDownIcon } from "components/Icons";

function AssetDropdown({ assetSymbol, assetInfo }) {
  const { active } = useWeb3React();
  const { chainId } = useChainId();
  let { coingecko, arbitrum, avalanche } = ICONLINKS[chainId][assetSymbol] || {};
  const unavailableTokenSymbols =
    {
      // 42161: ["ETH"],
      43114: ["AVAX"],
    }[chainId] || [];

  return (
    <Menu>
      <Menu.Button
        as="div"
        className="relative ml-2 flex cursor-pointer items-center justify-center overflow-hidden opacity-80"
      >
        {/* <FiChevronDown size={20} /> */}
        {/* <img className="w-5" src={arrowIcon} alt="Icon" /> */}
        <ArrowDownIcon />
      </Menu.Button>
      <Menu.Items
        as="div"
        className="absolute z-50 rounded border border-slate-800 bg-slate-900 focus:outline-none focus:ring-0"
      >
        <Menu.Item>
          <>
            {coingecko && (
              <a
                href={coingecko}
                className="flex cursor-pointer items-center py-[8.5px] px-2 text-sm font-normal text-slate-500 hover:text-slate-300"
                target="_blank"
                rel="noopener noreferrer"
              >
                <img src={coingeckoIcon} alt="Open in Coingecko" />
                <p className="m-0 ml-[5px] text-xs font-medium text-slate-200 hover:text-slate-400">
                  <Trans>Open in Coingecko</Trans>
                </p>
              </a>
            )}
          </>
        </Menu.Item>
        <Menu.Item>
          <>
            {arbitrum && (
              <a
                href={arbitrum}
                className="flex cursor-pointer items-center py-[8.5px] px-2 text-sm font-normal text-slate-500 hover:text-slate-300"
                target="_blank"
                rel="noopener noreferrer"
              >
                <img src={arbitrumIcon} alt="Open in explorer" />
                <p className="m-0 ml-[5px] text-xs font-medium text-slate-200 hover:text-slate-400">
                  <Trans>Open in Explorer</Trans>
                </p>
              </a>
            )}
            {avalanche && (
              <a
                target="_blank"
                rel="noopener noreferrer"
                href={avalanche}
                className="flex cursor-pointer items-center py-[8.5px] px-2 text-sm font-normal text-slate-500 hover:text-slate-300"
              >
                <img src={avalancheIcon} alt="Open in explorer" />
                <p className="m-0 ml-[5px] text-xs font-medium text-slate-200 hover:text-slate-400">
                  <Trans>Open in Explorer</Trans>
                </p>
              </a>
            )}
          </>
        </Menu.Item>
        <Menu.Item>
          <>
            {active && unavailableTokenSymbols.indexOf(assetSymbol) < 0 && (
              <div
                onClick={() => {
                  let token = assetInfo
                    ? { ...assetInfo, image: assetInfo.imageUrl }
                    : PLATFORM_TOKENS[chainId][assetSymbol];
                  addTokenToMetamask(token);
                }}
                className="flex cursor-pointer items-center py-[8.5px] px-2 text-sm font-normal text-slate-500 hover:text-slate-300"
              >
                <img src={metamaskIcon} alt="Add to Metamask" />
                <p className="m-0 ml-[5px] text-xs font-medium text-slate-200 hover:text-slate-400">
                  <Trans>Add to Metamask</Trans>
                </p>
              </div>
            )}
          </>
        </Menu.Item>
      </Menu.Items>
    </Menu>
  );
}

export default AssetDropdown;
