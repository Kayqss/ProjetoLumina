import { PrismaClient } from '@prisma/client';
import express from 'express';
import { requireOperatorId } from '../utils/operatorContext.js';

const prisma = new PrismaClient();
const router = express.Router();

const MACRO_KEYS = ['fat', 'carbs', 'protein', 'fiber'];
const EMPTY_MACRO_TARGETS = Object.freeze({
  fat: '',
  carbs: '',
  protein: '',
  fiber: '',
});

// Create patient
router.post('/', async (req, res) => {
  try {
    const operatorId = requireOperatorId(req, res);
    if (!operatorId) return;

    const {
      genero,
      nome,
      sobrenome,
      cpf,
      nascimento, // string ISO: YYYY-MM-DD
      historicoClinico,
      medicacoes,
      alergias,
      telefone,
      telefones,
      anotacoes,
    } = req.body || {};

    if (!genero || !nome || !sobrenome || !cpf || !nascimento) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // normaliza telefones: aceita string separada, array de strings, campo singular
    const phones = normalizePhones(telefones ?? telefone);

    const mealPlanPayload = sanitizeMealPlan(
      Array.isArray(req.body?.mealPlan) ? req.body.mealPlan : []
    );
    const macroTargetsPayload = sanitizeMacroTargets(req.body?.macroTargets);

    const patient = await prisma.patient.create({
      data: {
        genero,
        nome,
        sobrenome,
        cpf,
        operatorId,
        nascimento: new Date(nascimento),
        historicoClinico: historicoClinico || '',
        medicacoes: medicacoes || '',
        alergias: alergias || '',
        anotacoes: anotacoes || '',
        telefones: JSON.stringify(Array.isArray(phones) ? phones : []),
        mealPlan: JSON.stringify(mealPlanPayload),
        macroTargets: JSON.stringify(macroTargetsPayload),
      },
    });

    res.status(201).json(patient);
  } catch (err) {
    if (err?.code === 'P2002') {
      return res.status(409).json({ error: 'CPF already exists' });
    }
    console.error('[POST /patients] error:', err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// List/search patients with optional pagination
router.get('/', async (req, res) => {
  try {
    const operatorId = requireOperatorId(req, res);
    if (!operatorId) return;

    const { name, cpf } = req.query;
    const order = String(req.query.order || '').toLowerCase();
    // Pagination
    let take = parseInt(req.query.take, 10);
    let skip = parseInt(req.query.skip, 10);
    if (!Number.isFinite(take) || take <= 0) take = 10;
    if (!Number.isFinite(skip) || skip < 0) skip = 0;
    // clamp
    if (take > 50) take = 50;
    const where = { operatorId };
    if (name) {
      const terms = String(name).trim().split(/\s+/).filter(Boolean);
      if (terms.length > 0) {
        // SQLite does not support `mode: 'insensitive'` in Prisma filters.
        // Use basic contains for each term on first or last name.
        where.AND = terms.map((t) => ({
          OR: [
            { nome: { contains: t } },
            { sobrenome: { contains: t } },
          ],
        }));
      }
    }
    if (cpf) where.cpf = String(cpf);

    let orderBy = { createdAt: 'desc' };
    if (order === 'az') orderBy = [{ nome: 'asc' }, { sobrenome: 'asc' }];
    else if (order === 'za') orderBy = [{ nome: 'desc' }, { sobrenome: 'desc' }];
    else if (order === 'id_asc') orderBy = { id: 'asc' };
    else if (order === 'id_desc') orderBy = { id: 'desc' };

    const patients = await prisma.patient.findMany({
      where,
      orderBy,
      skip,
      take,
    });
    res.json(patients);
  } catch (err) {
    console.error('[GET /patients] error:', err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// Meal plan endpoints
router.get('/:id/meal-plan', async (req, res) => {
  try {
    const operatorId = requireOperatorId(req, res);
    if (!operatorId) return;

    const id = Number(req.params.id);
    if (!Number.isFinite(id)) return res.status(400).json({ error: 'Invalid id' });

    const patient = await prisma.patient.findFirst({
      where: { id, operatorId },
      select: { mealPlan: true, macroTargets: true },
    });
    if (!patient) return res.status(404).json({ error: 'Not Found' });

    res.json({
      meals: parseMealPlan(patient.mealPlan),
      macroTargets: parseMacroTargets(patient.macroTargets),
    });
  } catch (err) {
    console.error('[GET /patients/:id/meal-plan] error:', err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

router.put('/:id/meal-plan', async (req, res) => {
  try {
    const operatorId = requireOperatorId(req, res);
    if (!operatorId) return;

    const id = Number(req.params.id);
    if (!Number.isFinite(id)) return res.status(400).json({ error: 'Invalid id' });

    const existing = await prisma.patient.findFirst({
      where: { id, operatorId },
      select: { id: true },
    });
    if (!existing) return res.status(404).json({ error: 'Not Found' });

    if (!Array.isArray(req.body?.meals)) {
      return res.status(400).json({ error: 'meals must be an array' });
    }

    const sanitizedMeals = sanitizeMealPlan(req.body.meals);
    const updateData = {
      mealPlan: JSON.stringify(sanitizedMeals),
    };
    if (req.body.macroTargets !== undefined) {
      updateData.macroTargets = JSON.stringify(
        sanitizeMacroTargets(req.body.macroTargets)
      );
    }

    const updated = await prisma.patient.update({
      where: { id: existing.id },
      data: updateData,
      select: { mealPlan: true, macroTargets: true },
    });

    res.json({
      meals: parseMealPlan(updated.mealPlan),
      macroTargets: parseMacroTargets(updated.macroTargets),
    });
  } catch (err) {
    if (err?.code === 'P2025') {
      return res.status(404).json({ error: 'Not Found' });
    }
    console.error('[PUT /patients/:id/meal-plan] error:', err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});
router.delete('/:id/meal-plan/:mealId', async (req, res) => {
  try {
    const operatorId = requireOperatorId(req, res);
    if (!operatorId) return;

    const id = Number(req.params.id);
    if (!Number.isFinite(id)) return res.status(400).json({ error: 'Invalid id' });
    const mealId = String(req.params.mealId || '').trim();
    if (!mealId) return res.status(400).json({ error: 'Invalid meal id' });

    const patient = await prisma.patient.findFirst({
      where: { id, operatorId },
      select: { id: true, mealPlan: true, macroTargets: true },
    });
    if (!patient) return res.status(404).json({ error: 'Not Found' });

    const meals = parseMealPlan(patient.mealPlan);
    const filtered = meals.filter((meal) => meal.id !== mealId);
    if (filtered.length === meals.length) {
      return res.status(404).json({ error: 'Meal Not Found' });
    }

    const updated = await prisma.patient.update({
      where: { id: patient.id },
      data: { mealPlan: JSON.stringify(filtered) },
      select: { mealPlan: true, macroTargets: true },
    });

    res.json({
      meals: parseMealPlan(updated.mealPlan),
      macroTargets: parseMacroTargets(updated.macroTargets),
    });
  } catch (err) {
    if (err?.code === 'P2025') {
      return res.status(404).json({ error: 'Not Found' });
    }
    console.error('[DELETE /patients/:id/meal-plan/:mealId] error:', err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});


// Get patient by id
router.get('/:id', async (req, res) => {
  try {
    const operatorId = requireOperatorId(req, res);
    if (!operatorId) return;

    const id = Number(req.params.id);
    if (!Number.isFinite(id)) return res.status(400).json({ error: 'Invalid id' });

    const patient = await prisma.patient.findFirst({ where: { id, operatorId } });
    if (!patient) return res.status(404).json({ error: 'Not Found' });
    res.json(patient);
  } catch (err) {
    console.error('[GET /patients/:id] error:', err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// Update patient
router.put('/:id', async (req, res) => {
  try {
    const operatorId = requireOperatorId(req, res);
    if (!operatorId) return;

    const id = Number(req.params.id);
    if (!Number.isFinite(id)) return res.status(400).json({ error: 'Invalid id' });

    const existing = await prisma.patient.findFirst({
      where: { id, operatorId },
      select: { id: true },
    });
    if (!existing) return res.status(404).json({ error: 'Not Found' });

    const data = { ...req.body };
    delete data.operatorId;

    if (data.nascimento) data.nascimento = new Date(data.nascimento);
    if (data.telefones !== undefined || data.telefone !== undefined) {
      const phones = normalizePhones(data.telefones ?? data.telefone);
      data.telefones = JSON.stringify(Array.isArray(phones) ? phones : []);
      delete data.telefone;
    }

    if (data.mealPlan !== undefined) {
      const planArray = Array.isArray(data.mealPlan) ? data.mealPlan : [];
      data.mealPlan = JSON.stringify(sanitizeMealPlan(planArray));
    }
    if (data.macroTargets !== undefined) {
      data.macroTargets = JSON.stringify(sanitizeMacroTargets(data.macroTargets));
    }

    const updated = await prisma.patient.update({ where: { id: existing.id }, data });
    res.json(updated);
  } catch (err) {
    if (err?.code === 'P2025') {
      return res.status(404).json({ error: 'Not Found' });
    }
    console.error('[PUT /patients/:id] error:', err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// Delete patient
router.delete('/:id', async (req, res) => {
  try {
    const operatorId = requireOperatorId(req, res);
    if (!operatorId) return;

    const id = Number(req.params.id);
    if (!Number.isFinite(id)) return res.status(400).json({ error: 'Invalid id' });

    const existing = await prisma.patient.findFirst({
      where: { id, operatorId },
      select: { id: true },
    });
    if (!existing) return res.status(404).json({ error: 'Not Found' });

    await prisma.patient.delete({ where: { id: existing.id } });
    res.status(204).send();
  } catch (err) {
    if (err?.code === 'P2025') {
      return res.status(404).json({ error: 'Not Found' });
    }
    console.error('[DELETE /patients/:id] error:', err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

export default router;

// Helpers
function normalizePhones(value) {
  try {
    if (Array.isArray(value)) {
      return Array.from(new Set(value.map(String).map((s) => s.trim()).filter(Boolean)));
    }
    if (typeof value === 'string') {
      const parts = value
        .split(/[;,\n]+/)
        .map((s) => s.trim())
        .filter(Boolean);
      return Array.from(new Set(parts));
    }
    return [];
  } catch {
    return [];
  }
}

function parseMealPlan(value) {
  try {
    const parsed = typeof value === 'string' ? JSON.parse(value) : value;
    return sanitizeMealPlan(Array.isArray(parsed) ? parsed : []);
  } catch {
    return [];
  }
}

function sanitizeMacroTargets(value) {
  const base = { ...EMPTY_MACRO_TARGETS };
  if (value && typeof value === 'object') {
    MACRO_KEYS.forEach((key) => {
      const raw = value[key];
      if (raw !== undefined && raw !== null) {
        base[key] = String(raw);
      }
    });
  }
  return base;
}

function parseMacroTargets(value) {
  try {
    const parsed = typeof value === 'string' ? JSON.parse(value) : value;
    return sanitizeMacroTargets(parsed && typeof parsed === 'object' ? parsed : {});
  } catch {
    return sanitizeMacroTargets({});
  }
}

function sanitizeMealPlan(meals) {
  if (!Array.isArray(meals)) return [];
  return meals.map((meal) => {
    const shaped = ensureMealShape(meal);
    return {
      id: shaped.id,
      time: shaped.time,
      title: shaped.title,
      note: shaped.note,
      energy: shaped.energy,
      fat: shaped.fat,
      carbs: shaped.carbs,
      protein: shaped.protein,
      fiber: shaped.fiber,
      foods: shaped.foods.map((food) => ({
        id: food.id,
        name: food.name,
        quantity: food.quantity,
        equivalents: food.equivalents.map((eq) => ({
          id: eq.id,
          name: eq.name,
          quantity: eq.quantity,
        })),
      })),
    };
  });
}

function ensureMealShape(meal) {
  const safeMeal = meal && typeof meal === 'object' ? meal : {};
  const foods = Array.isArray(safeMeal.foods) ? safeMeal.foods : [];
  return {
    id: ensureId(safeMeal.id),
    time: ensureString(safeMeal.time, '08:00'),
    title: ensureString(safeMeal.title, 'Nova refeicao'),
    note: ensureString(safeMeal.note),
    energy: ensureString(safeMeal.energy),
    fat: ensureString(safeMeal.fat),
    carbs: ensureString(safeMeal.carbs),
    protein: ensureString(safeMeal.protein),
    fiber: ensureString(safeMeal.fiber),
    foods: foods.map(ensureFoodShape),
  };
}

function ensureFoodShape(food) {
  const safeFood = food && typeof food === 'object' ? food : {};
  const equivalents = Array.isArray(safeFood.equivalents) ? safeFood.equivalents : [];
  return {
    id: ensureId(safeFood.id),
    name: ensureString(safeFood.name),
    quantity: ensureString(safeFood.quantity),
    equivalents: equivalents.map(ensureEquivalentShape),
  };
}

function ensureEquivalentShape(eq) {
  const safeEq = eq && typeof eq === 'object' ? eq : {};
  return {
    id: ensureId(safeEq.id),
    name: ensureString(safeEq.name),
    quantity: ensureString(safeEq.quantity),
  };
}

function ensureString(value, fallback = '') {
  if (typeof value === 'string') return value;
  if (value === null || value === undefined) return fallback;
  return String(value);
}

function ensureId(value) {
  const str = ensureString(value).trim();
  if (str) return str;
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}
