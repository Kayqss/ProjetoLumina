import bcrypt from 'bcryptjs';
import { PrismaClient } from '@prisma/client';
import express from 'express';

const prisma = new PrismaClient();
const router = express.Router();

const DEFAULT_SALT_ROUNDS = 12;
const MIN_PASSWORD_LENGTH = 8;
const ALLOWED_GENDER_VALUES = new Set(['feminino', 'masculino']);

function pickSaltRounds() {
  const raw = process.env.BCRYPT_SALT_ROUNDS;
  const parsed = Number.parseInt(raw, 10);
  if (Number.isFinite(parsed) && parsed >= 4 && parsed <= 15) {
    return parsed;
  }
  return DEFAULT_SALT_ROUNDS;
}

router.post('/register', async (req, res) => {
  try {
    const { nome, sobrenome, email, senha, genero } = req.body || {};

    const nomeClean = typeof nome === 'string' ? nome.trim() : '';
    const sobrenomeClean = typeof sobrenome === 'string' ? sobrenome.trim() : '';
    const emailClean = typeof email === 'string' ? email.trim().toLowerCase() : '';
    const generoClean = typeof genero === 'string' ? genero.trim().toLowerCase() : '';
    const senhaStr = typeof senha === 'string' ? senha : '';

    if (!nomeClean || !sobrenomeClean || !emailClean || !generoClean || !senhaStr) {
      return res.status(400).json({ error: 'Preencha todos os campos obrigat\\u00F3rios.' });
    }

    if (!/^\S+@\S+\.\S+$/.test(emailClean)) {
      return res.status(400).json({ error: 'E-mail inv\\u00E1lido.' });
    }

    if (!ALLOWED_GENDER_VALUES.has(generoClean)) {
      return res.status(400).json({ error: 'Selecione um g\\u00EAnero v\\u00E1lido.' });
    }

    if (senhaStr.length < MIN_PASSWORD_LENGTH) {
      return res
        .status(400)
        .json({ error: `A senha deve ter pelo menos ${MIN_PASSWORD_LENGTH} caracteres.` });
    }

    const saltRounds = pickSaltRounds();
    const passwordHash = await bcrypt.hash(senhaStr, saltRounds);

    const operator = await prisma.operator.create({
      data: {
        nome: nomeClean,
        sobrenome: sobrenomeClean,
        email: emailClean,
        genero: generoClean,
        passwordHash,
      },
    });

    res.status(201).json({
      id: operator.id,
      nome: operator.nome,
      sobrenome: operator.sobrenome,
      genero: operator.genero,
      email: operator.email,
      createdAt: operator.createdAt,
    });
  } catch (err) {
    if (err?.code === 'P2002') {
      return res.status(409).json({ error: 'E-mail já cadastrado.' });
    }
    console.error('[POST /operators/register] error:', err?.message || err);
    res.status(500).json({ error: 'Erro interno ao registrar operador.' });
  }
});

router.post('/login', async (req, res) => {
  try {
    const { email, senha } = req.body || {};

    const emailClean = typeof email === 'string' ? email.trim().toLowerCase() : '';
    const senhaStr = typeof senha === 'string' ? senha : '';

    if (!emailClean || !senhaStr) {
      return res.status(400).json({ error: 'Informe email e senha.' });
    }

    const operator = await prisma.operator.findUnique({
      where: { email: emailClean },
    });

    if (!operator) {
      return res.status(401).json({ error: 'Credenciais invalidas.' });
    }

    const isValid = await bcrypt.compare(senhaStr, operator.passwordHash);
    if (!isValid) {
      return res.status(401).json({ error: 'Credenciais invalidas.' });
    }

    res.json({
      id: operator.id,
      nome: operator.nome,
      sobrenome: operator.sobrenome,
      genero: operator.genero,
      email: operator.email,
      createdAt: operator.createdAt,
    });
  } catch (err) {
    console.error('[POST /operators/login] error:', err?.message || err);
    res.status(500).json({ error: 'Erro interno ao autenticar.' });
  }
});

export default router;
