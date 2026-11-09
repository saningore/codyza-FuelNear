export function usingFixtures(env: NodeJS.ProcessEnv = process.env): boolean {
  return env.FUELNEAR_USE_FIXTURES === "1";
}

export function assertLiveData(env: NodeJS.ProcessEnv = process.env): void {
  if (usingFixtures(env)) {
    throw new Error("FuelNear refuses to start with sample stations. Unset FUELNEAR_USE_FIXTURES.");
  }
}

export function googleConfigured(env: NodeJS.ProcessEnv = process.env): boolean {
  return Boolean(env.GOOGLE_MAPS_API_KEY?.trim());
}

export function eiaConfigured(env: NodeJS.ProcessEnv = process.env): boolean {
  return Boolean(env.EIA_API_KEY?.trim());
}

export function nrelConfigured(env: NodeJS.ProcessEnv = process.env): boolean {
  return Boolean(env.NREL_API_KEY?.trim());
}

export function cacheEnabled(): boolean {
  return !process.env.VITEST && process.env.FUELNEAR_CACHE !== "0";
}
