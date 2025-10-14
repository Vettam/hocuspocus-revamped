import * as Y from 'yjs';
import { vettamAPI } from './vettam-api';
import { 
  DocumentLoadRequest,
  RefreshDocumentRequest,
  RefreshDocumentResponse 
} from '../types';
import { logger } from '../config/logger';

export class DocumentService {
  private documents: Map<string, Y.Doc> = new Map();
  private documentVersions: Map<string, number> = new Map();

  /**
   * Get or create a Yjs document for a room
   */
  getDocument(roomId: string): Y.Doc {
    let doc = this.documents.get(roomId);
    
    if (!doc) {
      doc = new Y.Doc();
      this.documents.set(roomId, doc);
      this.documentVersions.set(roomId, 0);
      
      logger.info('Created new Yjs document', { roomId });
      
      // Set up document change listener
      doc.on('update', (update: Uint8Array) => {
        this.onDocumentUpdate(roomId, update);
      });
    }
    
    return doc;
  }

  /**
   * Refresh a document from the Primary API Service
   */
  async refreshDocument(request: RefreshDocumentRequest): Promise<RefreshDocumentResponse> {
    try {
      logger.info('Refreshing document', request);

      // Get document load URL from Vettam API
      const loadRequest: DocumentLoadRequest = {
        documentId: request.roomId, // Assuming roomId maps to documentId
        roomId: request.roomId,
        userId: 'system', // System refresh
      };

      const signedUrlResponse = await vettamAPI.getDocumentLoadURL(loadRequest);
      const document = await vettamAPI.loadDocument(signedUrlResponse.url);

      // Get or create the Yjs document
      const yDoc = this.getDocument(request.roomId);
      
      // If force refresh or the document version is newer
      const currentVersion = this.documentVersions.get(request.roomId) || 0;
      
      if (request.forceRefresh || document.version > currentVersion) {
        // Parse the content and update the Yjs document
        this.updateYjsDocument(yDoc, document.content);
        this.documentVersions.set(request.roomId, document.version);
        
        logger.info('Document refreshed successfully', {
          roomId: request.roomId,
          version: document.version,
          previousVersion: currentVersion,
        });

        return {
          success: true,
          documentId: document.id,
          version: document.version,
          message: 'Document refreshed successfully',
        };
      } else {
        logger.debug('Document already up to date', {
          roomId: request.roomId,
          currentVersion,
          apiVersion: document.version,
        });

        return {
          success: true,
          documentId: document.id,
          version: currentVersion,
          message: 'Document already up to date',
        };
      }
    } catch (error) {
      logger.error('Failed to refresh document', {
        roomId: request.roomId,
        error: (error as Error).message,
      });

      return {
        success: false,
        message: `Failed to refresh document: ${(error as Error).message}`,
      };
    }
  }

  /**
   * Update Yjs document with new content
   */
  private updateYjsDocument(yDoc: Y.Doc, content: string): void {
    try {
      // Parse the content based on your document structure
      // This is a simple example assuming the content is JSON
      const data = JSON.parse(content);
      
      // Update the Yjs document structure
      const yMap = yDoc.getMap('document');
      
      // Clear existing content
      yMap.clear();
      
      // Set new content
      Object.entries(data).forEach(([key, value]) => {
        yMap.set(key, value);
      });
      
      logger.debug('Yjs document updated', { contentLength: content.length });
    } catch (error) {
      logger.warn('Failed to parse document content as JSON, treating as plain text', {
        error: (error as Error).message,
      });
      
      // Fallback: treat as plain text
      const yText = yDoc.getText('content');
      yText.delete(0, yText.length);
      yText.insert(0, content);
    }
  }

  /**
   * Handle document updates (for potential auto-save functionality)
   */
  private onDocumentUpdate(roomId: string, update: Uint8Array): void {
    logger.debug('Document updated', { 
      roomId, 
      updateSize: update.length 
    });
    
    // Update the version
    const currentVersion = this.documentVersions.get(roomId) || 0;
    this.documentVersions.set(roomId, currentVersion + 1);
    
    // Here you could implement auto-save logic
    // For now, we'll just log the update
  }

  /**
   * Get document as JSON string
   */
  getDocumentAsJSON(roomId: string): string {
    const yDoc = this.getDocument(roomId);
    const yMap = yDoc.getMap('document');
    
    const data: { [key: string]: any } = {};
    yMap.forEach((value, key) => {
      data[key] = value;
    });
    
    return JSON.stringify(data, null, 2);
  }

  /**
   * Get document version
   */
  getDocumentVersion(roomId: string): number {
    return this.documentVersions.get(roomId) || 0;
  }

  /**
   * Remove document from memory
   */
  removeDocument(roomId: string): void {
    const doc = this.documents.get(roomId);
    if (doc) {
      doc.destroy();
      this.documents.delete(roomId);
      this.documentVersions.delete(roomId);
      logger.info('Document removed from memory', { roomId });
    }
  }

  /**
   * Get all active document room IDs
   */
  getActiveDocuments(): string[] {
    return Array.from(this.documents.keys());
  }
}

// Export a singleton instance
export const documentService = new DocumentService();
export default documentService;