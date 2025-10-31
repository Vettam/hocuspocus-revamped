import test from "ava";
import express from "express";
import supertest from "supertest";
import bodyParser from "body-parser";
import stateRouter from "../state";
import * as hocuspocusInstanceModule from "../../services/hocuspocus-instance";
import * as Y from "yjs";
// Mock hocuspocusInstance for all tests
test.before(() => {
  const fakeDirectConnection = {
    document: new Y.Doc(),
    disconnect: async () => {},
    transact: async (fn: (doc: any) => void) => fn(new Y.Doc()),
  };
  const fakeHocuspocus = {
    openDirectConnection: async () => fakeDirectConnection,
  };
  // @ts-ignore
  hocuspocusInstanceModule.hocuspocusInstance = {
    getInstance: () => fakeHocuspocus,
    setInstance: () => {},
  };
});
import { handleErrorResponse } from "../../utils";

// Helper to create an express app with the stateRouter mounted
function createTestApp() {
  const app = express();
  app.use(bodyParser.json());
  app.use("/", stateRouter);
  // Add global error handler to match production
  app.use(
    (
      err: any,
      _req: express.Request,
      res: express.Response,
      _next: express.NextFunction
    ) => {
      handleErrorResponse(err, res);
    }
  );
  return app;
}

// --- GET /:draftId/:versionId/state ---
test.serial("GET /:draftId/:versionId/state - missing draftId", async (t) => {
  const app = createTestApp();
  const res = await supertest(app).get(
    "//550e8400-e29b-41d4-a716-446655440001/state"
  );
  t.is(res.status, 404); // Express treats missing param as 404
});

test.serial(
  "GET /:draftId/:versionId/state - invalid draftId UUID",
  async (t) => {
    const app = createTestApp();
    const res = await supertest(app).get(
      "/invalid-uuid/550e8400-e29b-41d4-a716-446655440001/state"
    );
    t.is(res.status, 400);
    t.is(res.body.error, "ValidationError");
    t.regex(res.body.message, /Draft ID must be a valid UUID/);
  }
);

test.serial("GET /:draftId/:versionId/state - missing versionId", async (t) => {
  const app = createTestApp();
  const res = await supertest(app).get(
    "/550e8400-e29b-41d4-a716-446655440000//state"
  );
  t.is(res.status, 404); // Express treats missing param as 404
});

test.serial(
  "GET /:draftId/:versionId/state - invalid versionId UUID",
  async (t) => {
    const app = createTestApp();
    const res = await supertest(app).get(
      "/550e8400-e29b-41d4-a716-446655440000/invalid-uuid/state"
    );
    t.is(res.status, 400);
    t.is(res.body.error, "ValidationError");
    t.regex(res.body.message, /Version ID must be a valid UUID/);
  }
);

// --- PATCH /:draftId/:versionId/state ---
test.serial("PATCH /:draftId/:versionId/state - missing draftId", async (t) => {
  const app = createTestApp();
  const res = await supertest(app)
    .patch("//550e8400-e29b-41d4-a716-446655440001/state")
    .send({ content: "# Test" });
  t.is(res.status, 404); // Express treats missing param as 404
});

test.serial(
  "PATCH /:draftId/:versionId/state - invalid draftId UUID",
  async (t) => {
    const app = createTestApp();
    const res = await supertest(app)
      .patch("/not-a-uuid/550e8400-e29b-41d4-a716-446655440001/state")
      .send({ content: "# Test" });
    t.is(res.status, 400);
    t.is(res.body.error, "ValidationError");
    t.regex(res.body.message, /Draft ID must be a valid UUID/);
  }
);

test.serial(
  "PATCH /:draftId/:versionId/state - missing versionId",
  async (t) => {
    const app = createTestApp();
    const res = await supertest(app)
      .patch("/550e8400-e29b-41d4-a716-446655440000//state")
      .send({ content: "# Test" });
    t.is(res.status, 404); // Express treats missing param as 404
  }
);

test.serial(
  "PATCH /:draftId/:versionId/state - invalid versionId UUID",
  async (t) => {
    const app = createTestApp();
    const res = await supertest(app)
      .patch("/550e8400-e29b-41d4-a716-446655440000/not-a-uuid/state")
      .send({ content: "# Test" });
    t.is(res.status, 400);
    t.is(res.body.error, "ValidationError");
    t.regex(res.body.message, /Version ID must be a valid UUID/);
  }
);

test.serial("PATCH /:draftId/:versionId/state - missing content", async (t) => {
  const app = createTestApp();
  const res = await supertest(app)
    .patch(
      "/550e8400-e29b-41d4-a716-446655440000/550e8400-e29b-41d4-a716-446655440001/state"
    )
    .send({});
  t.is(res.status, 400);
  t.is(res.body.error, "ValidationError");
  t.regex(res.body.message, /content is required and must be a string/);
});

test.serial(
  "PATCH /:draftId/:versionId/state - non-string content (number)",
  async (t) => {
    const app = createTestApp();
    const res = await supertest(app)
      .patch(
        "/550e8400-e29b-41d4-a716-446655440000/550e8400-e29b-41d4-a716-446655440001/state"
      )
      .send({ content: 123 });
    t.is(res.status, 400);
    t.is(res.body.error, "ValidationError");
    t.regex(res.body.message, /content is required and must be a string/);
  }
);

test.serial("PATCH /:draftId/:versionId/state - object content", async (t) => {
  const app = createTestApp();
  const res = await supertest(app)
    .patch(
      "/550e8400-e29b-41d4-a716-446655440000/550e8400-e29b-41d4-a716-446655440001/state"
    )
    .send({ content: { invalid: "object" } });
  t.is(res.status, 400);
  t.is(res.body.error, "ValidationError");
  t.regex(res.body.message, /content is required and must be a string/);
});

test.serial("PATCH /:draftId/:versionId/state - array content", async (t) => {
  const app = createTestApp();
  const res = await supertest(app)
    .patch(
      "/550e8400-e29b-41d4-a716-446655440000/550e8400-e29b-41d4-a716-446655440001/state"
    )
    .send({ content: ["array", "content"] });
  t.is(res.status, 400);
  t.is(res.body.error, "ValidationError");
  t.regex(res.body.message, /content is required and must be a string/);
});

test.serial(
  "PATCH /:draftId/:versionId/state - empty string content is valid",
  async (t) => {
    const app = createTestApp();
    const res = await supertest(app)
      .patch(
        "/550e8400-e29b-41d4-a716-446655440000/550e8400-e29b-41d4-a716-446655440001/state"
      )
      .send({ content: "" });

    t.assert(
      res.status >= 200 && res.status < 300,
      "Empty string should be accepted"
    );
  }
);
