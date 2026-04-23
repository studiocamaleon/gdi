-- Fase D.2 — Productividad multi-unidad.
-- Agrega `SEGUNDO` al enum `UnidadProceso` para soportar productividades
-- en segundos (routers, plotters de corte, etc. que se especifican en
-- mm/seg o pasada/seg).

ALTER TYPE "UnidadProceso" ADD VALUE IF NOT EXISTS 'SEGUNDO';
