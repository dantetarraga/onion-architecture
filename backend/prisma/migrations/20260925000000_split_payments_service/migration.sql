-- Extraccion de payments-service: la tabla payments se muda a la base propia
-- de payments-service (payments-postgres). No hay FK cross-database, asi que
-- aqui solo se elimina la tabla (y su enum); backend consulta los pagos por
-- gRPC (proto/payments.proto).
--
-- ATENCION: los pagos existentes en esta base NO se copian solos. En la demo
-- se parte de un seed limpio; si hubiera datos reales habria que exportar
-- payments (agregando branchId via parking_sessions -> parking_slots) e
-- importarlos en payments-service ANTES de aplicar esta migracion.

-- DropForeignKey
ALTER TABLE "payments" DROP CONSTRAINT "payments_sessionId_fkey";

-- DropTable
DROP TABLE "payments";

-- DropEnum
DROP TYPE "PaymentStatus";
