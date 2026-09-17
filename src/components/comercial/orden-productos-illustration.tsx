import s from "./orden-productos-illustration.module.css";

/** Ilustración vectorial decorativa: paquete abierto y una pieza gráfica. */
export function OrdenProductosIllustration() {
  return (
    <svg viewBox="0 0 176 144" className={s.illustration} aria-hidden="true" focusable="false">
      <ellipse className={s.halo} cx="88" cy="75" rx="72" ry="60" />
      <path className={s.registration} d="M22 44V32h12M142 32h12v12M22 106v12h12M154 106v12h-12" />
      <path className={s.guide} d="M30 105 88 73l58 32-58 32Z" />
      <ellipse className={s.shadow} cx="88" cy="124" rx="40" ry="6" />

      <path className={s.interior} d="m45 67 43-24 43 24-43 25Z" />
      <g className={s.print}>
        <path className={s.paperEdge} d="m67 27 43 8v50l-43-8Z" />
        <path className={s.paper} d="m62 22 43 8v50l-43-8Z" />
        <path className={s.printBlock} d="m70 34 27 5v16l-27-5Z" />
        <path className={s.printMark} d="m75 43 7-5 10 12M81 38l1 11" />
        <path className={s.printLine} d="m70 58 27 5m-27 2 17 3" />
      </g>

      <path className={s.leftFace} d="m45 67 43 25v34l-43-25Z" />
      <path className={s.rightFace} d="m88 92 43-25v34l-43 25Z" />
      <path className={s.boxEdge} d="M88 92v34m-43-25 43 25 43-25" />
      <path className={s.leftFlap} d="m45 67 43 25-18 12-43-25Z" />
      <path className={s.rightFlap} d="m88 92 43-25 17 12-43 25Z" />
      <path className={s.flapEdge} d="m45 67 43 25 43-25" />
      <path className={s.label} d="m109 102 13-7v7l-13 7Z" />
      <path className={s.spark} d="M136 44v10m-5-5h10" />
      <circle className={s.dot} cx="36" cy="54" r="3" />
      <circle className={s.smallDot} cx="145" cy="115" r="2" />
    </svg>
  );
}
