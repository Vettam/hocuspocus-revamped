// Set up test environment variables BEFORE importing modules
process.env.JWT_SECRET =
  "test-secret-key-at-least-32-characters-long-for-testing";
process.env.JWT_ALGORITHM = "HS256";
process.env.JWT_AUDIENCE = "authenticated";
process.env.JWT_ISSUER = "https://test.supabase.co/auth/v1";
process.env.VETTAM_API_KEY = "test-api-key";
process.env.VETTAM_API_URL = "https://test-api.example.com";
process.env.PUBLIC_HOST = "test.example.com";
process.env.npm_package_version = "1.2.3";

import test from "ava";
import { Request } from "express";
import healthRouter from "../health";

// Helper to create a mock Express request
function createMockRequest(): Partial<Request> {
  return {} as Partial<Request>;
}

// Helper to create a mock Express response
function createMockResponse(): any {
  const res: any = {
    statusCode: 200,
    data: null,
    status: function (code: number) {
      this.statusCode = code;
      return this;
    },
    json: function (data: any) {
      this.data = data;
      return this;
    },
  };
  return res;
}

// Helper to extract route handler
function getRouteHandler(
  router: any,
  method: string,
  path: string
): Function | undefined {
  const stack = router.stack || [];
  for (const layer of stack) {
    if (layer.route && layer.route.path === path) {
      const methodHandler = layer.route.stack.find(
        (s: any) => s.method === method.toLowerCase()
      );
      if (methodHandler) {
        return methodHandler.handle;
      }
    }
  }
  return undefined;
}

test.serial("Health router - should export a Router instance", (t) => {
  t.truthy(healthRouter);
  t.is(typeof healthRouter, "function"); // Express Router is a function
});

test.serial("Health router - should have GET / route", (t) => {
  const handler = getRouteHandler(healthRouter, "GET", "/");
  t.truthy(handler);
  t.is(typeof handler, "function");
});

test.serial("GET /health - should return healthy status", (t) => {
  const req = createMockRequest();
  const res = createMockResponse();

  const handler = getRouteHandler(healthRouter, "GET", "/");
  t.truthy(handler);

  if (handler) {
    handler(req, res);

    t.is(res.statusCode, 200);
    t.truthy(res.data);
    t.is(res.data.status, "healthy");
  }
});

test.serial("GET /health - should return timestamp", (t) => {
  const req = createMockRequest();
  const res = createMockResponse();

  const handler = getRouteHandler(healthRouter, "GET", "/");

  if (handler) {
    const beforeTime = new Date().getTime();
    handler(req, res);
    const afterTime = new Date().getTime();

    t.truthy(res.data.timestamp);
    t.is(typeof res.data.timestamp, "string");

    // Verify it's a valid ISO timestamp
    const timestamp = new Date(res.data.timestamp).getTime();
    t.true(timestamp >= beforeTime);
    t.true(timestamp <= afterTime);
  }
});

test.serial("GET /health - should return uptime", (t) => {
  const req = createMockRequest();
  const res = createMockResponse();

  const handler = getRouteHandler(healthRouter, "GET", "/");

  if (handler) {
    handler(req, res);

    t.truthy(res.data.uptime);
    t.is(typeof res.data.uptime, "number");
    t.true(res.data.uptime >= 0);
  }
});

test.serial("GET /health - should return version from environment", (t) => {
  const req = createMockRequest();
  const res = createMockResponse();

  const handler = getRouteHandler(healthRouter, "GET", "/");

  if (handler) {
    handler(req, res);

    t.truthy(res.data.version);
    t.is(res.data.version, "1.2.3");
  }
});

test.serial(
  "GET /health - should return default version when env var not set",
  (t) => {
    const originalVersion = process.env.npm_package_version;
    delete process.env.npm_package_version;

    const req = createMockRequest();
    const res = createMockResponse();

    const handler = getRouteHandler(healthRouter, "GET", "/");

    if (handler) {
      handler(req, res);

      t.truthy(res.data.version);
      t.is(res.data.version, "1.0.0");
    }

    // Restore
    if (originalVersion) {
      process.env.npm_package_version = originalVersion;
    }
  }
);

test.serial("GET /health - should return all required fields", (t) => {
  const req = createMockRequest();
  const res = createMockResponse();

  const handler = getRouteHandler(healthRouter, "GET", "/");

  if (handler) {
    handler(req, res);

    t.truthy(res.data);
    t.truthy(res.data.status);
    t.truthy(res.data.timestamp);
    t.truthy(res.data.uptime !== undefined);
    t.truthy(res.data.version);
  }
});

test.serial("GET /health - response structure validation", (t) => {
  const req = createMockRequest();
  const res = createMockResponse();

  const handler = getRouteHandler(healthRouter, "GET", "/");

  if (handler) {
    handler(req, res);

    const response = res.data;

    // Verify structure
    t.is(Object.keys(response).length, 4);
    t.true("status" in response);
    t.true("timestamp" in response);
    t.true("uptime" in response);
    t.true("version" in response);
  }
});

test.serial("GET /health - timestamp should be in ISO format", (t) => {
  const req = createMockRequest();
  const res = createMockResponse();

  const handler = getRouteHandler(healthRouter, "GET", "/");

  if (handler) {
    handler(req, res);

    const timestamp = res.data.timestamp;

    // ISO format regex: YYYY-MM-DDTHH:mm:ss.sssZ
    const isoRegex = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;
    t.regex(timestamp, isoRegex);
  }
});

test.serial("GET /health - uptime should increase over time", async (t) => {
  const req1 = createMockRequest();
  const res1 = createMockResponse();

  const handler = getRouteHandler(healthRouter, "GET", "/");

  if (handler) {
    handler(req1, res1);
    const firstUptime = res1.data.uptime;

    // Wait a small amount
    await new Promise((resolve) => setTimeout(resolve, 10));

    const req2 = createMockRequest();
    const res2 = createMockResponse();
    handler(req2, res2);
    const secondUptime = res2.data.uptime;

    t.true(secondUptime >= firstUptime);
  }
});

test.serial(
  "GET /health - multiple calls should return consistent structure",
  (t) => {
    const handler = getRouteHandler(healthRouter, "GET", "/");

    if (handler) {
      for (let i = 0; i < 5; i++) {
        const req = createMockRequest();
        const res = createMockResponse();

        handler(req, res);

        t.is(res.statusCode, 200);
        t.is(res.data.status, "healthy");
        t.truthy(res.data.timestamp);
        t.truthy(res.data.uptime !== undefined);
        t.truthy(res.data.version);
      }
    }
  }
);
