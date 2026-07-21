import { describe, expect, it } from "vitest";

import {
  acotarZoom,
  anclarZoom,
  construirEje,
  sliderDeZoom,
  Z_MAX,
  Z_MIN,
  ZOOM_PASOS,
  zoomDeSlider,
} from "@/lib/eje-laboral";
import type { CalendarioEstacion, Estacion } from "@/lib/estaciones";

const franja = (desde: string, hasta: string) => ({ desde, hasta });

const cal = (desde: string, hasta: string): CalendarioEstacion => ({
  dias: {
    lun: franja(desde, hasta),
    mar: franja(desde, hasta),
    mie: franja(desde, hasta),
    jue: franja(desde, hasta),
    vie: franja(desde, hasta),
    sab: null,
    dom: null,
  },
});

function estacion(id: string, calendario: CalendarioEstacion | null): Estacion {
  return {
    id,
    nombre: id,
    descripcion: "",
    activo: true,
    etapa: "impresion",
    icono: null,
    capacidadConcurrente: 1,
    tiempoPreparacionMin: null,
    calendario,
    familias: [],
    empleados: [],
    maquinas: [],
    createdAt: "",
    updatedAt: "",
  };
}

const jul = (dia: number, hora = 0, minuto = 0) =>
  new Date(2026, 6, dia, hora, minuto);

describe("construirEje", () => {
  it("toma la unión de las franjas de las estaciones activas", () => {
    const eje = construirEje({
      estaciones: [estacion("a", cal("08:00", "17:00")), estacion("b", cal("09:00", "18:00"))],
      ahora: jul(20, 8),
      hasta: jul(21, 12),
    });

    expect(eje.ventana).toEqual({ desde: 8 * 60, hasta: 18 * 60 });
    expect(eje.jornadaMin).toBe(600);
  });

  it("usa el calendario por defecto cuando la estación no tiene", () => {
    const eje = construirEje({
      estaciones: [estacion("a", null)],
      ahora: jul(20, 9),
      hasta: jul(20, 12),
    });

    // calendarioDefault() es 09:00–18:00.
    expect(eje.ventana).toEqual({ desde: 9 * 60, hasta: 18 * 60 });
  });

  it("colapsa el fin de semana: el lunes sigue al viernes", () => {
    const eje = construirEje({
      estaciones: [estacion("a", cal("08:00", "18:00"))],
      ahora: jul(24, 8), // viernes
      hasta: jul(27, 12), // lunes
    });

    expect(eje.dias.map((d) => d.etiqueta)).toEqual(["vie 24/07", "lun 27/07"]);
    // El lunes arranca justo donde termina la jornada del viernes.
    expect(eje.dias[1].x).toBe(600);
  });

  it("saltea los feriados del taller", () => {
    const eje = construirEje({
      estaciones: [estacion("a", cal("08:00", "18:00"))],
      ahora: jul(20, 8),
      hasta: jul(22, 12),
      noLaborables: new Set(["2026-07-21"]),
    });

    expect(eje.dias.map((d) => d.fecha)).toEqual(["2026-07-20", "2026-07-22"]);
  });

  it("mapea una hora del día a su minuto laboral", () => {
    const eje = construirEje({
      estaciones: [estacion("a", cal("08:00", "18:00"))],
      ahora: jul(20, 8),
      hasta: jul(21, 18),
    });

    expect(eje.aX(jul(20, 8, 0))).toBe(0);
    expect(eje.aX(jul(20, 9, 30))).toBe(90);
    // Segundo día: una jornada completa + el offset dentro del día.
    expect(eje.aX(jul(21, 10, 0))).toBe(600 + 120);
  });

  it("recorta lo que cae fuera de la franja en vez de estirar el eje", () => {
    const eje = construirEje({
      estaciones: [estacion("a", cal("08:00", "18:00"))],
      ahora: jul(20, 8),
      hasta: jul(20, 18),
    });

    expect(eje.aX(jul(20, 6, 0))).toBe(0); // antes de abrir
    expect(eje.aX(jul(20, 23, 0))).toBe(600); // después de cerrar
  });

  it("ancla al borde del día anterior lo que cae en un día no dibujado", () => {
    const eje = construirEje({
      estaciones: [estacion("a", cal("08:00", "18:00"))],
      ahora: jul(20, 8),
      hasta: jul(24, 18),
    });

    // El sábado no existe en el eje: se ancla al cierre del viernes.
    expect(eje.aX(jul(25, 10, 0))).toBe(eje.dias.at(-1)!.x + 600);
  });

  it("cubre el horizonte que se le pide", () => {
    const eje = construirEje({
      estaciones: [estacion("a", cal("08:00", "18:00"))],
      ahora: jul(20, 8),
      hasta: new Date(2026, 7, 10, 12),
    });

    expect(eje.dias.at(-1)!.fecha).toBe("2026-08-10");
    // 3 semanas de lunes a viernes.
    expect(eje.dias).toHaveLength(16);
  });
});

