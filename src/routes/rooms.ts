import { Router, Request, Response } from "express";
import { documentService } from "../services/document";
import { logger } from "../config/logger";
import {
  APIErrorResponse,
  RoomPreloadRequest,
} from "../types";

const roomsRouter = Router();

/**
 * 
 * POST /v1/room/:id/preload
 */
roomsRouter.post("/:id/preload", async (req: Request, res: Response) => {
  try {
  } catch (error) {
    logger.error("Error refreshing room document", {
      roomId: req.params.id,
      error: (error as Error).message,
    });
    const apiError: APIErrorResponse = {
      message: (error as Error).message || "Internal Server Error",
      error: "Internal Server Error",
      statusCode: 500,
      timestamp: new Date().toISOString(),
    };
    res.status(500).json(apiError);
  }
});

export default roomsRouter;
