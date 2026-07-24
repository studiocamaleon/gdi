-- Cancelación (o pausa) programada en la pasarela. Paddle deja la suscripción
-- en 'active' con un scheduled_change hasta el fin del período; sin guardarlo,
-- la pantalla del tenant diría "Activa" y no vería que se termina.
ALTER TABLE "Suscripcion" ADD COLUMN "cambioProgramado" TEXT;
ALTER TABLE "Suscripcion" ADD COLUMN "cambioProgramadoEl" TIMESTAMP(3);
