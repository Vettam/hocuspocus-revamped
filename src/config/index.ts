import { config } from "dotenv";
import { ServerConfig } from "../types";

// Load environment variables
config();

export const serverConfig: ServerConfig = {
  port: {
    express: parseInt(process.env.EXPRESS_PORT || "3000", 10),
  },
  host: {
    express: process.env.EXPRESS_HOST || "localhost",
  },
  cors: {
    origin: process.env.DEBUG == "false"
      ? (process.env.CORS_ORIGIN ?? "").split(",")
      : ["*"],
    credentials: process.env.CORS_CREDENTIALS === "true",
  },
  vettam: {
    apiUrl: process.env.VETTAM_API_URL || "https://api.vettam.app",
    apiKey: process.env.VETTAM_API_KEY!,
    timeout: parseInt(process.env.VETTAM_API_TIMEOUT || "30000", 10),
  },
  jwt: {
    secret: process.env.JWT_SECRET!,
    algorithm: process.env.JWT_ALGORITHM || "HS256",
  },
};

export const isDevelopment = process.env.NODE_ENV !== "production";

// Validate required environment variables
export function validateConfig(): void {
  const requiredVars = ["JWT_SECRET", "VETTAM_API_URL", "VETTAM_API_KEY"];

  const missingVars = requiredVars.filter((varName) => !process.env[varName]);

  if (missingVars.length > 0) {
    throw new Error(
      `Missing required environment variables: ${missingVars.join(", ")}`
    );
  }

  // Validate JWT secret strength
  const jwtSecret = process.env.JWT_SECRET!;
  if (jwtSecret.length < 32) {
    throw new Error(
      "JWT_SECRET must be at least 32 characters long for security"
    );
  }

  // Validate ports are valid numbers
  const expressPort = parseInt(process.env.EXPRESS_PORT || "3000", 10);
  
  if (isNaN(expressPort) || expressPort < 1 || expressPort > 65535) {
    throw new Error("EXPRESS_PORT must be a valid port number (1-65535)");
  }
}

export default serverConfig;
