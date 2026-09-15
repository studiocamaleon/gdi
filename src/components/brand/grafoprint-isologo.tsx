import type { SVGProps } from "react";

/** Isologo de Grafoprint, compartido por el sidebar y los estados de carga. */
export const GrafoprintIsologo = ({ size = 22, className, ...props }: SVGProps<SVGSVGElement> & { size?: number }) => (
  <svg
    className={className}
    viewBox="0 0 24 24"
    width={size}
    height={size}
    fill="none"
    aria-hidden="true"
    {...props}
  >
    <path
      d="M5.5 6.5 L18 6.5"
      stroke="currentColor"
      strokeWidth="1.4"
      strokeLinecap="round"
    />
    <path
      d="M5.5 6.5 L12 17.5"
      stroke="currentColor"
      strokeWidth="1.4"
      strokeLinecap="round"
    />
    <path
      d="M18 6.5 L12 17.5"
      stroke="currentColor"
      strokeWidth="1.4"
      strokeLinecap="round"
    />
    <path
      d="M18 6.5 L18 14.5"
      stroke="currentColor"
      strokeWidth="1.4"
      strokeLinecap="round"
      opacity="0.55"
    />
    <circle data-node="1" cx="5.5" cy="6.5" r="2.2" fill="currentColor" />
    <circle data-node="2" cx="18" cy="6.5" r="2.2" fill="currentColor" />
    <circle data-node="3" cx="12" cy="17.5" r="2.2" fill="currentColor" />
    <circle data-node="4" cx="18" cy="14.5" r="1.4" fill="currentColor" opacity="0.55" />
  </svg>
);
