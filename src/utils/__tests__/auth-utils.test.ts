// Set up test environment variables BEFORE importing modules
process.env.JWT_SECRET = 'test-secret-key-at-least-32-characters-long-for-testing';
process.env.JWT_ALGORITHM = 'HS256';
process.env.JWT_AUDIENCE = 'authenticated';
process.env.JWT_ISSUER = 'https://test.supabase.co/auth/v1';
process.env.VETTAM_API_KEY = 'test-api-key';
process.env.VETTAM_API_URL = 'https://test-api.example.com';
process.env.PUBLIC_HOST = 'test.example.com';

import test from 'ava';
import { Request } from 'express';
import {
  extractJWTFromRequest,
  getUserIdFromJWT,
  createRateLimitKey,
} from '../auth-utils';
import { SignJWT } from 'jose';

// Helper to create a mock Express request
function createMockRequest(options: {
  authHeader?: string;
  ip?: string;
  headers?: Record<string, string>;
}): Partial<Request> {
  return {
    headers: {
      ...(options.authHeader && { authorization: options.authHeader }),
      ...options.headers,
    },
    ip: options.ip || '127.0.0.1',
  } as Partial<Request>;
}

// Helper to create a valid JWT token for testing
// Uses the same secret as configured in environment
async function createTestJWT(payload: {
  sub?: string;
  aud?: string;
  iss?: string;
  exp?: number;
}): Promise<string> {
  const secret = new TextEncoder().encode('test-secret-key-at-least-32-characters-long-for-testing');
  
  const jwt = new SignJWT(payload)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt();

  if (payload.sub) jwt.setSubject(payload.sub);
  if (payload.aud) jwt.setAudience(payload.aud);
  if (payload.iss) jwt.setIssuer(payload.iss);
  if (payload.exp) jwt.setExpirationTime(payload.exp);

  return jwt.sign(secret);
}

// extractJWTFromRequest tests
test('extractJWTFromRequest extracts token from Bearer header', (t) => {
  const token = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.test.token';
  const req = createMockRequest({ authHeader: `Bearer ${token}` });
  
  const result = extractJWTFromRequest(req as Request);
  
  t.is(result, token);
});

test('extractJWTFromRequest returns null when no Authorization header', (t) => {
  const req = createMockRequest({});
  
  const result = extractJWTFromRequest(req as Request);
  
  t.is(result, null);
});

test('extractJWTFromRequest returns null when Authorization header is not Bearer', (t) => {
  const req = createMockRequest({ authHeader: 'Basic dXNlcjpwYXNz' });
  
  const result = extractJWTFromRequest(req as Request);
  
  t.is(result, null);
});

test('extractJWTFromRequest returns null when Authorization header is Bearer without token', (t) => {
  const req = createMockRequest({ authHeader: 'Bearer ' });
  
  const result = extractJWTFromRequest(req as Request);
  
  // After removing "Bearer ", we get empty string, which is falsy but not null
  // The function returns null for no header, but empty string passes through
  t.is(result, '');
});

test('extractJWTFromRequest handles Authorization header with extra spaces', (t) => {
  const token = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.test.token';
  const req = createMockRequest({ authHeader: `Bearer  ${token}` });
  
  const result = extractJWTFromRequest(req as Request);
  
  // Will have leading space since substring(7) includes the extra space
  t.is(result, ` ${token}`);
});

test('extractJWTFromRequest is case-sensitive for Bearer', (t) => {
  const token = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.test.token';
  const req = createMockRequest({ authHeader: `bearer ${token}` });
  
  const result = extractJWTFromRequest(req as Request);
  
  t.is(result, null);
});

// getUserIdFromJWT tests
test('getUserIdFromJWT extracts user ID from valid JWT', async (t) => {
  const userId = '123e4567-e89b-12d3-a456-426614174000';
  const token = await createTestJWT({
    sub: userId,
    aud: 'authenticated',
    iss: 'https://test.supabase.co/auth/v1',
  });

  const result = await getUserIdFromJWT(token);
  
  t.is(result, userId);
});

test('getUserIdFromJWT returns null for invalid JWT signature', async (t) => {
  const invalidToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.invalid_signature';

  const result = await getUserIdFromJWT(invalidToken);
  
  t.is(result, null);
});

test('getUserIdFromJWT returns null for expired JWT', async (t) => {
  const userId = '123e4567-e89b-12d3-a456-426614174000';
  const expiredTime = Math.floor(Date.now() / 1000) - 3600; // 1 hour ago
  
  const token = await createTestJWT({
    sub: userId,
    aud: 'authenticated',
    iss: 'https://test.supabase.co/auth/v1',
    exp: expiredTime,
  });

  const result = await getUserIdFromJWT(token);
  
  t.is(result, null);
});

test('getUserIdFromJWT returns null for JWT with wrong audience', async (t) => {
  const userId = '123e4567-e89b-12d3-a456-426614174000';
  
  const token = await createTestJWT({
    sub: userId,
    aud: 'wrong-audience',
    iss: 'https://test.supabase.co/auth/v1',
  });

  const result = await getUserIdFromJWT(token);
  
  t.is(result, null);
});

