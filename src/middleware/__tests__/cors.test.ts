// Set up test environment variables BEFORE importing modules
process.env.JWT_SECRET =
  "test-secret-key-at-least-32-characters-long-for-testing";
process.env.JWT_ALGORITHM = "HS256";
process.env.JWT_AUDIENCE = "authenticated";
process.env.JWT_ISSUER = "https://test.supabase.co/auth/v1";
process.env.VETTAM_API_KEY = "test-api-key";
process.env.VETTAM_API_URL = "https://test-api.example.com";
process.env.PUBLIC_HOST = "test.example.com";
process.env.DEBUG = "false";
process.env.CORS_ORIGIN = "https://example.com,https://app.vettam.com";
process.env.CORS_CREDENTIALS = "true";

import test from "ava";
import { Request, Response } from "express";
import { corsMiddleware } from "../cors";

// Helper to create a mock Express request
function createMockRequest(origin?: string): Request {
  return {
    headers: origin ? { origin } : {},
    get: (header: string) => {
      if (header.toLowerCase() === "origin") {
        return origin;
      }
      return undefined;
    },
  } as unknown as Request;
}

// Helper to create a mock Express response
function createMockResponse() {
  const state = {
    statusCode: 200,
    headers: {} as Record<string, string>,
    headersSent: false,
  };

  const res = {
    statusCode: state.statusCode,
    setHeader: (name: string, value: string | string[]) => {
      state.headers[name] = Array.isArray(value) ? value.join(", ") : value;
      return res;
    },
    getHeader: (name: string) => state.headers[name],
    removeHeader: (name: string) => {
      delete state.headers[name];
      return res;
    },
    status: (code: number) => {
      state.statusCode = code;
      return res;
    },
    end: () => {
      state.headersSent = true;
      return res;
    },
    get headersSent() {
      return state.headersSent;
    },
  };

  return {
    response: res as unknown as Response,
    getStatusCode: () => state.statusCode,
    getHeaders: () => state.headers,
  };
}

test.serial("corsMiddleware - should create CORS middleware", (t) => {
  const middleware = corsMiddleware();

  t.truthy(middleware);
  t.is(typeof middleware, "function");
});

test.serial("corsMiddleware - should allow requests with no origin", (t) => {
  return new Promise<void>((resolve, reject) => {
    const middleware = corsMiddleware();
    const req = createMockRequest(undefined);
    const { response } = createMockResponse();

    middleware(req, response, (err?: any) => {
      if (err) {
        reject(err);
      } else {
        t.pass();
        resolve();
      }
    });
  });
});

test.serial(
  "corsMiddleware - should allow requests from allowed origin",
  (t) => {
    return new Promise<void>((resolve, reject) => {
      const middleware = corsMiddleware();
      const req = createMockRequest("https://example.com");
      const { response, getHeaders } = createMockResponse();

      middleware(req, response, (err?: any) => {
        if (err) {
          reject(err);
        } else {
          const headers = getHeaders();
          t.is(headers["Access-Control-Allow-Origin"], "https://example.com");
          t.is(headers["Access-Control-Allow-Credentials"], "true");
          resolve();
        }
      });
    });
  }
);

test.serial(
  "corsMiddleware - should allow requests from another allowed origin",
  (t) => {
    return new Promise<void>((resolve, reject) => {
      const middleware = corsMiddleware();
      const req = createMockRequest("https://app.vettam.com");
      const { response, getHeaders } = createMockResponse();

      middleware(req, response, (err?: any) => {
        if (err) {
          reject(err);
        } else {
          const headers = getHeaders();
          t.is(
            headers["Access-Control-Allow-Origin"],
            "https://app.vettam.com"
          );
          resolve();
        }
      });
    });
  }
);

test.serial(
  "corsMiddleware - should reject requests from disallowed origin",
  (t) => {
    return new Promise<void>((resolve) => {
      const middleware = corsMiddleware();
      const req = createMockRequest("https://malicious.com");
      const { response } = createMockResponse();

      middleware(req, response, (err?: any) => {
        t.truthy(err);
        t.true(err.message.includes("not allowed by CORS"));
        resolve();
      });
    });
  }
);

