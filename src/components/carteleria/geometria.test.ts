import { describe, expect, it } from "vitest";
import { derivarMetricas, type CarteleriaVista } from "./geometria";
import {
  calcularEstructuraBastidor,
  parsearParamsEstructuraBastidor,
  parsearPerfilEstructural,
} from "../../../apps/api/src/motor-universal/estructura-bastidor";
import type { JobContext } from "../../../apps/api/src/motor-universal/tipos";

describe("el visor conserva el despiece del motor para perfiles rectangulares", () => {
  it.each(["simple", "doble"])(
    "coincide en ambos sentidos para un bastidor %s",
    (tipoBastidor) => {
      for (const orientacionPerfil of ["ancho_al_frente", "alto_al_frente"]) {
        const params = parsearParamsEstructuraBastidor({
          tipoBastidor,
          orientacionPerfil,
          sepRefuerzoVcm: 80,
          sepRefuerzoHcm: 80,
        });
        const motor = calcularEstructuraBastidor(
          {
            cantidad: 1,
            piezas: [{ cantidad: 1, anchoMm: 2400, altoMm: 1200 }],
            profundidadMm: 180,
          } as unknown as JobContext,
          params,
          parsearPerfilEstructural({ seccion: "20x30 mm" }),
        )!;
        const vista: CarteleriaVista = {
          tipoCartel: tipoBastidor === "doble" ? "backlight" : "frontlight",
          width: 2.4,
          height: 1.2,
          depth: 0.18,
          sepRefuerzoVcm: 80,
          sepRefuerzoHcm: 80,
          cenefa: false,
          solapaCenefaCm: 0,
          pintura: false,
          fondo: false,
          perfilLadoM: motor.perfilLadoM,
          perfilProfundidadM: motor.perfilProfundidadM,
          densidadLed: 1,
          coberturaLedM2: 0,
        };
        expect(derivarMetricas(vista).mlTotal).toBeCloseTo(motor.mlTotal, 8);
        expect(derivarMetricas(vista).puntosSoldadura).toBe(
          motor.puntosSoldadura,
        );
      }
    },
  );
});
