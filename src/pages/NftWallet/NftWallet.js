import React, { useState } from "react";
import { ethers } from "ethers";
import { useWeb3React } from "@web3-react/core";

import ERC721 from "abis/ERC721.json";

import "./NftWallet.css";
import { callContract } from "lib/contracts";
import { useChainId } from "lib/chains";

export default function NftWallet() {
  const [nftAddress, setNftAddress] = useState("");
  const [nftId, setNftId] = useState("");
  const [receiver, setReceiver] = useState("");
  const [isSubmitting, setIsSubmitting] = useState("");

  const { active, account, library } = useWeb3React();
  const { chainId } = useChainId();

  function getTransferError() {
    if (!active) {
      return "Wallet not connected";
    }
    if (!receiver || receiver.length === 0) {
      return "Enter Receiver Address";
    }
    if (!ethers.utils.isAddress(receiver)) {
      return "Invalid Receiver Address";
    }
    if (!nftAddress || nftAddress.length === 0) {
      return "Enter NFT Address";
    }
    if (!ethers.utils.isAddress(nftAddress)) {
      return "Invalid NFT Address";
    }
    if (!nftId || nftId.toString().length === 0) {
      return "Enter NFT ID";
    }
  }

  function getPrimaryText() {
    const transferError = getTransferError();
    if (transferError) {
      return transferError;
    }
    if (isSubmitting) {
      return "Tranferring...";
    }
    return "Transfer NFT";
  }

  function isPrimaryEnabled() {
    return !getTransferError();
  }

  function transferNft() {
    setIsSubmitting(true);
    const contract = new ethers.Contract(nftAddress, ERC721.abi, library.getSigner());
    callContract(chainId, contract, "transferFrom", [account, receiver, nftId], {
      sentMsg: "Transfer submitted!",
      failMsg: "Transfer failed.",
    }).finally(() => {
      setIsSubmitting(false);
    });
  }

  return (
    <div className="NftWallet Page page-layout">
      <div className="relative mt-0 pl-[46.5px] pr-[15px]">
        <div className="mb-[8px] flex flex-row items-center text-xl font-medium text-slate-300">
          NFT Wallet
        </div>
      </div>
      <div className="NftWallet-content">
        <div className="NftWallet-row">
          <label>Receiver Address</label>
          <div>
            <input type="text" value={receiver} onChange={(e) => setReceiver(e.target.value)} />
          </div>
        </div>
        <div className="NftWallet-row">
          <label>NFT Address</label>
          <div>
            <input type="text" value={nftAddress} onChange={(e) => setNftAddress(e.target.value)} />
          </div>
        </div>
        <div className="NftWallet-row">
          <label>NFT ID</label>
          <div>
            <input type="number" value={nftId} onChange={(e) => setNftId(e.target.value)} />
          </div>
        </div>
        <div className="NftWallet-row">
          <button
            className="w-full rounded-[3px]  bg-slate-800 p-[15px] text-[14px] leading-none hover:bg-[#4f60fc] hover:shadow disabled:cursor-not-allowed"
            disabled={!isPrimaryEnabled()}
            onClick={() => transferNft()}
          >
            {getPrimaryText()}
          </button>
        </div>
      </div>
    </div>
  );
}
