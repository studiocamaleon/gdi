-- Días con el local abierto al público, separado de la ventana de cortesía.
-- "Tu orden está lista, pasá a retirarla" mandado un sábado que la imprenta
-- produce pero no atiende hace que el cliente venga y encuentre cerrado.
ALTER TABLE "ConfiguracionNotificaciones"
  ADD COLUMN "diasAtencion" TEXT NOT NULL DEFAULT '1,2,3,4,5';
