ALTER TABLE "User" ADD COLUMN "fotoPerfilVersion" UUID;

CREATE TABLE "UserMfa" (
  "userId" UUID NOT NULL,
  "secret" JSONB,
  "activatedAt" TIMESTAMP(3),
  "pendingSecret" JSONB,
  "pendingId" UUID,
  "pendingSessionId" UUID,
  "pendingExpiresAt" TIMESTAMP(3),
  "lastUsedStep" INTEGER,
  "recoveryHashes" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "version" INTEGER NOT NULL DEFAULT 0,
  "failedAttempts" INTEGER NOT NULL DEFAULT 0,
  "lockedUntil" TIMESTAMP(3),
  CONSTRAINT "UserMfa_pkey" PRIMARY KEY ("userId"),
  CONSTRAINT "UserMfa_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE "MfaChallenge" (
  "tokenHash" TEXT NOT NULL,
  "userId" UUID NOT NULL,
  "destination" TEXT NOT NULL,
  "membershipId" UUID,
  "passwordStamp" TEXT NOT NULL,
  "mfaVersion" INTEGER NOT NULL,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "attempts" INTEGER NOT NULL DEFAULT 0,
  "usedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "MfaChallenge_pkey" PRIMARY KEY ("tokenHash"),
  CONSTRAINT "MfaChallenge_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "MfaChallenge_expiresAt_idx" ON "MfaChallenge"("expiresAt");
CREATE INDEX "MfaChallenge_userId_idx" ON "MfaChallenge"("userId");
