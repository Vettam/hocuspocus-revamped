import { Router, Request, Response } from "express";
import * as Y from "yjs";
import { markdownToTiptapJson } from "../utils/converters/json-to-tiptap";
import { jsonToYDoc, yDocToJSON } from "../utils/ydoc/converters";
import { schema } from "../utils/ydoc/schema";
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

    // 4) Compute structural diff (node-level changes)
    const structuralDiff = computeStructuralDiff(existingTiptapJson, newTiptapJson);

    logger.info("Changeset computed successfully", {
      roomId,
      structuralChanges: structuralDiff.changes.length,
    });

    // Return changeset and new Y.Doc snapshot (Uint8Array as base64)
    const state = Y.encodeStateAsUpdate(newYDoc);
    const stateBase64 = Buffer.from(state).toString("base64");

    // Clean up temporary Y.Doc
    newYDoc.destroy();

    return res.status(200).json({
      success: true,
      roomId,
      diff: structuralDiff,
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

// Compute structural differences between two TipTap JSON documents
function computeStructuralDiff(oldDoc: any, newDoc: any): any {
  const changes: any[] = [];
  
  if (!oldDoc?.content || !newDoc?.content) {
    return { changes: [], summary: "Invalid document structure" };
  }

  const oldContent = oldDoc.content;
  const newContent = newDoc.content;
  
  // Use a more sophisticated comparison approach
  let oldIndex = 0;
  let newIndex = 0;

  while (oldIndex < oldContent.length || newIndex < newContent.length) {
    const oldNode = oldContent[oldIndex];
    const newNode = newContent[newIndex];

    if (!oldNode && newNode) {
      // Node added at the end
      changes.push({
        type: "node_added",
        position: newIndex,
        node: newNode,
        summary: `Added ${newNode.type}${extractText(newNode) ? `: "${extractText(newNode)}"` : ""}`
      });
      newIndex++;
    } else if (oldNode && !newNode) {
      // Node removed from the end
      changes.push({
        type: "node_removed",
        position: oldIndex,
        node: oldNode,
        summary: `Removed ${oldNode.type}${extractText(oldNode) ? `: "${extractText(oldNode)}"` : ""}`
      });
      oldIndex++;
    } else if (oldNode && newNode) {
      // Both nodes exist - check if they match
      const nodeChanges = compareNodes(oldNode, newNode, oldIndex);
      
      if (nodeChanges) {
        // Nodes are different
        if (nodeChanges.type === "node_type_changed") {
          // Type changed - could be replace or actual type change
          changes.push(nodeChanges);
          oldIndex++;
          newIndex++;
        } else {
          // Content modified
          changes.push(nodeChanges);
          oldIndex++;
          newIndex++;
        }
      } else {
        // Nodes are the same
        oldIndex++;
        newIndex++;
      }
    }
  }

  return {
    summary: {
      totalChanges: changes.length,
      types: changes.reduce((acc: any, change: any) => {
        acc[change.type] = (acc[change.type] || 0) + 1;
        return acc;
      }, {})
    },
    changes
  };
}

function compareNodes(oldNode: any, newNode: any, position: number): any | null {
  // Check if node type changed
  if (oldNode.type !== newNode.type) {
    return {
      type: "node_type_changed",
      position,
      oldType: oldNode.type,
      newType: newNode.type,
      summary: `Changed from ${oldNode.type} to ${newNode.type}`
    };
  }

  // Check attributes
  const attrsChanged = JSON.stringify(oldNode.attrs) !== JSON.stringify(newNode.attrs);
  
  // Check content
  const oldText = extractText(oldNode);
  const newText = extractText(newNode);
  const contentChanged = oldText !== newText;

  if (attrsChanged || contentChanged) {
    return {
      type: "node_modified",
      position,
      nodeType: oldNode.type,
      oldText,
      newText,
      oldAttrs: oldNode.attrs,
      newAttrs: newNode.attrs,
      summary: contentChanged 
        ? `Modified ${oldNode.type}: "${oldText}" → "${newText}"`
        : `Modified ${oldNode.type} attributes`
    };
  }

  return null;
}

function extractText(node: any): string {
  if (!node) return "";
  if (node.text) return node.text;
  if (node.content) {
    return node.content.map((child: any) => extractText(child)).join("");
  }
  return "";
}

export default router;
