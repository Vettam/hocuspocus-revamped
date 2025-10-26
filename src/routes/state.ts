import { Router, Request, Response } from "express";
import { documentService } from "../services/document";
import { logger } from "../config/logger";
import { 
  markdownToTiptapJson, 
  tiptsapJsonToMarkdown, 
  ErrorFactory,
  asyncHandler 
} from "../utils";
import { yDocToJSON, jsonToYDoc } from "../utils/ydoc/converters";
import { schema } from "../utils/ydoc/schema";

const stateRouter = Router();

/**
 * GET /room/:id/state
 * Get markdown content of room's YDoc (YDoc -> JSON -> Markdown)
 */
stateRouter.get("/:id/state", asyncHandler(async (req: Request, res: Response) => {
  const roomId = req.params.id;

  if (!roomId || typeof roomId !== 'string') {
    throw ErrorFactory.validation("Room ID is required and must be a valid string");
  }

  logger.info("Getting room state as markdown", { roomId });

  try {
    // Get the YDoc for the room
    const yDoc = documentService.getDocument(roomId);

    // Convert YDoc to TipTap JSON using the schema
    const tiptapJsonString = yDocToJSON(yDoc, schema, "default");
    const tiptapJson = JSON.parse(tiptapJsonString);

    logger.info("YDoc converted to TipTap JSON", {
      roomId,
      jsonSize: tiptapJsonString.length,
    });

    // Convert TipTap JSON to markdown
    const markdownContent = tiptsapJsonToMarkdown(tiptapJson);

    logger.info("TipTap JSON converted to markdown", {
      roomId,
      markdownLength: markdownContent.length,
    });

    // Return the markdown content
    return res.status(200).json({
      success: true,
      roomId,
      content: markdownContent,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    if ((error as Error).message.includes("Document not found")) {
      throw ErrorFactory.notFound(`Document for room ${roomId}`);
    }
    throw ErrorFactory.internal(`Failed to get room state: ${(error as Error).message}`);
  }
}));

/**
 * PATCH /room/:id/state
 * Update room's YDoc with markdown content (Markdown -> JSON -> YDoc)
 */
stateRouter.patch("/:id/state", asyncHandler(async (req: Request, res: Response) => {
  const roomId = req.params.id;
  const { content } = req.body;

  // Validation
  if (!roomId || typeof roomId !== 'string') {
    throw ErrorFactory.validation("Room ID is required and must be a valid string");
  }

  if (typeof content !== "string") {
    throw ErrorFactory.validation("content is required and must be a string");
  }

  logger.info("Updating room state with markdown", {
    roomId,
    contentLength: content.length,
  });

  try {
    // Convert markdown to TipTap JSON
    const tiptapJson = markdownToTiptapJson(content);

    logger.info("Markdown converted to TipTap JSON", {
      tiptapJson,
    });

    // Get the YDoc for the room
    const yDoc = documentService.getDocument(roomId);

    // Convert TipTap JSON to YDoc using the schema
    jsonToYDoc(JSON.stringify(tiptapJson), yDoc, schema, "default");
    logger.info("TipTap JSON loaded into YDoc", { roomId });

    // Save the snapshot using documentService
    await documentService.saveSnapshot(roomId);

    logger.info("Document snapshot saved successfully", { roomId });

    // Return success response
    return res.status(200).json({
      success: true,
      message: "Room state updated successfully",
      roomId,
      contentLength: content.length,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    const errorMessage = (error as Error).message;
    
    if (errorMessage.includes("Document not found")) {
      throw ErrorFactory.notFound(`Document for room ${roomId}`);
    } else if (errorMessage.includes("Invalid room ID format")) {
      throw ErrorFactory.validation("Invalid room ID format");
    } else if (errorMessage.includes("Failed to convert")) {
      throw ErrorFactory.validation("Failed to convert markdown content");
    } else {
      throw ErrorFactory.internal(`Failed to update room state: ${errorMessage}`);
    }
  }
}));

export default stateRouter;
