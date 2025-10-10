-- Normalize existing genero values to the supported set
UPDATE "Operator"
SET "genero" = 'feminino'
WHERE "genero" NOT IN ('feminino', 'masculino');

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Operator" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "nome" TEXT NOT NULL,
    "sobrenome" TEXT NOT NULL,
    "genero" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL
);
INSERT INTO "new_Operator" ("createdAt", "email", "genero", "id", "nome", "passwordHash", "sobrenome", "updatedAt") SELECT "createdAt", "email", "genero", "id", "nome", "passwordHash", "sobrenome", "updatedAt" FROM "Operator";
DROP TABLE "Operator";
ALTER TABLE "new_Operator" RENAME TO "Operator";
CREATE UNIQUE INDEX "Operator_email_key" ON "Operator"("email");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
