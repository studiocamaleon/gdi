type GdiLoginArtProps = {
  className?: string;
  animated?: boolean;
};

export function GdiLoginArt({
  className,
  animated = false,
}: GdiLoginArtProps) {
  return (
    <svg
      viewBox="0 0 1600 1600"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      className={className}
    >
      <defs>
        <linearGradient id="bg" x1="140" y1="80" x2="1460" y2="1520" gradientUnits="userSpaceOnUse">
          <stop stopColor="#130D29" />
          <stop offset="0.42" stopColor="#1D2951" />
          <stop offset="1" stopColor="#090C1A" />
        </linearGradient>
        <linearGradient id="warm" x1="210" y1="184" x2="1340" y2="1288" gradientUnits="userSpaceOnUse">
          <stop stopColor="#FF9C2B" />
          <stop offset="0.45" stopColor="#FF4F4F" />
          <stop offset="1" stopColor="#F9D65C" />
        </linearGradient>
        <linearGradient id="cool" x1="1010" y1="180" x2="530" y2="1370" gradientUnits="userSpaceOnUse">
          <stop stopColor="#4E5CFF" />
          <stop offset="0.5" stopColor="#14B8A6" />
          <stop offset="1" stopColor="#43D9FF" />
        </linearGradient>
        <radialGradient
          id="glow"
          cx="0"
          cy="0"
          r="1"
          gradientUnits="userSpaceOnUse"
          gradientTransform="translate(818 672) rotate(90) scale(740)"
        >
          <stop stopColor="#FFF0B8" stopOpacity="0.84" />
          <stop offset="0.3" stopColor="#FFB133" stopOpacity="0.5" />
          <stop offset="1" stopColor="#FFB133" stopOpacity="0" />
        </radialGradient>
        <radialGradient
          id="cyan"
          cx="0"
          cy="0"
          r="1"
          gradientUnits="userSpaceOnUse"
          gradientTransform="translate(1180 1060) rotate(90) scale(520)"
        >
          <stop stopColor="#6BE6FF" stopOpacity="0.72" />
          <stop offset="1" stopColor="#6BE6FF" stopOpacity="0" />
        </radialGradient>
        <pattern id="dots" x="0" y="0" width="22" height="22" patternUnits="userSpaceOnUse">
          <circle cx="4" cy="4" r="2.1" fill="#FFF6D5" fillOpacity="0.42" />
        </pattern>
        <pattern id="micro" x="0" y="0" width="18" height="18" patternUnits="userSpaceOnUse">
          <rect width="18" height="18" fill="none" />
          <path d="M0 9H18M9 0V18" stroke="#FFFFFF" strokeOpacity="0.05" />
        </pattern>
        <filter
          id="blur"
          x="-120"
          y="-120"
          width="1840"
          height="1840"
          filterUnits="userSpaceOnUse"
          colorInterpolationFilters="sRGB"
        >
          <feGaussianBlur stdDeviation="40" />
        </filter>
      </defs>

      <rect width="1600" height="1600" fill="url(#bg)" />
      <rect width="1600" height="1600" fill="url(#micro)" />

      <g>
        <circle cx="818" cy="672" r="740" fill="url(#glow)" />
        {animated ? (
          <>
            <animateTransform
              attributeName="transform"
              type="translate"
              values="0 0; -42 -30; 0 0"
              dur="14s"
              repeatCount="indefinite"
            />
            <animate
              attributeName="opacity"
              values="0.82;1;0.82"
              dur="14s"
              repeatCount="indefinite"
            />
            <animateTransform
              additive="sum"
              attributeName="transform"
              type="scale"
              values="1 1; 1.08 1.08; 1 1"
              dur="14s"
              repeatCount="indefinite"
            />
          </>
        ) : null}
      </g>

      <g>
        <circle cx="1180" cy="1060" r="520" fill="url(#cyan)" />
        {animated ? (
          <animateTransform
            attributeName="transform"
            type="translate"
            values="0 0; 48 36; 0 0"
            dur="16s"
            repeatCount="indefinite"
          />
        ) : null}
      </g>

      <g opacity="0.9">
        <path
          d="M196 1146C282 874 506 702 812 634C1070 576 1276 440 1398 156L1508 224C1376 546 1154 716 876 786C610 854 424 996 338 1212L196 1146Z"
          fill="url(#warm)"
        />
        <path
          d="M90 1188C260 846 548 572 928 516C1158 482 1328 368 1464 134L1600 262C1450 518 1230 676 962 720C638 776 390 1012 246 1326L90 1188Z"
          fill="url(#cool)"
          fillOpacity="0.82"
        />
        <path
          d="M396 1364C650 1022 916 950 1258 928C1378 920 1478 850 1556 760V1120C1496 1180 1410 1214 1302 1222C986 1244 778 1286 542 1518L396 1364Z"
          fill="#FFF3C6"
          fillOpacity="0.18"
        />
        {animated ? (
          <>
            <animateTransform
              attributeName="transform"
              type="translate"
              values="0 0; 28 -18; 0 0"
              dur="15s"
              repeatCount="indefinite"
            />
            <animateTransform
              additive="sum"
              attributeName="transform"
              type="rotate"
              values="0 800 800; 1.5 800 800; 0 800 800"
              dur="15s"
              repeatCount="indefinite"
            />
          </>
        ) : null}
      </g>

      <g filter="url(#blur)" opacity="0.7">
        <circle cx="376" cy="344" r="128" fill="#FF6E5B" />
        <circle cx="1158" cy="412" r="186" fill="#5D7CFF" />
        <circle cx="1286" cy="970" r="144" fill="#F8DC54" />
        {animated ? (
          <animateTransform
            attributeName="transform"
            type="translate"
            values="0 0; -24 28; 0 0"
            dur="13s"
            repeatCount="indefinite"
          />
        ) : null}
      </g>

      <g opacity="0.85">
        <circle cx="404" cy="444" r="188" fill="#FF5B4E" fillOpacity="0.4" />
        <circle cx="544" cy="424" r="188" fill="#F7D14B" fillOpacity="0.36" />
        <circle cx="474" cy="572" r="188" fill="#11B5C9" fillOpacity="0.34" />
        {animated ? (
          <animateTransform
            attributeName="transform"
            type="translate"
            values="0 0; 32 -26; 0 0"
            dur="11s"
            repeatCount="indefinite"
          />
        ) : null}
      </g>

      <g opacity="0.65">
        <path
          d="M1006 208C1096 208 1170 282 1170 372C1170 462 1096 536 1006 536C916 536 842 462 842 372C842 282 916 208 1006 208Z"
          stroke="#FFF4CB"
          strokeWidth="26"
        />
        <path
          d="M980 234C1070 234 1144 308 1144 398C1144 488 1070 562 980 562C890 562 816 488 816 398C816 308 890 234 980 234Z"
          stroke="#52D7EA"
          strokeWidth="16"
          strokeOpacity="0.7"
        />
        {animated ? (
          <animateTransform
            attributeName="transform"
            type="rotate"
            values="0 1006 372; 6 1006 372; 0 1006 372"
            dur="12s"
            repeatCount="indefinite"
          />
        ) : null}
      </g>

      <g>
        <rect x="152" y="1060" width="420" height="288" rx="34" fill="#0A1021" fillOpacity="0.52" stroke="#FFFFFF" strokeOpacity="0.1" />
        <rect x="192" y="1102" width="340" height="208" rx="18" fill="url(#dots)" fillOpacity="0.48" />
        <path d="M210 1258C286 1160 352 1122 454 1108" stroke="#FFB43A" strokeWidth="12" strokeLinecap="round" />
        <path d="M254 1288C342 1176 434 1142 562 1136" stroke="#50DDF0" strokeWidth="16" strokeLinecap="round" />
        {animated ? (
          <animateTransform
            attributeName="transform"
            type="translate"
            values="0 0; 0 -18; 0 0"
            dur="9s"
            repeatCount="indefinite"
          />
        ) : null}
      </g>

      <g opacity="0.72">
        <path d="M1216 1034L1306 1034" stroke="#FFFFFF" strokeOpacity="0.45" strokeWidth="10" strokeLinecap="round" />
        <path d="M1261 989L1261 1079" stroke="#FFFFFF" strokeOpacity="0.45" strokeWidth="10" strokeLinecap="round" />
        <circle cx="1261" cy="1034" r="44" stroke="#FFFFFF" strokeOpacity="0.4" strokeWidth="8" />
        {animated ? (
          <>
            <animateTransform
              attributeName="transform"
              type="scale"
              values="1;1.14;1"
              dur="6s"
              repeatCount="indefinite"
            />
            <animate
              attributeName="opacity"
              values="0.62;1;0.62"
              dur="6s"
              repeatCount="indefinite"
            />
          </>
        ) : null}
      </g>

      <g opacity="0.9">
        <rect x="1012" y="1218" width="360" height="190" rx="30" fill="#07111F" fillOpacity="0.5" stroke="#FFFFFF" strokeOpacity="0.12" />
        <path d="M1066 1290H1316" stroke="#FFFFFF" strokeOpacity="0.16" strokeWidth="2" />
        <path d="M1066 1336H1288" stroke="#FFFFFF" strokeOpacity="0.16" strokeWidth="2" />
        <path d="M1066 1382H1230" stroke="#FFFFFF" strokeOpacity="0.16" strokeWidth="2" />
        <circle cx="1114" cy="1120" r="88" fill="#F7D14B" fillOpacity="0.22" />
        <circle cx="1216" cy="1140" r="88" fill="#FF5B4E" fillOpacity="0.22" />
        <circle cx="1162" cy="1230" r="88" fill="#11B5C9" fillOpacity="0.22" />
        {animated ? (
          <animateTransform
            attributeName="transform"
            type="translate"
            values="0 0; 0 16; 0 0"
            dur="10s"
            repeatCount="indefinite"
          />
        ) : null}
      </g>
    </svg>
  );
}
