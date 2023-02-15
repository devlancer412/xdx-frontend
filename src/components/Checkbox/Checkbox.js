import React from "react";

import cx from "classnames";

import { ImCheckboxUnchecked, ImCheckboxChecked } from "react-icons/im";

export default function Checkbox(props) {
  const { isChecked, setIsChecked, disabled, className, follow = "left" } = props;

  return (
    <div
      className={cx(
        "mb-[4.65px] flex w-full items-center",
        disabled ? "pointer-events-none cursor-default" : "cursor-pointer",
        follow === "left" && "justify-start",
        follow === "right" && "justify-between",
        { selected: isChecked },
        className
      )}
      onClick={() => setIsChecked(!isChecked)}
    >
      <span className="inline-flex items-center">
        {isChecked && (
          <ImCheckboxChecked
            className={cx(
              "align-center mb-0 mr-[6.2px] text-[12.5px] ",
              disabled ? "text-indigo-500" : "text-indigo-500"
            )}
          />
        )}
        {!isChecked && (
          <ImCheckboxUnchecked
            className={cx(
              "align-center mb-0 mr-[6.2px] text-[12.5px] ",
              disabled ? "text-indigo-500" : "text-indigo-500"
            )}
          />
        )}
      </span>
      <span className="inline-block text-xs font-medium font-medium align-middle text-slate-600">{props.children}</span>
    </div>
  );
}
