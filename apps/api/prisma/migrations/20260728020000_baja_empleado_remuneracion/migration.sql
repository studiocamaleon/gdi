-- Los sueldos salen del legajo. La remuneración dejó de ser el puente que
-- alimentaba a los centros de costo: desde la carga manual, el centro declara
-- en su planilla lo que absorbe de cada persona, y la nómina completa vive en
-- Gastos fijos. Nadie lee más esta tabla.
--
-- Respaldo de las filas antes de borrar: scripts/backup-pre-g5-remuneraciones.sql

DROP TABLE "EmpleadoRemuneracion";

-- Los permisos son strings sueltos dentro de Rol.permisos, así que la clave del
-- catálogo que se retira queda huérfana en los roles que la tenían. Nadie la
-- consulta, pero dejarla haría que la pantalla de roles muestre un permiso que
-- ya no existe.
UPDATE "Rol"
SET permisos = array_remove(permisos, 'registros.ver_remuneraciones')
WHERE 'registros.ver_remuneraciones' = ANY(permisos);
