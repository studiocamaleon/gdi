-- Nombre legible de a qué apunta el cupón ("Cartelería", "Coop. La Esperanza").
-- Se congela al crearlo: `alcanceRef` guarda el código/id con el que filtra el
-- motor, pero mostrarlo crudo en la UI obliga a resolver catálogos por cada
-- card (y a que el usuario entienda códigos internos).
ALTER TABLE "Cupon" ADD COLUMN "alcanceNombre" TEXT;