test.serial(
  "corsMiddleware - should handle case-sensitive origin matching",
  (t) => {
    return new Promise<void>((resolve) => {
      const middleware = corsMiddleware();
      const req = createMockRequest("https://EXAMPLE.COM");
      const { response } = createMockResponse();

      middleware(req, response, (err?: any) => {
        // Origins are case-sensitive, so this should fail
        t.truthy(err);
        t.true(err.message.includes("not allowed by CORS"));
        resolve();
      });
    });
  }
);

test.serial("corsMiddleware - should handle protocol mismatch", (t) => {
  return new Promise<void>((resolve) => {
    const middleware = corsMiddleware();
    const req = createMockRequest("http://example.com");
    const { response } = createMockResponse();

    middleware(req, response, (err?: any) => {
      // http vs https should not match
      t.truthy(err);
      t.true(err.message.includes("not allowed by CORS"));
      resolve();
    });
  });
});

test.serial("corsMiddleware - should handle subdomain variations", (t) => {
  return new Promise<void>((resolve) => {
    const middleware = corsMiddleware();
    const req = createMockRequest("https://subdomain.example.com");
    const { response } = createMockResponse();

    middleware(req, response, (err?: any) => {
      // Subdomain should not match exact domain
      t.truthy(err);
      t.true(err.message.includes("not allowed by CORS"));
      resolve();
    });
  });
});

test.serial("corsMiddleware - should handle port in origin", (t) => {
  return new Promise<void>((resolve) => {
    const middleware = corsMiddleware();
    const req = createMockRequest("https://example.com:8080");
    const { response } = createMockResponse();

    middleware(req, response, (err?: any) => {
      // Port should make it different
      t.truthy(err);
      t.true(err.message.includes("not allowed by CORS"));
      resolve();
    });
  });
});

test.serial("corsMiddleware - should handle credentials configuration", (t) => {
  return new Promise<void>((resolve, reject) => {
    const middleware = corsMiddleware();
    const req = createMockRequest("https://example.com");
    const { response, getHeaders } = createMockResponse();

    middleware(req, response, (err?: any) => {
      if (err) {
        reject(err);
      } else {
        const headers = getHeaders();
        // CORS_CREDENTIALS is set to "true" at the top of the file
        t.is(headers["Access-Control-Allow-Credentials"], "true");
        resolve();
      }
    });
  });
});

test.serial("corsMiddleware - should handle empty origin string", (t) => {
  return new Promise<void>((resolve) => {
    const middleware = corsMiddleware();
    const req = createMockRequest("");
    const { response } = createMockResponse();

    middleware(req, response, (err?: any) => {
      // Empty string is falsy and should be treated like no origin
      if (err) {
        resolve();
      } else {
        t.pass();
        resolve();
      }
    });
  });
});

test.serial("corsMiddleware - should handle trailing slash in origin", (t) => {
  return new Promise<void>((resolve) => {
    const middleware = corsMiddleware();
    const req = createMockRequest("https://example.com/");
    const { response } = createMockResponse();

    middleware(req, response, (err?: any) => {
      // Trailing slash makes it different
      t.truthy(err);
      t.true(err.message.includes("not allowed by CORS"));
      resolve();
    });
  });
});

test.serial(
  "corsMiddleware - should handle multiple allowed origins in sequence",
  (t) => {
    return new Promise<void>((resolve, reject) => {
      const middleware = corsMiddleware();

      // First request to example.com
      const req1 = createMockRequest("https://example.com");
      const { response: res1 } = createMockResponse();

      middleware(req1, res1, (err1?: any) => {
        if (err1) {
          reject(err1);
          return;
        }

        // Second request to app.vettam.com
        const req2 = createMockRequest("https://app.vettam.com");
        const { response: res2, getHeaders } = createMockResponse();

        middleware(req2, res2, (err2?: any) => {
          if (err2) {
            reject(err2);
          } else {
            const headers = getHeaders();
            t.is(
              headers["Access-Control-Allow-Origin"],
              "https://app.vettam.com"
            );
            resolve();
          }
        });
      });
    });
  }
);
