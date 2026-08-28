-- Una misma identidad puede administrar varias empresas. Sólo puede haber una
-- solicitud pendiente por correo; las solicitudes completadas son historial.
DROP INDEX "RegistroTenant_email_key";
CREATE INDEX "RegistroTenant_email_createdAt_idx"
  ON "RegistroTenant"("email", "createdAt");
CREATE UNIQUE INDEX "RegistroTenant_email_pendiente_key"
  ON "RegistroTenant"("email")
  WHERE "completadoEl" IS NULL AND "revocadoEl" IS NULL;
