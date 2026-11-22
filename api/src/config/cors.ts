export interface ParsedOrigins {
  origins: string[];
  warnings: string[];
}

/**
 * CORS_ORIGIN is a comma-separated list of ORIGINS (scheme + host [+ port]), e.g. https://my-site.netlify.app.
 * People often paste a full page URL (with /login or a trailing slash), which would never match what the browser sends,
 * so each entry is reduced to its origin and a warning is produced for the logs.
 */
export function parseOrigins(raw: string): ParsedOrigins {
  const origins: string[] = [];
  const warnings: string[] = [];
  for (const part of raw.split(',')) {
    const entry = part.trim();
    if (!entry) continue;
    if (entry === '*') {
      warnings.push('CORS_ORIGIN "*" is not supported. List the exact site origins instead.');
      continue;
    }
    try {
      const origin = new URL(entry).origin;
      if (origin === 'null') throw new Error('opaque origin');
      if (entry !== origin) warnings.push(`CORS_ORIGIN entry "${entry}" is not a bare origin (no path or trailing slash allowed). Using "${origin}". Please fix the setting.`);
      if (!origins.includes(origin)) origins.push(origin);
    } catch {
      warnings.push(`Ignoring invalid CORS_ORIGIN entry "${entry}". Use the form https://your-site.netlify.app`);
    }
  }
  return { origins, warnings };
}
