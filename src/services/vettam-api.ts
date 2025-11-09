import axios, { AxiosInstance, AxiosError } from "axios";
import {
  VettamAPIResponse,
  AuthorizationRequest,
  RoomAccessAuthorizationResponse,
  DocumentLoadRequest,
  SignedURLResponse,
} from "../types";
import { serverConfig } from "../config";
import { logger } from "../config/logger";
import FormData from "form-data";
import { createHash } from "node:crypto";
import * as Y from "yjs";
import { jsonToYDoc } from "../utils/ydoc/converters";
import { schema } from "../utils/ydoc/schema";

export class VettamAPIService {
  private client: AxiosInstance;

  constructor() {
    this.client = axios.create({
      baseURL: serverConfig.vettam.apiUrl,
      timeout: serverConfig.vettam.timeout,
      headers: {
        "Content-Type": "application/json",
      },
    });

    // Response interceptor for error handling
    this.client.interceptors.response.use(
      (response) => response,
      (error: AxiosError) => {
        logger.error("Vettam API Error", {
          status: error.response?.status,
          statusText: error.response?.statusText,
          data: error.response?.data,
          url: error.config?.url,
        });
        return Promise.reject(error);
      }
    );
  }

  private getApiKey(): string {
    const now = new Date();
    const year = now.getUTCFullYear();
    const month = now.getUTCMonth() + 1;
    const day = now.getUTCDate();
    const date = `${year}-${month.toString().padStart(2, "0")}-${day
      .toString()
      .padStart(2, "0")}`;

    return createHash("sha256")
      .update(`${date}${serverConfig.vettam.apiKey}`, "utf8")
      .digest("hex");
  }

  /**
   * Check if a user is authorized to access a room
   */
  async authorizeUser(
    request: AuthorizationRequest
  ): Promise<RoomAccessAuthorizationResponse> {
    try {
      logger.debug("Authorizing user for room", { userId: request.userId });

      const response = await this.client.post<
        VettamAPIResponse<RoomAccessAuthorizationResponse>
      >(
        `/internal/drafts/${request.draftId}/${request.versionId}/check-access/`,
        { user_id: request.userId },
        {
          headers: {
            "api-key": this.getApiKey(),
          },
        }
      );

      if (response.data.status != "success" || !response.data.data) {
        throw new Error(response.data.error || "Authorization failed");
      }

      logger.info("User authorization successful", response.data.data);

      return response.data.data;
    } catch (error) {
      logger.error("Failed to authorize user", {
        request,
        error: (error as Error).message,
      });
      throw new Error(`Authorization failed: ${(error as Error).message}`);
    }
  }

  /**
   * Get a signed URL to load a document
   */
  async getDocumentLoadURL(
    request: DocumentLoadRequest
  ): Promise<SignedURLResponse> {
    try {
      logger.debug("Getting document load URL", request);

      const response = await this.client.post<
        VettamAPIResponse<SignedURLResponse>
      >("/internal/drafts/${draft_id}/${version_id}/load/", request, {
        headers: {
          "api-key": this.getApiKey(),
        },
      });

      if (response.data.status != "success" || !response.data.data) {
        throw new Error(
          response.data.error || "Failed to get document load URL"
        );
      }

      return response.data.data;
    } catch (error) {
      logger.error("Failed to get document load URL", {
        request,
        error: (error as Error).message,
      });
      throw new Error(
        `Failed to get document load URL: ${(error as Error).message}`
      );
    }
  }

  /**
   * Load document content for a draft
   */
  async loadDocumentFromDraft(
    draftId: string,
    versionId: string
  ): Promise<Y.Doc> {
    try {
      logger.debug("Loading document from draft", { draftId });

      const response = await this.client.post<
        VettamAPIResponse<{ url: string }>
      >(`/internal/drafts/${draftId}/${versionId}/load/`, null, {
        headers: {
          "api-key": this.getApiKey(),
        },
      });

      if (response.data.status != "success" || !response.data.data) {
        throw new Error(
          response.data.error || "Failed to get document load URL"
        );
      }

      // Fetch the document content from the signed URL
      const contentResponse = await axios.get(response.data.data.url);
      const content = contentResponse.data;

      logger.info("Document loaded from draft", {
        draftId,
        contentLength: content.length,
      });

      var doc = new Y.Doc();
      jsonToYDoc(content, doc, schema);

      return doc;
    } catch (error) {
      logger.error("Failed to load document from draft", {
        draftId,
        error: (error as Error).message,
      });
      throw new Error(
        `Failed to load document from draft: ${(error as Error).message}`
      );
    }
  }

  /**
   * Save document snapshot with multipart/form-data
   */
  async saveDocumentSnapshot(
    draftId: string,
    versionId: string,
    content: string,
    checksum: string
  ): Promise<void> {
    try {
      logger.debug("Saving document snapshot", { draftId, checksum });

      const formData = new FormData();

      // Create JSON blob with proper filename
      const contentBuffer = Buffer.from(content, "utf-8");
      formData.append("file", contentBuffer, {
        filename: "snapshot.json",
        contentType: "application/json",
      });
      formData.append("checksum", checksum);

      const response = await this.client.post<VettamAPIResponse>(
        `/internal/drafts/${draftId}/${versionId}/snapshot/`,
        formData,
        {
          headers: {
            "api-key": this.getApiKey(),
            ...formData.getHeaders(),
          },
        }
      );

      if (response.data.status != "success") {
        throw new Error(
          response.data.error || "Failed to save document snapshot"
        );
      }

      logger.info("Document snapshot saved", {
        draftId,
        checksum,
      });
    } catch (error) {
      logger.error("Failed to save document snapshot", {
        draftId,
        checksum,
        error: (error as Error).message,
      });
      throw new Error(
        `Failed to save document snapshot: ${(error as Error).message}`
      );
    }
  }

  /**
   * Health check for the Vettam API
   */
  async healthCheck(): Promise<boolean> {
    try {
      const response = await this.client.get("/v1/health/");
      return response.status === 200;
    } catch (error) {
      logger.warn("Vettam API health check failed", {
        error: (error as Error).message,
      });
      return false;
    }
  }
}

// Export a singleton instance
export const vettamAPI = new VettamAPIService();
export default vettamAPI;
