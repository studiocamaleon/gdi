"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import {
  bibliotecaFamilias,
  bibliotecaUses,
  type InstallMaterialPresetPayload,
  type MaterialPresetListItem,
  type MaterialPresetVariant,
} from "@/lib/biblioteca-materias-primas";
import { instalarBibliotecaMateriaPrima } from "@/lib/materias-primas-api";
import s from "./biblioteca-materias-primas.module.css";

type Props = {
  initialItems: MaterialPresetListItem[];
};

const steps = [
  { key: "nombre", nm: "Nombre", sub: "visible en tu empresa" },
  { key: "variantes", nm: "Variantes", sub: "a instalar" },
  { key: "preview", nm: "Preview", sub: "qué se va a crear" },
  { key: "listo", nm: "Listo", sub: "instalación" },
] as const;

type Draft = {
  visibleName: string;
  codigo: string;
  descripcion: string;
  selectedVariantIds: Set<string>;
  lastMateriaPrimaId: string | null;
};

type InstallMode = "completar" | "separado";

const BIco = {
  Library: (p: React.SVGProps<SVGSVGElement>) => (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...p}
    >
      <path d="M3 4v17M21 4v17" />
      <path d="M3 9h18M3 16h18" />
      <path d="M7 4v17M14 4v17" />
    </svg>
  ),
  Search: (p: React.SVGProps<SVGSVGElement>) => (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...p}
    >
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-3-3" />
    </svg>
  ),
  ChevDn: (p: React.SVGProps<SVGSVGElement>) => (
    <svg
      width="11"
      height="11"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...p}
    >
      <path d="m6 9 6 6 6-6" />
    </svg>
  ),
  ChevLeft: (p: React.SVGProps<SVGSVGElement>) => (
    <svg
      width="13"
      height="13"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...p}
    >
      <path d="m15 18-6-6 6-6" />
    </svg>
  ),
  ChevRight: (p: React.SVGProps<SVGSVGElement>) => (
    <svg
      width="13"
      height="13"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...p}
    >
      <path d="m9 6 6 6-6 6" />
    </svg>
  ),
  X: (p: React.SVGProps<SVGSVGElement>) => (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...p}
    >
      <path d="M18 6 6 18M6 6l12 12" />
    </svg>
  ),
  Check: (p: React.SVGProps<SVGSVGElement>) => (
    <svg
      width="12"
      height="12"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...p}
    >
      <path d="M5 12l4 4 10-10" />
    </svg>
  ),
  CheckCircle: (p: React.SVGProps<SVGSVGElement>) => (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...p}
    >
      <circle cx="12" cy="12" r="9" />
      <path d="m9 12 2 2 4-4" />
    </svg>
  ),
  CheckCircleFill: (p: React.SVGProps<SVGSVGElement>) => (
    <svg width="42" height="42" viewBox="0 0 48 48" fill="none" {...p}>
      <circle cx="24" cy="24" r="22" fill="currentColor" opacity="0.16" />
      <circle cx="24" cy="24" r="14" fill="currentColor" />
      <path
        d="m18 24 4 4 8-8"
        stroke="#fff"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  ),
  Plus: (p: React.SVGProps<SVGSVGElement>) => (
    <svg
      width="13"
      height="13"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...p}
    >
      <path d="M12 5v14M5 12h14" />
    </svg>
  ),
  Edit: (p: React.SVGProps<SVGSVGElement>) => (
    <svg
      width="13"
      height="13"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...p}
    >
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4Z" />
    </svg>
  ),
  Arrow: (p: React.SVGProps<SVGSVGElement>) => (
    <svg
      width="13"
      height="13"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...p}
    >
      <path d="M5 12h14M13 6l6 6-6 6" />
    </svg>
  ),
  Info: (p: React.SVGProps<SVGSVGElement>) => (
    <svg
      width="13"
      height="13"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...p}
    >
      <circle cx="12" cy="12" r="9" />
      <path d="M12 8h0M11 12h1v5h1" />
    </svg>
  ),
  Warn: (p: React.SVGProps<SVGSVGElement>) => (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...p}
    >
      <path d="M12 3 1 21h22Z" />
      <path d="M12 10v5M12 18h0" />
    </svg>
  ),
  Sparkles: (p: React.SVGProps<SVGSVGElement>) => (
    <svg
      width="11"
      height="11"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...p}
    >
      <path d="M12 4v3M12 17v3M4 12h3M17 12h3M6.3 6.3l2 2M15.7 15.7l2 2M6.3 17.7l2-2M15.7 8.3l2-2" />
    </svg>
  ),
  Cube: (p: React.SVGProps<SVGSVGElement>) => (
    <svg
      width="12"
      height="12"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...p}
    >
      <path d="M12 3 21 7.5v9L12 21 3 16.5v-9Z" />
      <path d="M3 7.5 12 12l9-4.5" />
      <path d="M12 12v9" />
    </svg>
  ),
};

