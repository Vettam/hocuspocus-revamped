import test from "ava";
import * as Y from "yjs";
import sinon from "sinon";
import { DocumentService } from "../document";
import { logger } from "../../config/logger";

// Mocks


// Helper
function createRoomId() {
  return "123e4567-e89b-12d3-a456-426614174000:123e4567-e89b-12d3-a456-426614174001";
}

test.beforeEach(() => {
  sinon.restore();
  sinon.stub(logger, "info");
  sinon.stub(logger, "warn");
  sinon.stub(logger, "error");
  sinon.stub(logger, "debug");
});

test("registerHocuspocusDocument stores Y.Doc and sets dirty flag", (t) => {
  const service = new DocumentService();
  const yDoc = new Y.Doc();
  const roomId = createRoomId();
  service.registerHocuspocusDocument(roomId, yDoc);
  t.truthy(service["documents"].get(roomId));
  t.is(service["dirtyFlags"].get(roomId), false);
});

test("extractDraftId and extractVersionId parse roomId", (t) => {
  const service = new DocumentService();
  const roomId = createRoomId();
  t.is(service.extractDraftId(roomId), "123e4567-e89b-12d3-a456-426614174000");
  t.is(
    service.extractVersionId(roomId),
    "123e4567-e89b-12d3-a456-426614174001"
  );
});

test("applyUpdate creates Y.Doc if missing and applies update", (t) => {
  const service = new DocumentService();
  const roomId = createRoomId();
  const yDoc = new Y.Doc();
  const update = Y.encodeStateAsUpdate(yDoc);
  service.applyUpdate(roomId, update);
  t.truthy(service["documents"].get(roomId));
});

test("getDocument throws if not found", (t) => {
  const service = new DocumentService();
  t.throws(() => service.getDocument("missing"), {
    message: /Document not found/,
  });
});

test("getDocument returns Y.Doc if found", (t) => {
  const service = new DocumentService();
  const yDoc = new Y.Doc();
  const roomId = createRoomId();
  service.registerHocuspocusDocument(roomId, yDoc);
  t.is(service.getDocument(roomId), yDoc);
});

test("getActiveDocuments returns all roomIds", (t) => {
  const service = new DocumentService();
  const yDoc = new Y.Doc();
  const roomId = createRoomId();
  service.registerHocuspocusDocument(roomId, yDoc);
  t.deepEqual(service.getActiveDocuments(), [roomId]);
});

