"use client";

import type * as React from "react";

import { cn } from "@/lib/utils";

type GdiSpinnerProps = {
  className?: string;
} & React.SVGProps<SVGSVGElement>;

export function GdiSpinner({ className, ...props }: GdiSpinnerProps) {
  return (
    <svg
      viewBox="0 0 48 48"
      aria-hidden="true"
      className={cn("size-4 animate-[spin_1s_linear_infinite]", className)}
      {...props}
    >
      <g transform="translate(24 24)">
        <circle cx="0" cy="-12" r="5" fill="#28B8F2" />
        <circle cx="12" cy="0" r="5" fill="#FF0D96" />
        <circle cx="0" cy="12" r="5" fill="#FFF100" />
        <circle cx="-12" cy="0" r="5" fill="#1D1D1B" />
        <circle cx="0" cy="0" r="2.5" fill="#d1d5db" />
      </g>
    </svg>
  );
}