test('getUserIdFromJWT returns null for JWT with wrong issuer', async (t) => {
  const userId = '123e4567-e89b-12d3-a456-426614174000';
  
  const token = await createTestJWT({
    sub: userId,
    aud: 'authenticated',
    iss: 'https://wrong-issuer.com',
  });

  const result = await getUserIdFromJWT(token);
  
  t.is(result, null);
});

test('getUserIdFromJWT returns null for JWT without sub claim', async (t) => {
  const token = await createTestJWT({
    aud: 'authenticated',
    iss: 'https://test.supabase.co/auth/v1',
  });

  const result = await getUserIdFromJWT(token);
  
  t.is(result, null);
});

test('getUserIdFromJWT returns null for malformed JWT', async (t) => {
  const malformedToken = 'not.a.valid.jwt';

  const result = await getUserIdFromJWT(malformedToken);
  
  t.is(result, null);
});

test('getUserIdFromJWT returns null for empty string', async (t) => {
  const result = await getUserIdFromJWT('');
  
  t.is(result, null);
});

// createRateLimitKey tests
test('createRateLimitKey creates user-based key when userId provided', (t) => {
  const req = createMockRequest({ ip: '192.168.1.1' });
  const userId = '123e4567-e89b-12d3-a456-426614174000';
  
  const key = createRateLimitKey(req as Request, userId);
  
  t.is(key, `user:${userId}`);
});

test('createRateLimitKey creates IP-based key when no userId provided', (t) => {
  const ip = '192.168.1.1';
  const req = createMockRequest({ ip });
  
  const key = createRateLimitKey(req as Request);
  
  t.is(key, `ip:${ip}`);
});

test('createRateLimitKey creates IP-based key when userId is undefined', (t) => {
  const ip = '10.0.0.5';
  const req = createMockRequest({ ip });
  
  const key = createRateLimitKey(req as Request, undefined);
  
  t.is(key, `ip:${ip}`);
});

test('createRateLimitKey creates IP-based key when userId is empty string', (t) => {
  const ip = '172.16.0.1';
  const req = createMockRequest({ ip });
  
  const key = createRateLimitKey(req as Request, '');
  
  t.is(key, `ip:${ip}`);
});

test('createRateLimitKey handles IPv6 addresses', (t) => {
  const ipv6 = '2001:0db8:85a3:0000:0000:8a2e:0370:7334';
  const req = createMockRequest({ ip: ipv6 });
  
  const key = createRateLimitKey(req as Request);
  
  t.is(key, `ip:${ipv6}`);
});

test('createRateLimitKey handles localhost IP', (t) => {
  const req = createMockRequest({ ip: '127.0.0.1' });
  
  const key = createRateLimitKey(req as Request);
  
  t.is(key, 'ip:127.0.0.1');
});

test('createRateLimitKey prefers userId over IP', (t) => {
  const req = createMockRequest({ ip: '192.168.1.1' });
  const userId = 'user-123';
  
  const key = createRateLimitKey(req as Request, userId);
  
  t.true(key.startsWith('user:'));
  t.false(key.includes('ip:'));
});

// Integration test: Full auth flow
test('Full auth flow: extract JWT, validate, create rate limit key', async (t) => {
  const userId = '123e4567-e89b-12d3-a456-426614174000';
  const token = await createTestJWT({
    sub: userId,
    aud: 'authenticated',
    iss: 'https://test.supabase.co/auth/v1',
  });

  // Step 1: Extract JWT from request
  const req = createMockRequest({
    authHeader: `Bearer ${token}`,
    ip: '192.168.1.100',
  });
  const extractedToken = extractJWTFromRequest(req as Request);
  t.is(extractedToken, token);

  // Step 2: Validate JWT and get user ID
  const extractedUserId = await getUserIdFromJWT(extractedToken!);
  t.is(extractedUserId, userId);

  // Step 3: Create rate limit key
  const rateLimitKey = createRateLimitKey(req as Request, extractedUserId!);
  t.is(rateLimitKey, `user:${userId}`);
});

test('Full auth flow: invalid token falls back to IP-based rate limiting', async (t) => {
  const invalidToken = 'invalid.jwt.token';

  // Step 1: Extract invalid JWT from request
  const req = createMockRequest({
    authHeader: `Bearer ${invalidToken}`,
    ip: '192.168.1.200',
  });
  const extractedToken = extractJWTFromRequest(req as Request);
  t.is(extractedToken, invalidToken);

  // Step 2: Validation fails, returns null
  const extractedUserId = await getUserIdFromJWT(extractedToken!);
  t.is(extractedUserId, null);

  // Step 3: Falls back to IP-based rate limit key
  const rateLimitKey = createRateLimitKey(req as Request, extractedUserId || undefined);
  t.is(rateLimitKey, 'ip:192.168.1.200');
});
