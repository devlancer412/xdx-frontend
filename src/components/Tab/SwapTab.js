import cx from "classnames";

const borderColors = ["border-green-500", "border-red-400", "border-indigo-500"];

export default function SwapTab(props) {
  const { options, option, setOption, onChange, optionLabels } = props;
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
    <div className="flex -mx-4 text-xs font-medium justify-evenly">
      {options.map((opt, index) => {
        const label = optionLabels && optionLabels[opt] ? optionLabels[opt] : opt;
        return (
          <button
            key={index}
            type="button"
            className={cx(
              "inline-flex h-full w-full cursor-pointer items-center justify-center gap-x-2 border-t-2 border-slate-800 py-2 text-center font-medium text-xs font-medium tracking-wide text-slate-600 outline-none transition duration-200",
              index == currentIndex
                ? "text-slate-200 opacity-100"
                : "bg-slate-950 bg-opacity-50 text-slate-600 hover:bg-opacity-100 hover:text-slate-200",
              index == currentIndex && borderColors[index]
            )}
            onClick={() => onClick(opt)}
          >
            {label}
          </button>
        );
      })}
    </div>
  );
}
