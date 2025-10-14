import { Router, Request, Response } from 'express';
import { documentService } from '../services/document';
import { vettamAPI } from '../services/vettam-api';
import { logger } from '../config/logger';
import { 
  RefreshDocumentRequest, 
  RefreshDocumentResponse,
  APIErrorResponse 
} from '../types';

const router = Router();

/**
 * Refresh a room's document from the Primary API Service
 * POST /v1/room/:id/refresh
 */
router.post('/:id/refresh', async (req: Request, res: Response) => {
  try {
    const roomId = req.params.id;
    const { forceRefresh = false } = req.body;

    logger.info('Room refresh requested', { roomId, forceRefresh });

    // Validate room ID
    if (!roomId || typeof roomId !== 'string') {
      const error: APIErrorResponse = {
        error: 'Bad Request',
        message: 'Invalid room ID provided',
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
    const result: RefreshDocumentResponse = await documentService.refreshDocument(refreshRequest);

    if (result.success) {
      logger.info('Room refresh successful', { roomId, result });
      return res.json(result);
    } else {
      logger.warn('Room refresh failed', { roomId, result });
      const error: APIErrorResponse = {
        error: 'Refresh Failed',
        message: result.message || 'Failed to refresh room document',
        statusCode: 500,
        timestamp: new Date().toISOString(),
      };
      return res.status(500).json(error);
    }
  } catch (error) {
    logger.error('Room refresh error', { 
      roomId: req.params.id, 
      error: (error as Error).message 
    });

    const apiError: APIErrorResponse = {
      error: 'Internal Server Error',
      message: `Failed to refresh room: ${(error as Error).message}`,
      statusCode: 500,
      timestamp: new Date().toISOString(),
    };

    return res.status(500).json(apiError);
  }
});

/**
 * Get room document information
 * GET /v1/room/:id/info
 */
router.get('/:id/info', async (req: Request, res: Response) => {
  try {
    const roomId = req.params.id;

    logger.debug('Room info requested', { roomId });

    // Validate room ID
    if (!roomId || typeof roomId !== 'string') {
      const error: APIErrorResponse = {
        error: 'Bad Request',
        message: 'Invalid room ID provided',
        statusCode: 400,
        timestamp: new Date().toISOString(),
      };
      return res.status(400).json(error);
    }

    // Get room information from Vettam API
    try {
      const room = await vettamAPI.getRoom(roomId);
      const documentVersion = documentService.getDocumentVersion(roomId);

      return res.json({
        success: true,
        data: {
          room,
          documentVersion,
          isDocumentLoaded: documentVersion > 0,
        },
      });
    } catch (error) {
      logger.warn('Room not found or not accessible', { roomId, error: (error as Error).message });
      
      const apiError: APIErrorResponse = {
        error: 'Not Found',
        message: 'Room not found or not accessible',
        statusCode: 404,
        timestamp: new Date().toISOString(),
      };
      
      return res.status(404).json(apiError);
    }
  } catch (error) {
    logger.error('Room info error', { 
      roomId: req.params.id, 
      error: (error as Error).message 
    });

    const apiError: APIErrorResponse = {
      error: 'Internal Server Error',
      message: `Failed to get room info: ${(error as Error).message}`,
      statusCode: 500,
      timestamp: new Date().toISOString(),
    };

    return res.status(500).json(apiError);
  }
});

/**
 * Get document content as JSON
 * GET /v1/room/:id/document
 */
router.get('/:id/document', async (req: Request, res: Response) => {
  try {
    const roomId = req.params.id;

    logger.debug('Room document requested', { roomId });

    // Validate room ID
    if (!roomId || typeof roomId !== 'string') {
      const error: APIErrorResponse = {
        error: 'Bad Request',
        message: 'Invalid room ID provided',
        statusCode: 400,
        timestamp: new Date().toISOString(),
      };
      return res.status(400).json(error);
    }

    // Get document JSON
    const documentJSON = documentService.getDocumentAsJSON(roomId);
    const version = documentService.getDocumentVersion(roomId);

    return res.json({
      success: true,
      data: {
        roomId,
        version,
        content: JSON.parse(documentJSON),
        timestamp: new Date().toISOString(),
      },
    });
  } catch (error) {
    logger.error('Room document error', { 
      roomId: req.params.id, 
      error: (error as Error).message 
    });

    const apiError: APIErrorResponse = {
      error: 'Internal Server Error',
      message: `Failed to get room document: ${(error as Error).message}`,
      statusCode: 500,
      timestamp: new Date().toISOString(),
    };

    return res.status(500).json(apiError);
  }
});

/**
 * List all active rooms
 * GET /v1/room/
 */
router.get('/', async (_req: Request, res: Response) => {
  try {
    logger.debug('Active rooms list requested');

    const activeRooms = documentService.getActiveDocuments();

    res.json({
      success: true,
      data: {
        activeRooms: activeRooms.map(roomId => ({
          roomId,
          version: documentService.getDocumentVersion(roomId),
        })),
        count: activeRooms.length,
        timestamp: new Date().toISOString(),
      },
    });
  } catch (error) {
    logger.error('Active rooms list error', { error: (error as Error).message });

    const apiError: APIErrorResponse = {
      error: 'Internal Server Error',
      message: `Failed to get active rooms: ${(error as Error).message}`,
      statusCode: 500,
      timestamp: new Date().toISOString(),
    };

    res.status(500).json(apiError);
  }
});

export default router;