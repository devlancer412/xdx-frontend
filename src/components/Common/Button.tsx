import { ReactNode } from "react";

type Props = {
  imgSrc: string;
  children: ReactNode;
  imgName: string;
  href?: string;
  className?: string;
  size?: "xs" | "sm" | "lg" | "xl" | "2xl";
  onClick?: () => void;
};

export default function Button({ href, imgSrc, children, className, imgName, size = "lg", onClick }: Props) {
  if (onClick) {
    return (
      <button className={className} onClick={onClick}>
        {imgSrc && (
          <img className="inline-flex h-[23px] w-[23px] items-center justify-center" src={imgSrc} alt={imgName} />
        )}
        <span className="ml-[11.625px] text-[18.5px] leading-[23.25px]">{children}</span>
      </button>
    );
  }
  return (
    <a className={className} href={href} target="_blank" rel="noopener noreferrer">
      {imgSrc && (
        <img className="inline-flex h-[23px] w-[23px] items-center justify-center" src={imgSrc} alt={imgName} />
      )}
      <span className="ml-[11.625px] text-[18.5px] leading-[23.25px]">{children}</span>
    </a>
  );
}
