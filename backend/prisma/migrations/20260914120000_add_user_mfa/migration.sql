-- AlterTable
ALTER TABLE "users" ADD COLUMN     "mfaEnabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "totpSecretEnc" TEXT,
ADD COLUMN     "totpLastStep" INTEGER,
ADD COLUMN     "mfaBackupCodes" TEXT[] DEFAULT ARRAY[]::TEXT[];
