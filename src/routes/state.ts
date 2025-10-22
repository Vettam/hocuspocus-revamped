import { Router, Request, Response } from "express";
import { documentService } from "../services/document";
import { logger } from "../config/logger";
import { APIErrorResponse } from "../types";
import { markdownToTiptapJson, tiptsapJsonToMarkdown } from "../utils";
import { yDocToJSON, jsonToYDoc } from "../utils/ydoc/converters";
import { schema } from "../utils/ydoc/schema";

const stateRouter = Router();

/**
 * GET /room/:id/state
 * Get markdown content of room's YDoc (YDoc -> JSON -> Markdown)
 */
stateRouter.get("/:id/state", async (req: Request, res: Response) => {
  try {
    const roomId = req.params.id;

    logger.info("Getting room state as markdown", { roomId });

    // Get the YDoc for the room
    const yDoc = await documentService.getDocument(roomId);

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
    logger.error("Error getting room state", {
      roomId: req.params.id,
      error: (error as Error).message,
    });

    const apiError: APIErrorResponse = {
      message: (error as Error).message || "Failed to get room state",
      error: "Internal Server Error",
      statusCode: 500,
      timestamp: new Date().toISOString(),
    };

    return res.status(500).json(apiError);
  }
});

/**
 * PATCH /room/:id/state
 * Update room's YDoc with markdown content (Markdown -> JSON -> YDoc)
 */
stateRouter.patch("/:id/state", async (req: Request, res: Response) => {
  try {
    const roomId = req.params.id;
    const { content } = req.body;

    if (typeof content !== "string") {
      const apiError: APIErrorResponse = {
        message: "content is required and must be a string",
        error: "Bad Request",
        statusCode: 400,
        timestamp: new Date().toISOString(),
      };
      return res.status(400).json(apiError);
    }

    logger.info("Updating room state with markdown", {
      roomId,
      contentLength: content.length,
    });

    // Convert markdown to TipTap JSON
    const tiptapJson = markdownToTiptapJson(content);

    logger.info("Markdown converted to TipTap JSON", {
      tiptapJson
    });

    // Get the YDoc for the room
    const yDoc = await documentService.getDocument(roomId);

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
    logger.error("Error updating room state", {
      roomId: req.params.id,
      error: (error as Error).message,
    });

    let statusCode = 500;
    let errorMessage = "Internal Server Error";

    // Handle specific error types
    if ((error as Error).message.includes("Invalid room ID format")) {
      statusCode = 400;
      errorMessage = "Bad Request";
    } else if ((error as Error).message.includes("Failed to convert")) {
      statusCode = 422;
      errorMessage = "Unprocessable Entity";
    }

    const apiError: APIErrorResponse = {
      message: (error as Error).message || "Failed to update room state",
        error: errorMessage,
      statusCode,
      timestamp: new Date().toISOString(),
    };

    return res.status(statusCode).json(apiError);
  }
});

export default stateRouter;
