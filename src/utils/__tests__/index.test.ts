import test from "ava";
import * as utils from "../index";

test("utils exports markdownToTiptapJson", (t) => {
  t.truthy(utils.markdownToTiptapJson);
});

test("utils exports removeHtmlComments", (t) => {
  t.truthy(utils.removeHtmlComments);
});

test("utils exports parseInlineContent", (t) => {
  t.truthy(utils.parseInlineContent);
});

test("utils exports parseListItems", (t) => {
  t.truthy(utils.parseListItems);
});

test("utils exports tiptapJsonToMarkdown", (t) => {
  t.truthy(utils.tiptapJsonToMarkdown);
});

test("utils exports extractJWTFromRequest", (t) => {
  t.truthy(utils.extractJWTFromRequest);
});

test("utils exports getUserIdFromJWT (may be undefined)", (t) => {
  t.true("getUserIdFromJWT" in utils);
});

test("utils exports createRateLimitKey", (t) => {
  t.truthy(utils.createRateLimitKey);
});

test("utils exports StandardError", (t) => {
  t.truthy(utils.StandardError);
});

test("utils exports ErrorFactory", (t) => {
  t.truthy(utils.ErrorFactory);
});

test("utils exports ErrorType (may be undefined)", (t) => {
  t.true("ErrorType" in utils);
});

test("utils exports handleErrorResponse", (t) => {
  t.truthy(utils.handleErrorResponse);
});

test("utils exports sanitizeErrorMessage", (t) => {
  t.truthy(utils.sanitizeErrorMessage);
});

test("utils exports asyncHandler", (t) => {
  t.truthy(utils.asyncHandler);
});
