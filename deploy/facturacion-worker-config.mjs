/** Compara metadatos obtenidos en memoria; nunca devuelve credenciales ni huellas. */
export function validarWorkerFiscal(
  api,
  worker,
  { entorno, permitirManual = false } = {},
) {
  const ambiente =
    entorno === "produccion" ? "prod" : entorno === "staging" ? "dev" : null;
  if (!ambiente) throw new Error("Entorno inválido.");
  if (api.ambiente !== ambiente || worker.ambiente !== ambiente)
    throw new Error("API y worker deben usar el ambiente fiscal del entorno.");
  if (!api.token) {
    if (worker.token)
      throw new Error("El proveedor fiscal del worker difiere de la API.");
    if (!permitirManual)
      throw new Error(
        "La API no tiene proveedor automático: este ensayo no valida ARCA.",
      );
    return { modo: "manual", arcaValidada: false };
  }
  if (!worker.token)
    throw new Error("Falta AFIPSDK_ACCESS_TOKEN en el worker de facturación.");
  if (api.token !== worker.token)
    throw new Error("La credencial fiscal del worker difiere de la API.");
  if (!api.cifrado || api.cifrado !== worker.cifrado)
    throw new Error(
      "El worker no puede descifrar las credenciales fiscales de la API.",
    );
  return { modo: "automatico", configuracionCoincidente: true };
}
