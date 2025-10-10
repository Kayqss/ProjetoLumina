export function getOperatorIdFromRequest(req) {
  const headerValue = req?.headers?.['x-operator-id'] ?? req?.headers?.['X-Operator-Id'];
  const queryValue = req?.query?.operatorId ?? req?.query?.operatorID;
  const bodyValue = req?.body?.operatorId ?? req?.body?.operatorID;

  const raw =
    headerValue !== undefined && headerValue !== null
      ? headerValue
      : queryValue !== undefined && queryValue !== null
      ? queryValue
      : bodyValue;

  const numeric = Number(raw);
  if (!Number.isFinite(numeric) || numeric <= 0) {
    return null;
  }
  return numeric;
}

export function requireOperatorId(req, res) {
  const operatorId = getOperatorIdFromRequest(req);
  if (!operatorId) {
    res.status(401).json({ error: 'Operador não autenticado.' });
    return null;
  }
  return operatorId;
}
