import { isLogLevelEnabled, logger } from "@routier/core/utilities";

if (isLogLevelEnabled("debug")) {
  logger.debug("cache contents", JSON.stringify([...cache.entries()]));
}