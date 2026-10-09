import { test } from "node:test";
import assert from "node:assert/strict";
import { CAPACIDADES_COPIADOR, comprobarDestino, validarConfiguracion, validarPermisos, validarDeposito } from "./validar-destino.mjs";

const env = {
  RESPALDO_B2_KEY_ID: "identificador-ficticio", RESPALDO_B2_KEY: "secreto-ficticio",
  RESPALDO_B2_ACCOUNT_ID: "cuenta-ficticia", RESPALDO_B2_BUCKET_ID: "bucket-ficticio", RESPALDO_ENTORNO: "staging",
};
const config = validarConfiguracion(env);
function authValida() {
  return { accountId: config.accountId, authorizationToken: "token-ficticio", apiInfo: { storageApi: {
    apiUrl: "https://api001.backblazeb2.com", allowed: { buckets: [{ id: config.bucketId }], namePrefix: "staging/", capabilities: [...CAPACIDADES_COPIADOR] },
  } } };
}
function bucketValido() {
  return { buckets: [{ bucketId: config.bucketId, accountId: config.accountId, bucketType: "allPrivate", lifecycleRules: [], fileLockConfiguration: {
    isClientAuthorizedToRead: true, value: { isFileLockEnabled: true, defaultRetention: { mode: "compliance", period: { unit: "days", duration: 30 } } },
  } }] };
}

test("sólo consulta autorización y configuración; no crea, sube ni borra objetos", async () => {
  const calls = [];
  const result = await comprobarDestino(env, async (url, init) => {
    calls.push({ url, init });
    return Response.json(calls.length === 1 ? authValida() : bucketValido());
  });
  assert.deepEqual(result, { destinoVerificado: true, entorno: "staging", retencionDias: 30, copiaRealizada: false, restauracionComprobada: false });
  assert.equal(calls.length, 2);
  assert.equal(calls[0].url, "https://api.backblazeb2.com/b2api/v4/b2_authorize_account");
  assert.equal(calls[1].url, "https://api001.backblazeb2.com/b2api/v4/b2_list_buckets");
  assert.equal(calls[1].init.redirect, "error");
  assert.ok(calls[1].init.signal instanceof AbortSignal);
  assert.equal(JSON.stringify(result).includes("ficticio"), false);
});
for (const [nombre, cambiar] of [
  ["clave maestra", a => { a.apiInfo.storageApi.allowed.buckets = null; }],
  ["otra cuenta", a => { a.accountId = "otra"; }],
  ["otro bucket", a => { a.apiInfo.storageApi.allowed.buckets[0].id = "otro"; }],
  ["varios buckets", a => { a.apiInfo.storageApi.allowed.buckets.push({ id: "otro" }); }],
  ["otro entorno", a => { a.apiInfo.storageApi.allowed.namePrefix = "produccion/"; }],
  ["sin prefijo", a => { a.apiInfo.storageApi.allowed.namePrefix = null; }],
  ["sin lectura de retención", a => { a.apiInfo.storageApi.allowed.capabilities = CAPACIDADES_COPIADOR.filter(c => c !== "readFileRetentions"); }],
  ["administración de grupos", a => { a.apiInfo.groupsApi = { capabilities: ["all"] }; }],
  ...["deleteFiles", "writeKeys", "deleteKeys", "writeBuckets", "writeBucketRetentions", "bypassGovernance", "shareFiles", "writeFileLegalHolds", "permisoFuturo"].map(cap => [cap, a => { a.apiInfo.storageApi.allowed.capabilities.push(cap); }]),
  ...["https://example.invalid", "http://api001.backblazeb2.com", "https://api001.backblazeb2.com.example.invalid", "https://api001.backblazeb2.com:8443", "https://secreto@api001.backblazeb2.com", "https://api001.backblazeb2.com/?secreto", "https://api001.backblazeb2.com/otro"].map(url => [`destino ${url}`, a => { a.apiInfo.storageApi.apiUrl = url; }]),
]) {
  test(`rechaza ${nombre} antes de transmitir la autorización a otro destino`, () => {
    const auth = authValida(); cambiar(auth);
    assert.throws(() => validarPermisos(auth, config));
  });
}
for (const [nombre, cambiar] of [
  ["público", b => { b.bucketType = "allPublic"; }],
  ["sin permiso de inspección", b => { b.fileLockConfiguration.isClientAuthorizedToRead = false; }],
  ["lock apagado", b => { b.fileLockConfiguration.value.isFileLockEnabled = false; }],
  ["governance revocable", b => { b.fileLockConfiguration.value.defaultRetention.mode = "governance"; }],
  ["retención insuficiente", b => { b.fileLockConfiguration.value.defaultRetention.period.duration = 7; }],
  ["retención más cara no acordada", b => { b.fileLockConfiguration.value.defaultRetention.period.duration = 365; }],
  ["unidad diferente", b => { b.fileLockConfiguration.value.defaultRetention.period.unit = "years"; }],
  ["borrado automático", b => { b.lifecycleRules = [{ daysFromUploadingToHiding: 31 }]; }],
  ["bucket equivocado", b => { b.bucketId = "otro"; }],
]) {
  test(`rechaza depósito ${nombre}`, () => {
    const respuesta = bucketValido(); cambiar(respuesta.buckets[0]);
    assert.throws(() => validarDeposito(respuesta, config));
  });
}
test("configuración incompleta no hace solicitudes", async () => {
  await assert.rejects(comprobarDestino({}, () => assert.fail("no debe conectarse")), /Falta configuración/);
});
test("no continúa si el proveedor omite campos necesarios", () => {
  assert.throws(() => validarPermisos({}, config));
  assert.throws(() => validarDeposito({}, config));
});
test("no revela mensajes de red ni cuerpos de error del proveedor", async () => {
  await assert.rejects(comprobarDestino(env, async () => { throw new Error("secreto-ficticio"); }), /No se pudo verificar el destino; no continuar/);
  await assert.rejects(comprobarDestino(env, async () => new Response("secreto-ficticio", { status: 403 })), /El proveedor no permitió/);
});
test("respuesta enorme o inválida no puede aprobar el control", async () => {
  await assert.rejects(comprobarDestino(env, async () => new Response("x".repeat(512 * 1024 + 1))), /tamaño permitido/);
  await assert.rejects(comprobarDestino(env, async () => new Response("token-ficticio")), /No se pudo verificar/);
});