function MaterialIcon({ kind, size = 28 }: { kind: string; size?: number }) {
  const inks = { fill: "#14141a", light: "#d4d2cd", line: "#92929b" };
  switch (kind) {
    case "foam":
      return (
        <svg width={size} height={size} viewBox="0 0 32 32">
          <rect
            x="3"
            y="6"
            width="26"
            height="20"
            rx="2"
            fill="#fff"
            stroke={inks.fill}
            strokeWidth="1.2"
          />
          {[
            ["9", "13", "1.3"],
            ["14", "17", "1"],
            ["20", "12", "1.4"],
            ["24", "20", "1.1"],
            ["10", "22", ".9"],
          ].map(([cx, cy, r]) => (
            <circle
              key={`${cx}-${cy}`}
              cx={cx}
              cy={cy}
              r={r}
              fill={inks.light}
            />
          ))}
        </svg>
      );
    case "wood":
      return (
        <svg width={size} height={size} viewBox="0 0 32 32">
          <rect
            x="3"
            y="6"
            width="26"
            height="20"
            rx="2"
            fill="#e6dfd0"
            stroke={inks.fill}
            strokeWidth="1.2"
          />
          <path
            d="M5 10 Q12 9 19 11 T29 11M3 15 Q14 14 22 16 T29 16M5 21 Q12 20 18 22 T29 22"
            stroke="#a88f6c"
            strokeWidth=".7"
            fill="none"
            opacity=".55"
          />
        </svg>
      );
    case "layered":
      return (
        <svg width={size} height={size} viewBox="0 0 32 32">
          <rect x="3" y="8" width="26" height="3" rx=".5" fill={inks.fill} />
          <rect x="3" y="12" width="26" height="8" rx=".5" fill="#cfd0d0" />
          <rect x="3" y="21" width="26" height="3" rx=".5" fill={inks.fill} />
        </svg>
      );
    case "transparent":
      return (
        <svg width={size} height={size} viewBox="0 0 32 32">
          <rect
            x="3"
            y="6"
            width="26"
            height="20"
            rx="2"
            fill="rgba(20,20,26,0.04)"
            stroke={inks.fill}
            strokeWidth="1.2"
          />
          <path d="M8 6 L8 26" stroke="#fff" strokeWidth="1.2" opacity=".9" />
          <path
            d="M11 6 L11 26"
            stroke={inks.line}
            strokeWidth=".4"
            opacity=".5"
          />
        </svg>
      );
    case "corrugated":
      return (
        <svg width={size} height={size} viewBox="0 0 32 32">
          <rect
            x="3"
            y="6"
            width="26"
            height="20"
            rx="2"
            fill="#fff"
            stroke={inks.fill}
            strokeWidth="1.2"
          />
          {[8, 11, 14, 17, 20, 23, 26].map((x) => (
            <line
              key={x}
              x1={x}
              y1="8"
              x2={x}
              y2="24"
              stroke={inks.line}
              strokeWidth=".55"
              opacity=".5"
            />
          ))}
        </svg>
      );
    case "plastic":
      return (
        <svg width={size} height={size} viewBox="0 0 32 32">
          <rect
            x="4"
            y="6"
            width="24"
            height="20"
            rx="2"
            fill="#f7f7f5"
            stroke={inks.fill}
            strokeWidth="1.2"
          />
          <path
            d="M7 11h18M7 16h18M7 21h18"
            stroke={inks.line}
            strokeWidth=".55"
            opacity=".45"
          />
          <path
            d="M10 6v20M16 6v20M22 6v20"
            stroke="#fff"
            strokeWidth="1.1"
            opacity=".8"
          />
          <path d="M6 9h20" stroke="#fff" strokeWidth="1.1" opacity=".7" />
        </svg>
      );
    case "sandwich":
      return (
        <svg width={size} height={size} viewBox="0 0 32 32">
          <rect x="3" y="9" width="26" height="1.5" rx=".3" fill={inks.fill} />
          <rect
            x="3"
            y="11"
            width="26"
            height="10"
            rx=".3"
            fill="#fff"
            stroke={inks.line}
            strokeWidth=".4"
          />
          <circle cx="9" cy="16" r=".9" fill={inks.light} />
          <circle cx="15" cy="14" r=".7" fill={inks.light} />
          <circle cx="22" cy="17" r=".9" fill={inks.light} />
          <rect
            x="3"
            y="21.5"
            width="26"
            height="1.5"
            rx=".3"
            fill={inks.fill}
          />
        </svg>
      );
    case "paper":
      return (
        <svg width={size} height={size} viewBox="0 0 32 32">
          <path
            d="M8 4h12l4 4v20H8Z"
            fill="#fff"
            stroke={inks.fill}
            strokeWidth="1.2"
          />
          <path
            d="M20 4v5h5"
            fill="none"
            stroke={inks.fill}
            strokeWidth="1.2"
          />
          <path
            d="M11 15h12M11 19h12M11 23h8"
            stroke={inks.line}
            strokeWidth=".75"
            opacity=".7"
          />
        </svg>
      );
    case "coated":
      return (
        <svg width={size} height={size} viewBox="0 0 32 32">
          <rect
            x="6"
            y="5"
            width="20"
            height="24"
            rx="2"
            fill="#fff"
            stroke={inks.fill}
            strokeWidth="1.2"
          />
          <path
            d="M9 10h14M9 14h14M9 18h14"
            stroke={inks.line}
            strokeWidth=".65"
            opacity=".55"
          />
          <path
            d="M9 24c4-4 10-4 14 0"
            stroke={inks.fill}
            strokeWidth="1"
            fill="none"
          />
          <path d="M22 7l2 2M20 9l4 4" stroke="#d4d2cd" strokeWidth="1.1" />
        </svg>
      );
    case "copy":
      return (
        <svg width={size} height={size} viewBox="0 0 32 32">
          <rect
            x="7"
            y="4"
            width="16"
            height="20"
            rx="1.5"
            fill="#fff"
            stroke={inks.line}
            strokeWidth="1"
          />
          <rect
            x="10"
            y="8"
            width="16"
            height="20"
            rx="1.5"
            fill="#fff"
            stroke={inks.fill}
            strokeWidth="1.2"
          />
          <path
            d="M13 14h10M13 18h10M13 22h7"
            stroke={inks.line}
            strokeWidth=".75"
            opacity=".65"
          />
        </svg>
      );
    case "adhesive":
      return (
        <svg width={size} height={size} viewBox="0 0 32 32">
          <path
            d="M6 5h20v22H6Z"
            fill="#fff"
            stroke={inks.fill}
            strokeWidth="1.2"
          />
          <path
            d="M18 27c0-5 3-8 8-8"
            fill="#f4f1e8"
            stroke={inks.fill}
            strokeWidth="1.2"
          />
          <path
            d="M11 11h10M11 15h10"
            stroke={inks.line}
            strokeWidth=".75"
            opacity=".65"
          />
        </svg>
      );
    case "kraft":
      return (
        <svg width={size} height={size} viewBox="0 0 32 32">
          <rect
            x="5"
            y="5"
            width="22"
            height="22"
            rx="2"
            fill="#d4a35f"
            stroke={inks.fill}
            strokeWidth="1.2"
          />
          <path
            d="M8 11c4-2 9 2 16 0M8 17c5-2 10 2 16 0M8 23c5-2 10 2 16 0"
            stroke="#8c6530"
            strokeWidth=".7"
            fill="none"
            opacity=".45"
          />
        </svg>
      );
    case "roll":
      return (
        <svg width={size} height={size} viewBox="0 0 32 32">
          <circle
            cx="11"
            cy="16"
            r="7"
            fill="#fff"
            stroke={inks.fill}
            strokeWidth="1.2"
          />
          <circle
            cx="11"
            cy="16"
            r="2.3"
            fill={inks.light}
            stroke={inks.line}
            strokeWidth=".7"
          />
          <path
            d="M11 9h12c3.3 0 6 3.1 6 7s-2.7 7-6 7H11"
            fill="#fff"
            stroke={inks.fill}
            strokeWidth="1.2"
          />
          <path
            d="M22 10c2.2.9 3.5 3 3.5 6s-1.3 5.1-3.5 6"
            stroke={inks.line}
            strokeWidth=".7"
            fill="none"
            opacity=".6"
          />
        </svg>
      );
    case "banner":
      return (
        <svg width={size} height={size} viewBox="0 0 32 32">
          <path
            d="M6 7h20v18H6Z"
            fill="#fff"
            stroke={inks.fill}
            strokeWidth="1.2"
          />
          <path
            d="M8 11h16M8 16h16M8 21h16"
            stroke={inks.line}
            strokeWidth=".75"
            opacity=".55"
          />
          <path d="M5 7h22M5 25h22" stroke={inks.fill} strokeWidth="1.2" />
        </svg>
      );
    case "mesh":
      return (
        <svg width={size} height={size} viewBox="0 0 32 32">
          <rect
            x="5"
            y="6"
            width="22"
            height="20"
            rx="2"
            fill="#fff"
            stroke={inks.fill}
            strokeWidth="1.2"
          />
          {[9, 13, 17, 21].map((x) => (
            <path
              key={`v-${x}`}
              d={`M${x} 8v16`}
              stroke={inks.line}
              strokeWidth=".65"
              opacity=".55"
            />
          ))}
          {[10, 14, 18, 22].map((y) => (
            <path
              key={`h-${y}`}
              d={`M7 ${y}h18`}
              stroke={inks.line}
              strokeWidth=".65"
              opacity=".55"
            />
          ))}
        </svg>
      );
    case "film":
      return (
        <svg width={size} height={size} viewBox="0 0 32 32">
          <rect
            x="5"
            y="7"
            width="22"
            height="18"
            rx="2"
            fill="rgba(20,20,26,0.04)"
            stroke={inks.fill}
            strokeWidth="1.2"
          />
          <path
            d="M9 7v18M23 7v18"
            stroke="#fff"
            strokeWidth="1.2"
            opacity=".9"
          />
          <path
            d="M12 7v18M20 7v18"
            stroke={inks.line}
            strokeWidth=".45"
            opacity=".55"
          />
          <path
            d="M7 12h18M7 20h18"
            stroke={inks.line}
            strokeWidth=".45"
            opacity=".4"
          />
        </svg>
      );
    case "ink":
      return (
        <svg width={size} height={size} viewBox="0 0 32 32">
          <path
            d="M13 4h6l1 4h-8Z"
            fill="#fff"
            stroke={inks.fill}
            strokeLinejoin="round"
            strokeWidth="1.2"
          />
          <path
            d="M11 8h10l2 4v13a3 3 0 0 1-3 3h-8a3 3 0 0 1-3-3V12Z"
            fill="#fff"
            stroke={inks.fill}
            strokeLinejoin="round"
            strokeWidth="1.2"
          />
          <path
            d="M12 17h8v7h-8Z"
            fill={inks.fill}
            opacity=".12"
            stroke={inks.line}
            strokeWidth=".65"
          />
          <path
            d="M13 12h6"
            stroke={inks.line}
            strokeWidth=".75"
            opacity=".55"
          />
        </svg>
      );
    case "toner":
      return (
        <svg width={size} height={size} viewBox="0 0 32 32">
          <rect
            x="5"
            y="9"
            width="22"
            height="14"
            rx="2"
            fill="#fff"
            stroke={inks.fill}
            strokeWidth="1.2"
          />
          <path
            d="M9 9V7h14v2M10 23v2h12v-2"
            fill="none"
            stroke={inks.fill}
            strokeWidth="1.2"
            strokeLinejoin="round"
          />
          <path
            d="M10 14h12M10 18h8"
            stroke={inks.line}
            strokeWidth=".75"
            opacity=".55"
          />
        </svg>
      );
    case "magnet":
      return (
        <svg width={size} height={size} viewBox="0 0 32 32">
          <path
            d="M8 7h5v11a3 3 0 0 0 6 0V7h5v11a8 8 0 0 1-16 0Z"
            fill="#fff"
            stroke={inks.fill}
            strokeLinejoin="round"
            strokeWidth="1.2"
          />
          <path d="M8 7h5v5H8Zm11 0h5v5h-5Z" fill={inks.fill} opacity=".9" />
          <path
            d="M11 22c1.1 2 2.8 3 5 3s3.9-1 5-3"
            fill="none"
            stroke={inks.line}
            strokeWidth=".7"
            opacity=".55"
          />
        </svg>
      );
    case "lamination":
      return (
        <svg width={size} height={size} viewBox="0 0 32 32">
          <rect
            x="5"
            y="8"
            width="18"
            height="16"
            rx="2"
            fill="#fff"
            stroke={inks.fill}
            strokeWidth="1.2"
          />
          <path
            d="M9 12h10M9 16h10M9 20h7"
            stroke={inks.line}
            strokeWidth=".65"
            opacity=".45"
          />
          <path
            d="M12 6h13a2 2 0 0 1 2 2v16"
            fill="none"
            stroke={inks.fill}
            strokeWidth="1.2"
          />
          <path
            d="M15 9h9v13"
            fill="none"
            stroke={inks.line}
            strokeWidth=".65"
            opacity=".55"
          />
        </svg>
      );
    case "pouch":
      return (
        <svg width={size} height={size} viewBox="0 0 32 32">
          <rect
            x="6"
            y="5"
            width="20"
            height="22"
            rx="2"
            fill="rgba(20,20,26,0.03)"
            stroke={inks.fill}
            strokeWidth="1.2"
          />
          <rect
            x="9"
            y="8"
            width="14"
            height="16"
            rx="1.5"
            fill="#fff"
            stroke={inks.line}
            strokeWidth=".8"
            opacity=".85"
          />
          <path
            d="M12 13h8M12 17h8M12 21h5"
            stroke={inks.line}
            strokeWidth=".55"
            opacity=".45"
          />
        </svg>
      );
    case "canvas":
      return (
        <svg width={size} height={size} viewBox="0 0 32 32">
          <rect
            x="5"
            y="6"
            width="22"
            height="20"
            rx="2"
            fill="#f7f4ec"
            stroke={inks.fill}
            strokeWidth="1.2"
          />
          <path
            d="M8 9h16M8 13h16M8 17h16M8 21h16"
            stroke="#b9aa8e"
            strokeWidth=".55"
            opacity=".55"
          />
          <path
            d="M10 7v18M15 7v18M20 7v18"
            stroke="#c9bca3"
            strokeWidth=".45"
            opacity=".55"
          />
        </svg>
      );
    case "sticker":
      return (
        <svg width={size} height={size} viewBox="0 0 32 32">
          <path
            d="M8 5h16a3 3 0 0 1 3 3v16a3 3 0 0 1-3 3H8a3 3 0 0 1-3-3V8a3 3 0 0 1 3-3Z"
            fill="#fff"
            stroke={inks.fill}
            strokeWidth="1.2"
          />
          <path
            d="M20 27c0-4.4 2.6-7 7-7"
            fill="#f4f1e8"
            stroke={inks.fill}
            strokeWidth="1.2"
          />
          <path
            d="M10 11h9M10 15h12"
            stroke={inks.line}
            strokeWidth=".75"
            opacity=".65"
          />
          <path
            d="M12 21c2.2-2.1 5.8-2.1 8 0"
            stroke={inks.fill}
            strokeWidth="1"
            fill="none"
          />
        </svg>
      );
    case "textile":
      return (
        <svg width={size} height={size} viewBox="0 0 32 32">
          <path
            d="M11 6 8 8.2 4 10.5l3 5.2 3-1.4V27h12V14.3l3 1.4 3-5.2-4-2.3L21 6c-1.1 1.4-2.8 2.2-5 2.2S12.1 7.4 11 6Z"
            fill="#fff"
            stroke={inks.fill}
            strokeWidth="1.2"
            strokeLinejoin="round"
          />
          <path
            d="M12.5 6.8c.8 1.7 2 2.6 3.5 2.6s2.7-.9 3.5-2.6"
            stroke={inks.line}
            strokeWidth=".75"
            fill="none"
            opacity=".65"
          />
          <path
            d="M12 18h8M12 21h8"
            stroke={inks.line}
            strokeWidth=".65"
            opacity=".45"
          />
        </svg>
      );
    case "holographic":
      return (
        <svg width={size} height={size} viewBox="0 0 32 32">
          <defs>
            <linearGradient
              id="bm-holo"
              x1="4"
              x2="28"
              y1="5"
              y2="27"
              gradientUnits="userSpaceOnUse"
            >
              <stop stopColor="#bff4ff" />
              <stop offset=".35" stopColor="#f3d2ff" />
              <stop offset=".7" stopColor="#fff1a8" />
              <stop offset="1" stopColor="#c9ffd8" />
            </linearGradient>
          </defs>
          <rect
            x="5"
            y="6"
            width="22"
            height="20"
            rx="2"
            fill="url(#bm-holo)"
            stroke={inks.fill}
            strokeWidth="1.2"
          />
          <path
            d="M9 10h14M7 16h18M10 22h12"
            stroke="#fff"
            strokeWidth="1"
            opacity=".75"
          />
          <path
            d="m11 9 1 2 2 1-2 1-1 2-1-2-2-1 2-1Zm11 9 .8 1.5 1.5.8-1.5.8-.8 1.5-.8-1.5-1.5-.8 1.5-.8Z"
            fill={inks.fill}
            opacity=".7"
          />
        </svg>
      );
    default:
      return (
        <svg width={size} height={size} viewBox="0 0 32 32">
          <rect
            x="3"
            y="6"
            width="26"
            height="20"
            rx="2"
            fill="#fff"
            stroke={inks.fill}
            strokeWidth="1.2"
          />
        </svg>
      );
  }
}

