export async function register() {
  if (process.env.FUELNEAR_USE_FIXTURES === "1") {
    throw new Error("FuelNear refuses to start with sample stations. Unset FUELNEAR_USE_FIXTURES.");
  }
}
