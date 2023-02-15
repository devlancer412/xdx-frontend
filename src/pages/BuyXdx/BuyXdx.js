import React, { useCallback } from "react";

import { useWeb3React } from "@web3-react/core";

import Synapse from "img/ic_synapse.svg";
import Multiswap from "img/ic_multiswap.svg";
// import Hop from "img/ic_hop.svg";
import Banxa from "img/ic_banxa.svg";
import Binance from "img/ic_binance_logo.svg";
import avax30Icon from "img/ic_avax_30.svg";
// import xdxArbitrum from "img/ic_xdx_arbitrum.svg";
import xdxAvax from "img/ic_xdx_avax.svg";
// import ohmArbitrum from "img/ic_olympus_arbitrum.svg";

import { Trans } from "@lingui/macro";
import Button from "components/Common/Button";
import {
  // ARBITRUM,
  AVALANCHE,
} from "config/chains";
import { switchNetwork } from "lib/wallets";
import { useChainId } from "lib/chains";

export default function BuyXdx() {
  const { chainId } = useChainId();
  const { active } = useWeb3React();

  const onNetworkSelect = useCallback(
    (value) => {
      if (value === chainId) {
        return;
      }
      return switchNetwork(value, active);
    },
    [chainId, active]
  );

  return (
    <div className="flex min-h-[calc(100vh-102px)] flex-col justify-between pt-[46.5px]">
      <div className="mx-auto w-full max-w-[1264px] flex-1 px-[32px] text-slate-300">
        <div className="w-full p-0 pb-[31px]">
          {/* {chainId === ARBITRUM && (
            <div className="mb-[40.25px] flex w-full max-w-[584px]">
              <div className="flex flex-col flex-start">
                <div className="mb-[8px] flex flex-row items-center text-xl font-medium text-slate-300">
                  <Trans>Buy / Transfer ETH</Trans>
                </div>
                <div className="text-sm text-slate-600">
                  <Trans>ETH is needed on Arbitrum to purchase XDX.</Trans>
                  <br />
                  <Trans>
                    To purchase XDX on{" "}
                    <span className="inline-flex underline cursor-pointer" onClick={() => onNetworkSelect(AVALANCHE)}>
                      Avalanche
                    </span>
                    , please change your network.
                  </Trans>
                </div>
              </div>
            </div>
          )}
          {chainId === ARBITRUM && (
            <div className="grid grid-cols-1 gap-5 p-0 pb-[38.75px] xl:grid-cols-2">
              <div className="relative w-full rounded border border-slate-800 pb-[18.6px] text-[15px] xl:max-w-[590px]">
                <div className="flex items-center justify-start rounded-t bg-slate-950 p-[15px] py-3.5 text-xs font-medium uppercase text-slate-600">
                  <Trans>Buy ETH</Trans>
                </div>
                <div className="mb-[10.5px] h-[1px] bg-slate-800"></div>
                <div className="grid grid-cols-1 gap-[8px] px-[15px]">
                  <div className="text-slate-400">
                    <Trans>
                      You can buy ETH directly on{" "}
                      <a
                        className="text-slate-300"
                        href="https://arbitrum.io/"
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        Arbitrum
                      </a>{" "}
                      using Banxa:
                    </Trans>
                  </div>
                  <div className="my-[31px] mx-0 flex flex-1 items-center justify-center">
                    <Button
                      className="inline-flex items-center justify-start rounded-sm border border-slate-800 py-2 px-[15px] text-[14px] text-slate-300"
                      href="#" //"https://gmx.banxa.com?coinType=ETH&fiatType=USD&fiatAmount=500&blockchain=arbitrum"
                      imgSrc={Banxa}
                    >
                      <Trans>Banxa</Trans>
                    </Button>
                  </div>
                </div>
              </div>
              <div className="relative w-full rounded border border-slate-800 pb-[18.6px] text-[15px] xl:max-w-[590px]">
                <div className="flex items-center justify-start rounded-t bg-slate-950 p-[15px] py-3.5 text-xs font-medium uppercase text-slate-600">
                  <Trans>Transfer ETH</Trans>
                </div>
                <div className="mb-[10.5px] h-[1px] bg-slate-800"></div>
                <div className="grid grid-cols-1 gap-[8px] px-[15px]">
                  <div className="text-slate-400">
                    <Trans>You can transfer ETH from other networks to Arbitrum using any of the below options:</Trans>
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    <Button
                      className="inline-flex items-center justify-start rounded-sm border border-slate-800 py-2 px-[15px] text-[14px] text-slate-300"
                      href="https://synapseprotocol.com/?inputCurrency=ETH&outputCurrency=ETH&outputChain=42161"
                      align="left"
                      imgSrc={Synapse}
                    >
                      <Trans>Synapse</Trans>
                    </Button>
                    <Button
                      className="inline-flex items-center justify-start rounded-sm border border-slate-800 py-2 px-[15px] text-[14px] text-slate-300"
                      href="https://app.multichain.org/#/router"
                      align="left"
                      imgSrc={Multiswap}
                    >
                      <Trans>Multiswap</Trans>
                    </Button>
                    <Button
                      className="inline-flex items-center justify-start rounded-sm border border-slate-800 py-2 px-[15px] text-[14px] text-slate-300"
                      href="https://app.hop.exchange/send?token=ETH&sourceNetwork=ethereum&destNetwork=arbitrum"
                      align="left"
                      imgSrc={Hop}
                    >
                      <Trans>Hop</Trans>
                    </Button>
                    <Button
                      className="inline-flex items-center justify-start rounded-sm border border-slate-800 py-2 px-[15px] text-[14px] text-slate-300"
                      href="https://binance.com/"
                      align="left"
                      imgSrc={Binance}
                    >
                      <Trans>Binance</Trans>
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          )} */}
          {chainId === AVALANCHE && (
            <div className="mb-[40.25px] flex w-full max-w-[584px]">
              <div className="flex flex-col flex-start">
                <div className="mb-[8px] flex flex-row items-center text-xl font-medium text-slate-300">
                  <Trans>Buy / Transfer AVAX</Trans>
                </div>
                <div className="text-sm text-slate-600">
                  <Trans>Avax is needed on Avalanche to purchase XDX.</Trans>
                  <br />
                  {/* <Trans>
                    {" "}
                    To purchase XDX on <span onClick={() => onNetworkSelect(ARBITRUM)}>Arbitrum</span>, please change
                    your network.
                  </Trans> */}
                </div>
              </div>
            </div>
          )}
          {chainId === AVALANCHE && (
            <div className="grid grid-cols-1 gap-5 p-0 pb-[38.75px] xl:grid-cols-2">
              <div className="relative w-full rounded border border-slate-800 pb-[18.6px] text-[15px] xl:max-w-[590px]">
                <div className="flex items-center justify-start rounded-t bg-slate-950 p-[15px] py-3.5 text-xs font-medium uppercase text-slate-600">
                  <Trans>Buy AVAX</Trans>
                </div>
                <div className="mb-[10.5px] h-[1px] bg-slate-800"></div>
                <div className="grid grid-cols-1 gap-[8px] px-[15px]">
                  <div className="text-slate-400">
                    <Trans>
                      You can buy AVAX directly on{" "}
                      <a
                        className="text-slate-300"
                        href="https://www.avax.network/"
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        Avalanche
                      </a>{" "}
                      using Banxa:
                    </Trans>
                  </div>
                  <div className="my-[31px] mx-0 flex flex-1 items-center justify-center">
                    <Button
                      className="inline-flex items-center justify-start rounded-sm border border-slate-800 py-2 px-[15px] text-[14px] text-slate-300"
                      href="#" //"https://gmx.banxa.com?coinType=AVAX&fiatType=USD&fiatAmount=500&blockchain=avalanche"
                      imgSrc={Banxa}
                    >
                      <Trans>Banxa</Trans>
                    </Button>
                  </div>
                </div>
              </div>
              <div className="relative w-full rounded border border-slate-800 pb-[18.6px] text-[15px] xl:max-w-[590px]">
                <div className="flex items-center justify-start rounded-t bg-slate-950 p-[15px] py-3.5 text-xs font-medium uppercase text-slate-600">
                  <Trans>Transfer AVAX</Trans>
                </div>
                <div className="mb-[10.5px] h-[1px] bg-slate-800"></div>
                <div className="grid grid-cols-1 gap-[8px] px-[15px]">
                  <div className="text-slate-400">
                    <Trans>You can transfer AVAX to Avalanche using any of the below options.</Trans> <br />
                    <br />
                    <Trans>
                      Using the Avalanche or Synapse bridges, you can also transfer any other supported cryptocurrency,
                      and receive free AVAX to pay for the network's fees.
                    </Trans>
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    <Button
                      className="inline-flex items-center justify-start rounded-sm border border-slate-800 py-2 px-[15px] text-[14px] text-slate-300"
                      align="left"
                      href="https://bridge.avax.network/"
                      imgSrc={avax30Icon}
                    >
                      <Trans>Avalanche</Trans>
                    </Button>
                    <Button
                      className="inline-flex items-center justify-start rounded-sm border border-slate-800 py-2 px-[15px] text-[14px] text-slate-300"
                      align="left"
                      href="https://synapseprotocol.com/"
                      imgSrc={Synapse}
                    >
                      <Trans>Synapse</Trans>
                    </Button>
                    <Button
                      className="inline-flex items-center justify-start rounded-sm border border-slate-800 py-2 px-[15px] text-[14px] text-slate-300"
                      align="left"
                      href="https://app.multichain.org/"
                      imgSrc={Multiswap}
                    >
                      <Trans>Multiswap</Trans>
                    </Button>
                    <Button
                      className="inline-flex items-center justify-start rounded-sm border border-slate-800 py-2 px-[15px] text-[14px] text-slate-300"
                      align="left"
                      href="https://binance.com"
                      imgSrc={Binance}
                    >
                      <Trans>Binance</Trans>
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          )}
          {chainId === AVALANCHE && (
            <div className="grid grid-cols-1 gap-5 p-0 pb-[38.75px] xl:grid-cols-2">
              <div className="flex flex-col">
                <div className="flex flex-col flex-start">
                  <div className="mb-[8px] flex flex-row items-center text-xl font-medium text-slate-300">
                    <Trans>Buy XDX</Trans>
                  </div>
                </div>
                <div className="relative w-full rounded border border-slate-800 p-[15px] pb-[18.6px] text-[15px] xl:max-w-[590px]">
                  <div className="grid grid-cols-1 gap-2">
                    <div className="better-rates-description text-slate-400">
                      <Trans>
                        After you have ETH, set your network to{" "}
                        <a href="https://arbitrum.io/bridge-tutorial/" target="_blank" rel="noopener noreferrer">
                          Arbitrum
                        </a>{" "}
                        then click the button below:
                      </Trans>
                    </div>
                    <div className="my-[31px] mx-0 flex flex-1 items-center justify-center">
                      <Button
                        className="inline-flex items-center justify-start rounded-sm border border-slate-800 py-2 px-[15px] text-[14px] text-slate-300"
                        href="#" //"https://traderjoexyz.com/trade?outputCurrency=0x62edc0692BD897D2295872a9FFCac5425011c661#/"
                      >
                        <Trans>Purchase XDX</Trans>
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
          {/* 
          {chainId === ARBITRUM && (
            <div className="grid grid-cols-1 items-stretch justify-between gap-5 p-0 pb-[38.75px] lg:grid-cols-2">
              <div className="flex flex-col md:mr-5">
                <div className="flex flex-col flex-start">
                  <div className="mb-[8px] flex flex-row items-center text-xl font-medium text-slate-300">
                    <Trans>Buy XDX</Trans>
                  </div>
                </div>
                <div className="relative w-full flex-1 rounded border border-slate-800 p-[15px] pb-[18.6px] text-[15px] xl:max-w-[590px]">
                  <div className="grid grid-cols-1 gap-2">
                    <div className="text-slate-400">
                      <Trans>
                        After you have ETH, set your network to{" "}
                        <a href="https://arbitrum.io/bridge-tutorial/" target="_blank" rel="noopener noreferrer">
                          Arbitrum
                        </a>{" "}
                        then click the button below:
                      </Trans>
                    </div>
                    <div className="my-[31px] mx-0 flex flex-1 items-center justify-center">
                      <Button
                        className="inline-flex items-center justify-start rounded-sm border border-slate-800 py-2 px-[15px] text-[14px] text-slate-300"
                        imgSrc={xdxArbitrum}
                        href="#" //"https://app.uniswap.org/#/swap?inputCurrency=ETH&outputCurrency=0xfc5A1A6EB076a2C7aD06eD22C90d7E710E35ad0a"
                      >
                        <Trans>Purchase XDX</Trans>
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
              <div className="flex flex-col">
                <div className="flex flex-col flex-start">
                  <div className="mb-[8px] flex flex-row items-center text-xl font-medium text-slate-300">
                    <Trans>Buy XDX Bonds</Trans>
                  </div>
                </div>
                <div className="relative w-full rounded border border-slate-800 p-[15px] pb-[18.6px] text-[15px] xl:max-w-[590px]">
                  <div className="grid grid-cols-1 gap-2">
                    <div className="text-slate-400">
                      <Trans>XDX bonds can be bought on Olympus Pro with a discount and a small vesting period:</Trans>
                    </div>
                    <div className="my-[31px] mx-0 flex flex-1 items-center justify-center">
                      <Button
                        className="inline-flex items-center justify-start rounded-sm border border-slate-800 py-2 px-[15px] text-[14px] text-slate-300"
                        imgSrc={ohmArbitrum}
                        href="https://pro.olympusdao.finance/#/partners/XDX"
                      >
                        <Trans>Olympus Pro</Trans>
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )} */}
        </div>
      </div>
    </div>
  );
}
