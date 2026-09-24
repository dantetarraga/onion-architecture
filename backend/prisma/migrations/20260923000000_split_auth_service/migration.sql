-- Extraccion de auth-service: User (y sus credenciales/MFA) se muda a una
-- base de datos propia. No existe FK cross-database en Postgres, asi que
-- reservations/parking_sessions/payments dejan de tener una relacion Prisma
-- hacia users: userId pasa a ser un id opaco (sigue siendo la misma columna
-- y el mismo indice, solo se elimina la FK y la tabla referenciada).
--
-- NOTA: generada a mano comparando el schema.prisma anterior/actual, porque
-- `prisma migrate dev`/`migrate diff --from-migrations` requieren una base de
-- datos (shadow o real) para calcular el diff, y no habia Postgres disponible
-- en este entorno (Docker no estaba corriendo). Antes de aplicarla contra la
-- base de datos real, correr `npx prisma migrate deploy` en un entorno con
-- Postgres y confirmar que `npx prisma validate` / el arranque del backend no
-- reportan drift.

-- DropForeignKey
ALTER TABLE "reservations" DROP CONSTRAINT "reservations_userId_fkey";

-- DropForeignKey
ALTER TABLE "parking_sessions" DROP CONSTRAINT "parking_sessions_userId_fkey";

-- DropForeignKey
ALTER TABLE "payments" DROP CONSTRAINT "payments_userId_fkey";

-- DropTable
DROP TABLE "users";

-- DropEnum
DROP TYPE "Role";
