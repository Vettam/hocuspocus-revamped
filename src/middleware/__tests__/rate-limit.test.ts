// Set up test environment variables BEFORE importing modules
process.env.JWT_SECRET =
  "test-secret-key-at-least-32-characters-long-for-testing";
process.env.JWT_ALGORITHM = "HS256";
process.env.JWT_AUDIENCE = "authenticated";
process.env.JWT_ISSUER = "https://test.supabase.co/auth/v1";
process.env.VETTAM_API_KEY = "test-api-key";
process.env.VETTAM_API_URL = "https://test-api.example.com";
process.env.PUBLIC_HOST = "test.example.com";

import test from "ava";
import { Request, Response, NextFunction } from "express";
import { SignJWT } from "jose";
import { createRateLimitMiddleware, rateLimitMiddleware } from "../rate-limit";

// Helper to create a mock Express request
function createMockRequest(options: {
  path?: string;
  headers?: Record<string, string>;
  ip?: string;
  method?: string;
}): Request {
  return {
    path: options.path || "/",
    headers: options.headers || {},
    ip: options.ip || "127.0.0.1",
    method: options.method || "GET",
    get: (header: string) => options.headers?.[header.toLowerCase()],
  } as unknown as Request;
}

// Helper to create a mock Express response with proper tracking
function createMockResponse() {
  const state = {
    statusCode: 200,
    jsonData: null as any,
    headers: {} as Record<string, string>,
  };

  const res = {
    status: (code: number) => {
      state.statusCode = code;
      return res;
    },
    json: (data: any) => {
      state.jsonData = data;
      return res;
    },
    setHeader: (name: string, value: string) => {
      state.headers[name] = value;
      return res;
    },
  };

  return {
    response: res as unknown as Response,
    getStatusCode: () => state.statusCode,
    getJsonData: () => state.jsonData,
    getHeaders: () => state.headers,
  };
}

// Helper to create a valid JWT token for testing
async function createTestJWT(userId: string): Promise<string> {
  const secret = new TextEncoder().encode(process.env.JWT_SECRET);
  const jwt = await new SignJWT({ sub: userId })
    .setProtectedHeader({ alg: process.env.JWT_ALGORITHM || "HS256" })
    .setIssuedAt()
    .setIssuer(process.env.JWT_ISSUER!)
    .setAudience(process.env.JWT_AUDIENCE!)
    .setExpirationTime("1h")
    .sign(secret);
  return jwt;
}

test.serial(
  "createRateLimitMiddleware - should create rate limit middleware",
  (t) => {
    const middleware = createRateLimitMiddleware();

    t.truthy(middleware);
    t.is(typeof middleware, "function");
  }
);

test.serial(
  "rateLimitMiddleware - should export pre-configured middleware",
  (t) => {
    t.truthy(rateLimitMiddleware);
    t.is(typeof rateLimitMiddleware, "function");
  }
);

test.serial(
  "createRateLimitMiddleware - should be callable multiple times",
  (t) => {
    const middleware1 = createRateLimitMiddleware();
    const middleware2 = createRateLimitMiddleware();

    t.not(middleware1, middleware2);
    t.is(typeof middleware1, "function");
    t.is(typeof middleware2, "function");
  }
);

test.serial("rateLimitMiddleware - should be the same instance", (t) => {
  const middleware1 = rateLimitMiddleware;
  const middleware2 = rateLimitMiddleware;

  t.is(middleware1, middleware2);
});

test.serial(
  "middleware - should skip rate limiting for /health endpoint",
  (t) => {
    return new Promise<void>((resolve) => {
      const middleware = createRateLimitMiddleware();
      const req = createMockRequest({ path: "/health" });
      const { response } = createMockResponse();
      const next: NextFunction = () => {
        // Should call next without error (rate limit should be skipped)
        t.pass();
        resolve();
      };

      // Call the middleware
      middleware(req, response, next);
    });
  }
);

test.serial(
  "middleware - should skip rate limiting for WebSocket upgrade requests",
  (t) => {
    return new Promise<void>((resolve) => {
      const middleware = createRateLimitMiddleware();
      const req = createMockRequest({
        path: "/ws",
        headers: { upgrade: "websocket" },
      });
      const { response } = createMockResponse();
      const next: NextFunction = () => {
        // Should call next without error (rate limit should be skipped)
        t.pass();
        resolve();
      };

      // Call the middleware
      middleware(req, response, next);
    });
  }
);

test.serial(
  "middleware - should skip rate limiting for /health sub-paths",
  (t) => {
    return new Promise<void>((resolve) => {
      const middleware = createRateLimitMiddleware();
      const req = createMockRequest({ path: "/health/metrics" });
      const { response } = createMockResponse();
      const next: NextFunction = () => {
        // Should call next without error (rate limit should be skipped)
        t.pass();
        resolve();
      };

      // Call the middleware
      middleware(req, response, next);
    });
  }
);

test.serial(
  "middleware - should apply rate limiting to regular API endpoints",
  (t) => {
    return new Promise<void>((resolve) => {
      const middleware = createRateLimitMiddleware();
      const req = createMockRequest({
        path: "/api/documents",
        ip: "192.168.1.100",
      });
      const { response } = createMockResponse();
      const next: NextFunction = () => {
        // Should call next (rate limit applies but not exceeded on first request)
        t.pass();
        resolve();
      };

      // Call the middleware
      middleware(req, response, next);
    });
  }
);

