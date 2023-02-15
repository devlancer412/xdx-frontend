import React from "react";

import cx from "classnames";

export default function Tab(props) {
  const {
    options,
    option,
    setOption,
    onChange,
    type = "block",
    className,
    optionLabels,
    border = false,
    disabled = false,
  } = props;
  const onClick = (opt) => {
    if (setOption) {
      setOption(opt);
    }
    if (onChange) {
      onChange(opt);
    }
  };

  let currentIndex = 0;
  for (const index in options) {
    if (options[index] === option) {
      currentIndex = index;
      break;
    }
  }

  return (
    <div
      className={cx(
        type === "inline"
          ? "gap-0"
          : "grid grid-flow-col gap-2 overflow-hidden rounded bg-slate-700 p-1 text-sm text-slate-500 shadow",
        `grid-cols-${options.length} grid`,
        className
      )}
    >
      {options.map((opt, index) => {
        const label = optionLabels && optionLabels[opt] ? optionLabels[opt] : opt;
        return (
          <button
            className={cx(
              opt === option && "!cursor-default !text-slate-300",
              border && "py-2 md:px-2",
              opt === option ? "after:scale-x-100" : "after:scale-x-0",
              type === "inline"
                ? "inline-block !bg-transparent px-2 py-1 text-center font-medium after:absolute after:bottom-0 after:left-1/2 after:z-10 after:h-[2px] after:w-full after:origin-center after:-translate-x-1/2 after:translate-y-[2px] after:rounded-sm after:bg-indigo-500 after:transition-transform after:duration-300"
                : "flex min-w-[56px] flex-row items-center justify-center rounded p-2 px-4 !py-1 text-center",
              "relative cursor-pointer text-xs font-medium text-slate-600 hover:text-slate-200",
              { "!cursor-not-allowed opacity-80": disabled }
            )}
            onClick={() => onClick(opt)}
            key={opt}
            disabled={disabled}
          >
            {index === 0 && type !== "inline" && (
              <div
                className={
                  "absolute top-0 bottom-0 right-0 left-0 z-0 rounded bg-[#181e2b] transition-all duration-200 ease-in-out"
                }
                style={{ transform: `translateX(calc(${currentIndex * 100}% + ${currentIndex * 8}px))` }}
              />
            )}
            <div className="z-10">{label}</div>
          </button>
        );
      })}
    </div>
  );
}
