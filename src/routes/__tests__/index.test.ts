// Set up test environment variables BEFORE importing modules
process.env.JWT_SECRET =
  "test-secret-key-at-least-32-characters-long-for-testing";
process.env.JWT_ALGORITHM = "HS256";
process.env.JWT_AUDIENCE = "authenticated";
process.env.JWT_ISSUER = "https://test.supabase.co/auth/v1";
process.env.VETTAM_API_KEY = "test-api-key";
process.env.VETTAM_API_URL = "https://test-api.example.com";
process.env.PUBLIC_HOST = "test.example.com";
process.env.npm_package_version = "2.0.0";

import test from "ava";
import { Request } from "express";
import indexRouter from "../index";

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

test.serial("Index router - should export a Router instance", (t) => {
  t.truthy(indexRouter);
  t.is(typeof indexRouter, "function"); // Express Router is a function
});

test.serial("Index router - should have GET / route", (t) => {
  const handler = getRouteHandler(indexRouter, "GET", "/");
  t.truthy(handler);
  t.is(typeof handler, "function");
});

test.serial("GET / - should return API information", (t) => {
  const req = createMockRequest();
  const res = createMockResponse();

  const handler = getRouteHandler(indexRouter, "GET", "/");

  if (handler) {
    handler(req, res);

    t.is(res.statusCode, 200);
    t.truthy(res.data);
    t.truthy(res.data.name);
    t.truthy(res.data.description);
    t.truthy(res.data.version);
    t.truthy(res.data.endpoints);
  }
});

test.serial("GET / - should return correct API name", (t) => {
  const req = createMockRequest();
  const res = createMockResponse();

  const handler = getRouteHandler(indexRouter, "GET", "/");

  if (handler) {
    handler(req, res);

    t.is(res.data.name, "Vettam Hocuspocus Backend");
  }
});

test.serial("GET / - should return description", (t) => {
  const req = createMockRequest();
  const res = createMockResponse();

  const handler = getRouteHandler(indexRouter, "GET", "/");

  if (handler) {
    handler(req, res);

    t.is(
      res.data.description,
      "Modular TypeScript server with Hocuspocus CRDT collaboration and Express REST API"
    );
  }
});

test.serial("GET / - should return version from environment", (t) => {
  const req = createMockRequest();
  const res = createMockResponse();

  const handler = getRouteHandler(indexRouter, "GET", "/");

  if (handler) {
    handler(req, res);

    t.is(res.data.version, "2.0.0");
  }
});

test.serial(
  "GET / - should return default version when env var not set",
  (t) => {
    const originalVersion = process.env.npm_package_version;
    delete process.env.npm_package_version;

    const req = createMockRequest();
    const res = createMockResponse();

    const handler = getRouteHandler(indexRouter, "GET", "/");

    if (handler) {
      handler(req, res);

      t.is(res.data.version, "1.0.0");
    }

    // Restore
    if (originalVersion) {
      process.env.npm_package_version = originalVersion;
    }
  }
);

test.serial("GET / - should return endpoints object", (t) => {
  const req = createMockRequest();
  const res = createMockResponse();

  const handler = getRouteHandler(indexRouter, "GET", "/");

  if (handler) {
    handler(req, res);

    t.truthy(res.data.endpoints);
    t.is(typeof res.data.endpoints, "object");
  }
});

test.serial("GET / - endpoints should include health endpoint", (t) => {
  const req = createMockRequest();
  const res = createMockResponse();

  const handler = getRouteHandler(indexRouter, "GET", "/");

  if (handler) {
    handler(req, res);

    t.truthy(res.data.endpoints.health);
    t.is(res.data.endpoints.health, "/health");
  }
});

test.serial("GET / - should return all required fields", (t) => {
  const req = createMockRequest();
  const res = createMockResponse();

  const handler = getRouteHandler(indexRouter, "GET", "/");

  if (handler) {
    handler(req, res);

    const response = res.data;

    t.true("name" in response);
    t.true("description" in response);
    t.true("version" in response);
    t.true("endpoints" in response);
    t.is(Object.keys(response).length, 4);
  }
});

test.serial("GET / - response structure validation", (t) => {
  const req = createMockRequest();
  const res = createMockResponse();

  const handler = getRouteHandler(indexRouter, "GET", "/");

  if (handler) {
    handler(req, res);

    const response = res.data;

    // Verify types
    t.is(typeof response.name, "string");
    t.is(typeof response.description, "string");
    t.is(typeof response.version, "string");
    t.is(typeof response.endpoints, "object");
  }
});

test.serial("GET / - name should not be empty", (t) => {
  const req = createMockRequest();
  const res = createMockResponse();

  const handler = getRouteHandler(indexRouter, "GET", "/");

  if (handler) {
    handler(req, res);

    t.true(res.data.name.length > 0);
  }
});

test.serial("GET / - description should not be empty", (t) => {
  const req = createMockRequest();
  const res = createMockResponse();

  const handler = getRouteHandler(indexRouter, "GET", "/");

  if (handler) {
    handler(req, res);

    t.true(res.data.description.length > 0);
  }
});

test.serial("GET / - version should follow semver format", (t) => {
  const req = createMockRequest();
  const res = createMockResponse();

  const handler = getRouteHandler(indexRouter, "GET", "/");

  if (handler) {
    handler(req, res);

    // Semver regex (basic)
    const semverRegex = /^\d+\.\d+\.\d+/;
    t.regex(res.data.version, semverRegex);
  }
});

test.serial("GET / - multiple calls should return consistent data", (t) => {
  const handler = getRouteHandler(indexRouter, "GET", "/");

  if (handler) {
    const results = [];

    for (let i = 0; i < 5; i++) {
      const req = createMockRequest();
      const res = createMockResponse();

      handler(req, res);
      results.push(res.data);
    }

    // All results should be identical
    for (let i = 1; i < results.length; i++) {
      t.deepEqual(results[i], results[0]);
    }
  }
});

test.serial("GET / - endpoints object should be extensible", (t) => {
  const req = createMockRequest();
  const res = createMockResponse();

  const handler = getRouteHandler(indexRouter, "GET", "/");

  if (handler) {
    handler(req, res);

    // Verify endpoints is a plain object
    t.is(Object.prototype.toString.call(res.data.endpoints), "[object Object]");

    // Should have at least health endpoint
    const keys = Object.keys(res.data.endpoints);
    t.true(keys.length >= 1);
    t.true(keys.includes("health"));
  }
});

test.serial("GET / - should return 200 status code", (t) => {
  const req = createMockRequest();
  const res = createMockResponse();

  const handler = getRouteHandler(indexRouter, "GET", "/");

  if (handler) {
    handler(req, res);

    t.is(res.statusCode, 200);
  }
});

test.serial("GET / - description should mention key technologies", (t) => {
  const req = createMockRequest();
  const res = createMockResponse();

  const handler = getRouteHandler(indexRouter, "GET", "/");

  if (handler) {
    handler(req, res);

    const description = res.data.description.toLowerCase();

    // Should mention key technologies
    t.true(
      description.includes("hocuspocus") ||
        description.includes("crdt") ||
        description.includes("express")
    );
  }
});