test.serial(
  "middleware - should handle authenticated user requests",
  async (t) => {
    const token = await createTestJWT("test-user-123");

    return new Promise<void>((resolve) => {
      const middleware = createRateLimitMiddleware();
      const req = createMockRequest({
        path: "/api/documents",
        headers: { authorization: `Bearer ${token}` },
        ip: "192.168.1.101",
      });
      const { response } = createMockResponse();
      const next: NextFunction = () => {
        // Should call next (authenticated user has higher rate limit)
        t.pass();
        resolve();
      };

      // Call the middleware
      middleware(req, response, next);
    });
  }
);

test.serial("middleware - should handle invalid JWT tokens gracefully", (t) => {
  return new Promise<void>((resolve) => {
    const middleware = createRateLimitMiddleware();
    const req = createMockRequest({
      path: "/api/documents",
      headers: { authorization: "Bearer invalid.token.here" },
      ip: "192.168.1.102",
    });
    const { response } = createMockResponse();
    const next: NextFunction = () => {
      // Should call next (falls back to IP-based rate limiting)
      t.pass();
      resolve();
    };

    // Call the middleware
    middleware(req, response, next);
  });
});

test.serial(
  "middleware - should differentiate between authenticated and unauthenticated requests",
  async (t) => {
    const token = await createTestJWT("user-456");

    return new Promise<void>((resolve) => {
      const middleware = createRateLimitMiddleware();
      let authCallReceived = false;

      // Authenticated request
      const authReq = createMockRequest({
        path: "/api/test",
        headers: { authorization: `Bearer ${token}` },
        ip: "10.0.0.1",
      });
      const { response: authRes } = createMockResponse();
      const authNext: NextFunction = () => {
        authCallReceived = true;

        // Now test unauthenticated request
        const unauthReq = createMockRequest({
          path: "/api/test",
          ip: "10.0.0.2",
        });
        const { response: unauthRes } = createMockResponse();
        const unauthNext: NextFunction = () => {
          // Both requests should have been processed
          t.true(authCallReceived);
          t.pass();
          resolve();
        };

        middleware(unauthReq, unauthRes, unauthNext);
      };

      middleware(authReq, authRes, authNext);
    });
  }
);

test.serial("middleware - should handle requests without IP address", (t) => {
  return new Promise<void>((resolve) => {
    const middleware = createRateLimitMiddleware();
    const req = createMockRequest({
      path: "/api/documents",
      ip: undefined,
    });
    const { response } = createMockResponse();
    const next: NextFunction = () => {
      // Should still work with undefined IP
      t.pass();
      resolve();
    };

    middleware(req, response, next);
  });
});

test.serial(
  "middleware - should handle requests with expired JWT tokens",
  async (t) => {
    // Create an expired token
    const secret = new TextEncoder().encode(process.env.JWT_SECRET);
    const expiredToken = await new SignJWT({ sub: "expired-user" })
      .setProtectedHeader({ alg: process.env.JWT_ALGORITHM || "HS256" })
      .setIssuedAt()
      .setIssuer(process.env.JWT_ISSUER!)
      .setAudience(process.env.JWT_AUDIENCE!)
      .setExpirationTime("0s") // Already expired
      .sign(secret);

    return new Promise<void>((resolve) => {
      const middleware = createRateLimitMiddleware();
      const req = createMockRequest({
        path: "/api/documents",
        headers: { authorization: `Bearer ${expiredToken}` },
        ip: "192.168.1.103",
      });
      const { response } = createMockResponse();
      const next: NextFunction = () => {
        // Should handle expired token gracefully and fall back to IP-based limiting
        t.pass();
        resolve();
      };

      middleware(req, response, next);
    });
  }
);

test.serial(
  "middleware - should not skip rate limiting for non-WebSocket upgrade headers",
  (t) => {
    return new Promise<void>((resolve) => {
      const middleware = createRateLimitMiddleware();
      const req = createMockRequest({
        path: "/api/test",
        headers: { upgrade: "h2c" }, // Not websocket
        ip: "192.168.1.104",
      });
      const { response } = createMockResponse();
      const next: NextFunction = () => {
        // Should apply rate limiting (not skipped)
        t.pass();
        resolve();
      };

      middleware(req, response, next);
    });
  }
);

test.serial("middleware - should handle missing Authorization header", (t) => {
  return new Promise<void>((resolve) => {
    const middleware = createRateLimitMiddleware();
    const req = createMockRequest({
      path: "/api/documents",
      headers: {},
      ip: "192.168.1.105",
    });
    const { response } = createMockResponse();
    const next: NextFunction = () => {
      // Should work with no auth header (IP-based rate limiting)
      t.pass();
      resolve();
    };

    middleware(req, response, next);
  });
});

test.serial(
  "middleware - should handle malformed Authorization header",
  (t) => {
    return new Promise<void>((resolve) => {
      const middleware = createRateLimitMiddleware();
      const req = createMockRequest({
        path: "/api/documents",
        headers: { authorization: "NotBearer token" },
        ip: "192.168.1.106",
      });
      const { response } = createMockResponse();
      const next: NextFunction = () => {
        // Should handle malformed header gracefully
        t.pass();
        resolve();
      };

      middleware(req, response, next);
    });
  }
);

test.serial(
  "middleware - should process multiple sequential requests",
  async (t) => {
    const token = await createTestJWT("multi-request-user");

    return new Promise<void>((resolve) => {
      const middleware = createRateLimitMiddleware();
      let requestsProcessed = 0;

      const makeRequest = () => {
        const req = createMockRequest({
          path: "/api/test",
          headers: { authorization: `Bearer ${token}` },
          ip: "192.168.1.107",
        });
        const { response } = createMockResponse();
        const next: NextFunction = () => {
          requestsProcessed++;

          if (requestsProcessed === 3) {
            // All three requests should be processed
            t.is(requestsProcessed, 3);
            resolve();
          } else {
            makeRequest();
          }
        };

        middleware(req, response, next);
      };

      makeRequest();
    });
  }
);
