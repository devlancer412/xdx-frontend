type Props = {
  label: string;
  value: number | [number];
  showDollar?: boolean;
};

export default function StatsTooltipRow({ label, value, showDollar = true }: Props) {
  function renderValue() {
    if (Array.isArray(value)) {
      return (
        <ul className="list-none">
          {value.map((v, i) => (
            <li className="pt-[2.5px]" key={i}>
              {v}
            </li>
          ))}
        </ul>
      );
    }
    return (
      <span className="text-xs font-medium text-right text-slate-300">
        {showDollar && "$"}
        {value}
      </span>
    );
  }
  return (
    <div className="mb-[5px] grid grid-cols-[1fr_auto]">
      <span className="mr-[5px] text-slate-500 text-xs font-medium">{label}:</span>
      {renderValue()}
    </div>
  );
}
