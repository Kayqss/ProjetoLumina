import { PrismaClient } from "@prisma/client";
import express from "express";
import { gerarReviewIA } from "../services/aiReviewService.js";
import { requireOperatorId } from "../utils/operatorContext.js";

const prisma = new PrismaClient();
const router = express.Router();

// Create an evaluation for a patient
router.post("/:patientId", async (req, res) => {
  try {
    const operatorId = requireOperatorId(req, res);
    if (!operatorId) return;

    const patientId = Number(req.params.patientId);
    if (!Number.isFinite(patientId)) {
      return res.status(400).json({ error: "Invalid patientId" });
    }

    const patient = await prisma.patient.findFirst({
      where: { id: patientId, operatorId },
      select: { id: true },
    });
    if (!patient) {
      return res.status(404).json({ error: "Patient not found" });
    }

    const body = req.body ?? {};
    const circunferenciasRaw = parseObject(body.circunferencias);
    const metodo3DobrasRaw = parseNullableObject(body.metodo3Dobras);

    const created = await prisma.evaluation.create({
      data: {
        patientId: patient.id,
        peso: toFloat(body.peso),
        alturaCm: toFloat(body.altura),
        imc: toFloat(body.imc),
        cintura: toFloat(circunferenciasRaw?.cintura),
        quadril: toFloat(circunferenciasRaw?.quadril),
        abdomen: toFloat(circunferenciasRaw?.abdomen),
        bracoRelaxado: toFloat(circunferenciasRaw?.bracoRelaxado),
        bracoContraido: toFloat(circunferenciasRaw?.bracoContraido),
        coxa: toFloat(circunferenciasRaw?.coxa),
        panturrilha: toFloat(circunferenciasRaw?.panturrilha),
        peitoralMm: toFloat(metodo3DobrasRaw?.peitoralMm),
        abdomenMm: toFloat(metodo3DobrasRaw?.abdomenMm),
        coxaMm: toFloat(metodo3DobrasRaw?.coxaMm),
      },
    });

    gerarReviewIA({ patientId }).catch((err) => {
      console.error("[IA review] falhou:", err);
    });

    res.status(201).json(toPublicEvaluation(created));
  } catch (err) {
    if (err?.code === "P2003") {
      return res.status(404).json({ error: "Patient not found" });
    }
    console.error("[POST /evaluations/:patientId] error:", err);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

// List evaluations for a patient
router.get("/patient/:patientId", async (req, res) => {
  try {
    const operatorId = requireOperatorId(req, res);
    if (!operatorId) return;

    const patientId = Number(req.params.patientId);
    if (!Number.isFinite(patientId)) {
      return res.status(400).json({ error: "Invalid patientId" });
    }

    const patient = await prisma.patient.findFirst({
      where: { id: patientId, operatorId },
      select: { id: true },
    });
    if (!patient) {
      return res.status(404).json({ error: "Patient not found" });
    }

    const items = await prisma.evaluation.findMany({
      where: { patientId: patient.id },
      orderBy: { createdAt: "desc" },
    });

    res.json(items.map(toPublicEvaluation));
  } catch (err) {
    console.error("[GET /evaluations/patient/:patientId] error:", err);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

// Delete evaluation by id
router.delete("/:id", async (req, res) => {
  try {
    const operatorId = requireOperatorId(req, res);
    if (!operatorId) return;

    const id = Number(req.params.id);
    if (!Number.isFinite(id)) {
      return res.status(400).json({ error: "Invalid id" });
    }

    const existing = await prisma.evaluation.findFirst({
      where: { id, patient: { operatorId } },
      select: { id: true },
    });

    if (!existing) {
      return res.status(404).json({ error: "Not Found" });
    }

    await prisma.evaluation.delete({ where: { id: existing.id } });

    res.status(204).send();
  } catch (err) {
    if (err?.code === "P2025") {
      return res.status(404).json({ error: "Not Found" });
    }
    console.error("[DELETE /evaluations/:id] error:", err);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

export default router;

function parseObject(value) {
  if (!value) return {};
  if (typeof value === "object") return value;
  if (typeof value !== "string") return {};
  const trimmed = value.trim();
  if (!trimmed) return {};
  try {
    const parsed = JSON.parse(trimmed);
    return typeof parsed === "object" && parsed !== null ? parsed : {};
  } catch {
    return {};
  }
}

function parseNullableObject(value) {
  if (!value) return null;
  if (typeof value === "object") return value;
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed || trimmed === "null") return null;
  try {
    const parsed = JSON.parse(trimmed);
    return typeof parsed === "object" && parsed !== null ? parsed : null;
  } catch {
    return null;
  }
}

function toPublicEvaluation(evaluation) {
  return evaluation;
}

function toFloat(value) {
  if (value === undefined || value === null || value === "") return null;
  const normalized = String(value).replace(",", ".");
  const numberValue = parseFloat(normalized);
  return Number.isFinite(numberValue) ? numberValue : null;
}
