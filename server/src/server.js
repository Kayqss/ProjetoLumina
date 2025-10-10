import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import patientsRouter from './routes/patients.js';
import evaluationsRouter from './routes/evaluations.js';
import appointmentsRouter from './routes/appointments.js';
import operatorsRouter from './routes/operators.js';

const app = express();
const PORT = process.env.PORT || 4000;

app.use(cors());
app.use(express.json({ limit: '2mb' }));

app.get('/health', (_req, res) => {
  res.json({ ok: true });
});

app.use('/patients', patientsRouter);
app.use('/evaluations', evaluationsRouter);
app.use('/appointments', appointmentsRouter);
app.use('/operators', operatorsRouter);

// Fallback
app.use((req, res) => {
  res.status(404).json({ error: 'Not Found', path: req.path });
});

app.listen(PORT, () => {
  console.log(`[lumina] API listening on http://localhost:${PORT}`);
});

