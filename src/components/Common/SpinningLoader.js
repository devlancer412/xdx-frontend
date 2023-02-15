import { ImSpinner2 } from "react-icons/im";

function SpinningLoader({ size = "12.5px" }) {
  return (
    <ImSpinner2
      className="ml-2 -mt-[3.1px] inline-block animate-spin align-middle text-[12.5px] text-indigo-600"
      style={{ fontSize: size }}
    />
  );
}

export default SpinningLoader;
