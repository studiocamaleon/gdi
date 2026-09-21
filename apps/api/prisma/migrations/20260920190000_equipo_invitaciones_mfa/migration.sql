ALTER TABLE "UserMfa" ADD COLUMN "recuperacionConfirmadaEl" TIMESTAMP(3), ADD COLUMN "recoveryPendingSessionId" UUID;
ALTER TABLE "AuthSession" ADD COLUMN "mfaVerificadoEl" TIMESTAMP(3);
CREATE TABLE "InvitacionPlataforma" (
  "id" UUID NOT NULL,
  "email" TEXT NOT NULL,
  "rol" "RolPlataforma" NOT NULL,
  "tokenHash" TEXT NOT NULL,
  "invitadorId" UUID NOT NULL,
  "creadaEl" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "venceEl" TIMESTAMP(3) NOT NULL,
  "revocadaEl" TIMESTAMP(3),
  "aceptadaEl" TIMESTAMP(3),
  "aceptadaPorId" UUID,
  CONSTRAINT "InvitacionPlataforma_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "InvitacionPlataforma_tokenHash_key" ON "InvitacionPlataforma"("tokenHash");
CREATE INDEX "InvitacionPlataforma_email_creadaEl_idx" ON "InvitacionPlataforma"("email", "creadaEl");
CREATE INDEX "InvitacionPlataforma_invitadorId_idx" ON "InvitacionPlataforma"("invitadorId");
ALTER TABLE "InvitacionPlataforma" ADD CONSTRAINT "InvitacionPlataforma_invitadorId_fkey" FOREIGN KEY ("invitadorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "MfaChallenge" ADD COLUMN "invitacionPlataformaId" UUID;
ALTER TABLE "MfaChallenge" ADD CONSTRAINT "MfaChallenge_invitacionPlataformaId_fkey" FOREIGN KEY ("invitacionPlataformaId") REFERENCES "InvitacionPlataforma"("id") ON DELETE CASCADE ON UPDATE CASCADE;
