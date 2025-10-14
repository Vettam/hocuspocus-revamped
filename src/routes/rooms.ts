import { Router, Request, Response } from "express";
import { documentService } from "../services/document";
import { logger } from "../config/logger";
import {
  RefreshDocumentRequest,
  RefreshDocumentResponse,
  APIErrorResponse,
} from "../types";

const roomsRouter = Router();

/**
 * Refresh a room's document from the Primary API Service
 * POST /v1/room/:id/refresh
 */
roomsRouter.post("/:id/refresh", async (req: Request, res: Response) => {
  try {
    const roomId = req.params.id;
    const { forceRefresh = false } = req.body;

    logger.info("Room refresh requested", { roomId, forceRefresh });

    // Validate room ID
    if (!roomId || typeof roomId !== "string") {
      const error: APIErrorResponse = {
        error: "Bad Request",
        message: "Invalid room ID provided",
        statusCode: 400,
        timestamp: new Date().toISOString(),
      };
      return res.status(400).json(error);
    }

    // Create refresh request
    const refreshRequest: RefreshDocumentRequest = {
      roomId,
      forceRefresh: Boolean(forceRefresh),
    };

    // Refresh the document
    const result: RefreshDocumentResponse =
      await documentService.refreshDocument(refreshRequest);

    if (result.success) {
      logger.info("Room refresh successful", { roomId, result });
      return res.json(result);
    } else {
      logger.warn("Room refresh failed", { roomId, result });
      const error: APIErrorResponse = {
        error: "Refresh Failed",
        message: result.message || "Failed to refresh room document",
        statusCode: 500,
        timestamp: new Date().toISOString(),
      };
      return res.status(500).json(error);
    }
  } catch (error) {
    logger.error("Room refresh error", {
      roomId: req.params.id,
      error: (error as Error).message,
    });

    const apiError: APIErrorResponse = {
      error: "Internal Server Error",
      message: `Failed to refresh room: ${(error as Error).message}`,
      statusCode: 500,
      timestamp: new Date().toISOString(),
    };

    return res.status(500).json(apiError);
  }
});

export default roomsRouter;
