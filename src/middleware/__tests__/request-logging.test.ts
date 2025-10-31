import test from "ava";
import sinon from "sinon";
import { requestLoggingMiddleware } from "../request-logging";
import * as loggerModule from "../../config/logger";
import { Request, Response, NextFunction } from "express";

test.beforeEach(() => {
  sinon.restore();
});

test.serial("calls next() exactly once", (t) => {
  const req = {
    method: "GET",
    url: "/test",
    ip: "127.0.0.1",
    get: () => "test-agent",
  } as unknown as Request;
  const res = {} as Response;
  let nextCalled = 0;
  const next: NextFunction = () => {
    nextCalled++;
  };

  requestLoggingMiddleware(req, res, next);
  t.is(nextCalled, 1);
});

test.serial("logs correct metadata", (t) => {
  const loggerSpy = sinon.spy(loggerModule.logger, "debug");
  const req = {
    method: "POST",
    url: "/api/resource",
    ip: "10.0.0.2",
    get: (header: string) => (header === "User-Agent" ? "my-agent" : undefined),
  } as unknown as Request;
  const res = {} as Response;
  const next: NextFunction = () => {};

  requestLoggingMiddleware(req, res, next);

  t.true(loggerSpy.calledOnce);
  const [msg, meta] = loggerSpy.firstCall.args;
  t.is(msg, "HTTP Request");
  t.deepEqual(meta, {
    method: "POST",
    url: "/api/resource",
    ip: "10.0.0.2",
    userAgent: "my-agent",
  });
});

test.serial("does not throw if User-Agent is missing", (t) => {
  const loggerSpy = sinon.spy(loggerModule.logger, "debug");
  const req = {
    method: "GET",
    url: "/no-agent",
    ip: "127.0.0.1",
    get: () => undefined,
  } as unknown as Request;
  const res = {} as Response;
  const next: NextFunction = () => {};

  t.notThrows(() => {
    requestLoggingMiddleware(req, res, next);
  });
  t.true(loggerSpy.calledOnce);
  const meta = loggerSpy.firstCall.args[1];
  t.is(meta.userAgent, undefined);
});

test.serial("does not modify the response", (t) => {
  const req = {
    method: "GET",
    url: "/test",
    ip: "127.0.0.1",
    get: () => "test-agent",
  } as unknown as Request;
  const res = { foo: "bar" } as unknown as Response;
  const next: NextFunction = () => {};

  requestLoggingMiddleware(req, res, next);
  t.is((res as any).foo, "bar");
});
