/**
 * Lectura del código de barras PDF417 del DNI argentino.
 *
 * El reverso del documento trae un PDF417 que los lectores 2D leen como
 * teclado, igual que un QR. Sirve para dar de alta a un cliente de mostrador
 * sin tipear nada: apellido, nombres y número de documento salen del propio
 * documento, sin errores de transcripción.
 *
 * Hay dos formatos en circulación y se soportan los dos:
 *
 *  - **Actual** (DNI tarjeta, separador `"`):
 *    `00000000000"APELLIDO"NOMBRES"M"12345678"A"01-01-1990"01-01-2015"000`
 *    con el número de trámite adelante.
 *  - **Anterior** (separador `@`):
 *    `@APELLIDO@NOMBRES@M@12345678@A@01/01/1990@01/01/2015@`
 *
 * Ojo: son datos personales sensibles (ley 25.326). Se guarda lo mínimo para
 * identificar al cliente —nombre y documento—; sexo y fecha de nacimiento se
 * parsean para poder derivar el CUIL, no para almacenarlos porque sí.
 */

export type DatosDocumento = {
  apellido: string;
  nombres: string;
  /** "GOMEZ, Lucas Germán" listo para el campo nombre del cliente. */
  nombreCompleto: string;
  /** Sólo dígitos. */
  documento: string;
  sexo: "M" | "F" | "X" | null;
  /** ISO (YYYY-MM-DD) o null si no vino / no se entiende. */
  fechaNacimiento: string | null;
};

/** Capitaliza "LUCAS GERMAN" → "Lucas German" sin tocar las preposiciones. */
function capitalizar(texto: string): string {
  const minusculas = new Set(["de", "del", "la", "las", "los", "y", "da"]);
  return texto
    .toLocaleLowerCase("es-AR")
    .split(/\s+/)
    .filter(Boolean)
    .map((palabra, i) =>
      i > 0 && minusculas.has(palabra)
        ? palabra
        : palabra.charAt(0).toLocaleUpperCase("es-AR") + palabra.slice(1),
    )
    .join(" ");
}

/** "03-01-1994" o "03/01/1994" → "1994-01-03". */
function aIso(fecha: string): string | null {
  const m = fecha.trim().match(/^(\d{2})[-/](\d{2})[-/](\d{4})$/);
  if (!m) return null;
  const [, dia, mes, anio] = m;
  const num = Number(mes);
  if (num < 1 || num > 12) return null;
  return `${anio}-${mes}-${dia}`;
}

/**
 * Parsea lo que escupió el lector. Devuelve null si no es un documento —así
 * el llamador puede probar otros formatos con el mismo texto.
 */
export function parsearDniArgentino(crudo: string): DatosDocumento | null {
  const texto = crudo.trim();
  if (!texto) return null;

  // El formato viejo abre con @; el nuevo separa con comillas.
  const partes = texto.includes('"')
    ? texto.split('"')
    : texto.includes("@")
      ? texto.split("@")
      : null;
  if (!partes) return null;

  const campos = partes.map((p) => p.trim());
  // El formato nuevo arranca con el número de trámite (sólo dígitos); el
  // viejo arranca con un vacío por el @ inicial. En los dos casos el
  // apellido es el campo siguiente.
  const base = campos[0] === "" || /^\d+$/.test(campos[0]) ? 1 : 0;

  const apellido = campos[base] ?? "";
  const nombres = campos[base + 1] ?? "";
  const sexoCrudo = (campos[base + 2] ?? "").toUpperCase();
  const documento = (campos[base + 3] ?? "").replace(/\D/g, "");
  const fechaNac = campos[base + 5] ?? "";

  // Un documento sin apellido o sin número no es un documento.
  if (!apellido || !/^[A-Za-zÁÉÍÓÚÑáéíóúñ' -]+$/.test(apellido)) return null;
  if (documento.length < 7 || documento.length > 9) return null;

  const ape = capitalizar(apellido);
  const nom = capitalizar(nombres);
  return {
    apellido: ape,
    nombres: nom,
    nombreCompleto: nom ? `${ape}, ${nom}` : ape,
    documento,
    sexo:
      sexoCrudo === "M" || sexoCrudo === "F" || sexoCrudo === "X"
        ? (sexoCrudo as "M" | "F" | "X")
        : null,
    fechaNacimiento: aIso(fechaNac),
  };
}

/**
 * CUIL a partir del documento y el sexo. Es el mismo algoritmo que usa ARCA:
 * prefijo por sexo, dígito verificador módulo 11, y el caso especial del 23
 * cuando el resto da 10.
 *
 * Sirve para facturar: un consumidor final identificado con CUIL entra
 * derecho en el comprobante. Devuelve null si no se puede calcular — nunca
 * un número inventado, que en un comprobante sería peor que no tenerlo.
 */
export function cuilDesdeDocumento(
  documento: string,
  sexo: "M" | "F" | "X" | null,
): string | null {
  const dni = documento.replace(/\D/g, "");
  if (dni.length < 7 || dni.length > 8 || !sexo || sexo === "X") return null;
  const base = dni.padStart(8, "0");
  const pesos = [5, 4, 3, 2, 7, 6, 5, 4, 3, 2];
  const calcular = (prefijo: string): number => {
    const cuerpo = prefijo + base;
    const suma = cuerpo
      .split("")
      .reduce((acc, d, i) => acc + Number(d) * pesos[i], 0);
    return 11 - (suma % 11);
  };

  const prefijo = sexo === "M" ? "20" : "27";
  let verificador = calcular(prefijo);
  if (verificador === 11) verificador = 0;
  if (verificador === 10) {
    // El 10 no es un dígito: ARCA reasigna estos casos al prefijo 23.
    const alterno = calcular("23");
    const v = alterno === 11 ? 0 : alterno;
    if (v === 10) return null;
    return `23${base}${v}`;
  }
  return `${prefijo}${base}${verificador}`;
}
