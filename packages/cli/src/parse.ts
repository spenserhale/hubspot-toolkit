export function parseJsonFlag<T>(raw: string, flagName: string): T {
  try {
    return JSON.parse(raw) as T;
  } catch {
    console.error(`Validation error: --${flagName} must be valid JSON`);
    return process.exit(2);
  }
}

export function parseCsv(raw?: string): string[] | undefined {
  if (!raw) return undefined;
  return raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}
