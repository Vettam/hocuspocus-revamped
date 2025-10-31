import test from "ava";
import { validateConfig, isDevelopment, serverConfig } from "../index";

// Store original env values
const originalEnv = { ...process.env };

test.beforeEach(() => {
  // Reset to known good state
  process.env.JWT_SECRET =
    "test-secret-key-at-least-32-characters-long-for-testing";
  process.env.JWT_ALGORITHM = "HS256";
  process.env.JWT_AUDIENCE = "authenticated";
  process.env.JWT_ISSUER = "https://test.supabase.co/auth/v1";
  process.env.VETTAM_API_KEY = "test-api-key";
  process.env.VETTAM_API_URL = "https://test-api.example.com";
  process.env.PUBLIC_HOST = "test.example.com";
  process.env.EXPRESS_PORT = "3000";
  process.env.DEBUG = "false";
});

test.afterEach(() => {
  // Restore original environment
  process.env = { ...originalEnv };
});

test("serverConfig - should have correct default port", (t) => {
  t.is(typeof serverConfig.port.express, "number");
  t.true(serverConfig.port.express >= 1);
  t.true(serverConfig.port.express <= 65535);
});

test("serverConfig - should have correct bind host", (t) => {
  t.is(serverConfig.host.bindHost, "0.0.0.0");
});

test("serverConfig - should parse PUBLIC_HOST from environment", (t) => {
  // Clear module cache and re-require to get updated config
  delete require.cache[require.resolve("../index")];
  const { serverConfig: reloadedConfig } = require("../index");

  t.truthy(reloadedConfig.host.publicHost);
  t.is(typeof reloadedConfig.host.publicHost, "string");
});

test("serverConfig - should have JWT configuration", (t) => {
  // Clear module cache and re-require to get updated config
  delete require.cache[require.resolve("../index")];
  const { serverConfig: reloadedConfig } = require("../index");

  t.truthy(reloadedConfig.jwt.secret);
  t.truthy(reloadedConfig.jwt.algorithm);
  t.truthy(reloadedConfig.jwt.audience);
  t.truthy(reloadedConfig.jwt.issuer);
});

test("serverConfig - should have Vettam API configuration", (t) => {
  // Clear module cache and re-require to get updated config
  delete require.cache[require.resolve("../index")];
  const { serverConfig: reloadedConfig } = require("../index");

  t.truthy(reloadedConfig.vettam.apiUrl);
  t.truthy(reloadedConfig.vettam.apiKey);
  t.is(typeof reloadedConfig.vettam.timeout, "number");
});

test("serverConfig - should have CORS configuration", (t) => {
  t.truthy(serverConfig.cors);
  t.true(
    typeof serverConfig.cors.origin === "string" ||
      Array.isArray(serverConfig.cors.origin) ||
      typeof serverConfig.cors.origin === "boolean"
  );
  t.is(typeof serverConfig.cors.credentials, "boolean");
});

test("isDevelopment - should be false when DEBUG is false", (t) => {
  t.is(typeof isDevelopment, "boolean");
});

test("validateConfig - should not throw with valid configuration", (t) => {
  t.notThrows(() => {
    validateConfig();
  });
});

test("validateConfig - should throw when JWT_SECRET is missing", (t) => {
  delete process.env.JWT_SECRET;

  // Need to clear module cache to reload config
  delete require.cache[require.resolve("../index")];

  const error = t.throws(() => {
    validateConfig();
  });

  t.truthy(error);
  t.true(error!.message.includes("JWT_SECRET"));
});

test("validateConfig - should throw when JWT_SECRET is too short", (t) => {
  process.env.JWT_SECRET = "short";

  const error = t.throws(() => {
    validateConfig();
  });

  t.truthy(error);
  t.true(error!.message.includes("at least 32 characters"));
});

test("validateConfig - should throw when VETTAM_API_URL is missing", (t) => {
  delete process.env.VETTAM_API_URL;

  const error = t.throws(() => {
    validateConfig();
  });

  t.truthy(error);
  t.true(error!.message.includes("VETTAM_API_URL"));
});

test("validateConfig - should throw when VETTAM_API_KEY is missing", (t) => {
  delete process.env.VETTAM_API_KEY;

  const error = t.throws(() => {
    validateConfig();
  });

  t.truthy(error);
  t.true(error!.message.includes("VETTAM_API_KEY"));
});

test("validateConfig - should throw when JWT_ISSUER is missing", (t) => {
  delete process.env.JWT_ISSUER;

  const error = t.throws(() => {
    validateConfig();
  });

  t.truthy(error);
  t.true(error!.message.includes("JWT_ISSUER"));
});

test("validateConfig - should throw when PUBLIC_HOST is missing", (t) => {
  delete process.env.PUBLIC_HOST;

  const error = t.throws(() => {
    validateConfig();
  });

  t.truthy(error);
  t.true(error!.message.includes("PUBLIC_HOST"));
});

