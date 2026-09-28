-- Metadatos de la copia enviada a Meta; nunca referencia al archivo original del cliente.
ALTER TABLE "InboxEnvio" ADD COLUMN "adjunto" JSONB;
