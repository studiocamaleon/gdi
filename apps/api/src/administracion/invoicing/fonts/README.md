# Geist para el PDF de los comprobantes

Estos TTF son la misma familia que usa la app (`next/font/google` → Geist),
para que la factura impresa se vea como el sistema.

Van acá y no se toman de `next/font` porque éste sólo expone `woff2` y jsPDF
necesita TTF. Son el subset **latin** que sirve Google Fonts (32 KB cada uno)
y cubren acentos, ñ y los símbolos que lleva un comprobante.

Origen: `https://fonts.googleapis.com/css?family=Geist:400,700` (la API v1
devuelve TTF; la v2 sólo woff2). Versión v5, bajados el 2026-07-16.

`nest-cli.json` los copia a `dist` con `assets`, así que `__dirname` los
encuentra tanto con ts-node como compilados.
