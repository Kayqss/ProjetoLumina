-- Add operatorId to Appointment and Patient tables with cascading FK
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;

CREATE TABLE "new_Appointment" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "operatorId" INTEGER,
    "patientId" INTEGER,
    "name" TEXT NOT NULL,
    "date" DATETIME NOT NULL,
    "time" TEXT NOT NULL,
    "comment" TEXT NOT NULL DEFAULT '',
    CONSTRAINT "Appointment_operatorId_fkey"
      FOREIGN KEY ("operatorId") REFERENCES "Operator" ("id")
      ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Appointment_patientId_fkey"
      FOREIGN KEY ("patientId") REFERENCES "Patient" ("id")
      ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Appointment" ("comment", "createdAt", "date", "id", "name", "patientId", "time", "updatedAt")
SELECT "comment", "createdAt", "date", "id", "name", "patientId", "time", "updatedAt"
FROM "Appointment";
DROP TABLE "Appointment";
ALTER TABLE "new_Appointment" RENAME TO "Appointment";

CREATE TABLE "new_Patient" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "operatorId" INTEGER,
    "genero" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "sobrenome" TEXT NOT NULL,
    "cpf" TEXT NOT NULL,
    "nascimento" DATETIME NOT NULL,
    "historicoClinico" TEXT NOT NULL,
    "medicacoes" TEXT NOT NULL,
    "alergias" TEXT NOT NULL,
    "anotacoes" TEXT NOT NULL DEFAULT '',
    "ultimaReviewIA" TEXT,
    "telefones" TEXT NOT NULL DEFAULT '[]',
    "mealPlan" TEXT NOT NULL DEFAULT '[]',
    "macroTargets" TEXT NOT NULL DEFAULT '{}',
    CONSTRAINT "Patient_operatorId_fkey"
      FOREIGN KEY ("operatorId") REFERENCES "Operator" ("id")
      ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_Patient" ("alergias", "anotacoes", "cpf", "createdAt", "genero", "historicoClinico", "id", "macroTargets", "mealPlan", "medicacoes", "nascimento", "nome", "sobrenome", "telefones", "ultimaReviewIA", "updatedAt")
SELECT "alergias", "anotacoes", "cpf", "createdAt", "genero", "historicoClinico", "id", "macroTargets", "mealPlan", "medicacoes", "nascimento", "nome", "sobrenome", "telefones", "ultimaReviewIA", "updatedAt"
FROM "Patient";
DROP TABLE "Patient";
ALTER TABLE "new_Patient" RENAME TO "Patient";

CREATE UNIQUE INDEX "Patient_cpf_key" ON "Patient"("cpf");

PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
