"use client";

import { useReportarError } from "@/hooks/use-reportar-error";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error;
  reset: () => void;
}) {
  useReportarError(error);
  return (
    <html lang="es">
      <body
        style={{
          margin: 0,
          background: "#f3f2ee",
          color: "#181b1c",
          fontFamily: "Arial, sans-serif",
        }}
      >
        <main
          style={{
            minHeight: "100dvh",
            display: "grid",
            placeContent: "center",
            padding: 32,
          }}
        >
          <p
            style={{ color: "#bd411d", fontSize: 12, letterSpacing: "0.14em" }}
          >
            GRAFOPRINT
          </p>
          <h1 style={{ fontSize: 30, marginBottom: 8 }}>
            No pudimos abrir esta vista.
          </h1>
          <p style={{ color: "#606466", maxWidth: 420, lineHeight: 1.6 }}>
            Podés volver a intentarlo. Si estabas completando un formulario,
            comprobá los últimos cambios guardados.
          </p>
          <button
            type="button"
            onClick={reset}
            style={{
              justifySelf: "start",
              background: "#181b1c",
              color: "#fff",
              border: 0,
              borderRadius: 8,
              padding: "12px 20px",
              fontSize: 14,
              cursor: "pointer",
            }}
          >
            Volver a intentar
          </button>
        </main>
      </body>
    </html>
  );
}
