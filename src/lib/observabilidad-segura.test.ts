import { describe, expect, it } from "vitest";
import {
  areaMonitoreo,
  configurarMonitoreo,
  eventoMinimo,
} from "../../apps/api/src/common/observabilidad-segura";

describe("privacidad de incidentes", () => {
  it("descarta datos de clientes, credenciales, SQL, formularios, mensajes y contexto nuevo del SDK", () => {
    const secreto = "SECRETO_FICTICIO_NO_ENVIAR";
    const salida = eventoMinimo({
      event_id: "a".repeat(32),
      environment: "staging",
      release: "b".repeat(40),
      exception: {
        values: [
          {
            type: "TypeError",
            value: secreto,
            stacktrace: {
              frames: [
                {
                  filename: "/app/src/comercial/cotizar.ts",
                  lineno: 12,
                  colno: 8,
                  function: "cotizar",
                  vars: { password: secreto },
                  pre_context: [secreto],
                  context_line: secreto,
                },
                {
                  filename: "/Users/persona/Documentos/" + secreto + ".pdf",
                  function: secreto,
                },
              ],
            },
          },
        ],
      },
      user: { email: secreto, ip_address: "192.0.2.1" },
      request: {
        headers: { Authorization: secreto },
        data: secreto,
        url: "https://example.invalid/invitation/" + secreto,
      },
      breadcrumbs: [{ message: secreto }],
      extra: { sql: secreto },
      contexts: { proveedor: secreto },
      attachments: [secreto],
      nuevoCampoSdk: secreto,
      tags: { area: "comercial", servicio: "web-cliente", otro: secreto },
    });
    expect(JSON.stringify(salida)).not.toContain(secreto);
    expect(JSON.stringify(salida)).not.toContain("192.0.2.1");
    expect(salida?.exception).toMatchObject({
      values: [
        {
          type: "TypeError",
          stacktrace: {
            frames: [{ filename: "src/comercial/cotizar.ts", lineno: 12 }],
          },
        },
      ],
    });
    expect(salida?.tags).toEqual({
      area: "comercial",
      servicio: "web-cliente",
    });
  });
  it("no envía transacciones ni mensajes arbitrarios", () => {
    expect(eventoMinimo({ message: "Datos privados" })).toBeNull();
    expect(
      eventoMinimo({ type: "transaction", exception: { values: [{}] } }),
    ).toBeNull();
  });
  it("retira ubicaciones falsas dentro del mensaje de un proveedor", () => {
    const original = new Error(
      "SQL privado\n    at cliente (/app/src/SECRETO.ts:1:2)",
    );
    original.stack = `Error: ${original.message}\n    at cotizar (/app/src/motor.ts:12:8)`;
    const evento = eventoMinimo(
      {
        exception: {
          values: [
            {
              type: "Error",
              stacktrace: {
                frames: [
                  { filename: "/app/src/SECRETO.ts", lineno: 1, colno: 2 },
                  { filename: "/app/src/motor.ts", lineno: 12, colno: 8 },
                ],
              },
            },
          ],
        },
      },
      original,
    );
    expect(JSON.stringify(evento)).not.toContain("SECRETO");
    expect(JSON.stringify(evento)).toContain("src/motor.ts");
  });
  it("no transforma tokens ni identificadores de ruta en etiquetas", () => {
    expect(areaMonitoreo("/api/backend/archivos/privado?token=secreto")).toBe(
      "archivos",
    );
    expect(areaMonitoreo("/invitations/secreto")).toBe("aplicacion");
    expect(areaMonitoreo("/correo@example.invalid")).toBe("aplicacion");
  });
  it("exige habilitación y entorno cloud explícitos; rechaza destinos ajenos y DSN con secreto", () => {
    const env = {
      SENTRY_DSN: `https://${"a".repeat(32)}@o123.ingest.us.sentry.io/456`,
      SENTRY_ENABLED: "true",
    };
    expect(configurarMonitoreo(env)).toBeNull();
    expect(
      configurarMonitoreo({
        ...env,
        STAGING_PRIVATE: "true",
        SENTRY_ENABLED: "false",
      }),
    ).toBeNull();
    expect(
      configurarMonitoreo({ ...env, STAGING_PRIVATE: "true" })?.environment,
    ).toBe("staging");
    expect(
      configurarMonitoreo({ ...env, GRAFO_DEPLOY_ENV: "staging" })?.environment,
    ).toBe("staging");
    expect(
      configurarMonitoreo({ ...env, GRAFO_DEPLOY_ENV: "production" })
        ?.environment,
    ).toBe("production");
    expect(
      configurarMonitoreo({
        ...env,
        STAGING_PRIVATE: "true",
        SENTRY_DSN: env.SENTRY_DSN.replace(".sentry.io", ".example.invalid"),
      }),
    ).toBeNull();
    expect(
      configurarMonitoreo({
        ...env,
        STAGING_PRIVATE: "true",
        SENTRY_DSN: env.SENTRY_DSN.replace("@", ":secreto@"),
      }),
    ).toBeNull();
  });
});
