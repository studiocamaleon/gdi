-- Punto de convergencia del componente fabricado dentro del grafo padre.
ALTER TABLE "ProductoRecetaComponente"
  ADD COLUMN "nodoIncorporacionClave" VARCHAR(160);
