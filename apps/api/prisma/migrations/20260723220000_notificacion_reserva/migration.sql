-- Reserva atómica del despachador de WhatsApp: la fila pasa a 'enviando'
-- antes de llamar a Wati, así dos procesos no mandan el mismo mensaje.

-- AlterTable
ALTER TABLE "NotificacionWhatsapp" ADD COLUMN "reservadaEl" TIMESTAMP(3);
