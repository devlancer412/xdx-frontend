import cx from "classnames";

export default function ExchangeInfoRow(props) {
  const { label, children, value, isTop, isWarning } = props;

  return (
    <div
      className={cx("mb-[4.65px] grid grid-cols-[auto_auto] text-xs font-medium text-slate-200", {
        "mt-[15px] border-t border-slate-600 pt-[15px]": isTop,
      })}
    >
      <div className="mr-2 text-xs font-medium text-slate-600">{label}</div>
      <div className={`flex justify-end text-right ${isWarning ? "text-[#fa3c58]" : ""}`}>{children || value}</div>
    </div>
  );
}
