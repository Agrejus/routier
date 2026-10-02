import { logger } from "@routier/core/utilities";
import type { InspectedValue } from "@routier/datastore";

export function reportError(context: string, error: InspectedValue): Error {
  const normalized = error instanceof Error ? error : new Error(String(error));
  logger.error(`[routier-devtools] ${context}`, normalized);
  return normalized;
}
