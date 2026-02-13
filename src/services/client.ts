/**
 * Facade re-export for SolomemoryClient.
 * Preserves the original import path (`./services/client.js`) for all consumers.
 * Implementation lives in the `client/` directory.
 */

export { SolomemoryClient, solomemoryClient } from "./client/index.js";
