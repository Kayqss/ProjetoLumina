-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Patient" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "genero" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "sobrenome" TEXT NOT NULL,
    "cpf" TEXT NOT NULL,
    "nascimento" DATETIME NOT NULL,
    "historicoClinico" TEXT NOT NULL,
    "medicacoes" TEXT NOT NULL,
    "alergias" TEXT NOT NULL,
    "anotacoes" TEXT NOT NULL DEFAULT '',
    "telefones" TEXT NOT NULL DEFAULT '[]'
);
INSERT INTO "new_Patient" ("alergias", "anotacoes", "cpf", "createdAt", "genero", "historicoClinico", "id", "medicacoes", "nascimento", "nome", "sobrenome", "updatedAt") SELECT "alergias", "anotacoes", "cpf", "createdAt", "genero", "historicoClinico", "id", "medicacoes", "nascimento", "nome", "sobrenome", "updatedAt" FROM "Patient";
DROP TABLE "Patient";
ALTER TABLE "new_Patient" RENAME TO "Patient";
CREATE UNIQUE INDEX "Patient_cpf_key" ON "Patient"("cpf");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