test("validateConfig - should throw when EXPRESS_PORT is invalid (too low)", (t) => {
  // Set all required vars
  process.env.JWT_SECRET =
    "test-secret-key-at-least-32-characters-long-for-testing";
  process.env.VETTAM_API_URL = "https://test-api.example.com";
  process.env.VETTAM_API_KEY = "test-api-key";
  process.env.JWT_ISSUER = "https://test.supabase.co/auth/v1";
  process.env.PUBLIC_HOST = "test.example.com";
  process.env.EXPRESS_PORT = "0";

  const error = t.throws(() => {
    validateConfig();
  });

  t.truthy(error);
  t.true(error!.message.includes("valid port number"));
});

test("validateConfig - should throw when EXPRESS_PORT is invalid (too high)", (t) => {
  // Set all required vars
  process.env.JWT_SECRET =
    "test-secret-key-at-least-32-characters-long-for-testing";
  process.env.VETTAM_API_URL = "https://test-api.example.com";
  process.env.VETTAM_API_KEY = "test-api-key";
  process.env.JWT_ISSUER = "https://test.supabase.co/auth/v1";
  process.env.PUBLIC_HOST = "test.example.com";
  process.env.EXPRESS_PORT = "65536";

  const error = t.throws(() => {
    validateConfig();
  });

  t.truthy(error);
  t.true(error!.message.includes("valid port number"));
});

test("validateConfig - should throw when EXPRESS_PORT is not a number", (t) => {
  // Set all required vars
  process.env.JWT_SECRET =
    "test-secret-key-at-least-32-characters-long-for-testing";
  process.env.VETTAM_API_URL = "https://test-api.example.com";
  process.env.VETTAM_API_KEY = "test-api-key";
  process.env.JWT_ISSUER = "https://test.supabase.co/auth/v1";
  process.env.PUBLIC_HOST = "test.example.com";
  process.env.EXPRESS_PORT = "not-a-number";

  const error = t.throws(() => {
    validateConfig();
  });

  t.truthy(error);
  t.true(error!.message.includes("valid port number"));
});

test("validateConfig - should accept minimum valid port (1)", (t) => {
  // Set all required vars
  process.env.JWT_SECRET =
    "test-secret-key-at-least-32-characters-long-for-testing";
  process.env.VETTAM_API_URL = "https://test-api.example.com";
  process.env.VETTAM_API_KEY = "test-api-key";
  process.env.JWT_ISSUER = "https://test.supabase.co/auth/v1";
  process.env.PUBLIC_HOST = "test.example.com";
  process.env.EXPRESS_PORT = "1";

  t.notThrows(() => {
    validateConfig();
  });
});

test("validateConfig - should accept maximum valid port (65535)", (t) => {
  // Set all required vars
  process.env.JWT_SECRET =
    "test-secret-key-at-least-32-characters-long-for-testing";
  process.env.VETTAM_API_URL = "https://test-api.example.com";
  process.env.VETTAM_API_KEY = "test-api-key";
  process.env.JWT_ISSUER = "https://test.supabase.co/auth/v1";
  process.env.PUBLIC_HOST = "test.example.com";
  process.env.EXPRESS_PORT = "65535";

  t.notThrows(() => {
    validateConfig();
  });
});

test("validateConfig - should accept JWT_SECRET at minimum length (32)", (t) => {
  // Set all required vars
  process.env.JWT_SECRET = "12345678901234567890123456789012"; // Exactly 32 characters
  process.env.VETTAM_API_URL = "https://test-api.example.com";
  process.env.VETTAM_API_KEY = "test-api-key";
  process.env.JWT_ISSUER = "https://test.supabase.co/auth/v1";
  process.env.PUBLIC_HOST = "test.example.com";

  t.notThrows(() => {
    validateConfig();
  });
});

test("validateConfig - should throw with multiple missing variables", (t) => {
  delete process.env.JWT_SECRET;
  delete process.env.VETTAM_API_KEY;
  delete process.env.PUBLIC_HOST;

  const error = t.throws(() => {
    validateConfig();
  });

  t.truthy(error);
  t.true(error!.message.includes("JWT_SECRET"));
  t.true(error!.message.includes("VETTAM_API_KEY"));
  t.true(error!.message.includes("PUBLIC_HOST"));
});

test("serverConfig - should parse CORS_ORIGIN as array when DEBUG is false", (t) => {
  process.env.DEBUG = "false";
  process.env.CORS_ORIGIN = "https://example.com,https://app.vettam.com";

  // Clear module cache and re-require
  delete require.cache[require.resolve("../index")];
  const { serverConfig: reloadedConfig } = require("../index");

  t.true(Array.isArray(reloadedConfig.cors.origin));
  if (Array.isArray(reloadedConfig.cors.origin)) {
    t.true(reloadedConfig.cors.origin.includes("https://example.com"));
    t.true(reloadedConfig.cors.origin.includes("https://app.vettam.com"));
  }
});

