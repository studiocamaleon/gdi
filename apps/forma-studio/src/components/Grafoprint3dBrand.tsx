/** Isologo y composición de la web de Grafoprint, con el sufijo de la herramienta. */
export function Grafoprint3dBrand() {
  return (
    <span className="brand-logo" role="img" aria-label="Grafoprint 3D">
      <span className="brand-mark" aria-hidden="true">
        <svg viewBox="0 0 24 24" fill="none">
          <path d="M5.5 6.5H18L12 17.5Z" stroke="currentColor" strokeWidth="1.4" />
          <circle cx="5.5" cy="6.5" r="2.2" fill="currentColor" />
          <circle cx="18" cy="6.5" r="2.2" fill="currentColor" />
          <circle cx="12" cy="17.5" r="2.2" fill="currentColor" />
        </svg>
      </span>
      <span aria-hidden="true">
        grafoprint<span className="brand-period">.</span>
        <span className="brand-suffix">3D</span>
      </span>
    </span>
  );
}
