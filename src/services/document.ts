import * as Y from "yjs";
import * as crypto from "crypto";
import { vettamAPI } from "./vettam-api";
import { logger } from "../config/logger";
import { AUTO_SAVE_INTERVAL } from "../config/constants";
import { RegexMatcher } from "../utils/regex_matcher";

export class DocumentService {
  private documents: Map<string, Y.Doc> = new Map();
  private saveTimers: Map<string, NodeJS.Timeout> = new Map();
  private dirtyFlags: Map<string, boolean> = new Map();

  /**
   * Extract draftId from roomId format: <uuid:draft_id>:<uuid:version_id>
   */
  private extractDraftId(roomId: string): string {
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
  private extractVersionId(roomId: string): string {
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
  private serializeDocument(yDoc: Y.Doc): string {
    const yMap = yDoc.getMap("document");
    const data: { [key: string]: any } = {};

    yMap.forEach((value, key) => {
      data[key] = value;
    });

    return JSON.stringify(data);
  }

  /**
   * Load content into Y.Doc
   */
  private loadYjsDocument(yDoc: Y.Doc, content: string): void {
    try {
      const data = JSON.parse(content);
      const yMap = yDoc.getMap("document");

      // Clear existing content
      yMap.clear();

      // Set new content
      Object.entries(data).forEach(([key, value]) => {
        yMap.set(key, value);
      });
    } catch (error) {
      // If content is not valid JSON, initialize empty document
      logger.warn(
        "Failed to parse document content, initializing empty document",
        {
          error: (error as Error).message,
        }
      );
      const yMap = yDoc.getMap("document");
      yMap.clear();
    }
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
      const content = this.serializeDocument(new Y.Doc());
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
   * Get or create a Yjs document for a room
   */
  async getDocument(roomId: string): Promise<Y.Doc> {
    // If document already exists in memory, return it
    let doc = this.documents.get(roomId);
    if (doc) {
      return doc;
    }

    // Create new document
    doc = new Y.Doc();

    try {
      // Load document content from API
      const draftId = this.extractDraftId(roomId);
      const versionId = this.extractVersionId(roomId);
      const content = await vettamAPI.loadDocumentFromDraft(draftId, versionId);

      // Load content into Y.Doc
      this.loadYjsDocument(doc, content);

      logger.info("Document loaded from API", { roomId, draftId });
    } catch (error) {
      // If loading fails, initialize empty document
      logger.warn(
        "Failed to load document from API, initializing empty document",
        {
          roomId,
          error: (error as Error).message,
        }
      );
      this.loadYjsDocument(doc, "{}");
    }

    // Store in memory
    this.documents.set(roomId, doc);
    this.dirtyFlags.set(roomId, false);

    // Set up document update listener
    doc.on("update", () => {
      this.onDocumentUpdate(roomId);
    });

    // Set up auto-save timer
    this.setupAutoSaveTimer(roomId);

    logger.info("Document initialized in memory", { roomId });

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
