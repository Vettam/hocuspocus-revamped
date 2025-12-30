import { Router, Request, Response } from "express";
import { Step } from "prosemirror-transform";
import { hocuspocusInstance } from "../../services/hocuspocus-instance";
import { logger } from "../../config/logger";
import { yDocToJSON, jsonToYDoc } from "../../utils/ydoc/converters";
import { schema } from "../../utils/ydoc/schema";
import { RegexMatcher } from "../../utils/regex_matcher";
import { ErrorFactory, asyncHandler } from "../../utils";

const applyRouter = Router();

interface DiffStep {
  stepType: string;
  from: number;
  to: number;
  slice?: {
    content: Array<{
      type: string;
      text?: string;
      content?: any[];
      attrs?: Record<string, any>;
    }>;
  };
}

interface ApplyChangesRequest {
  diff: {
    summary: {
      totalSteps: number;
      totalChanges: number;
    };
    steps: DiffStep[];
    changes?: any[];
  };
}

/**
 * POST /:draftId/:versionId/apply
 * Body: { diff: { steps: [...], summary: {...} } }
 *
 * Applies the provided diff steps to the document in the specified room.
 * Steps are expected to be in ProseMirror step format.
 */
applyRouter.post(
  "/:draftId/:versionId/apply",
  asyncHandler(async (req: Request, res: Response) => {
    const { draftId, versionId } = req.params;
    const { diff } = req.body as ApplyChangesRequest;

    // Validation
    if (!draftId || typeof draftId !== "string") {
      throw ErrorFactory.validation(
        "Draft ID is required and must be a valid string"
      );
    }

    if (!RegexMatcher.matchUUID(draftId)) {
      throw ErrorFactory.validation("Draft ID must be a valid UUID");
    }

    if (!versionId || typeof versionId !== "string") {
      throw ErrorFactory.validation(
        "Version ID is required and must be a valid string"
      );
    }

    if (!RegexMatcher.matchUUID(versionId)) {
      throw ErrorFactory.validation("Version ID must be a valid UUID");
    }

    if (!diff || !diff.steps || !Array.isArray(diff.steps)) {
      throw ErrorFactory.validation(
        "Missing or invalid 'diff.steps' in request body"
      );
    }

    // Construct roomId from draftId and versionId
    const roomId = `${draftId}:${versionId}`;

    logger.info("Applying changes to document", {
      roomId,
      draftId,
      versionId,
      totalSteps: diff.steps.length,
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

      const ydoc = directConnection.document;

      // 1) Convert existing YDoc to TipTap JSON, then to ProseMirror Node
      const existingTiptapJsonString = yDocToJSON(ydoc, schema, "default");
      const existingTiptapJson = JSON.parse(existingTiptapJsonString);

      logger.info("Existing YDoc converted to TipTap JSON", {
        roomId,
        jsonSize: existingTiptapJsonString.length,
      });

      // Create ProseMirror document from existing content
      let pmDoc = schema.nodeFromJSON(existingTiptapJson);

      logger.info("Created ProseMirror document from TipTap JSON", {
        roomId,
        docSize: pmDoc.content.size,
      });

      // 2) Apply each step to the ProseMirror document
      let appliedSteps = 0;
      const stepResults: any[] = [];

      for (const [index, stepData] of diff.steps.entries()) {
        try {
          // Create Step from JSON
          const step = Step.fromJSON(schema, stepData);

          // Apply the step
          const result = step.apply(pmDoc);

          if (result.failed) {
            logger.warn(`Step ${index} failed to apply`, {
              roomId,
              step: stepData,
              error: result.failed,
            });
            stepResults.push({
              index,
              success: false,
              error: result.failed,
              step: stepData,
            });
          } else if (result.doc) {
            // Update document with the result
            pmDoc = result.doc;
            appliedSteps++;
            stepResults.push({
              index,
              success: true,
              step: stepData,
            });
            logger.debug(`Step ${index} applied successfully`, {
              roomId,
              step: stepData,
            });
          }
        } catch (error) {
          const errorMessage =
            error instanceof Error ? error.message : "Unknown error";
          logger.error(`Error applying step ${index}`, {
            roomId,
            step: stepData,
            error: errorMessage,
          });
          stepResults.push({
            index,
            success: false,
            error: errorMessage,
            step: stepData,
          });
        }
      }

      logger.info("Steps application completed", {
        roomId,
        totalSteps: diff.steps.length,
        appliedSteps,
        failedSteps: diff.steps.length - appliedSteps,
      });

      // 3) Convert updated ProseMirror document back to TipTap JSON
      const updatedTiptapJson = pmDoc.toJSON();

      logger.info("Updated ProseMirror document converted to TipTap JSON", {
        roomId,
        newDocSize: pmDoc.content.size,
      });

      // 4) Update the YDoc with the new content
      jsonToYDoc(updatedTiptapJson, ydoc, schema, "default");

      logger.info("YDoc updated with new content", {
        roomId,
      });

      return res.status(200).json({
        success: true,
        roomId,
        appliedSteps,
        totalSteps: diff.steps.length,
        failedSteps: diff.steps.length - appliedSteps,
        stepResults,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";

      if (errorMessage.includes("Document not found")) {
        throw ErrorFactory.notFound(`Document for room ${roomId}`);
      }

      logger.error("Failed to apply changes", {
        roomId,
        error: errorMessage,
      });

      throw ErrorFactory.internal(
        `Failed to apply changes: ${errorMessage}`
      );
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
  })
);

export default applyRouter;
