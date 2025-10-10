import express from 'express';
import { PrismaClient } from '@prisma/client';
import { requireOperatorId } from '../utils/operatorContext.js';

const prisma = new PrismaClient();
const router = express.Router();

// Helpers
function dateFromYMD(ymd) {
  try {
    const s = String(ymd || '');
    const base = s.includes('T') ? s.split('T')[0] : s;
    const [y, m, d] = base.split('-').map((x) => parseInt(x, 10));
    if (!y || !m || !d) return null;
    return new Date(y, m - 1, d);
  } catch { return null; }
}

// List appointments (optional filter by patientId)
router.get('/', async (req, res) => {
  try {
    const operatorId = requireOperatorId(req, res);
    if (!operatorId) return;

    const pid = req.query.patientId != null ? Number(req.query.patientId) : null;
    const where = { operatorId };
    if (pid != null && Number.isFinite(pid)) {
      where.patientId = pid;
    }
    const items = await prisma.appointment.findMany({
      where,
      orderBy: [{ date: 'desc' }, { time: 'desc' }],
    });
    // manter resposta compatível com o frontend (date como YYYY-MM-DD)
    const out = items.map((it) => ({
      id: it.id,
      name: it.name,
      date: it.date.toISOString().split('T')[0],
      time: it.time,
      comment: it.comment || '',
      patientId: it.patientId,
      createdAt: it.createdAt,
    }));
    res.json(out);
  } catch (e) {
    console.error('[GET /appointments] error:', e);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// Create appointment
router.post('/', async (req, res) => {
  try {
    const operatorId = requireOperatorId(req, res);
    if (!operatorId) return;

    const { name, date, time, comment, patientId } = req.body || {};
    if (!name || !date || !time) return res.status(400).json({ error: 'Missing required fields' });
    const dt = dateFromYMD(date);
    if (!dt) return res.status(400).json({ error: 'Invalid date' });

    let patientRef = null;
    if (patientId !== undefined && patientId !== null && patientId !== '') {
      const numericPatientId = Number(patientId);
      if (!Number.isFinite(numericPatientId) || numericPatientId <= 0) {
        return res.status(400).json({ error: 'Invalid patientId' });
      }
      const patient = await prisma.patient.findFirst({
        where: { id: numericPatientId, operatorId },
        select: { id: true },
      });
      if (!patient) {
        return res.status(404).json({ error: 'Patient not found' });
      }
      patientRef = patient.id;
    }

    const created = await prisma.appointment.create({
      data: {
        operatorId,
        name: String(name),
        date: dt,
        time: String(time),
        comment: comment ? String(comment) : '',
        patientId: patientRef,
      },
    });
    res.status(201).json({
      id: created.id,
      name: created.name,
      date: created.date.toISOString().split('T')[0],
      time: created.time,
      comment: created.comment || '',
      patientId: created.patientId,
      createdAt: created.createdAt,
    });
  } catch (e) {
    console.error('[POST /appointments] error:', e);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// Delete appointment by id
router.delete('/:id', async (req, res) => {
  try {
    const operatorId = requireOperatorId(req, res);
    if (!operatorId) return;

    const id = Number(req.params.id);
    if (!Number.isFinite(id)) return res.status(400).json({ error: 'Invalid id' });

    const existing = await prisma.appointment.findFirst({
      where: { id, operatorId },
      select: { id: true },
    });
    if (!existing) return res.status(404).json({ error: 'Not Found' });

    await prisma.appointment.delete({ where: { id: existing.id } });
    res.status(204).send();
  } catch (e) {
    if (e?.code === 'P2025') return res.status(404).json({ error: 'Not Found' });
    console.error('[DELETE /appointments/:id] error:', e);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

export default router;
