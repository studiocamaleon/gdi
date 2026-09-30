import { pathToFileURL } from "node:url";

// Sólo lectura. Este control no crea buckets, no cambia retención ni sube datos.
export const CAPACIDADES_COPIADOR = Object.freeze([
  "listBuckets", "readBucketRetentions", "listFiles", "readFiles",
  "writeFiles", "readFileRetentions", "writeFileRetentions",
]);
export const CAPACIDADES_LECTOR = Object.freeze([
  "listBuckets", "readBucketRetentions", "listFiles", "readFiles", "readFileRetentions",
]);
const MAX_RESPUESTA = 512 * 1024;

class ConfiguracionInsegura extends Error {}
function exigir(condicion, mensaje) {
  if (!condicion) throw new ConfiguracionInsegura(mensaje);
}

export function validarConfiguracion(env) {
  const campos = ["RESPALDO_B2_KEY_ID", "RESPALDO_B2_KEY", "RESPALDO_B2_ACCOUNT_ID", "RESPALDO_B2_BUCKET_ID", "RESPALDO_ENTORNO"];
  exigir(campos.every((c) => typeof env[c] === "string" && env[c].trim()), "Falta configuración privada del respaldo.");
  exigir(["staging", "produccion"].includes(env.RESPALDO_ENTORNO), "El entorno del respaldo debe ser explícito.");
  exigir(!env.RESPALDO_B2_KEY_ID.includes(":"), "El identificador de acceso no es válido.");
  return {
    keyId: env.RESPALDO_B2_KEY_ID,
    key: env.RESPALDO_B2_KEY,
    accountId: env.RESPALDO_B2_ACCOUNT_ID,
    bucketId: env.RESPALDO_B2_BUCKET_ID,
    prefijo: `${env.RESPALDO_ENTORNO}/`,
  };
}

export function validarPermisos(auth, config, capacidades = CAPACIDADES_COPIADOR) {
  const storage = auth?.apiInfo?.storageApi;
  const allowed = storage?.allowed;
  exigir(auth?.accountId === config.accountId, "La cuenta de respaldo no coincide con la esperada.");
  exigir(typeof auth?.authorizationToken === "string" && auth.authorizationToken.length > 0, "No se recibió una autorización válida.");
  exigir(!auth?.apiInfo?.groupsApi, "El copiador no debe tener acceso administrativo a grupos.");
  exigir(Array.isArray(allowed?.buckets) && allowed.buckets.length === 1 && allowed.buckets[0]?.id === config.bucketId, "La clave debe estar limitada a un único depósito de respaldo.");
  exigir(allowed?.namePrefix === config.prefijo, "La clave debe estar limitada al prefijo exacto del entorno.");
  const caps = allowed?.capabilities;
  exigir(Array.isArray(caps) && capacidades.every((c) => caps.includes(c)) && caps.every((c) => capacidades.includes(c)), "La clave tiene permisos faltantes o excesivos; no debe administrar ni borrar respaldos.");
  // La URL viene del proveedor: no enviar el token a hosts arbitrarios o redirects.
  let url;
  try { url = new URL(storage.apiUrl); } catch { /* Rechazo genérico abajo. */ }
  exigir(url && url.protocol === "https:" && /^api[0-9]*\.backblazeb2\.com$/.test(url.hostname) && !url.username && !url.password && !url.port && url.pathname === "/" && !url.search && !url.hash, "El proveedor devolvió un destino de API no permitido.");
  return url.origin;
}

export function validarDeposito(respuesta, config) {
  const buckets = respuesta?.buckets;
  exigir(Array.isArray(buckets) && buckets.length === 1, "No se pudo identificar un único depósito.");
  const b = buckets[0];
  exigir(b?.bucketId === config.bucketId && b.accountId === config.accountId, "El depósito no pertenece al destino esperado.");
  exigir(b.bucketType === "allPrivate", "El depósito de respaldo debe ser privado.");
  const lock = b.fileLockConfiguration;
  exigir(lock?.isClientAuthorizedToRead === true && lock.value?.isFileLockEnabled === true, "No se pudo comprobar la protección contra borrado.");
  const retencion = lock.value.defaultRetention;
  exigir(retencion?.mode === "compliance" && retencion.period?.unit === "days" && retencion.period.duration === 30, "La retención debe ser compliance por 30 días, según lo acordado.");
  // Un borrado automático podría quitar objetos compartidos por copias futuras.
  // Primero implementar y probar un recolector consciente de los manifiestos.
  exigir(Array.isArray(b.lifecycleRules) && b.lifecycleRules.length === 0, "No activar reglas automáticas de borrado antes de verificar las referencias de las copias.");
}

async function jsonAcotado(url, init, fetchFn) {
  const response = await fetchFn(url, { ...init, redirect: "error", signal: AbortSignal.timeout(10_000) });
  if (!response.ok || !response.body) {
    await response.body?.cancel();
    throw new ConfiguracionInsegura("El proveedor no permitió verificar el respaldo.");
  }
  const reader = response.body.getReader();
  const chunks = [];
  let total = 0;
  try {
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      total += value.byteLength;
      exigir(total <= MAX_RESPUESTA, "La respuesta del proveedor excede el tamaño permitido.");
      chunks.push(Buffer.from(value));
    }
  } finally {
    await reader.cancel();
    reader.releaseLock();
  }
  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}

export async function comprobarDestino(env = process.env, fetchFn = fetch) {
  try {
    const config = validarConfiguracion(env);
    const auth = await jsonAcotado("https://api.backblazeb2.com/b2api/v4/b2_authorize_account", {
      headers: { Authorization: `Basic ${Buffer.from(`${config.keyId}:${config.key}`).toString("base64")}` },
    }, fetchFn);
    const api = validarPermisos(auth, config);
    const buckets = await jsonAcotado(`${api}/b2api/v4/b2_list_buckets`, {
      method: "POST",
      headers: { Authorization: auth.authorizationToken, "Content-Type": "application/json" },
      body: JSON.stringify({ accountId: config.accountId, bucketId: config.bucketId }),
    }, fetchFn);
    validarDeposito(buckets, config);
    return { destinoVerificado: true, entorno: env.RESPALDO_ENTORNO, retencionDias: 30, copiaRealizada: false, restauracionComprobada: false };
  } catch (error) {
    // No imprimir respuestas, claves, URLs privadas ni mensajes de red del proveedor.
    throw new Error(error instanceof ConfiguracionInsegura ? error.message : "No se pudo verificar el destino; no continuar con la copia.");
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  comprobarDestino().then((resultado) => console.log(JSON.stringify(resultado))).catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
