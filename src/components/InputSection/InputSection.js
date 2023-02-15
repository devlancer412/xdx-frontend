import cx from "classnames";
import { Trans } from "@lingui/macro";

export default function InputSection(props) {
  const {
    topLeftLabel,
    topRightLabel,
    onClickTopRightLabel,
    inputValue,
    onInputValueChange,
    onClickMax,
    showMaxButton,
    staticInput,
  } = props;

  return (
    <div className="mb-2 rounded bg-slate-700 p-4 shadow">
      <div className="grid grid-cols-2 pb-[12.5px] text-[14px]">
        <div className="opacity-70">{topLeftLabel}</div>
        <div
          className={cx("opacity-70", "flex items-end justify-end text-end", {
            "cursor-pointer": onClickTopRightLabel,
          })}
          onClick={onClickTopRightLabel}
        >
          {topRightLabel}
        </div>
      </div>
      <div className="grid grid-cols-[1fr_auto] pb-[3.1px]">
        <div className="relative overflow-hidden">
          {!staticInput && (
            <input
              type="number"
              min="0"
              placeholder="0.0"
              className="w-full overflow-hidden text-ellipsis whitespace-nowrap border-none bg-transparent p-0 pr-5 text-xl text-slate-200 placeholder-slate-400 ring-offset-0 focus:outline-none focus:ring-0"
              value={inputValue}
              onChange={onInputValueChange}
            />
          )}
          {staticInput && <div className="InputSection-static-input">{inputValue}</div>}
          {showMaxButton && (
            <div
              className="absolute right-[12.5px] top-0 cursor-pointer rounded bg-slate-700 py-1 px-2 text-xs font-medium hover:bg-indigo-500"
              onClick={onClickMax}
            >
              <Trans>MAX</Trans>
            </div>
          )}
        </div>
        <div className="text-right text-[21px]">{props.children}</div>
      </div>
    </div>
  );
}
