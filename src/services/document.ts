import * as Y from "yjs";
import * as crypto from "crypto";
import { Hocuspocus, Document as HocuspocusDocument } from "@hocuspocus/server";
import { vettamAPI } from "./vettam-api";
import { logger } from "../config/logger";
import { RegexMatcher } from "../utils/regex_matcher";

export class DocumentService {
  private documents: Map<string, Y.Doc> = new Map();
  private dirtyFlags: Map<string, boolean> = new Map();
  private persistenceTimers: Map<string, NodeJS.Timeout> = new Map();
  private loadingPromises: Map<string, Promise<void>> = new Map();
  private readonly PERSISTENCE_DELAY_MS = 30000; // 30 seconds

  /**
   * Check if a document is already registered
   */
  isDocumentRegistered(roomId: string): boolean {
    return this.documents.has(roomId);
  }

  /**
   * Register a Hocuspocus document instance
   * This ensures we use the same YDoc instance that Hocuspocus manages
   */
  registerHocuspocusDocument(roomId: string, yDoc: Y.Doc): void {
    logger.info("Registering Hocuspocus document", { roomId });

    // Check if document was already registered
    const wasAlreadyRegistered = this.documents.has(roomId);

    if (wasAlreadyRegistered) {
      logger.info(
        "Document already registered (reconnection), skipping re-registration",
        { roomId }
      );
      // Cancel any pending persistence timer since user reconnected
      this.cancelPersistenceTimer(roomId);
      // On reconnection, the document is already set up with listeners
      // We should NOT destroy it or re-register it as that would cause issues
      // Hocuspocus manages the document lifecycle, we just track it
      return;
    }

    // First-time registration
    this.documents.set(roomId, yDoc);
    this.dirtyFlags.set(roomId, false);

    // Set up document update listener
    yDoc.on("update", () => {
      this.onDocumentUpdate(roomId);
    });

    logger.debug("Document registration complete", {
      roomId,
      wasAlreadyRegistered: false,
    });
  }

  /**
   * Load initial state from API into a YDoc
   * This is called by Hocuspocus after a document is created
   */
  async loadInitialStateFromAPI(roomId: string, yDoc: Y.Doc): Promise<void> {
    if (this.loadingPromises.has(roomId)) {
      logger.info("Document loading already in progress, waiting...", {
        roomId,
      });
      return this.loadingPromises.get(roomId);
    }

    const loadPromise = (async () => {
      try {
        const draftId = this.extractDraftId(roomId);
        const versionId = this.extractVersionId(roomId);

        logger.info("Loading initial state from API", {
          roomId,
          draftId,
          versionId,
        });

        // Fetch the binary update from the API
        const update = await vettamAPI.loadDocumentFromDraft(
          draftId,
          versionId
        );

        // Apply the loaded state to the Hocuspocus YDoc
        Y.applyUpdate(yDoc, update);

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
      } finally {
        this.loadingPromises.delete(roomId);
      }
    })();

    this.loadingPromises.set(roomId, loadPromise);
    return loadPromise;
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

      let draftId = "";
      let checksum = "";

      try {
        // Encode state as binary update
        const update = Y.encodeStateAsUpdate(yDoc);
        // Convert to Base64 string
        const content = Buffer.from(update).toString("base64");

        draftId = this.extractDraftId(roomId);
        const versionId = this.extractVersionId(roomId);
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
      } catch (error) {
        throw error;
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
   * Cancel any pending persistence timer for a room
   */
  private cancelPersistenceTimer(roomId: string): void {
    const existingTimer = this.persistenceTimers.get(roomId);
    if (existingTimer) {
      clearTimeout(existingTimer);
      this.persistenceTimers.delete(roomId);
      logger.info("Cancelled pending persistence timer (user reconnected)", {
        roomId,
      });
    }
  }

  /**
   * Schedule delayed persistence for a document
   */
  private scheduleDelayedPersistence(
    roomId: string,
    document: HocuspocusDocument,
    instance: Hocuspocus
  ): void {
    // Cancel any existing timer first
    this.cancelPersistenceTimer(roomId);

    logger.info(`Scheduling persistence in ${this.PERSISTENCE_DELAY_MS}ms`, {
      roomId,
    });

    const timer = setTimeout(async () => {
      logger.info("Executing delayed persistence", { roomId });

      try {
        const yDoc = this.documents.get(roomId);

        if (!yDoc) {
          logger.warn("[scheduleDelayedPersistence] No document found to persist after delay", { roomId });
          this.persistenceTimers.delete(roomId);
          return;
        }

        // Unregister the document to free up resources
        // removeDocument will handle saving the snapshot
        await instance.unloadDocument(document);
        await this.removeDocument(roomId);
        logger.info("Document persisted and resources cleaned up after delay", {
          roomId,
        });
      } catch (error) {
        logger.error("Failed to persist document after delay", {
          roomId,
          error: (error as Error).message,
        });
      } finally {
        this.persistenceTimers.delete(roomId);
      }
    }, this.PERSISTENCE_DELAY_MS);

    this.persistenceTimers.set(roomId, timer);
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

      logger.debug("Scheduling delayed persistence for document", {
        roomId,
      });

      // Retrieve Yjs document from our document service
      const yDoc = this.documents.get(roomId);

      if (!yDoc) {
        logger.warn("[persistAndCleanupDocument] No document found to persist", { roomId });
        return;
      }

      // Schedule delayed persistence (can be cancelled if user reconnects)
      this.scheduleDelayedPersistence(roomId, document, instance);

      return Promise.resolve();
    } catch (error) {
      logger.error("Failed to schedule persistence", {
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
    // Cancel all pending persistence timers
    for (const [roomId, timer] of this.persistenceTimers) {
      clearTimeout(timer);
      logger.info("Cancelled persistence timer during shutdown", { roomId });
    }
    this.persistenceTimers.clear();

    // Immediately persist all documents
    for (const [roomId, doc] of hocuspocusInstance.documents) {
      await this.persistAndCleanupDocumentImmediate(
        roomId,
        doc,
        hocuspocusInstance
      );
    }

    return Promise.resolve();
  }

  /**
   * Immediately persist and cleanup document (used for shutdown)
   */
  private async persistAndCleanupDocumentImmediate(
    roomId: string | undefined,
    document: HocuspocusDocument,
    instance: Hocuspocus
  ): Promise<void> {
    try {
      if (!roomId) {
        logger.warn(
          "No room id/document name available to persist on shutdown",
          { documentName: document.name }
        );
        return;
      }

      logger.debug("Immediately persisting document to storage", {
        roomId,
      });

      const yDoc = this.documents.get(roomId);

      if (!yDoc) {
        logger.warn("[persistAndCleanupDocumentImmediate] No document found to persist", { roomId });
        return;
      }

      // Unregister the document to free up resources
      await instance.unloadDocument(document);
      await this.removeDocument(roomId);
      logger.info(
        "Document unregistered and resources cleaned up immediately",
        {
          roomId,
        }
      );

      return Promise.resolve();
    } catch (error) {
      logger.error("Failed to immediately persist document", {
        roomId,
        documentName: document.name,
        error: (error as Error).message,
      });
      return Promise.reject();
    }
  }
}

// Export a singleton instance
export const documentService = new DocumentService();
export default documentService;
