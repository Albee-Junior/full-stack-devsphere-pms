export function notFound(req, res) {
  res.status(404).json({ error: `No route found for ${req.method} ${req.path}.` });
}

export function errorHandler(error, req, res, next) {
  if (res.headersSent) return next(error);
  const status = Number(error.status) || 500;
  if (status >= 500) console.error(error);
  res.status(status).json({
    error: status >= 500 ? "Something went wrong. Please try again." : error.message,
  });
}

export function httpError(status, message) {
  const error = new Error(message);
  error.status = status;
  return error;
}

export function requireText(value, label, maxLength = 2000) {
  if (typeof value !== "string" || !value.trim()) {
    throw httpError(400, `${label} is required.`);
  }
  if (value.trim().length > maxLength) {
    throw httpError(400, `${label} must be ${maxLength} characters or fewer.`);
  }
  return value.trim();
}
