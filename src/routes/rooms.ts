import { Router, Request, Response } from "express";
import { documentService } from "../services/document";
import { logger } from "../config/logger";
import axios from "axios";
import { APIErrorResponse, RoomPreloadRequest } from "../types";
import { markdownToTiptapJson } from "../utils";
import { DEFAULT_HTTP_TIMEOUT } from "../config/constants";

const roomsRouter = Router();

/**
 *
 * POST /v1/room/:id/preload
 */
roomsRouter.post("/:id/preload", async (req: Request, res: Response) => {
  try {
    const roomId = req.params.id;
    const { mdFileUrl }: RoomPreloadRequest = req.body;

    if (!mdFileUrl) {
      const apiError: APIErrorResponse = {
        message: "mdFileUrl is required in request body",
        error: "Bad Request",
        statusCode: 400,
        timestamp: new Date().toISOString(),
      };
      return res.status(400).json(apiError);
    }

    logger.info("Starting preload process", { roomId, mdFileUrl });

    // Fetch markdown content from the signed URL
    const response = await axios.get(mdFileUrl, {
      timeout: DEFAULT_HTTP_TIMEOUT,
      responseType: "text",
    });

    if (response.status !== 200) {
      throw new Error(`Failed to fetch markdown file: HTTP ${response.status}`);
    }

    // const markdownContent = response.data;
    const markdownContent = response.data as string;
  
    logger.info("Markdown content fetched successfully", {
      roomId,
      contentLength: markdownContent.length,
    });

    // Convert markdown to TipTap JSON using custom server-side parser
    const tiptapJson = markdownToTiptapJson(markdownContent);

    logger.info("Markdown converted to TipTap JSON", {
      roomId,
      jsonSize: JSON.stringify(tiptapJson).length,
    });


    // Initialize the room document to ensure it exists
    const yDoc = await documentService.getDocument(roomId);

    // Load the TipTap JSON into the Y.Doc
    const yMap = yDoc.getMap("document");
    yMap.set("content", tiptapJson);

    logger.info("TipTap JSON loaded into Y.Doc", { roomId });

    // Save the snapshot using documentService
    await documentService.saveSnapshot(roomId);

    logger.info("Document snapshot saved successfully", { roomId });

    // Return success response
    return res.status(200).json({
      success: true,
      message: "Room preloaded successfully",
      roomId,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error("Error in room preload", {
      roomId: req.params.id,
      error: (error as Error).message,
    });

    let statusCode = 500;
    let errorMessage = "Internal Server Error";

    // Handle specific error types
    if (axios.isAxiosError(error)) {
      if (error.response?.status === 404) {
        statusCode = 404;
        errorMessage = "Markdown file not found";
      } else if (error.response?.status === 403) {
        statusCode = 403;
        errorMessage = "Access denied to markdown file";
      } else if (error.code === "ECONNABORTED") {
        statusCode = 408;
        errorMessage = "Timeout fetching markdown file";
      } else {
        statusCode = 502;
        errorMessage = "Failed to fetch markdown file";
      }
    }

    const apiError: APIErrorResponse = {
      message: (error as Error).message || errorMessage,
      error: errorMessage,
      statusCode,
      timestamp: new Date().toISOString(),
    };
    return res.status(statusCode).json(apiError);
  }
});

export default roomsRouter;
