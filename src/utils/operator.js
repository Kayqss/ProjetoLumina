export function getOperatorContext() {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem("lumina-operator");
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return null;
    return parsed;
  } catch {
    return null;
  }
}

export function getOperatorId() {
  const context = getOperatorContext();
  const rawId =
    context?.id ??
    context?.operatorId ??
    context?.operatorID ??
    context?.profile?.id ??
    context?.profile?.operatorId;

  const numeric = Number(rawId);
  if (!Number.isFinite(numeric) || numeric <= 0) {
    return null;
  }
  return numeric;
}

export function withOperator(options = {}) {
  const operatorId = getOperatorId();
  if (!operatorId) return { ...options };

  const baseOptions = { ...options };
  const existingHeaders = options.headers;
  const operatorHeader = { "x-operator-id": String(operatorId) };

  if (!existingHeaders) {
    baseOptions.headers = operatorHeader;
  } else if (existingHeaders instanceof Headers) {
    const headersCopy = new Headers(existingHeaders);
    headersCopy.set("x-operator-id", String(operatorId));
    baseOptions.headers = headersCopy;
  } else if (Array.isArray(existingHeaders)) {
    const headersCopy = existingHeaders.slice();
    headersCopy.push(["x-operator-id", String(operatorId)]);
    baseOptions.headers = headersCopy;
  } else {
    baseOptions.headers = {
      ...existingHeaders,
      "x-operator-id": String(operatorId),
    };
  }

  return baseOptions;
}

export function fetchWithOperator(input, options) {
  return fetch(input, withOperator(options));
}