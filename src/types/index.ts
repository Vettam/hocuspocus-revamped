// Core types for the Vettam Hocuspocus Backend

export interface User {
  id: string;
  email?: string;
  name?: string;
}

export interface Room {
  id: string;
  name?: string;
  ownerId: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface Document {
  id: string;
  roomId: string;
  content: string;
  version: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface AuthContext {
  user: User;
  roomId: string;
  permissions: string[];
}

export interface VettamAPIResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface DocumentLoadRequest {
  documentId: string;
  roomId: string;
  userId: string;
}

export interface DocumentSaveRequest {
  documentId: string;
  roomId: string;
  content: string;
  userId: string;
}

export interface AuthorizationRequest {
  userJwt: string;
  userId: string;
  roomId: string;
}

export interface AuthorizationResponse {
  access: boolean;
  edit: boolean
  user: User;
  room?: Room;
}

export interface SignedURLResponse {
  url: string;
  expiresAt: Date;
  method: 'GET' | 'POST' | 'PUT';
}

export interface RefreshDocumentRequest {
  roomId: string;
  forceRefresh?: boolean;
}

export interface RefreshDocumentResponse {
  success: boolean;
  documentId?: string;
  version?: number;
  message?: string;
}

// Hocuspocus specific types
export interface HocuspocusAuthPayload {
  token: string;
  roomName: string;
  documentName?: string;
}

// Express API specific types
export interface APIErrorResponse {
  error: string;
  message: string;
  statusCode: number;
  timestamp: string;
}

// Configuration types
export interface ServerConfig {
  port: {
    hocuspocus: number;
    express: number;
  };
  host: {
    hocuspocus: string;
    express: string;
  };
  cors: {
    origin: string | string[] | boolean;
    credentials: boolean;
  };
  vettam: {
    apiUrl: string;
    apiKey: string;
    timeout: number;
  };
  jwt: {
    secret: string;
    algorithm: string;
  };
}