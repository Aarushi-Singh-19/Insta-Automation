import { validateProductionMongoConfig } from "./production-mongodb.js";
import { validateStagingMongoConfig } from "./staging-mongodb.js";

export function validateNativeServiceMongoConfig(env) {
  if (env?.TRIGGERDM_RUNTIME === "production") {
    if (env.ENABLE_PRODUCTION_CUSTOMER_API !== "true") throw new Error("PRODUCTION_CUSTOMER_API_DISABLED");
    return validateProductionMongoConfig(env);
  }
  return validateStagingMongoConfig(env);
}
