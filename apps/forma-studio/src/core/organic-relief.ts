import type { Parameters } from "./types";

export type OrganicReliefParameters = Pick<Parameters,
  "organicProfile" | "organicAmplitude" | "organicPeriod" | "organicBelly" | "organicExpansion" | "organicCurvature" | "organicWaveAmplitude" | "organicWavePeriod" | "organicWaveShape" | "organicBumper" | "organicFoot" | "organicCloseBase" | "organicBubble" | "organicRadius" | "organicCount" | "organicStackAdvance" | "organicStackGap" | "organicSlant" | "organicAngle">;
const clamp = (v:number,a=0,b=1)=>Math.max(a,Math.min(b,v));
const rad = (a:number)=>a*Math.PI/180;

/** Perfil radial compartido por letras orgánicas y laterales de banderolas.
 * La receta de cada producto resuelve sus alojamientos y extremos. */
export function organicRelief(p:OrganicReliefParameters,z:number,start:number,H:number){
  const slope=Math.tan(rad(p.organicAngle)),bodyEnd=start+H;
  const peak=p.organicProfile==="stack"?p.organicStackAdvance+.8:p.organicBumper;
  const cycles=Math.max(1,Math.round(H/(p.organicProfile==="waves"?p.organicWavePeriod:p.organicPeriod)));
    const t = clamp((z - start) / H),
      down = 1 - t;
    let d = 0;
    switch (p.organicProfile) {
      case "zigzag": {
        const phase = (t * cycles) % 1;
        d = p.organicAmplitude * (1 - Math.abs(2 * phase - 1));
        break;
      }
      case "waves": {
        const wave = (1 - Math.cos(2 * Math.PI * t * cycles)) / 2;
        const power = Math.pow(4, (p.organicWaveShape - 50) / 50);
        d = p.organicWaveAmplitude * Math.pow(wave, power);
        break;
      }
      case "belly":
        d = p.organicBelly * Math.sin(Math.PI * t);
        break;
      case "pedestal": {
        const q = 1 + (3 * p.organicCurvature) / 100;
        d =
          (p.organicExpansion * Math.pow(down, q)) /
          (Math.pow(t, q) + Math.pow(down, q));
        break;
      }
      case "bumper": {
        const foot = p.organicCloseBase ? peak / slope : 0;
        d = Math.min(
          peak,
          p.organicCloseBase ? z * slope : peak,
          Math.max(0, (foot + p.organicFoot + peak / slope - z) * slope),
        );
        break;
      }
      case "bubble": {
        const radius = Math.min(p.organicRadius, H),
          angle = rad(45 + (45 * p.organicBubble) / 100),
          height = radius * Math.sin(angle);
        const u = clamp(z - (bodyEnd - height), 0, height);
        d =
          Math.sqrt(Math.max(0, radius * radius - u * u)) -
          radius * Math.cos(angle);
        break;
      }
      case "stack": {
        const n = Math.max(1, Math.round(p.organicCount)),
          gap = Math.min(p.organicStackGap, H / n / 2),
          span = (H - gap * (n - 1)) / n;
        const band = Math.min(n - 1, Math.floor(z / (span + gap))),
          local = z - band * (span + gap);
        const lower =
          band === 0
            ? p.organicCloseBase
              ? local * slope
              : peak
            : 0.8 + local * slope;
        const upper =
          band === n - 1 ? (H - z) * slope : 0.8 + (span - local) * slope;
        d = clamp(Math.min(lower, upper), 0.8, peak);
        if (band === 0 && p.organicCloseBase) d = Math.min(d, z * slope);
        if (band === n - 1) d = Math.min(d, Math.max(0, (H - z) * slope));
        break;
      }
    }
    return d + p.organicSlant * down;
}
