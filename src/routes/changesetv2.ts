import { Router, Request, Response } from "express";
import * as Y from "yjs";
import { markdownToTiptapJson } from "../utils/converters/json-to-tiptap";
import { jsonToYDoc, yDocToJSON } from "../utils/ydoc/converters";
import { schema } from "../utils/ydoc/schema";
import { recreateTransform } from "@manuscripts/prosemirror-recreate-steps";
import { hocuspocusInstance } from "../services/hocuspocus-instance";
import { logger } from "../config/logger";
import { RegexMatcher } from "../utils/regex_matcher";
import { ErrorFactory, asyncHandler } from "../utils";

const router = Router();

/**
 * POST /:draftId/:versionId/markdown
 * Body: { markdown: string }
 *
 * Loads existing document from room (draftId:versionId),
 * converts markdown -> TipTap JSON -> Y.Doc (temp),
 * and computes a changeset from existing doc -> markdown-generated doc.
 */
router.post("/:draftId/:versionId/markdown", asyncHandler(async (req: Request, res: Response) => {
  const { draftId, versionId } = req.params;
  const { markdown, fieldName = "default" } = req.body || {};

  // Validation
  if (!draftId || typeof draftId !== 'string') {
    throw ErrorFactory.validation("Draft ID is required and must be a valid string");
  }

  if (!RegexMatcher.matchUUID(draftId)) {
    throw ErrorFactory.validation("Draft ID must be a valid UUID");
  }

  if (!versionId || typeof versionId !== 'string') {
    throw ErrorFactory.validation("Version ID is required and must be a valid string");
  }

  if (!RegexMatcher.matchUUID(versionId)) {
    throw ErrorFactory.validation("Version ID must be a valid UUID");
  }

  if (!markdown || typeof markdown !== "string") {
    throw ErrorFactory.validation("Missing 'markdown' in request body");
  }

  // Construct roomId from draftId and versionId
  const roomId = `${draftId}:${versionId}`;

  logger.info("Computing changeset from existing doc to markdown", {
    roomId,
    draftId,
    versionId,
    markdownLength: markdown.length,
  });

  // Get Hocuspocus instance
  const hocuspocus = hocuspocusInstance.getInstance();

  // Open a direct connection to load/access the document
  const directConnection = await hocuspocus.openDirectConnection(roomId, {
    room_id: roomId,
  });

  try {
    // Ensure document is loaded
    if (!directConnection.document) {
      throw ErrorFactory.internal("Failed to load document");
    }

    const existingYDoc = directConnection.document;

    // 1) Convert existing YDoc to TipTap JSON
    const existingTiptapJsonString = yDocToJSON(existingYDoc, schema, fieldName);
    const existingTiptapJson = JSON.parse(existingTiptapJsonString);

    logger.info("Existing YDoc converted to TipTap JSON", {
      roomId,
      jsonSize: existingTiptapJsonString.length,
    });

    // 2) Convert markdown to TipTap JSON
    const newTiptapJson = markdownToTiptapJson(markdown);

    logger.info("Markdown converted to TipTap JSON", {
      roomId,
      newJsonSize: JSON.stringify(newTiptapJson).length,
    });

    // 3) Create a temporary Y.Doc and populate it from new TipTap JSON
    const newYDoc = new Y.Doc();
    jsonToYDoc(newTiptapJson, newYDoc, schema, fieldName);

    // 4) Create ProseMirror nodes from TipTap JSON
    const existingPmDoc = schema.nodeFromJSON(existingTiptapJson);
    const newPmDoc = schema.nodeFromJSON(newTiptapJson);

    // 5) Use prosemirror-recreate-steps to compute the diff
    const transform = recreateTransform(existingPmDoc, newPmDoc, true, true);
    
    // 6) Format the steps into a readable diff
    const diff = formatTransformSteps(transform, existingPmDoc, newPmDoc);

    logger.info("Changeset computed successfully", {
      roomId,
      totalSteps: transform.steps.length,
      changes: diff.changes.length,
    });

    // Return changeset and new Y.Doc snapshot (Uint8Array as base64)
    const state = Y.encodeStateAsUpdate(newYDoc);
    const stateBase64 = Buffer.from(state).toString("base64");

    // Clean up temporary Y.Doc
    newYDoc.destroy();

    return res.status(200).json({
      success: true,
      roomId,
      diff,
      ydocSnapshot: stateBase64,
      existingTiptap: existingTiptapJson,
      newTiptap: newTiptapJson,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    if ((error as Error).message.includes("Document not found")) {
      throw ErrorFactory.notFound(`Document for room ${roomId}`);
    }
    throw ErrorFactory.internal(`Failed to compute changeset: ${(error as Error).message}`);
  } finally {
    // Always disconnect the direct connection
    try {
      await directConnection.disconnect();
    } catch (disconnectError) {
      logger.error("Error disconnecting direct connection", {
        roomId,
        error: (disconnectError as Error).message,
      });
    }
    logger.debug("Direct connection disconnected", { roomId });
  }
}));

// ---------------------- Helper functions ----------------------

// Format ProseMirror Transform steps into readable diff
function formatTransformSteps(transform: any, oldDoc: any, newDoc: any): any {
  const changes: any[] = [];
  
  transform.steps.forEach((step: any, index: number) => {
    const stepJSON = step.toJSON();
    
    changes.push({
      index,
      stepType: step.constructor.name,
      step: stepJSON,
      from: stepJSON.from,
      to: stepJSON.to,
      summary: formatStepSummary(step, oldDoc, newDoc),
    });
  });

  return {
    summary: {
      totalSteps: transform.steps.length,
      totalChanges: changes.length,
    },
    steps: transform.steps.map((s: any) => s.toJSON()),
    changes,
  };
}

function formatStepSummary(step: any, _oldDoc: any, _newDoc: any): string {
  const stepType = step.constructor.name;
  const json = step.toJSON();

  switch (stepType) {
    case "ReplaceStep":
      if (json.slice?.content) {
        const content = json.slice.content.map((n: any) => {
          if (n.type === "text") return n.text;
          return `[${n.type}]`;
        }).join("");
        return `Replace at ${json.from}-${json.to} with: ${content}`;
      }
      return `Delete at ${json.from}-${json.to}`;
    
    case "ReplaceAroundStep":
      return `Replace around ${json.from}-${json.to}`;
    
    case "AddMarkStep":
      return `Add mark ${json.mark?.type} at ${json.from}-${json.to}`;
    
    case "RemoveMarkStep":
      return `Remove mark ${json.mark?.type} at ${json.from}-${json.to}`;
    
    default:
      return `${stepType} at ${json.from || 0}-${json.to || 0}`;
  }
}

export default router;
