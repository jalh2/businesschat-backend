// Simple request/response logger with safe masking
function mask(obj) {
  if (!obj || typeof obj !== 'object') return obj;
  try {
    const clone = JSON.parse(JSON.stringify(obj));
    if (clone.password) clone.password = '***';
    if (clone.confirmPassword) clone.confirmPassword = '***';
    if (clone.token) clone.token = '***';
    return clone;
  } catch (_) {
    return {};
  }
}

function requestLogger(req, res, next) {
  const start = Date.now();
  const meta = {
    method: req.method,
    url: req.originalUrl || req.url,
    userId: req.user?.id || null,
    query: req.query,
    body: mask(req.body),
  };
  // eslint-disable-next-line no-console
  console.log('[REQ]', JSON.stringify(meta));

  res.on('finish', () => {
    const duration = Date.now() - start;
    // eslint-disable-next-line no-console
    console.log('[RES]', JSON.stringify({
      method: meta.method,
      url: meta.url,
      status: res.statusCode,
      durationMs: duration,
      userId: meta.userId,
    }));
  });

  next();
}

module.exports = { requestLogger };