/* El zoom vive en la vista, pero se apoya en que el eje sea lineal en
   minutos laborales: sin eso, anclar el cursor no tendría sentido. */
describe("construirEje · linealidad (base del zoom)", () => {
  it("un minuto laboral vale lo mismo en cualquier punto del eje", () => {
    const eje = construirEje({
      estaciones: [estacion("a", cal("08:00", "18:00"))],
      ahora: jul(20, 8),
      hasta: jul(24, 18),
    });

    const d1 = eje.aX(jul(20, 12, 0)) - eje.aX(jul(20, 11, 0));
    const d2 = eje.aX(jul(23, 15, 0)) - eje.aX(jul(23, 14, 0));
    expect(d1).toBe(60);
    expect(d2).toBe(60);
  });
});

describe("anclarZoom", () => {
  const invariante = (scrollLeft: number, offsetX: number, za: number, zn: number) => {
    const nuevo = anclarZoom({ scrollLeft, offsetX, zAnterior: za, zNuevo: zn });
    // El minuto que estaba bajo el cursor tiene que seguir bajo el cursor.
    return (nuevo + offsetX) / zn;
  };

  it("deja quieto el minuto bajo el cursor al acercar", () => {
    const antes = (500 + 300) / 0.16;
    expect(invariante(500, 300, 0.16, 0.45)).toBeCloseTo(antes, 6);
  });

  it("lo deja quieto también al alejar", () => {
    const antes = (2000 + 120) / 1.6;
    expect(invariante(2000, 120, 1.6, 0.2)).toBeCloseTo(antes, 6);
  });

  it("no devuelve scroll negativo cerca del origen", () => {
    expect(anclarZoom({ scrollLeft: 0, offsetX: 400, zAnterior: 1.6, zNuevo: 0.02 })).toBe(0);
  });

  it("con el mismo zoom no mueve nada", () => {
    expect(anclarZoom({ scrollLeft: 777, offsetX: 250, zAnterior: 0.45, zNuevo: 0.45 })).toBeCloseTo(777, 6);
  });
});

describe("acotarZoom", () => {
  it("respeta los límites", () => {
    expect(acotarZoom(999)).toBe(Z_MAX);
    expect(acotarZoom(0.0001)).toBe(Z_MIN);
    expect(acotarZoom(0.45)).toBe(0.45);
  });

  it("no deja pasar NaN ni Infinity", () => {
    // Puede salir de dividir por un ancho 0 al montar el contenedor.
    expect(acotarZoom(Number.NaN)).toBe(Z_MIN);
    expect(acotarZoom(Number.POSITIVE_INFINITY)).toBe(Z_MAX);
  });
});

describe("deslizador de zoom", () => {
  it("los extremos de la barra son los extremos del rango", () => {
    expect(zoomDeSlider(0)).toBeCloseTo(Z_MIN, 6);
    expect(zoomDeSlider(ZOOM_PASOS)).toBeCloseTo(Z_MAX, 6);
  });

  it("ida y vuelta sin deriva", () => {
    for (const z of [0.02, 0.08, 0.16, 0.45, 1.6, 6]) {
      expect(zoomDeSlider(sliderDeZoom(z))).toBeCloseTo(z, 2);
    }
  });

  it("es logarítmico: cada mitad de la barra multiplica lo mismo", () => {
    // Con escala lineal esto no se cumpliría: el primer tramo casi no
    // cambiaría nada y el último saltaría de golpe.
    const a = zoomDeSlider(0);
    const b = zoomDeSlider(ZOOM_PASOS / 2);
    const c = zoomDeSlider(ZOOM_PASOS);
    expect(b / a).toBeCloseTo(c / b, 4);
  });

  it("el medio de la barra cae en un zoom de trabajo, no en un extremo", () => {
    const medio = zoomDeSlider(ZOOM_PASOS / 2);
    expect(medio).toBeGreaterThan(0.2);
    expect(medio).toBeLessThan(0.8);
  });
});

