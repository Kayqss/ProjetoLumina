-- CreateTable
CREATE TABLE "Patient" (
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
    "anotacoes" TEXT NOT NULL DEFAULT ''
);

-- CreateTable
CREATE TABLE "Evaluation" (
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

-- CreateIndex
CREATE UNIQUE INDEX "Patient_cpf_key" ON "Patient"("cpf");
