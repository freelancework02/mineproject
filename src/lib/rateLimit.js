const buckets = new Map();

export function rateLimit(req, res, options = {}) {
  const limit = options.limit || 30;
  const windowMs = options.windowMs || 60 * 1000;
  const forwarded = req.headers["x-forwarded-for"];
  const ip = Array.isArray(forwarded) ? forwarded[0] : forwarded || req.socket.remoteAddress || "unknown";
  const key = `${req.method}:${req.url}:${ip}`;
  const now = Date.now();
  const record = buckets.get(key) || { count: 0, resetAt: now + windowMs };

  if (record.resetAt < now) {
    record.count = 0;
    record.resetAt = now + windowMs;
  }

  record.count += 1;
  buckets.set(key, record);

  if (record.count > limit) {
    res.status(429).json({ error: "Too many requests. Please try again shortly." });
    return false;
  }

  return true;
}
