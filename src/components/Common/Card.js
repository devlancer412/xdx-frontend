import Tooltip from "../Tooltip/Tooltip";

function Card({ title, children, className, tooltipText }) {
  return (
    <div className={`rounded-[4px] border border-slate-800 bg-slate-950 ${className ? className : ""}`}>
      {tooltipText ? (
        <Tooltip
          handle={
            <div className="m-[15px] flex items-center justify-between text-[16px] font-normal leading-[21px] tracking-normal text-white">
              {title}
            </div>
          }
          position="left-bottom"
          renderContent={() => tooltipText}
        />
      ) : (
        <div className="m-[15px] flex items-center justify-between text-[16px] font-normal leading-[21px] tracking-normal text-white">
          {title}
        </div>
      )}
      <div className="h-[1px] w-full bg-slate-800"></div>
      <div className="p-[15px]">{children}</div>
    </div>
  );
}

export default Card;
