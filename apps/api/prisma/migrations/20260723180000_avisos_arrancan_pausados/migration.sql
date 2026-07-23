-- Los avisos arrancan PAUSADOS.
--
-- Conectar Wati y tener las plantillas aprobadas no puede ser lo mismo que
-- empezar a escribirle a todos los clientes de la imprenta. Encender eso tiene
-- que ser un acto deliberado, con alguien mirando.
--
-- Sólo cambia el default: a quien ya lo tenía configurado no se le toca nada.
ALTER TABLE "ConfiguracionNotificaciones" ALTER COLUMN "pausado" SET DEFAULT true;
