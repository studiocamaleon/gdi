ALTER TABLE "Suscripcion" ADD COLUMN "usuariosAdicionales" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Suscripcion" ADD CONSTRAINT "Suscripcion_usuariosAdicionales_no_negativos" CHECK ("usuariosAdicionales" >= 0);
