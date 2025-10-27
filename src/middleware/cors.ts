import cors from "cors";
import { serverConfig } from "../config";

/**
 * CORS middleware with environment-based configuration
 * Configures Cross-Origin Resource Sharing based on server configuration
 */
export const corsMiddleware = () => {
  const corsOrigin = serverConfig.cors.origin;

  const corsOptions = {
    origin:
      Array.isArray(corsOrigin) && corsOrigin[0] === "*"
        ? (
            origin: string | undefined,
            callback: (
              err: Error | null,
              origin?: boolean | string | RegExp | (string | RegExp)[]
            ) => void
          ) => callback(null, origin || "*")
        : corsOrigin,
    credentials: serverConfig.cors.credentials,
  };

  return cors(corsOptions);
};
