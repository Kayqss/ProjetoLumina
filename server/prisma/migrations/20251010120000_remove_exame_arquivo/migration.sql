PRAGMA foreign_keys=OFF;

CREATE TABLE "new_Evaluation" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "patientId" INTEGER NOT NULL,
    "peso" REAL,
    "alturaCm" REAL,
    "imc" REAL,
    "cintura" REAL,
    "quadril" REAL,
    "abdomen" REAL,
    "bracoRelaxado" REAL,
    "bracoContraido" REAL,
    "coxa" REAL,
    "panturrilha" REAL,
    "peitoralMm" REAL,
    "abdomenMm" REAL,
    "coxaMm" REAL,
    CONSTRAINT "Evaluation_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

INSERT INTO "new_Evaluation" (
    "id",
    "createdAt",
    "updatedAt",
    "patientId",
    "peso",
    "alturaCm",
    "imc",
    "cintura",
    "quadril",
    "abdomen",
    "bracoRelaxado",
    "bracoContraido",
    "coxa",
    "panturrilha",
    "peitoralMm",
    "abdomenMm",
    "coxaMm"
)
SELECT
    "id",
    "createdAt",
    "updatedAt",
    "patientId",
    "peso",
    "alturaCm",
    "imc",
    "cintura",
    "quadril",
    "abdomen",
    "bracoRelaxado",
    "bracoContraido",
    "coxa",
    "panturrilha",
    "peitoralMm",
    "abdomenMm",
    "coxaMm"
FROM "Evaluation";

DROP TABLE "Evaluation";
ALTER TABLE "new_Evaluation" RENAME TO "Evaluation";

PRAGMA foreign_key_check;
PRAGMA foreign_keys=ON;