export function BibliotecaMateriasPrimasView({ initialItems }: Props) {
  const [items, setItems] = React.useState(initialItems);
  const [query, setQuery] = React.useState("");
  const [familyFilter, setFamilyFilter] = React.useState("all");
  const [categoriaFilter, setCategoriaFilter] = React.useState("all");
  const [statusFilter, setStatusFilter] = React.useState("all");
  const [wizardKey, setWizardKey] = React.useState<string | null>(null);
  const selectedItem =
    items.find((item) => item.canonicalKey === wizardKey) ?? null;
  const familyOptions = React.useMemo(() => {
    const keys = Array.from(new Set(items.map((item) => item.subfamilia)));
    return keys.map((key) => ({
      key,
      label: bibliotecaFamilias[key]?.nm ?? key,
    }));
  }, [items]);
  // Categoría (rubro) de un blank de merchandising/textil: vive en la primera
  // variante (atributosVariante.categoria). Vacío para el resto de materiales.
  const itemCategoria = React.useCallback((item: MaterialPresetListItem) => {
    const raw = item.variantes[0]?.atributosVariante?.categoria;
    return typeof raw === "string" ? raw : "";
  }, []);
  const categoriaOptions = React.useMemo(() => {
    const set = new Set<string>();
    for (const item of items) {
      const cat = itemCategoria(item);
      if (cat) set.add(cat);
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b, "es"));
  }, [items, itemCategoria]);
  const counts = {
    all: items.length,
    installed: items.filter(
      (item) => item.installState.status !== "not-installed",
    ).length,
    "not-installed": items.filter(
      (item) => item.installState.status === "not-installed",
    ).length,
  };
  const visibleItems = items.filter((item) => {
    const hay =
      `${item.nombreCanonico} ${item.aliasDisponibles.join(" ")} ${item.descripcionCorta}`.toLowerCase();
    const q = query.trim().toLowerCase();
    if (q && !hay.includes(q)) return false;
    if (familyFilter !== "all" && item.subfamilia !== familyFilter)
      return false;
    if (categoriaFilter !== "all" && itemCategoria(item) !== categoriaFilter)
      return false;
    if (statusFilter === "installed")
      return item.installState.status !== "not-installed";
    if (statusFilter === "not-installed")
      return item.installState.status === "not-installed";
    return true;
  });
  const visibleGroups = React.useMemo(() => {
    const order = new Map<string, number>(
      familyOptions.map((option, index) => [option.key, index]),
    );
    const groups = new Map<string, MaterialPresetListItem[]>();
    for (const item of visibleItems) {
      groups.set(item.subfamilia, [
        ...(groups.get(item.subfamilia) ?? []),
        item,
      ]);
    }
    return Array.from(groups.entries()).sort(
      ([a], [b]) => (order.get(a) ?? 999) - (order.get(b) ?? 999),
    );
  }, [familyOptions, visibleItems]);
  const updateItem = (next: MaterialPresetListItem) => {
    setItems((prev) =>
      prev.map((item) =>
        item.canonicalKey === next.canonicalKey ? next : item,
      ),
    );
  };

  return (
    <div className={s.scope}>
      <div className={s.page}>
        <div className={s.head}>
          <div className="title-block">
            <div className="eyebrow">
              <span className="ic">
                <BIco.Library />
              </span>
              Inventario · Materias primas
            </div>
            <h1>Biblioteca de materias primas</h1>
            <div className="sub">
              Instalá materiales comunes con variantes ya preparadas. El sistema
              mantiene la relación canónica para reportes y compatibilidad
              cross-tenant.
            </div>
          </div>
          <div className="actions">
            <button className={`${s.btn} ghost`} type="button">
              Ver instaladas <span className="ct">{counts.installed}</span>
            </button>
            <button className={s.btn} type="button">
              Sugerir material
            </button>
          </div>
        </div>

        <div className={s.toolbar}>
          <div className={s.search}>
            <span className="ic">
              <BIco.Search />
            </span>
            <input
              placeholder="Buscar por nombre, alias o descripción..."
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
            <span className="kbd">/</span>
          </div>
          <div className={s.filter}>
            <span className="lbl">Familia</span>
            <select
              value={familyFilter}
              onChange={(event) => setFamilyFilter(event.target.value)}
              aria-label="Filtrar por familia"
            >
              <option value="all">Todas</option>
              {familyOptions.map((option) => (
                <option key={option.key} value={option.key}>
                  {option.label}
                </option>
              ))}
            </select>
            <BIco.ChevDn />
          </div>
          {categoriaOptions.length > 0 ? (
            <div className={s.filter}>
              <span className="lbl">Categoría</span>
              <select
                value={categoriaFilter}
                onChange={(event) => setCategoriaFilter(event.target.value)}
                aria-label="Filtrar por categoría / rubro"
              >
                <option value="all">Todas</option>
                {categoriaOptions.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>
              <BIco.ChevDn />
            </div>
          ) : null}
          <div className={s.filter}>
            <span className="lbl">Uso</span>
            <span className="v">Todos</span>
            <BIco.ChevDn />
          </div>
          <div className={s.seg}>
            {(["all", "not-installed", "installed"] as const).map((key) => (
              <button
                key={key}
                className={statusFilter === key ? "on" : ""}
                onClick={() => setStatusFilter(key)}
                type="button"
              >
                {key === "all"
                  ? "Todos"
                  : key === "not-installed"
                    ? "No instalados"
                    : "Instalados"}
                <span className="ct">{counts[key]}</span>
              </button>
            ))}
          </div>
          <div className={s.toolbarSummary}>
            Mostrando <strong>{visibleItems.length}</strong> de{" "}
            <strong>{items.length}</strong>
          </div>
        </div>

        <div className={s.familyStack}>
          {visibleGroups.map(([familyKey, familyItems]) => (
            <section key={familyKey} className={s.familySection}>
              <div className={s.familyHead}>
                <div>
                  <h2>
                    {bibliotecaFamilias[familyKey]?.nm ??
                      humanizeEnum(familyKey)}
                  </h2>
                  <p>{familySectionDescription(familyKey)}</p>
                </div>
                <span>{familyItems.length} materiales</span>
              </div>
              <div className={s.grid}>
                {familyItems.map((item) => (
                  <MaterialCard
                    key={item.canonicalKey}
                    item={item}
                    onConfigure={setWizardKey}
                  />
                ))}
              </div>
            </section>
          ))}
        </div>
      </div>
      {selectedItem && (
        <Wizard
          item={selectedItem}
          onClose={() => setWizardKey(null)}
          onInstalled={(preset) => updateItem(preset)}
        />
      )}
    </div>
  );
}

