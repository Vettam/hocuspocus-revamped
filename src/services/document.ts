import * as Y from "yjs";
import * as crypto from "crypto";
import { Hocuspocus, Document as HocuspocusDocument } from "@hocuspocus/server";
import { vettamAPI } from "./vettam-api";
import { logger } from "../config/logger";
import { RegexMatcher } from "../utils/regex_matcher";
import { yDocToJSON } from "../utils/ydoc/converters";
import { schema } from "../utils/ydoc/schema";

export class DocumentService {
  private documents: Map<string, Y.Doc> = new Map();
  private dirtyFlags: Map<string, boolean> = new Map();

  /**
   * Register a Hocuspocus document instance
   * This ensures we use the same YDoc instance that Hocuspocus manages
   */
  registerHocuspocusDocument(roomId: string, yDoc: Y.Doc): void {
    logger.info("Registering Hocuspocus document", { roomId });
    
    // Check if document was already registered
    const wasAlreadyRegistered = this.documents.has(roomId);
    
    if (wasAlreadyRegistered) {
      logger.warn("Document already registered, clearing old listeners", { roomId });
      // Get the old document and remove all update listeners
      const oldDoc = this.documents.get(roomId);
      if (oldDoc) {
        // Remove all listeners by replacing the document
        oldDoc.destroy();
      }
    }
    
    this.documents.set(roomId, yDoc);
    this.dirtyFlags.set(roomId, false);

    // Set up document update listener
    yDoc.on("update", () => {
      this.onDocumentUpdate(roomId);
    });
    
    logger.debug("Document registration complete", { 
      roomId, 
      wasAlreadyRegistered 
    });
  }

  /**
   * Load initial state from API into a YDoc
   * This is called by Hocuspocus after a document is created
   */
  async loadInitialStateFromAPI(roomId: string, yDoc: Y.Doc): Promise<void> {
    try {
      const draftId = this.extractDraftId(roomId);
      const versionId = this.extractVersionId(roomId);

      logger.info("Loading initial state from API", {
        roomId,
        draftId,
        versionId,
      });

      // Fetch the YDoc from the API
      const loadedYDoc = await vettamAPI.loadDocumentFromDraft(
        draftId,
        versionId
      );

      // Apply the loaded state to the Hocuspocus YDoc
      const stateVector = Y.encodeStateAsUpdate(loadedYDoc);
      Y.applyUpdate(yDoc, stateVector);

      logger.info("Initial state loaded successfully", { roomId });
    } catch (error) {
      logger.warn(
        "Failed to load initial state from API, starting with empty document",
        {
          roomId,
          error: (error as Error).message,
        }
      );
      // If loading fails, the document remains empty (which is fine)
    }
  }

  applyUpdate(roomId: string, update: Uint8Array): void {
    logger.debug("Applying update to room:", { roomId });
    let yDoc = this.documents.get(roomId);
    if (!yDoc) {
      yDoc = new Y.Doc();
      this.documents.set(roomId, yDoc);
    }
    Y.applyUpdate(yDoc, update);
    this.onDocumentUpdate(roomId);
  }

  /**
   * Extract draftId from roomId format: <uuid:draft_id>:<uuid:version_id>
   */
  extractDraftId(roomId: string): string {
    const uuidRegex = RegexMatcher.uuidRegex;
    const match = roomId.match(new RegExp(`^(${uuidRegex}):(${uuidRegex})$`));
    if (!match) {
      throw new Error(
        `Invalid room ID format. Expected '<uuid:draft_id>:<uuid:version_id>', got: ${roomId}`
      );
    }
    return match[1];
  }

  /**
   * Extract draftId from roomId format: <uuid:draft_id>:<uuid:version_id>
   */
  extractVersionId(roomId: string): string {
    const uuidRegex = RegexMatcher.uuidRegex;
    const match = roomId.match(new RegExp(`^(${uuidRegex}):(${uuidRegex})$`));
    if (!match) {
      throw new Error(
        `Invalid room ID format. Expected '<uuid:draft_id>:<uuid:version_id>', got: ${roomId}`
      );
    }
    return match[2];
  }

  /**
   * Calculate SHA256 checksum of content
   */
  private calculateChecksum(content: string): string {
    return crypto.createHash("sha256").update(content, "utf8").digest("hex");
  }

