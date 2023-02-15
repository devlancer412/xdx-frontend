import { useEffect, useRef, useState } from "react";
import { Trans } from "@lingui/macro";
import { toJpeg } from "html-to-image";
import cx from "classnames";
import { BiCopy } from "react-icons/bi";
import { RiFileDownloadLine } from "react-icons/ri";
import { FiTwitter } from "react-icons/fi";
import { useCopyToClipboard, useMedia } from "react-use";
import Modal from "../Modal/Modal";
import xdxLogo from "img/xdx-logo-with-name.svg";
import { QRCodeSVG } from "qrcode.react";
import { getHomeUrl, getRootShareApiUrl, getTwitterIntentURL, USD_DECIMALS } from "lib/legacy";
import { useAffiliateCodes } from "domain/referrals";
import SpinningLoader from "../Common/SpinningLoader";
import useLoadImage from "lib/useLoadImage";
import shareBgImg from "img/position-share-bg.png";
import { helperToast } from "lib/helperToast";
import { formatAmount } from "lib/numbers";
import downloadImage from "lib/downloadImage";

import "./PositionShare.css";

const ROOT_SHARE_URL = getRootShareApiUrl();
const UPLOAD_URL = ROOT_SHARE_URL + "/api/upload";
const UPLOAD_SHARE = ROOT_SHARE_URL + "/api/s";
const config = { quality: 0.95, canvasWidth: 518, canvasHeight: 292, type: "image/jpeg" };

function getShareURL(imageInfo, ref) {
  if (!imageInfo) return;
  let url = `${UPLOAD_SHARE}?id=${imageInfo.id}`;
  if (ref.success && ref.code) {
    url = url + `&ref=${ref.code}`;
  }
  return url;
}

function PositionShare({ setIsPositionShareModalOpen, isPositionShareModalOpen, positionToShare, account, chainId }) {
  const userAffiliateCode = useAffiliateCodes(chainId, account);
  const [uploadedImageInfo, setUploadedImageInfo] = useState();
  const [uploadedImageError, setUploadedImageError] = useState();
  const [, copyToClipboard] = useCopyToClipboard();
  const sharePositionBgImg = useLoadImage(shareBgImg);
  const positionRef = useRef();
  const tweetLink = getTwitterIntentURL(
    `Latest $${positionToShare?.indexToken?.symbol} trade on @XDX_IO`,
    getShareURL(uploadedImageInfo, userAffiliateCode)
  );

  useEffect(() => {
    (async function () {
      const element = positionRef.current;
      if (element && userAffiliateCode.success && sharePositionBgImg && positionToShare) {
        // We have to call the toJpeg function multiple times to make sure the canvas renders all the elements like background image
        // @refer https://github.com/tsayen/dom-to-image/issues/343#issuecomment-652831863
        const image = await toJpeg(element, config)
          .then(() => toJpeg(element, config))
          .then(() => toJpeg(element, config));
        try {
          const imageInfo = await fetch(UPLOAD_URL, { method: "POST", body: image }).then((res) => res.json());
          setUploadedImageInfo(imageInfo);
        } catch {
          setUploadedImageInfo(null);
          setUploadedImageError("Image generation error, please refresh and try again.");
        }
      }
    })();
  }, [userAffiliateCode, sharePositionBgImg, positionToShare]);

  async function handleDownload() {
    const element = positionRef.current;
    if (!element) return;
    const imgBlob = await toJpeg(element, config)
      .then(() => toJpeg(element, config))
      .then(() => toJpeg(element, config));
    downloadImage(imgBlob, "share.jpeg");
  }

  function handleCopy() {
    if (!uploadedImageInfo) return;
    const url = getShareURL(uploadedImageInfo, userAffiliateCode);
    copyToClipboard(url);
    helperToast.success("Link copied to clipboard.");
  }
  return (
    <Modal
      className="!w-[400px] !min-w-[360px]"
      isVisible={isPositionShareModalOpen}
      setIsVisible={setIsPositionShareModalOpen}
      label="Share Position"
    >
      <PositionShareCard
        userAffiliateCode={userAffiliateCode}
        positionRef={positionRef}
        position={positionToShare}
        chainId={chainId}
        account={account}
        uploadedImageInfo={uploadedImageInfo}
        uploadedImageError={uploadedImageError}
        sharePositionBgImg={sharePositionBgImg}
      />
      {uploadedImageError && <span className="error">{uploadedImageError}</span>}

      <div className="mt-[15px] grid grid-cols-3 gap-[15px]">
        <button
          disabled={!uploadedImageInfo}
          className="flex cursor-pointer items-center justify-center rounded bg-slate-700 py-2 px-4 text-left text-sm shadow hover:bg-indigo-500"
          onClick={handleCopy}
        >
          <BiCopy className="mr-[5px] align-middle" />
          <Trans>Copy</Trans>
        </button>
        <button
          disabled={!uploadedImageInfo}
          className="flex cursor-pointer items-center justify-center rounded bg-slate-700 py-2 px-4 text-left text-sm shadow hover:bg-indigo-500"
          onClick={handleDownload}
        >
          <RiFileDownloadLine className="mr-[5px] align-middle" />
          <Trans>Download</Trans>
        </button>
        <div className={cx("disabled:cursor-not-allowed", { disabled: !uploadedImageInfo })}>
          <a
            target="_blank"
            className={cx(
              "flex w-full cursor-pointer items-center justify-center rounded bg-slate-700 py-2 px-4 text-left text-sm no-underline shadow hover:bg-indigo-500",
              {
                disabled: !uploadedImageInfo,
              }
            )}
            rel="noreferrer"
            href={tweetLink}
          >
            <FiTwitter className="mr-[5px] align-middle" />
            <Trans>Tweet</Trans>
          </a>
        </div>
      </div>
    </Modal>
  );
}

