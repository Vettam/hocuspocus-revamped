import { config } from "dotenv";
import { ServerConfig } from "../types";

// Load environment variables
config();

export const serverConfig: ServerConfig = {
  port: {
    express: parseInt(process.env.EXPRESS_PORT || "3000", 10),
  },
  host: {
    // For display/logging purposes only (e.g., in Docker labels, health checks)
    // The application always binds to 0.0.0.0 internally
    // Set PUBLIC_HOST to your actual domain (e.g., collaboration.api.vettam.app)
    publicHost: process.env.PUBLIC_HOST!,
    bindHost: "0.0.0.0"
  },
  cors: {
    origin:
      process.env.DEBUG === "false"
        ? (process.env.CORS_ORIGIN ?? "")
            .split(",")
            .map((o) => o.trim())
            .filter(Boolean)
        : ["*"],
    credentials: process.env.CORS_CREDENTIALS === "true",
  },
  vettam: {
    apiUrl: process.env.VETTAM_API_URL || "https://api.vettam.app",
    apiKey: process.env.VETTAM_API_KEY!,
    timeout: parseInt(process.env.VETTAM_API_TIMEOUT || "30000", 10),
  },
  jwt: {
    jwksUrl: `${process.env.JWT_ISSUER}/.well-known/jwks.json`,
    audience: process.env.JWT_AUDIENCE || "authenticated",
    issuer: process.env.JWT_ISSUER!,
  },
};

export const isDevelopment = process.env.DEBUG === "true";

// Validate required environment variables
export function validateConfig(): void {
  const requiredVars = [
    "VETTAM_API_URL",
    "VETTAM_API_KEY",
    "JWT_ISSUER",
    "PUBLIC_HOST",
  ];

  const missingVars = requiredVars.filter((varName) => !process.env[varName]);

  if (missingVars.length > 0) {
    throw new Error(
      `Missing required environment variables: ${missingVars.join(", ")}`
    );
  }


  // Validate ports are valid numbers
  const expressPort = parseInt(process.env.EXPRESS_PORT || "3000", 10);

  if (isNaN(expressPort) || expressPort < 1 || expressPort > 65535) {
    throw new Error("EXPRESS_PORT must be a valid port number (1-65535)");
  }
}

export default serverConfig;
