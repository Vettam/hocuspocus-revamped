import * as Y from "yjs";
import * as crypto from "crypto";
import { vettamAPI } from "./vettam-api";
import { logger } from "../config/logger";
import { AUTO_SAVE_INTERVAL } from "../config/constants";
import { RegexMatcher } from "../utils/regex_matcher";
import { yDocToJSON } from "../utils/ydoc/converters";
import { schema } from "../utils/ydoc/schema";

export class DocumentService {
  private documents: Map<string, Y.Doc> = new Map();
  private saveTimers: Map<string, NodeJS.Timeout> = new Map();
  private dirtyFlags: Map<string, boolean> = new Map();

  /**
   * Register a Hocuspocus document instance
   * This ensures we use the same YDoc instance that Hocuspocus manages
   */
  registerHocuspocusDocument(roomId: string, yDoc: Y.Doc): void {
    logger.info("Registering Hocuspocus document", { roomId });
    this.documents.set(roomId, yDoc);
    this.dirtyFlags.set(roomId, false);

    // Set up document update listener
    yDoc.on("update", () => {
      this.onDocumentUpdate(roomId);
    });

    // Set up auto-save timer
    this.setupAutoSaveTimer(roomId);
  }

  /**
   * Load initial state from API into a YDoc
   * This is called by Hocuspocus after a document is created
   */
  async loadInitialStateFromAPI(roomId: string, yDoc: Y.Doc): Promise<void> {
    try {
      const draftId = this.extractDraftId(roomId);
      const versionId = this.extractVersionId(roomId);
      
      logger.info("Loading initial state from API", { roomId, draftId, versionId });
      
      // Fetch the YDoc from the API
      const loadedYDoc = await vettamAPI.loadDocumentFromDraft(draftId, versionId);
      
      // Apply the loaded state to the Hocuspocus YDoc
      const stateVector = Y.encodeStateAsUpdate(loadedYDoc);
      Y.applyUpdate(yDoc, stateVector);
      
      logger.info("Initial state loaded successfully", { roomId });
    } catch (error) {
      logger.warn("Failed to load initial state from API, starting with empty document", {
        roomId,
        error: (error as Error).message,
      });
      // If loading fails, the document remains empty (which is fine)
    }
  }

  applyUpdate(roomId: string, update: Uint8Array): void {
    console.log("Applying update to room:", roomId);
    let yDoc = this.documents.get(roomId);
    if (!yDoc) {
      yDoc = new Y.Doc();
      this.documents.set(roomId, yDoc);
    }
    Y.applyUpdate(yDoc, update);
    this.onDocumentUpdate(roomId);
    this.setupAutoSaveTimer(roomId);
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
    const yMap = yDoc.getXmlElement("default")
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

      const draftId = this.extractDraftId(roomId);
      const versionId = this.extractVersionId(roomId);
      const content = yDocToJSON(yDoc, schema, "default")
      const checksum = this.calculateChecksum(content);

      await vettamAPI.saveDocumentSnapshot(
        draftId,
        versionId,
        content,
        checksum
      );

      // Reset dirty flag
      this.dirtyFlags.set(roomId, false);

      logger.info("Document snapshot saved", { roomId, draftId, checksum });
    } catch (error) {
      logger.error("Failed to save document snapshot", {
        roomId,
        error: (error as Error).message,
      });
    }
  }

  /**
   * Set up auto-save timer for a room
   */
  private setupAutoSaveTimer(roomId: string): void {
    // Clear existing timer if any
    const existingTimer = this.saveTimers.get(roomId);
    if (existingTimer) {
      clearInterval(existingTimer);
    }

    // Set up new timer
    const timer = setInterval(() => {
      this.saveSnapshot(roomId);
    }, AUTO_SAVE_INTERVAL);

    this.saveTimers.set(roomId, timer);
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

    // Clear timer
    const timer = this.saveTimers.get(roomId);
    if (timer) {
      clearInterval(timer);
      this.saveTimers.delete(roomId);
    }

    // Destroy and remove document
    const doc = this.documents.get(roomId);
    if (doc) {
      doc.destroy();
      this.documents.delete(roomId);
    }

    // Clean up flags
    this.dirtyFlags.delete(roomId);

    logger.info("Document removed from memory", { roomId });
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