/* El eje arranca EN `ahora`: en el pasado nunca se dibuja nada, así que
   esas horas serían píxeles muertos. La primera jornada queda parcial. */
describe("construirEje · arranca en ahora", () => {
  const un = [estacion("a", cal("08:00", "18:00"))];

  it("ahora es el origen del eje", () => {
    const ahora = jul(20, 14, 0);
    const eje = construirEje({ estaciones: un, ahora, hasta: jul(21, 18) });
    expect(eje.aX(ahora)).toBe(0);
  });

  it("la primera jornada es parcial: sólo lo que queda del día", () => {
    const ahora = jul(20, 14, 0);
    const eje = construirEje({ estaciones: un, ahora, hasta: jul(21, 18) });
    // De 14:00 a 18:00 quedan 240 min, contra una jornada de 600.
    expect(eje.dias[0].ancho).toBe(240);
    expect(eje.dias[0].desdeMin).toBe(14 * 60);
    expect(eje.jornadaMin).toBe(600);
  });

  it("las jornadas siguientes son completas y encadenan", () => {
    const ahora = jul(20, 14, 0);
    const eje = construirEje({ estaciones: un, ahora, hasta: jul(22, 18) });
    expect(eje.dias[1].ancho).toBe(600);
    expect(eje.dias[1].x).toBe(240);
    expect(eje.dias[2].x).toBe(840);
  });

  it("si ya cerró, hoy no entra: el eje empieza mañana", () => {
    const ahora = jul(20, 21, 0);
    const eje = construirEje({ estaciones: un, ahora, hasta: jul(22, 18) });
    expect(eje.dias[0].fecha).toBe("2026-07-21");
    expect(eje.dias[0].ancho).toBe(600);
  });

  it("antes de abrir, hoy entra completo", () => {
    const ahora = jul(20, 6, 30);
    const eje = construirEje({ estaciones: un, ahora, hasta: jul(21, 18) });
    expect(eje.dias[0].fecha).toBe("2026-07-20");
    expect(eje.dias[0].ancho).toBe(600);
    expect(eje.aX(ahora)).toBe(0);
  });

  it("una hora posterior del primer día se mide desde ahora", () => {
    const ahora = jul(20, 14, 0);
    const eje = construirEje({ estaciones: un, ahora, hasta: jul(21, 18) });
    expect(eje.aX(jul(20, 16, 30))).toBe(150);
  });

  it("totalMin es la suma real, con la primera jornada recortada", () => {
    const ahora = jul(20, 14, 0);
    const eje = construirEje({ estaciones: un, ahora, hasta: jul(22, 18) });
    // 240 del primer día + 600 + 600.
    expect(eje.totalMin).toBe(1440);
  });
});

describe("anclarZoom · borde izquierdo", () => {
  it("mantiene quieto lo que está en el borde al acercar", () => {
    // Es el caso de la barra de zoom: sin cursor, se ancla offsetX = 0.
    const nuevo = anclarZoom({ scrollLeft: 900, offsetX: 0, zAnterior: 0.45, zNuevo: 0.9 });
    // El minuto que estaba en el borde (2000) sigue en el borde.
    expect(nuevo / 0.9).toBeCloseTo(900 / 0.45, 6);
  });

  it("anclar el centro sí expulsa el arranque por izquierda", () => {
    // Documenta POR QUÉ no se usa el centro: con el trabajo pegado a la
    // izquierda, al acercar se va de pantalla.
    const anchoVentana = 1200;
    const centro = anclarZoom({
      scrollLeft: 171,
      offsetX: anchoVentana / 2,
      zAnterior: 0.45,
      zNuevo: 0.9,
    });
    const borde = anclarZoom({ scrollLeft: 171, offsetX: 0, zAnterior: 0.45, zNuevo: 0.9 });
    // "ahora" está en x=0 del eje: con centro queda muy a la izquierda del
    // scroll (invisible); con borde, justo en el borde.
    expect(0 - centro).toBeLessThan(-500);
    expect(0 - borde).toBeGreaterThan(-400);
  });
});
