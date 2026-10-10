import { afterEach, describe, expect, it } from "vitest";
import * as Sentry from "../../apps/api/node_modules/@sentry/nestjs";
import {
  datosMinimos,
  eventoMinimo,
} from "../../apps/api/src/common/observabilidad-segura";

afterEach(async () => {
  await Sentry.close(1000);
});

describe("SDK sin transmisión de información privada", () => {
  it("el transporte recibe sólo incidentes filtrados y conserva el tenant correcto en tareas concurrentes", async () => {
    const sobres: unknown[] = [];
    Sentry.init({
      dsn: `https://${"a".repeat(32)}@o123.ingest.us.sentry.io/456`,
      environment: "staging",
      defaultIntegrations: false,
      dataCollection: { ...datosMinimos, httpBodies: [] },
      tracesSampleRate: 0,
      sendClientReports: false,
      beforeSend: (e, h) =>
        eventoMinimo(
          e as unknown as Record<string, unknown>,
          h.originalException,
        ) as Sentry.ErrorEvent | null,
      beforeSendLog: () => null,
      beforeSendMetric: () => null,
      transport: () => ({
        send: async (envelope) => {
          sobres.push(envelope);
          return { statusCode: 200 };
        },
        flush: async () => true,
      }),
    });
    const secreto = "SECRETO_FICTICIO_CLIENTE";
    const tenants = [
      "11111111-1111-4111-8111-111111111111",
      "22222222-2222-4222-8222-222222222222",
    ];
    await Promise.all(
      tenants.map(async (tenant) =>
        Sentry.withIsolationScope(async (scope) => {
          scope.setTag("tenant_id", tenant);
          scope.setUser({ email: secreto });
          scope.setExtra("formulario", secreto);
          await Promise.resolve();
          Sentry.captureException(new Error(secreto));
        }),
      ),
    );
    await Sentry.flush(1000);
    expect(JSON.stringify(sobres)).not.toContain(secreto);
    expect(sobres).toHaveLength(2);
    const etiquetas = sobres.map(
      (s) =>
        (s as [unknown, [[unknown, { tags: { tenant_id: string } }]]])[1][0][1]
          .tags.tenant_id,
    );
    expect(etiquetas.sort()).toEqual(tenants);
  });
});