function MaterialCard({
  item,
  onConfigure,
}: {
  item: MaterialPresetListItem;
  onConfigure: (key: string) => void;
}) {
  const state = item.installState;
  const uses = item.usosRecomendados
    .slice(0, 4)
    .map((use) => bibliotecaUses[use])
    .filter(Boolean);
  const aliases = item.aliasDisponibles.slice(1, 4);
  return (
    <button
      className={`${s.card} ${state.visibleName ? "has-banner" : ""}`}
      onClick={() => onConfigure(item.canonicalKey)}
      type="button"
    >
      {state.visibleName && (
        <div className={s.visibleBanner}>
          <span className="ic">
            <BIco.Check />
          </span>
          <span>Instalado como</span>
          <span className="nm">{state.visibleName}</span>
        </div>
      )}
      <div className={s.cardHead}>
        <div className={s.cardIcon}>
          <MaterialIcon kind={item.iconKind} size={32} />
        </div>
        <div className={s.cardMeta}>
          <div className={s.cardCanonical}>
            <span className="nm">{item.nombreCanonico}</span>
          </div>
          <div className={s.cardFam}>
            {bibliotecaFamilias[item.subfamilia]?.nm ?? item.subfamilia}
          </div>
        </div>
        <span className={`${s.status} ${state.status}`}>
          <span className="d" />
          {statusLabel(state)}
        </span>
      </div>
      <div className={s.cardDesc}>{item.descripcionCorta}</div>
      {aliases.length > 0 && (
        <div className={s.cardAliases}>
          <span className="lbl">Alias</span>
          {aliases.map((alias, index) => (
            <React.Fragment key={alias}>
              <span className="alias">{alias}</span>
              {index < aliases.length - 1 && <span className="sep">·</span>}
            </React.Fragment>
          ))}
        </div>
      )}
      <div className={s.cardUses}>
        {uses.map((use) => (
          <span key={use.code} className={s.use}>
            {use.code}
          </span>
        ))}
      </div>
      <div className={s.cardFoot}>
        <span className={s.cardCounts}>
          <strong>{item.variantes.length}</strong> variantes sugeridas
        </span>
        <span className={s.cardCta}>
          Configurar instalación{" "}
          <span className="arr">
            <BIco.Arrow />
          </span>
        </span>
      </div>
    </button>
  );
}

