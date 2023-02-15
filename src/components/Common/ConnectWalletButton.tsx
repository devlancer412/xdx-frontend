import { ReactNode } from "react";
import { WalletIcon } from "@heroicons/react/24/outline";

type Props = {
  children: ReactNode;
  onClick: () => void;
};

export default function ConnectWalletButton({ children, onClick }: Props) {
  return (
    <button
      className="relative flex h-8 flex-1 items-center justify-center rounded border border-transparent bg-indigo-500 px-4 py-2 text-xs text-slate-200 shadow-sm hover:bg-indigo-600 hover:text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 focus:ring-offset-gray-800"
      onClick={onClick}
    >
      <WalletIcon className="mr-2 -ml-1 h-5 w-5" aria-hidden="true" />
      <span className="ml-0">{children}</span>
    </button>
  );
}
