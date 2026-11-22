import { validateProductionMongoConfig } from "./production-mongodb.js";
import { validateStagingMongoConfig } from "./staging-mongodb.js";

export function automationRuntime(env) {
  const production = env?.TRIGGERDM_RUNTIME === "production";
  const database = production ? validateProductionMongoConfig(env) : validateStagingMongoConfig(env);
  if (production && (env.ENABLE_PRODUCTION_AUTOMATION !== "true" ||
      env.ENABLE_PRODUCTION_EXCLUSIVE_SEND_OWNERSHIP !== "true")) {
    throw new Error("PRODUCTION_AUTOMATION_OWNERSHIP_REQUIRED");
  }
  return { ...database, production, prefix: production ? "cloudflare_production" : "cloudflare_staging" };
}
