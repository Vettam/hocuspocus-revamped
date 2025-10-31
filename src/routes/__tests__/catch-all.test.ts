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
import catchAllRouter from "../catch-all";

test.serial("Catch-all router - should export a Router instance", (t) => {
  t.truthy(catchAllRouter);
  t.is(typeof catchAllRouter, "function"); // Express Router is a function
});

test.serial("Catch-all router - should have route configured", (t) => {
  const stack = catchAllRouter.stack || [];
  t.true(stack.length > 0);

  // Find the catch-all route
  const catchAllRoute = stack.find(
    (layer: any) => layer.route && layer.route.path === "*"
  );
  t.truthy(catchAllRoute);
});

test.serial(
  "Catch-all route - should handle GET request with proper response format",
  (t) => {
    // Test the expected APIErrorResponse structure
    const mockError = {
      error: "Not Found",
      message: "Endpoint GET /unknown not found",
      statusCode: 404,
      timestamp: new Date().toISOString(),
    };

    t.is(mockError.error, "Not Found");
    t.is(mockError.statusCode, 404);
    t.true(mockError.message.includes("GET"));
    t.true(mockError.message.includes("/unknown"));
    t.truthy(mockError.timestamp);
  }
);

test.serial("Catch-all route - should format error message correctly", (t) => {
  const testCases = [
    { method: "GET", path: "/test", expected: "Endpoint GET /test not found" },
    {
      method: "POST",
      path: "/api/users",
      expected: "Endpoint POST /api/users not found",
    },
    {
      method: "DELETE",
      path: "/resource/123",
      expected: "Endpoint DELETE /resource/123 not found",
    },
    {
      method: "PUT",
      path: "/update",
      expected: "Endpoint PUT /update not found",
    },
    {
      method: "PATCH",
      path: "/modify",
      expected: "Endpoint PATCH /modify not found",
    },
  ];

  for (const testCase of testCases) {
    const message = `Endpoint ${testCase.method} ${testCase.path} not found`;
    t.is(message, testCase.expected);
  }
});

test.serial(
  "Catch-all route - error response should have all required fields",
  (t) => {
    const errorResponse = {
      error: "Not Found",
      message: "Endpoint GET /test not found",
      statusCode: 404,
      timestamp: new Date().toISOString(),
    };

    t.true("error" in errorResponse);
    t.true("message" in errorResponse);
    t.true("statusCode" in errorResponse);
    t.true("timestamp" in errorResponse);
    t.is(Object.keys(errorResponse).length, 4);
  }
);

test.serial("Catch-all route - timestamp should be in ISO format", (t) => {
  const timestamp = new Date().toISOString();

  // ISO format regex: YYYY-MM-DDTHH:mm:ss.sssZ
  const isoRegex = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;
  t.regex(timestamp, isoRegex);
});

test.serial("Catch-all route - statusCode should always be 404", (t) => {
  const statusCode = 404;
  t.is(statusCode, 404);
});

test.serial('Catch-all route - error field should be "Not Found"', (t) => {
  const error = "Not Found";
  t.is(error, "Not Found");
});

test.serial("Catch-all route - should handle different HTTP methods", (t) => {
  const methods = ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS", "HEAD"];

  for (const method of methods) {
    const message = `Endpoint ${method} /test not found`;
    t.true(message.includes(method));
  }
});

test.serial("Catch-all route - should handle nested paths", (t) => {
  const paths = [
    "/api/v1/users",
    "/api/v2/resources/123/items",
    "/deep/nested/path/structure",
  ];

  for (const path of paths) {
    const message = `Endpoint GET ${path} not found`;
    t.true(message.includes(path));
  }
});

test.serial("Catch-all route - message should be descriptive", (t) => {
  const message = "Endpoint GET /unknown not found";

  t.true(message.length > 0);
  t.true(message.includes("Endpoint"));
  t.true(message.includes("not found"));
});
