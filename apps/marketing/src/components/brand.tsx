export function Brand({ compact = false }: { compact?: boolean }) {
  return (
    <span className="brand">
      <span className="brand-mark">
        <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path
            d="M5.5 6.5H18L12 17.5Z"
            stroke="currentColor"
            strokeWidth="1.4"
          />
          <circle cx="5.5" cy="6.5" r="2.2" fill="currentColor" />
          <circle cx="18" cy="6.5" r="2.2" fill="currentColor" />
          <circle cx="12" cy="17.5" r="2.2" fill="currentColor" />
        </svg>
      </span>
      {!compact && (
        <span>
          grafoprint<span className="brand-period">.</span>
        </span>
      )}
    </span>
  );
}
