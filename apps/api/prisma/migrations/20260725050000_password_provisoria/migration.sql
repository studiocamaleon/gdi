-- La clave la puso un administrador y hay que cambiarla al entrar.
--
-- Sin esto, restablecerle la clave a alguien dejaba al admin sabiendo con qué
-- clave trabaja esa persona para siempre, y la auditoría de quién hizo qué
-- pasaba a ser discutible. Con el flag, la clave que el admin conoce sólo sirve
-- para el primer ingreso: el sistema no deja entrar a ningún lado sin cambiarla.
--
-- Ver docs/usuarios-roles-permisos-diseno.md
ALTER TABLE "User" ADD COLUMN "debeCambiarPassword" BOOLEAN NOT NULL DEFAULT false;
