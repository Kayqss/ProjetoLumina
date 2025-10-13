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
  const baseOptions = { ...options };
  const forcedHeaders = { "ngrok-skip-browser-warning": "true" };

  if (operatorId) {
    forcedHeaders["x-operator-id"] = String(operatorId);
  }

  const forcedEntries = Object.entries(forcedHeaders);
  if (forcedEntries.length === 0) {
    return baseOptions;
  }

  const existingHeaders = options.headers;

  if (!existingHeaders) {
    baseOptions.headers = forcedHeaders;
  } else if (existingHeaders instanceof Headers) {
    const headersCopy = new Headers(existingHeaders);
    forcedEntries.forEach(([key, value]) => headersCopy.set(key, value));
    baseOptions.headers = headersCopy;
  } else if (Array.isArray(existingHeaders)) {
    const headersCopy = new Headers(existingHeaders);
    forcedEntries.forEach(([key, value]) => headersCopy.set(key, value));
    baseOptions.headers = Array.from(headersCopy.entries());
  } else {
    baseOptions.headers = {
      ...existingHeaders,
      ...forcedHeaders,
    };
  }

  return baseOptions;
}

export function fetchWithOperator(input, options) {
  return fetch(input, withOperator(options));
}
