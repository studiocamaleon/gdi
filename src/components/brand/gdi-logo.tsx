type GdiLogoProps = {
  className?: string;
};

export function GdiLogo({ className }: GdiLogoProps) {
  return (
    <svg
      viewBox="0 0 677 369"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-label="GDI grafica digital inteligente"
      className={className}
    >
      <defs>
        <linearGradient id="gdi-cyan" x1="124" y1="57" x2="192" y2="153" gradientUnits="userSpaceOnUse">
          <stop stopColor="#28B8F2" />
          <stop offset="1" stopColor="#1295D0" />
        </linearGradient>
        <linearGradient
          id="gdi-magenta"
          x1="218"
          y1="56"
          x2="290"
          y2="151"
          gradientUnits="userSpaceOnUse"
        >
          <stop stopColor="#FF0D96" />
          <stop offset="1" stopColor="#DD007D" />
        </linearGradient>
        <linearGradient
          id="gdi-yellow"
          x1="123"
          y1="151"
          x2="189"
          y2="252"
          gradientUnits="userSpaceOnUse"
        >
          <stop stopColor="#FFF100" />
          <stop offset="1" stopColor="#F5DD00" />
        </linearGradient>
        <linearGradient id="gdi-black" x1="219" y1="153" x2="286" y2="247" gradientUnits="userSpaceOnUse">
          <stop stopColor="#1D1D1B" />
          <stop offset="1" stopColor="#000000" />
        </linearGradient>
        <filter
          id="soft-shadow"
          x="92"
          y="28"
          width="232"
          height="254"
          filterUnits="userSpaceOnUse"
          colorInterpolationFilters="sRGB"
        >
          <feDropShadow dx="0" dy="4" stdDeviation="10" floodColor="#000000" floodOpacity="0.18" />
        </filter>
      </defs>

      <g filter="url(#soft-shadow)">
        <circle cx="152.5" cy="96.5" r="49.5" fill="url(#gdi-cyan)" />
        <circle cx="247.5" cy="96.5" r="49.5" fill="url(#gdi-magenta)" />
        <circle cx="152.5" cy="191.5" r="49.5" fill="url(#gdi-yellow)" />
        <circle cx="247.5" cy="191.5" r="49.5" fill="url(#gdi-black)" />
      </g>

      <g>
        <circle cx="200" cy="96.5" r="16" fill="#5F5F78" fillOpacity="0.26" />
        <circle cx="200" cy="191.5" r="16" fill="#5F5F78" fillOpacity="0.26" />
        <circle cx="152.5" cy="144" r="16" fill="#5F5F78" fillOpacity="0.18" />
        <circle cx="247.5" cy="144" r="16" fill="#5F5F78" fillOpacity="0.18" />
        <circle cx="200" cy="144" r="20" fill="#4A4A57" fillOpacity="0.18" />
      </g>

      <g fill="#FAFAF8">
        <text
          x="332"
          y="161"
          fontFamily="Montserrat, Avenir Next, Poppins, Arial, sans-serif"
          fontSize="126"
          fontWeight="700"
          letterSpacing="0.5"
        >
          GDI
        </text>
        <text
          x="334"
          y="206"
          fontFamily="Montserrat, Avenir Next, Poppins, Arial, sans-serif"
          fontSize="40"
          fontWeight="500"
          letterSpacing="-0.2"
        >
          grafica digital
        </text>
        <text
          x="334"
          y="244"
          fontFamily="Montserrat, Avenir Next, Poppins, Arial, sans-serif"
          fontSize="40"
          fontWeight="500"
          letterSpacing="-0.2"
        >
          inteligente
        </text>
      </g>
    </svg>
  );
}
