export default function ExchangeBanner(props) {
  const { hideBanner } = props;

  return (
    <div className="relative m-[15px] mt-[8px] rounded-[5px] bg-gradient-to-r from-indigo-400 to-indigo-800 py-3 px-6 pr-10 md:mx-[31px] md:mt-[30px] md:mb-[15px]">
      <p className="m-0 text-[18px] leading-[23px] text-white">
        Trade on XDX and win <span className="text-[#50d0fe]">$250.000</span> in prizes! Live until November 30th,{" "}
        <a href="https://xdx.exchange/docs" target="_blank" className="text-white" rel="noreferrer">
          click here
        </a>{" "}
        to learn more.
      </p>
      <span
        className="absolute top-3 right-6 cursor-pointer"
        onClick={(e) => {
          hideBanner();
        }}
      >
        <svg xmlns="http://www.w3.org/2000/svg" width="11.25" height="11.25" viewBox="0 0 11.25 11.25">
          <path
            id="ic_close"
            d="M11-2.565,6.818-6.75,11-10.935a.844.844,0,0,0,0-1.193.844.844,0,0,0-1.193,0L5.625-7.943,1.44-12.128a.844.844,0,0,0-1.193,0,.844.844,0,0,0,0,1.193L4.432-6.75.247-2.565a.844.844,0,0,0,0,1.193.844.844,0,0,0,1.193,0L5.625-5.557,9.81-1.372a.844.844,0,0,0,1.193,0A.844.844,0,0,0,11-2.565Z"
            transform="translate(0 12.375)"
            fill="#fff"
          />
        </svg>
      </span>
    </div>
  );
}
