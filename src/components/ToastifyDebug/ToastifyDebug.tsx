import { useState } from "react";

export function ToastifyDebug(props) {
  const [open, setOpen] = useState(false);
  return (
    <div className="mt-[4.65px] text-[12.4px] text-slate-500">
      <span className="inline-block cursor-pointer border border-dashed" onClick={() => setOpen((old) => !old)}>
        {open ? "Hide error" : "Show error"}
      </span>
      {open && <div className="mt-1 mb-2 max-w-[300px] overflow-x-auto">{props.children}</div>}
    </div>
  );
}