function PositionShareCard({
  positionRef,
  position,
  userAffiliateCode,
  uploadedImageInfo,
  uploadedImageError,
  sharePositionBgImg,
}) {
  const isMobile = useMedia("(max-width: 400px)");
  const { code, success } = userAffiliateCode;
  const { deltaAfterFeesPercentageStr, isLong, leverage, indexToken, averagePrice, markPrice } = position;

  const homeURL = getHomeUrl();

  return (
    <div className="relative">
      {/* flex aspect-[1.78] h-full w-full flex-col justify-between bg-contain bg-no-repeat py-4 px-5 */}
      <div ref={positionRef} className="position-share" style={{ backgroundImage: `url(${sharePositionBgImg})` }}>
        <img className="block w-[50px] align-middle" src={xdxLogo} alt="XDX Logo" />
        <ul className="flex list-none text-[12.5px] text-white">
          <li className="mr-[10px] font-extrabold text-[#00daff]">{isLong ? "LONG" : "SHORT"}</li>
          <li>{formatAmount(leverage, 4, 2, true)}x&nbsp;</li>
          <li>{indexToken.symbol} USD</li>
        </ul>
        <h3 className="text-[32.5px] font-bold leading-none">{deltaAfterFeesPercentageStr}</h3>
        <div className="flex max-w-[200px] justify-between">
          <div>
            <p>Entry Price</p>
            <p className="mt-[2.5px] text-[15px] font-bold">${formatAmount(averagePrice, USD_DECIMALS, 2, true)}</p>
          </div>
          <div>
            <p>Index Price</p>
            <p className="mt-[2.5px] text-[15px] font-bold">${formatAmount(markPrice, USD_DECIMALS, 2, true)}</p>
          </div>
        </div>
        <div className="flex max-w-[180px] items-center rounded-md bg-[#FFFFFF08] p-[5px]">
          <div>
            <QRCodeSVG size={isMobile ? 24 : 32} value={success && code ? `${homeURL}/#/?ref=${code}` : `${homeURL}`} />
          </div>
          <div className="ml-[10px] flex flex-col">
            {success && code ? (
              <>
                <p className="text-slate-400">Referral Code:</p>
                <p className="font-medium leading-none">{code}</p>
              </>
            ) : (
              <p className="font-medium leading-none">https://xdx.io</p>
            )}
          </div>
        </div>
      </div>
      {!uploadedImageInfo && !uploadedImageError && (
        <div className="image-overlay-wrapper">
          <div className="image-overlay">
            <SpinningLoader />
            <p className="loading-text">Generating shareable image...</p>
          </div>
        </div>
      )}
    </div>
  );
}

export default PositionShare;