function Wizard({
  item,
  onClose,
  onInstalled,
}: {
  item: MaterialPresetListItem;
  onClose: () => void;
  onInstalled: (preset: MaterialPresetListItem) => void;
}) {
  const router = useRouter();
  const [step, setStep] = React.useState(0);
  const [saving, setSaving] = React.useState(false);
  // El mismo material canónico puede instalarse varias veces como copias
  // separadas (ej: la misma tinta CMYK con precios distintos por máquina).
  const yaInstalado = item.installState.status !== "not-installed";
  const puedeCompletar = item.installState.status === "partial";
  const [installMode, setInstallMode] = React.useState<InstallMode>(
    puedeCompletar ? "completar" : "separado",
  );
  const separado = installMode === "separado";
  const [draft, setDraft] = React.useState<Draft>(() => ({
    visibleName: puedeCompletar
      ? (item.installState.visibleName ??
        item.aliasDisponibles[1] ??
        item.aliasDisponibles[0] ??
        item.nombreCanonico)
      : (item.aliasDisponibles[1] ??
        item.aliasDisponibles[0] ??
        item.nombreCanonico),
    codigo: item.canonicalKey,
    descripcion: item.descripcionCorta,
    selectedVariantIds: new Set(
      item.variantes
        .filter(
          (variant) =>
            variant.recomendada && (!puedeCompletar || !variant.instalada),
        )
        .map((variant) => variant.id),
    ),
    lastMateriaPrimaId: item.installState.materiaPrimaId,
  }));
  // Al cambiar de modo reseteamos la selección a las recomendadas disponibles
  // en ese modo (en "separado" todas cuentan; en "completar" solo las faltantes).
  React.useEffect(() => {
    setDraft((prev) => ({
      ...prev,
      selectedVariantIds: new Set(
        item.variantes
          .filter(
            (variant) =>
              variant.recomendada && (separado || !variant.instalada),
          )
          .map((variant) => variant.id),
      ),
    }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [installMode]);
  const selectedVariants = item.variantes.filter(
    (variant) =>
      draft.selectedVariantIds.has(variant.id) &&
      (separado || !variant.instalada),
  );

  const install = async () => {
    const payload: InstallMaterialPresetPayload = {
      visibleName: draft.visibleName,
      codigo: draft.codigo,
      descripcion: draft.descripcion,
      aliasUsado: draft.visibleName,
      variantPresetIds: selectedVariants.map((variant) => variant.id),
      customVariants: [],
      modoDuplicado: separado ? "crear_separado" : "agregar_faltantes",
    };
    setSaving(true);
    try {
      const response = await instalarBibliotecaMateriaPrima(
        item.canonicalKey,
        payload,
      );
      setDraft((prev) => ({
        ...prev,
        lastMateriaPrimaId: response.materiaPrimaId,
      }));
      onInstalled(response.preset);
      toast.success("Materia prima instalada.");
      setStep(3);
      router.refresh();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "No se pudo instalar.",
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <div className={s.backdrop} onClick={onClose} />
      <div className={s.sheet} role="dialog" aria-modal="true">
        <div className={s.sheetHead}>
          <div className="icon-box">
            <MaterialIcon kind={item.iconKind} size={28} />
          </div>
          <div className="body">
            <div className="eyebrow">
              <BIco.Library />
              <span>Biblioteca</span>
              <span>›</span>
              <span>{item.canonicalKey}</span>
            </div>
            <h2>Instalar {item.nombreCanonico}</h2>
            <div className="sub">
              Configurá cómo se llamará en tu empresa y qué variantes querés
              tener disponibles para cotizar.
            </div>
          </div>
          <button
            className={s.sheetClose}
            onClick={onClose}
            aria-label="Cerrar"
            type="button"
          >
            <BIco.X />
          </button>
        </div>
        <Stepper current={step} onJump={setStep} />
        <div className={s.sheetBody}>
          {step === 0 && (
            <StepNombre
              item={item}
              draft={draft}
              setDraft={setDraft}
              installMode={installMode}
              setInstallMode={setInstallMode}
              puedeCompletar={puedeCompletar}
              yaInstalado={yaInstalado}
            />
          )}
          {step === 1 && (
            <StepVariantes
              item={item}
              draft={draft}
              setDraft={setDraft}
              separado={separado}
            />
          )}
          {step === 2 && (
            <StepPreview
              item={item}
              draft={draft}
              selectedVariants={selectedVariants}
              separado={separado}
            />
          )}
          {step === 3 && (
            <StepListo item={item} draft={draft} onClose={onClose} />
          )}
        </div>
        {step < 3 && (
          <div className={s.sheetFoot}>
            <button className={`${s.btn} ghost`} onClick={onClose} type="button">
              Cancelar
            </button>
            <div className="spacer" />
            <span className="step-count">
              {step === 1 && (
                <>
                  <strong>{selectedVariants.length}</strong> variantes
                  seleccionadas
                </>
              )}
              {step === 0 && draft.visibleName && (
                <>
                  Nombre: <strong>{draft.visibleName}</strong>
                </>
              )}
              {step === 2 && (
                <>
                  <strong>{selectedVariants.length}</strong> ítems a crear
                </>
              )}
            </span>
            {step > 0 && (
              <button
                className={s.btn}
                onClick={() => setStep((s) => Math.max(0, s - 1))}
                type="button"
              >
                <BIco.ChevLeft /> Atrás
              </button>
            )}
            <button
              className={`${s.btn} primary`}
              onClick={
                step === 2 ? install : () => setStep((s) => Math.min(2, s + 1))
              }
              disabled={
                saving ||
                (step === 0 && !draft.visibleName.trim()) ||
                (step === 2 && selectedVariants.length === 0)
              }
              type="button"
            >
              {step === 2
                ? saving
                  ? "Instalando..."
                  : "Instalar materia prima"
                : "Siguiente"}
              {step < 2 && <BIco.ChevRight />}
            </button>
          </div>
        )}
      </div>
    </>
  );
}

function Stepper({
  current,
  onJump,
}: {
  current: number;
  onJump: (step: number) => void;
}) {
  return (
    <div className={s.stepper}>
      {steps.map((step, index) => {
        const state =
          index < current ? "done" : index === current ? "current" : "pending";
        return (
          <React.Fragment key={step.key}>
            <button
              className={`${s.step} ${state}`}
              onClick={() => onJump(index)}
              type="button"
            >
              <span className="ix">
                {state === "done" ? <BIco.Check /> : index + 1}
              </span>
              <span className="lbl">
                {step.nm}
                <span className="sm">{step.sub}</span>
              </span>
            </button>
            {index < steps.length - 1 && (
              <span
                className={`${s.stepRule} ${state === "done" ? "done" : ""}`}
              />
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
}

function CanonicalRecap({ item }: { item: MaterialPresetListItem }) {
  return (
    <div className={s.canonicalRecap}>
      <span className="ic">
        <BIco.Library />
      </span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div className="lbl">Nombre canónico SaaS</div>
        <div className="v">{item.nombreCanonico}</div>
        <div className="meta">
          {item.canonicalKey} · {item.templateId}
        </div>
      </div>
      <span className={s.canonicalPill}>
        <span className="ic">
          <BIco.Sparkles />
        </span>
        Biblioteca
      </span>
    </div>
  );
}

function StepNombre({
  item,
  draft,
  setDraft,
  installMode,
  setInstallMode,
  puedeCompletar,
  yaInstalado,
}: {
  item: MaterialPresetListItem;
  draft: Draft;
  setDraft: React.Dispatch<React.SetStateAction<Draft>>;
  installMode: InstallMode;
  setInstallMode: React.Dispatch<React.SetStateAction<InstallMode>>;
  puedeCompletar: boolean;
  yaInstalado: boolean;
}) {
  const customMode = !item.aliasDisponibles.includes(draft.visibleName);
  return (
    <>
      <div className={s.section}>
        <CanonicalRecap item={item} />
      </div>
      {yaInstalado && (
        <div className={s.section}>
          <div className={s.sectionHead}>
            <div className="ttl">Ya tenés este material instalado</div>
            <div className="sub">
              {item.installState.visibleName
                ? `Existe como «${item.installState.visibleName}». `
                : ""}
              Elegí qué querés hacer.
            </div>
          </div>
          <div className={s.modeGrid}>
            {puedeCompletar && (
              <button
                type="button"
                className={`${s.mode} ${installMode === "completar" ? "on" : ""}`}
                onClick={() => setInstallMode("completar")}
              >
                <span className={s.modeTitle}>Completar el existente</span>
                <span className={s.modeSub}>
                  Agrega las variantes que falten a la materia prima ya
                  instalada.
                </span>
              </button>
            )}
            <button
              type="button"
              className={`${s.mode} ${installMode === "separado" ? "on" : ""}`}
              onClick={() => setInstallMode("separado")}
            >
              <span className={s.modeTitle}>Instalar copia separada</span>
              <span className={s.modeSub}>
                Crea otra materia prima independiente (otro precio, proveedor o
                máquina). El código y los SKU se ajustan para no repetirse.
              </span>
            </button>
          </div>
        </div>
      )}
      <div className={s.section}>
        <div className={s.sectionHead}>
          <div className="ttl">Nombre visible en tu empresa</div>
          <div className="sub">
            Elegí cómo llama tu equipo a este material. Será el nombre que
            aparezca en cotizaciones, órdenes y consumos.
          </div>
        </div>
        <div className={s.field} style={{ marginBottom: 14 }}>
          <input
            className={`${s.input} lg`}
            value={draft.visibleName}
            onChange={(event) =>
              setDraft((d) => ({ ...d, visibleName: event.target.value }))
            }
            placeholder="Nombre visible..."
          />
        </div>
        <div className={s.field}>
          <label>O elegí un alias común</label>
          <div className={s.aliasGrid}>
            {item.aliasDisponibles.map((alias) => (
              <button
                key={alias}
                className={`${s.alias} ${!customMode && draft.visibleName === alias ? "on" : ""}`}
                onClick={() => setDraft((d) => ({ ...d, visibleName: alias }))}
                type="button"
              >
                {alias}
              </button>
            ))}
            <button
              className={`${s.alias} custom ${customMode ? "on" : ""}`}
              onClick={() => setDraft((d) => ({ ...d, visibleName: "" }))}
              type="button"
            >
              {customMode ? "Personalizado" : "+ Personalizado"}
            </button>
          </div>
        </div>
        <div className={s.mapping}>
          <div className="col">
            <div className="k">
              <BIco.Library /> Canónico SaaS
            </div>
            <div className="v">{item.nombreCanonico}</div>
            <div className="meta">{item.canonicalKey}</div>
          </div>
          <div className="arrow">
            <BIco.Arrow />
          </div>
          <div className="col">
            <div className="k">
              <BIco.Cube /> Visible en tu empresa
            </div>
            <div className="v">{draft.visibleName || "—"}</div>
            <div className="meta">se mostrará en inventario</div>
          </div>
        </div>
        <div className={s.fieldHelp} style={{ marginTop: 10 }}>
          <span className="ic">
            <BIco.Info />
          </span>
          El sistema conservará <strong>{item.nombreCanonico}</strong> como
          nombre canónico para reportes cross-tenant y compatibilidad técnica.
        </div>
      </div>
      <div className={s.section}>
        <div className={s.sectionHead}>
          <div className="ttl">Código y descripción</div>
          <div className="sub">
            Opcional. Se autogeneran a partir del canónico.
          </div>
        </div>
        <div className={s.twoCols}>
          <div className={s.field}>
            <label>
              Código <span className="opt">interno</span>
            </label>
            <input
              className={`${s.input} mono`}
              value={draft.codigo}
              onChange={(event) =>
                setDraft((d) => ({ ...d, codigo: event.target.value }))
              }
            />
          </div>
          <div className={s.field}>
            <label>
              Descripción <span className="opt">corta</span>
            </label>
            <input
              className={s.input}
              value={draft.descripcion}
              onChange={(event) =>
                setDraft((d) => ({ ...d, descripcion: event.target.value }))
              }
            />
          </div>
        </div>
      </div>
    </>
  );
}

function StepVariantes({
  item,
  draft,
  setDraft,
  separado,
}: {
  item: MaterialPresetListItem;
  draft: Draft;
  setDraft: React.Dispatch<React.SetStateAction<Draft>>;
  separado: boolean;
}) {
  const groups = React.useMemo(() => {
    const map = new Map<string, MaterialPresetVariant[]>();
    for (const variant of item.variantes) {
      map.set(variant.formato, [...(map.get(variant.formato) ?? []), variant]);
    }
    return Array.from(map.entries());
  }, [item.variantes]);
  // En una copia separada ninguna variante está "ya instalada": es un material nuevo.
  const disponible = (variant: MaterialPresetVariant) =>
    separado || !variant.instalada;
  const selectedCount = item.variantes.filter(
    (variant) => draft.selectedVariantIds.has(variant.id) && disponible(variant),
  ).length;
  const totalAvailable = item.variantes.filter(disponible).length;
  const toggle = (variant: MaterialPresetVariant) => {
    if (!disponible(variant)) return;
    setDraft((draft) => {
      const next = new Set(draft.selectedVariantIds);
      if (next.has(variant.id)) next.delete(variant.id);
      else next.add(variant.id);
      return { ...draft, selectedVariantIds: next };
    });
  };
  const setAll = (selected: boolean) => {
    setDraft((draft) => ({
      ...draft,
      selectedVariantIds: new Set(
        selected
          ? item.variantes.filter(disponible).map((variant) => variant.id)
          : [],
      ),
    }));
  };
  const setRecommended = () => {
    setDraft((draft) => ({
      ...draft,
      selectedVariantIds: new Set(
        item.variantes
          .filter((variant) => variant.recomendada && disponible(variant))
          .map((variant) => variant.id),
      ),
    }));
  };
  return (
    <>
      <div className={s.section}>
        <CanonicalRecap item={item} />
      </div>
      <div className={s.section}>
        <div className={s.sectionHead}>
          <div className="ttl">Variantes a instalar</div>
          <div className="sub">{variantHelpText(item)}</div>
        </div>
        <div className={s.variantActions}>
          <button className="quick" onClick={setRecommended} type="button">
            Seleccionar comunes
          </button>
          <button className="quick" onClick={() => setAll(true)} type="button">
            Todas
          </button>
          <button className="quick" onClick={() => setAll(false)} type="button">
            Limpiar
          </button>
          <div className="sum">
            <strong>{selectedCount}</strong> de {totalAvailable} seleccionadas
          </div>
        </div>
        {groups.map(([format, variants]) => (
          <div key={format} className={s.variantGroup}>
            <div className={s.variantGroupHead}>
              <span className="nm">Formato {format}</span>
              <span className="ct">{variants.length} variantes</span>
            </div>
            {variants.map((variant) => {
              // En copia separada la variante instalada en otra materia prima
              // no cuenta como bloqueada: es un material nuevo.
              const bloqueada = variant.instalada && !separado;
              const checked =
                bloqueada || draft.selectedVariantIds.has(variant.id);
              return (
                <button
                  key={variant.id}
                  className={`${s.variant} ${checked ? "checked" : ""} ${bloqueada ? "installed" : ""}`}
                  onClick={() => toggle(variant)}
                  type="button"
                >
                  <span className={s.check}>{checked && <BIco.Check />}</span>
                  <div className={s.variantInfo}>
                    <div className="nm">
                      {variantDescriptor(item, variant)}
                      {variant.recomendada && !bloqueada && (
                        <span className="rec">recom.</span>
                      )}
                    </div>
                    <div className="sub">
                      SKU sugerido · {variant.skuSugerido}
                    </div>
                  </div>
                  {bloqueada ? (
                    <span className={s.variantInstalledTag}>
                      ya instalada
                    </span>
                  ) : (
                    <span style={{ width: 70 }} />
                  )}
                  <span className={s.variantEdit}>
                    <BIco.Edit />
                  </span>
                </button>
              );
            })}
          </div>
        ))}
        <button
          className={s.variantAdd}
          disabled
          title="Las variantes personalizadas se agregan desde la ficha de materia prima una vez instalada."
          type="button"
        >
          <BIco.Plus />
          Agregar variante personalizada
        </button>
        {item.advertencias.length > 0 && (
          <div className={s.warning} style={{ marginTop: 14 }}>
            <span className="ic">
              <BIco.Warn />
            </span>
            <div>
              <strong>Advertencias del material</strong>
              <ul>
                {item.advertencias.map((warning) => (
                  <li key={warning}>{warning}</li>
                ))}
              </ul>
            </div>
          </div>
        )}
      </div>
    </>
  );
}

function StepPreview({
  item,
  draft,
  selectedVariants,
  separado,
}: {
  item: MaterialPresetListItem;
  draft: Draft;
  selectedVariants: MaterialPresetVariant[];
  separado: boolean;
}) {
  return (
    <div className={s.section}>
      <div className={s.sectionHead}>
        <div className="ttl">Revisá lo que se va a crear</div>
        <div className="sub">
          Verificá que la información sea correcta antes de instalar.
        </div>
      </div>
      <div className={s.previewCard}>
        <div className="head">
          <div className="ic-box">
            <MaterialIcon kind={item.iconKind} size={28} />
          </div>
          <div style={{ flex: 1 }}>
            <h3>{draft.visibleName || "—"}</h3>
            <div className={s.previewMeta}>
              {draft.codigo} · {selectedVariants.length} variantes nuevas
            </div>
          </div>
          <span className={s.canonicalPill}>
            <span className="ic">
              <BIco.Sparkles />
            </span>
            {item.canonicalKey}
          </span>
        </div>
        <div className={s.previewRow}>
          <span className="k">Nombre visible</span>
          <span className="v">{draft.visibleName}</span>
        </div>
        <div className={s.previewRow}>
          <span className="k">Nombre canónico</span>
          <span className="v">
            {item.nombreCanonico}
            <span className="muted">conservado para reportes</span>
          </span>
        </div>
        <div className={s.previewRow}>
          <span className="k">Familia</span>
          <span className="v muted">{familyLine(item)}</span>
        </div>
        <div className={s.previewRow}>
          <span className="k">Template</span>
          <span className="v mono">{item.templateId}</span>
        </div>
      </div>
      <div className={s.previewCard}>
        <div className="head">
          <div style={{ flex: 1 }}>
            <h3 className={s.previewTitleSmall}>Variantes a instalar</h3>
            <div className={s.previewMeta}>
              {selectedVariants.length} nuevas
            </div>
          </div>
        </div>
        <div className={`bm-preview-list`}>
          {selectedVariants.map((variant) => (
            <div key={variant.id} className={s.previewItem}>
              <span className="ic">
                <BIco.CheckCircle />
              </span>
              <span className="nm">
                {variant.formato} · {variantDescriptor(item, variant)}
              </span>
              <span className="sku">{variant.skuSugerido}</span>
            </div>
          ))}
        </div>
      </div>
      {separado && item.installState.visibleName && (
        <div className={s.dup}>
          <div className="head">
            <span>
              <BIco.Sparkles />
            </span>
            <div>
              <strong>
                Se creará una materia prima separada de{" "}
                {item.installState.visibleName}.
              </strong>
              <div>
                Comparten el material canónico {item.nombreCanonico}, pero esta
                copia tiene su propio código, SKU y precios. Los SKU se ajustan
                con un sufijo para no repetirse.
              </div>
            </div>
          </div>
        </div>
      )}
      {!separado && item.installState.status === "partial" && (
        <div className={s.dup}>
          <div className="head">
            <span>
              <BIco.Warn />
            </span>
            <div>
              <strong>
                Ya existe una materia prima vinculada a {item.nombreCanonico}.
              </strong>
              <div>
                Se agregarán sólo las variantes faltantes a{" "}
                <strong>{item.installState.visibleName}</strong>.
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function StepListo({
  item,
  draft,
  onClose,
}: {
  item: MaterialPresetListItem;
  draft: Draft;
  onClose: () => void;
}) {
  const router = useRouter();
  return (
    <div className={s.success}>
      <div className={s.successIco}>
        <BIco.CheckCircleFill />
      </div>
      <h2>Se instaló {draft.visibleName}</h2>
      <div className="sub">
        Tu equipo ya puede usar este material en cotizaciones y órdenes de
        trabajo. El sistema mantiene <strong>{item.nombreCanonico}</strong> como
        nombre canónico para reportes.
      </div>
      <div className={s.successSummary}>
        <div className={s.successStat}>
          <div className="v">
            {item.templateId.replace("_v1", "").replaceAll("_", " ")}
          </div>
          <div className="k">Template aplicado</div>
        </div>
        <div className={s.successStat}>
          <div className="v">1</div>
          <div className="k">Materia prima</div>
        </div>
      </div>
      <div className={s.successActions}>
        <button
          className={`${s.btn} primary lg`}
          onClick={() =>
            draft.lastMateriaPrimaId &&
            router.push(
              `/inventario/materias-primas/${draft.lastMateriaPrimaId}`,
            )
          }
          type="button"
        >
          Ver materia prima
        </button>
        <button className={`${s.btn} lg`} onClick={onClose} type="button">
          Instalar otro material
        </button>
        <button
          className={`${s.btn} ghost lg`}
          onClick={() => router.push("/inventario/materias-primas")}
          type="button"
        >
          Ir a inventario
        </button>
      </div>
    </div>
  );
}

function familyLine(item: MaterialPresetListItem) {
  return `${humanizeEnum(item.familia)} · ${bibliotecaFamilias[item.subfamilia]?.nm ?? humanizeEnum(item.subfamilia)}`;
}

function familySectionDescription(familyKey: string) {
  if (familyKey === "sustrato_rigido") {
    return "Placas y tableros para señalética, POP, corte y mecanizado.";
  }
  if (familyKey === "sustrato_hoja") {
    return "Papeles, cartulinas y pliegos para impresión por hoja.";
  }
  if (familyKey === "sustrato_rollo_flexible") {
    return "Vinilos, lonas, films y soportes flexibles para gran formato.";
  }
  if (familyKey === "tinta_impresion") {
    return "Tintas por tecnología, canal de color y presentación para equipos de impresión.";
  }
  if (familyKey === "toner") {
    return "Tóner por color, rendimiento y equipo compatible para impresión láser y producción.";
  }
  if (familyKey === "film_transferencia") {
    return "Films para transferencia DTF, DTF UV, sublimación y procesos similares.";
  }
  if (familyKey === "laminado_film") {
    return "Films en rollo para termolaminado, laminado gráfico y acabados de protección.";
  }
  if (familyKey === "laminado_pouch") {
    return "Sobres pouch para plastificado de credenciales, documentos, láminas y piezas sueltas.";
  }
  if (familyKey === "iman_ceramico_flexible") {
    return "Imanes flexibles, ferrita/cerámicos y neodimio para souvenirs, vehículos, POP y fijación.";
  }
  return "Materiales canónicos disponibles para instalar en inventario.";
}

function variantHelpText(item: MaterialPresetListItem) {
  if (item.templateId === "sustrato_hoja_v1") {
    return "Seleccioná los formatos, gramajes y acabados que realmente usás.";
  }
  if (item.templateId === "sustrato_rollo_flexible_v1") {
    return "Seleccioná los anchos de rollo y acabados que realmente usás.";
  }
  if (item.templateId === "tinta_impresion_v1") {
    return "Seleccioná los colores y presentaciones que realmente usás.";
  }
  if (item.templateId === "toner_v1") {
    return "Seleccioná los colores, rendimientos y compatibilidades que realmente usás.";
  }
  if (item.templateId === "film_transferencia_v1") {
    return "Seleccioná los anchos de film que realmente usás.";
  }
  if (item.templateId === "laminado_film_v1") {
    return "Seleccioná los anchos, largos, micrones y acabados de rollo que realmente usás.";
  }
  if (item.templateId === "laminado_pouch_v1") {
    return "Seleccioná los formatos y espesores de pouch que realmente usás.";
  }
  if (item.templateId === "iman_flexible_rollo_v1") {
    return "Seleccioná los anchos, largos y espesores de rollo que realmente usás.";
  }
  if (item.templateId === "iman_redondo_v1") {
    return "Seleccioná los diámetros, espesores y packs de imanes redondos que realmente usás.";
  }
  return "Seleccioná las medidas, espesores y colores que realmente usás.";
}

function variantDescriptor(
  item: MaterialPresetListItem,
  variant: MaterialPresetVariant,
) {
  if (item.templateId === "sustrato_hoja_v1") {
    const attrs = variant.atributosVariante;
    const gramaje =
      variant.gramaje ??
      numberAttr(attrs, "gramaje") ??
      numberAttr(attrs, "gramajeGr");
    const material = stringAttr(attrs, "material") ?? item.nombreCanonico;
    const acabado = stringAttr(attrs, "acabado");
    const color = stringAttr(attrs, "color") ?? variant.color;
    return [
      gramaje ? `${formatNumber(gramaje)} g/m²` : null,
      material,
      acabado,
      color && color !== "Blanco" ? color : null,
    ]
      .filter(Boolean)
      .join(" · ");
  }
  if (item.templateId === "sustrato_rollo_flexible_v1") {
    const attrs = variant.atributosVariante;
    const ancho = numberAttr(attrs, "ancho");
    const largo = numberAttr(attrs, "largo");
    const acabado = stringAttr(attrs, "acabado");
    return [
      ancho ? `${formatNumber(ancho)} m ancho` : null,
      largo ? `${formatNumber(largo)} m largo` : null,
      acabado,
    ]
      .filter(Boolean)
      .join(" · ");
  }
  if (item.templateId === "tinta_impresion_v1") {
    const attrs = variant.atributosVariante;
    const color = stringAttr(attrs, "color") ?? variant.color;
    const canal = stringAttr(attrs, "canal");
    const volumen =
      numberAttr(attrs, "volumenPresentacion") ??
      numberAttr(attrs, "volumenMl");
    const equipo = stringAttr(attrs, "equipoCompatible");
    return [
      color,
      canal ? canal.toUpperCase() : null,
      volumen ? `${formatNumber(volumen)} ml` : null,
      equipo && equipo !== "Genérico" ? equipo : null,
    ]
      .filter(Boolean)
      .join(" · ");
  }
  if (item.templateId === "toner_v1") {
    const attrs = variant.atributosVariante;
    const color = stringAttr(attrs, "color") ?? variant.color;
    const canal = stringAttr(attrs, "canal");
    const rendimiento = numberAttr(attrs, "rendimientoPaginasIso");
    const equipo = stringAttr(attrs, "equipoCompatible");
    const presentacion = stringAttr(attrs, "presentacion");
    return [
      color,
      canal ? canal.toUpperCase() : null,
      rendimiento ? `${formatNumber(rendimiento)} págs. ISO` : null,
      presentacion,
      equipo && equipo !== "Genérico" ? equipo : null,
    ]
      .filter(Boolean)
      .join(" · ");
  }
  if (item.templateId === "film_transferencia_v1") {
    const attrs = variant.atributosVariante;
    const ancho = numberAttr(attrs, "ancho");
    const largo = numberAttr(attrs, "largo");
    const tecnologia = stringAttr(attrs, "tecnologiaCompatible");
    return [
      ancho ? `${formatNumber(ancho)} mm ancho` : null,
      largo ? `${formatNumber(largo)} m largo` : null,
      tecnologia ? humanizeEnum(tecnologia) : null,
    ]
      .filter(Boolean)
      .join(" · ");
  }
  if (item.templateId === "laminado_film_v1") {
    const attrs = variant.atributosVariante;
    const ancho = numberAttr(attrs, "ancho");
    const largo = numberAttr(attrs, "largo");
    const micrones = numberAttr(attrs, "micrones");
    const acabado = stringAttr(attrs, "acabado");
    return [
      ancho ? `${formatNumber(ancho)} mm ancho` : null,
      largo ? `${formatNumber(largo)} m largo` : null,
      micrones ? `${formatNumber(micrones)} mic` : null,
      acabado,
    ]
      .filter(Boolean)
      .join(" · ");
  }
  if (item.templateId === "laminado_pouch_v1") {
    const attrs = variant.atributosVariante;
    const formato = stringAttr(attrs, "formato");
    const micrones = numberAttr(attrs, "micrones");
    const acabado = stringAttr(attrs, "acabado");
    const unidadesPorPack = numberAttr(attrs, "unidadesPorPack");
    return [
      formato,
      micrones ? `${formatNumber(micrones)} mic` : null,
      acabado,
      unidadesPorPack ? `pack x ${formatNumber(unidadesPorPack)}` : null,
    ]
      .filter(Boolean)
      .join(" · ");
  }
  if (item.templateId === "iman_flexible_rollo_v1") {
    const attrs = variant.atributosVariante;
    const ancho = numberAttr(attrs, "ancho");
    const largo = numberAttr(attrs, "largo");
    const espesor = numberAttr(attrs, "espesor");
    return [
      ancho ? `${formatNumber(ancho)} mm ancho` : null,
      largo ? `${formatNumber(largo)} m largo` : null,
      espesor ? `${formatNumber(espesor)} mm espesor` : null,
    ]
      .filter(Boolean)
      .join(" · ");
  }
  if (item.templateId === "iman_redondo_v1") {
    const attrs = variant.atributosVariante;
    const diametro = numberAttr(attrs, "diametro");
    const espesor = numberAttr(attrs, "espesor");
    const grado = stringAttr(attrs, "grado");
    const adhesivo = booleanAttr(attrs, "adhesivo");
    const unidadesPorPack = numberAttr(attrs, "unidadesPorPack");
    return [
      diametro ? `${formatNumber(diametro)} mm diámetro` : null,
      espesor ? `${formatNumber(espesor)} mm espesor` : null,
      grado,
      adhesivo == null ? null : adhesivo ? "adhesivo" : "sin adhesivo",
      unidadesPorPack ? `pack x ${formatNumber(unidadesPorPack)}` : null,
    ]
      .filter(Boolean)
      .join(" · ");
  }
  if (item.templateId === "portabanner_estructura_v1") {
    const attrs = variant.atributosVariante;
    const tipo = stringAttr(attrs, "tipoPortabanner");
    const linea = stringAttr(attrs, "linea");
    return [tipo, linea && linea !== "Estándar" ? `línea ${linea.toLowerCase()}` : null]
      .filter(Boolean)
      .join(" · ");
  }
  return [
    variant.espesor ? `${formatNumber(variant.espesor)} mm` : null,
    variant.color,
  ]
    .filter(Boolean)
    .join(" · ");
}

function numberAttr(attrs: Record<string, unknown>, key: string) {
  const value = attrs[key];
  if (typeof value === "number") return value;
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function stringAttr(attrs: Record<string, unknown>, key: string) {
  const value = attrs[key];
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function booleanAttr(attrs: Record<string, unknown>, key: string) {
  const value = attrs[key];
  if (typeof value === "boolean") return value;
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (["true", "si", "sí", "1"].includes(normalized)) return true;
    if (["false", "no", "0"].includes(normalized)) return false;
  }
  return null;
}

function formatNumber(value: number) {
  return Number.isInteger(value)
    ? String(value)
    : String(value).replace(".", ",");
}

function humanizeEnum(value: string) {
  return value
    .split("_")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function statusLabel(state: MaterialPresetListItem["installState"]) {
  if (state.status === "not-installed") return "No instalado";
  if (state.status === "installed") return "Instalado";
  return `Parcial · ${state.installedCount}/${state.totalSuggested}`;
}
