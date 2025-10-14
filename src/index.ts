// Main exports for the Vettam Hocuspocus Backend
export { default as VettamBackendServer } from "./server";
export { default as HocuspocusServer } from "./servers/hocuspocus";
export { default as ExpressServer } from "./servers/express";

// Services
export { vettamAPI } from "./services/vettam-api";
export { documentService } from "./services/document";

// Configuration
export { serverConfig, validateConfig } from "./config";
export { logger } from "./config/logger";

// Types
export * from "./types";
