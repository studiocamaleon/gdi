-- Config regional del tenant: moneda, zona horaria y redondeo de pricing.
-- Defaults argentinos: cero impacto en los tenants existentes.
-- La moneda es etiqueta+formato, nunca conversión (D1/D2); el catálogo con
-- símbolo y decimales vive en código.
-- Ver docs/multi-moneda-zona-horaria-diseno.md
ALTER TABLE "DatosEmpresa"
    ADD COLUMN "monedaCodigo" VARCHAR(3) NOT NULL DEFAULT 'ARS',
    ADD COLUMN "zonaHoraria" VARCHAR(64) NOT NULL DEFAULT 'America/Argentina/Buenos_Aires',
    ADD COLUMN "redondeoPrecio" VARCHAR(10) NOT NULL DEFAULT 'moneda';
