ALTER TABLE "PlanOfertaPrecio" DROP CONSTRAINT "PlanOfertaPrecio_condiciones_check";
ALTER TABLE "PlanOfertaPrecio" ADD CONSTRAINT "PlanOfertaPrecio_condiciones_check" CHECK (
  "entorno" IN ('sandbox','production') AND
  (("tipo" IN ('base','usuario') AND "ciclo" IN ('mensual','anual')) OR
   ("tipo" = 'implementacion' AND "ciclo" = 'unico' AND "cantidadMaxima" = 1)) AND
  "importe" > 0 AND "moneda" = 'USD' AND "cantidadMaxima" BETWEEN 1 AND 10000
);
ALTER TABLE "PlanPaddleRecurso" ADD CONSTRAINT "PlanPaddleRecurso_versionId_fkey" FOREIGN KEY ("versionId") REFERENCES "PlanVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PlanPaddleRecurso" ADD CONSTRAINT "PlanPaddleRecurso_estado_check" CHECK ("estado" IN ('pendiente','enviando','verificar','listo') AND "entorno" IN ('sandbox','production'));
