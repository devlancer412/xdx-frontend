import Modal from "../Modal/Modal";
import Checkbox from "../Checkbox/Checkbox";

export function RedirectPopupModal({
  redirectModalVisible,
  setRedirectModalVisible,
  appRedirectUrl,
  setRedirectPopupTimestamp,
  setShouldHideRedirectModal,
  shouldHideRedirectModal,
  removeRedirectPopupTimestamp,
}) {
  const onClickAgree = () => {
    if (shouldHideRedirectModal) {
      setRedirectPopupTimestamp(Date.now());
    }
  };

  return (
    <Modal
      className="RedirectModal"
      isVisible={redirectModalVisible}
      setIsVisible={setRedirectModalVisible}
      label="Launch App"
    >
      You are leaving XDX.io and will be redirected to a third party, independent website.
      <br />
      <br />
      The website is a community deployed and maintained instance of the open source{" "}
      <a href="https://xdx.exchange/docs" target="_blank" rel="noopener noreferrer">
        XDX front end
      </a>
      , hosted and served on the distributed, peer-to-peer{" "}
      <a href="https://ipfs.io/" target="_blank" rel="noopener noreferrer">
        IPFS network
      </a>
      .
      <br />
      <br />
      Alternative links can be found in the{" "}
      <a href="https://xdx.exchange/docs" target="_blank" rel="noopener noreferrer">
        docs
      </a>
      .
      <br />
      <br />
      By clicking Agree you accept the{" "}
      <a href="https://xdx.exchange/docs" target="_blank" rel="noopener noreferrer">
        T&Cs
      </a>{" "}
      and{" "}
      <a href="https://xdx.exchange/docs" target="_blank" rel="noopener noreferrer">
        Referral T&Cs
      </a>
      .
      <br />
      <br />
      <div className="mb-sm">
        <Checkbox isChecked={shouldHideRedirectModal} setIsChecked={setShouldHideRedirectModal}>
          Don't show this message again for 30 days.
        </Checkbox>
      </div>
      <a
        href={appRedirectUrl}
        className="w-full rounded-[3px]  bg-slate-800 p-[15px] text-[14px] leading-none hover:bg-[#4f60fc] hover:shadow disabled:cursor-not-allowed"
        onClick={() => onClickAgree()}
      >
        Agree
      </a>
    </Modal>
  );
}
