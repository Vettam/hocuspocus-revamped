import { config } from 'dotenv';
import { ServerConfig } from '../types';

// Load environment variables
config();

export const serverConfig: ServerConfig = {
  port: {
    hocuspocus: parseInt(process.env.HOCUSPOCUS_PORT || '1234', 10),
    express: parseInt(process.env.EXPRESS_PORT || '3000', 10),
  },
  host: {
    hocuspocus: process.env.HOCUSPOCUS_HOST || 'localhost',
    express: process.env.EXPRESS_HOST || 'localhost',
  },
  cors: {
    origin: process.env.CORS_ORIGIN ? process.env.CORS_ORIGIN.split(',') : ['http://localhost:3000'],
    credentials: process.env.CORS_CREDENTIALS === 'true',
  },
  vettam: {
    apiUrl: process.env.VETTAM_API_URL || 'https://api.vettam.app',
    apiKey: process.env.VETTAM_API_KEY,
    timeout: parseInt(process.env.VETTAM_API_TIMEOUT || '30000', 10),
  },
  jwt: {
    secret: process.env.JWT_SECRET || 'your-jwt-secret-here',
    algorithm: process.env.JWT_ALGORITHM || 'HS256',
  },
};

export const isDevelopment = process.env.NODE_ENV !== 'production';
export const isProduction = process.env.NODE_ENV === 'production';

// Validate required environment variables
export function validateConfig(): void {
  const requiredVars = [
    'JWT_SECRET',
    'VETTAM_API_URL'
  ];

  const missingVars = requiredVars.filter(varName => !process.env[varName]);

  if (missingVars.length > 0) {
    throw new Error(`Missing required environment variables: ${missingVars.join(', ')}`);
  }
}

export default serverConfig;