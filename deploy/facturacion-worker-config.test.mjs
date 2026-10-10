import { test } from "node:test";
import assert from "node:assert/strict";
import { validarWorkerFiscal } from "./facturacion-worker-config.mjs";

const api = {
  ambiente: "prod",
  token: "huella-ficticia-token",
  cifrado: "huella-ficticia-cifrado",
};
test("detecta el secreto ausente aunque el proceso esté saludable", () => {
  assert.throws(
    () =>
      validarWorkerFiscal(
        api,
        { ...api, token: null },
        { entorno: "produccion" },
      ),
    /Falta AFIPSDK_ACCESS_TOKEN/,
  );
});
test("rechaza otra credencial o clave de cifrado", () => {
  assert.throws(
    () =>
      validarWorkerFiscal(
        api,
        { ...api, token: "otra" },
        { entorno: "produccion" },
      ),
    /credencial fiscal/,
  );
  assert.throws(
    () =>
      validarWorkerFiscal(
        api,
        { ...api, cifrado: "otra" },
        { entorno: "produccion" },
      ),
    /descifrar/,
  );
});
test("rechaza homologación en producción", () => {
  assert.throws(
    () =>
      validarWorkerFiscal(
        api,
        { ...api, ambiente: "dev" },
        { entorno: "produccion" },
      ),
    /ambiente fiscal/,
  );
});
test("no presenta el recorrido manual como validación de ARCA", () => {
  const manual = { ambiente: "dev", token: null, cifrado: null };
  assert.throws(
    () => validarWorkerFiscal(manual, manual, { entorno: "staging" }),
    /no valida ARCA/,
  );
  assert.deepEqual(
    validarWorkerFiscal(manual, manual, {
      entorno: "staging",
      permitirManual: true,
    }),
    { modo: "manual", arcaValidada: false },
  );
});
test("confirma coincidencia sin exponer huellas", () => {
  assert.deepEqual(validarWorkerFiscal(api, api, { entorno: "produccion" }), {
    modo: "automatico",
    configuracionCoincidente: true,
  });
});
