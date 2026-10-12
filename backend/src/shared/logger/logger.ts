const REDACTED_KEYS = new Set([
  "qrimage",
  "qrbase64",
  "authorization",
  "cookie",
  "cookies",
  "token",
  "password",
  "passwordhash",
  "accesstoken",
  "refreshtoken",
]);

function sanitize(fields?: Record<string, unknown>): Record<string, unknown> | undefined {
  if (!fields) {
    return undefined;
  }
  const safe: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(fields)) {
    safe[key] = REDACTED_KEYS.has(key.toLowerCase()) ? "[redacted]" : value;
  }
  return safe;
}

function write(level: string, message: string, fields?: Record<string, unknown>) {
  const entry = {
    level,
    message,
    time: new Date().toISOString(),
    ...sanitize(fields),
  };
  const line = JSON.stringify(entry);
  if (level === "error") {
    console.error(line);
    return;
  }
  console.log(line);
}

export const logger = {
  info(message: string, fields?: Record<string, unknown>) {
    write("info", message, fields);
  },
  warn(message: string, fields?: Record<string, unknown>) {
    write("warn", message, fields);
  },
  error(message: string, fields?: Record<string, unknown>) {
    write("error", message, fields);
  },
};
