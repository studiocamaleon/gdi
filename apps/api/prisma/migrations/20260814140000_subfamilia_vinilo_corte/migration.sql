-- Nueva subfamilia de materia prima: VINILO_CORTE (vinilo de corte de color
-- para plotter de corte), distinta del rollo flexible de impresión — así el
-- plotter de corte filtra su sustrato propio sin aceptar vinilo de impresión.
-- Ver docs/corte-sustrato-propio-o-heredado-diseno.md §6-§7.
ALTER TYPE "SubfamiliaMateriaPrima" ADD VALUE IF NOT EXISTS 'VINILO_CORTE' AFTER 'SUSTRATO_ROLLO_FLEXIBLE';