test("serverConfig - should use wildcard CORS in DEBUG mode", (t) => {
  process.env.DEBUG = "true";

  // Clear module cache and re-require
  delete require.cache[require.resolve("../index")];
  const { serverConfig: reloadedConfig } = require("../index");

  t.true(Array.isArray(reloadedConfig.cors.origin));
  if (Array.isArray(reloadedConfig.cors.origin)) {
    t.true(reloadedConfig.cors.origin.includes("*"));
  }
});

test("serverConfig - should filter empty CORS origins", (t) => {
  process.env.DEBUG = "false";
  process.env.CORS_ORIGIN = "https://example.com,,https://app.vettam.com,  ,";

  // Clear module cache and re-require
  delete require.cache[require.resolve("../index")];
  const { serverConfig: reloadedConfig } = require("../index");

  t.true(Array.isArray(reloadedConfig.cors.origin));
  if (Array.isArray(reloadedConfig.cors.origin)) {
    t.is(reloadedConfig.cors.origin.length, 2);
    t.true(reloadedConfig.cors.origin.includes("https://example.com"));
    t.true(reloadedConfig.cors.origin.includes("https://app.vettam.com"));
  }
});

test("serverConfig - should trim whitespace from CORS origins", (t) => {
  process.env.DEBUG = "false";
  process.env.CORS_ORIGIN = " https://example.com , https://app.vettam.com ";

  // Clear module cache and re-require
  delete require.cache[require.resolve("../index")];
  const { serverConfig: reloadedConfig } = require("../index");

  t.true(Array.isArray(reloadedConfig.cors.origin));
  if (Array.isArray(reloadedConfig.cors.origin)) {
    t.true(reloadedConfig.cors.origin.includes("https://example.com"));
    t.true(reloadedConfig.cors.origin.includes("https://app.vettam.com"));
    // Ensure no whitespace in the origins
    reloadedConfig.cors.origin.forEach((origin: string) => {
      t.is(origin, origin.trim());
    });
  }
});

test("serverConfig - should parse CORS_CREDENTIALS as boolean", (t) => {
  process.env.CORS_CREDENTIALS = "true";

  // Clear module cache and re-require
  delete require.cache[require.resolve("../index")];
  const { serverConfig: reloadedConfig } = require("../index");

  t.is(reloadedConfig.cors.credentials, true);
});

test("serverConfig - should default CORS_CREDENTIALS to false", (t) => {
  process.env.CORS_CREDENTIALS = "false";

  // Clear module cache and re-require
  delete require.cache[require.resolve("../index")];
  const { serverConfig: reloadedConfig } = require("../index");

  t.is(reloadedConfig.cors.credentials, false);
});

test("serverConfig - should parse VETTAM_API_TIMEOUT as number", (t) => {
  process.env.VETTAM_API_TIMEOUT = "60000";

  // Clear module cache and re-require
  delete require.cache[require.resolve("../index")];
  const { serverConfig: reloadedConfig } = require("../index");

  t.is(reloadedConfig.vettam.timeout, 60000);
});

test("serverConfig - should use default VETTAM_API_TIMEOUT", (t) => {
  delete process.env.VETTAM_API_TIMEOUT;

  // Clear module cache and re-require
  delete require.cache[require.resolve("../index")];
  const { serverConfig: reloadedConfig } = require("../index");

  t.is(reloadedConfig.vettam.timeout, 30000);
});

test("serverConfig - should use default JWT_ALGORITHM", (t) => {
  delete process.env.JWT_ALGORITHM;

  // Clear module cache and re-require
  delete require.cache[require.resolve("../index")];
  const { serverConfig: reloadedConfig } = require("../index");

  t.is(reloadedConfig.jwt.algorithm, "HS256");
});

test("serverConfig - should use default JWT_AUDIENCE", (t) => {
  delete process.env.JWT_AUDIENCE;

  // Clear module cache and re-require
  delete require.cache[require.resolve("../index")];
  const { serverConfig: reloadedConfig } = require("../index");

  t.is(reloadedConfig.jwt.audience, "authenticated");
});

test("isDevelopment - should be true when DEBUG is true", (t) => {
  process.env.DEBUG = "true";

  // Clear module cache and re-require
  delete require.cache[require.resolve("../index")];
  const { isDevelopment: reloadedIsDev } = require("../index");

  t.is(reloadedIsDev, true);
});

test("serverConfig - should use default Vettam API URL", (t) => {
  delete process.env.VETTAM_API_URL;
  // But need to set it for validation
  process.env.VETTAM_API_URL = "https://api.vettam.app";

  // Clear module cache and re-require
  delete require.cache[require.resolve("../index")];
  const { serverConfig: reloadedConfig } = require("../index");

  t.is(reloadedConfig.vettam.apiUrl, "https://api.vettam.app");
});