  /**
   * Serialize Y.Doc to JSON string
   */
  serializeDocument(yDoc: Y.Doc): string {
    const yMap = yDoc.getXmlElement("default");
    const data: { [key: string]: any } = {};

    yMap.forEach((value, key) => {
      data[key] = value;
    });

    return JSON.stringify(data);
  }

  /**
   * Save document snapshot
   */
  async saveSnapshot(roomId: string): Promise<void> {
    try {
      const yDoc = this.documents.get(roomId);
      if (!yDoc) {
        logger.warn("Attempted to save non-existent document", { roomId });
        return;
      }

      // A temp copy of yDoc is made to delete all non-persistent 
      // data before saving, like metadata and garbage collection info.
      // This ensures only the actual document content is saved.
      const tempYDoc = new Y.Doc();
      let draftId = "";
      let checksum = "";
      
      try {
        const stateVector = Y.encodeStateAsUpdate(yDoc);
        Y.applyUpdate(tempYDoc, stateVector);

        draftId = this.extractDraftId(roomId);
        const versionId = this.extractVersionId(roomId);
        const content = yDocToJSON(tempYDoc, schema, "default");
        checksum = this.calculateChecksum(content);

        await vettamAPI.saveDocumentSnapshot(
          draftId,
          versionId,
          content,
          checksum
        );

        // Reset dirty flag on successful save
        this.dirtyFlags.set(roomId, false);
        
        logger.info("Document snapshot saved", { roomId, draftId, checksum });
      } finally {
        // Always destroy temp doc to prevent memory leak
        tempYDoc.destroy();
      }
    } catch (error) {
      logger.error("Failed to save document snapshot", {
        roomId,
        error: (error as Error).message,
      });
    }
  }

  /**
   * Handle document updates - mark as dirty
   */
  private onDocumentUpdate(roomId: string): void {
    this.dirtyFlags.set(roomId, true);
  }

  /**
   * Get a Yjs document for a room
   * Note: Documents should be registered via registerHocuspocusDocument first
   * This method is used by the REST API endpoints
   */
  getDocument(roomId: string): Y.Doc {
    const doc = this.documents.get(roomId);
    if (!doc) {
      throw new Error(
        `Document not found for room: ${roomId}. Document must be loaded via WebSocket connection first.`
      );
    }

    return doc;
  }

  /**
   * Remove document from memory
   */
  async removeDocument(roomId: string): Promise<void> {
    // Save snapshot before removing
    await this.saveSnapshot(roomId);

    // Destroy and remove document
    const doc = this.documents.get(roomId);
    if (doc) {
      doc.destroy();
      this.documents.delete(roomId);
    }

    // Clean up all tracking data
    this.dirtyFlags.delete(roomId);

    logger.info("Document removed from memory", { roomId });
  }

  /**
   * Persist document and cleanup resources
   * Used in Hocuspocus lifecycle hooks (onDisconnect, etc.)
   */
  async persistAndCleanupDocument(
    roomId: string | undefined,
    document: HocuspocusDocument,
    instance: Hocuspocus
  ): Promise<void> {
    try {
      if (!roomId) {
        logger.warn(
          "No room id/document name available to persist on disconnect",
          { documentName: document.name }
        );
        return;
      }

      logger.debug("Persisting document to storage", {
        roomId,
      });

      // Retrieve Yjs document from our document service
      const yDoc = this.documents.get(roomId);

      if (!yDoc) {
        logger.warn("No document found to persist", { roomId });
        return;
      }

      // Unregister the document to free up resources
      // removeDocument will handle saving the snapshot
      await instance.unloadDocument(document);
      await this.removeDocument(roomId);
      logger.info("Document unregistered and resources cleaned up", {
        roomId,
      });

      return Promise.resolve();
    } catch (error) {
      logger.error("Failed to persist document", {
        roomId,
        documentName: document.name,
        error: (error as Error).message,
      });
      return Promise.reject();
    }
  }

  /**
   * Get all active document room IDs
   */
  getActiveDocuments(): string[] {
    return Array.from(this.documents.keys());
  }

  /**
   * Force cleanup of all documents (for shutdown)
   */
  async shutdown(hocuspocusInstance: Hocuspocus): Promise<void> {
    for (const [roomId, doc] of hocuspocusInstance.documents) {
      await this.persistAndCleanupDocument(roomId, doc, hocuspocusInstance);
    }

    return Promise.resolve();
  }
}

// Export a singleton instance
export const documentService = new DocumentService();
export default documentService;
