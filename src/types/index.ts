// Core types for the Vettam Hocuspocus Backend

export interface User {
  id: string;
  email?: string;
  name?: string;
}

export interface Room {
  room_id: string;
  draft_id: string;
  version_id: string;
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
  room_id: string;
  edit: boolean;
}

export interface VettamAPIResponse<T = any> {
  status: string;
  data?: T;
  error?: string;
  message?: string;
}

export interface DocumentLoadRequest {
  documentId: string;
  roomId: string;
  userId: string;
}

export interface RoomPreloadRequest {
  mdFileUrl: string;
}

export interface AuthorizationRequest {
  userJwt: string;
  userId: string;
  roomId: string;
  draftId: string;
  versionId: string;
}

export interface RoomAccessAuthorizationResponse {
  access: boolean;
  edit: boolean;
  user: User;
  room: Room;
}

export interface SignedURLResponse {
  url: string;
  expiresAt: Date;
  method: "GET" | "POST" | "PUT";
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
    express: number;
  };
  host: {
    publicHost: string;
    bindHost: string;
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
    audience: string;
    issuer: string;
  };
}
