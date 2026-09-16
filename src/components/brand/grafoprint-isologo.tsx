import type { SVGProps } from "react";

/** Misma geometría de tres nodos que la marca de la web y el sidebar. */
export const GrafoprintIsologo = ({
  size = 22,
  className,
  ...props
}: SVGProps<SVGSVGElement> & { size?: number }) => (
  <svg
    className={className}
    viewBox="0 0 24 24"
    width={size}
    height={size}
    fill="none"
    aria-hidden="true"
    {...props}
  >
    <path d="M5.5 6.5H18L12 17.5Z" stroke="currentColor" strokeWidth="1.4" />
    <circle data-node="1" cx="5.5" cy="6.5" r="2.2" fill="currentColor" />
    <circle data-node="2" cx="18" cy="6.5" r="2.2" fill="currentColor" />
    <circle data-node="3" cx="12" cy="17.5" r="2.2" fill="currentColor" />
  </svg>
);
