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
   * Save document snapshot using two-step signed URL approach
   * Step 1: Get signed upload URL from backend
   * Step 2: Upload directly to storage
   * Step 3: Commit the upload
   */
  async saveDocumentSnapshot(
    draftId: string,
    versionId: string,
    content: string,
    checksum: string,
    versionName?: string
  ): Promise<void> {
    try {
      logger.debug("Starting document snapshot save", { draftId, versionId, checksum });

      // STEP 1: Request signed upload URL
      logger.debug("Requesting signed upload URL", { draftId, versionId });
      
      const signedUrlResponse = await this.client.get<VettamAPIResponse<{
        signed_upload_url: string;
        temp_path: string;
        token: string;
        expires_in: number;
        upload_instructions: {
          method: string;
          content_type: string;
          note: string;
        };
      }>>(
        `/internal/drafts/${draftId}/${versionId}/snapshot/`,
        {
          params: { checksum },
          headers: {
            "api-key": this.getApiKey(),
          },
        }
      );

      // Handle 204 No Content - file unchanged
      if (signedUrlResponse.status === 204) {
        logger.info("Document snapshot unchanged - skipping upload", {
          draftId,
          versionId,
          checksum,
        });
        return;
      }

      if (signedUrlResponse.data.status !== "success" || !signedUrlResponse.data.data) {
        throw new Error(
          signedUrlResponse.data.error || "Failed to get signed upload URL"
        );
      }

      const { signed_upload_url, temp_path, expires_in } = signedUrlResponse.data.data;

      logger.info("Signed upload URL obtained", {
        draftId,
        versionId,
        temp_path,
        expires_in,
      });

      // STEP 2: Upload directly to storage using signed URL
      logger.debug("Uploading to storage", { temp_path });

      const uploadResponse = await axios.put(signed_upload_url, content, {
        headers: {
          "Content-Type": "application/json",
        },
        timeout: 4 * 60 * 1000, // 4 minutes (buffer before 5 min expiry)
      });

      if (uploadResponse.status < 200 || uploadResponse.status >= 300) {
        throw new Error(
          `Storage upload failed with status ${uploadResponse.status}`
        );
      }

      logger.info("File uploaded to storage", {
        draftId,
        versionId,
        temp_path,
        status: uploadResponse.status,
      });

      // STEP 3: Commit the upload
      logger.debug("Committing upload", { draftId, versionId, temp_path });

      const commitPayload: {
        temp_path: string;
        checksum: string;
        version_name?: string;
      } = {
        temp_path,
        checksum,
      };

      if (versionName) {
        commitPayload.version_name = versionName;
      }

      const commitResponse = await this.client.post<VettamAPIResponse>(
        `/internal/drafts/${draftId}/${versionId}/snapshot/`,
        commitPayload,
        {
          headers: {
            "api-key": this.getApiKey(),
            "Content-Type": "application/json",
          },
        }
      );

      if (commitResponse.data.status !== "success") {
        throw new Error(
          commitResponse.data.error || "Failed to commit document snapshot"
        );
      }

      logger.info("Document snapshot committed successfully", {
        draftId,
        versionId,
        checksum,
        temp_path,
      });
    } catch (error) {
      const axiosError = error as AxiosError;
      
      // Handle specific error cases
      if (axiosError.response?.status === 204) {
        logger.info("Document unchanged - no save needed", {
          draftId,
          versionId,
        });
        return;
      }

      if (axiosError.response?.status === 400) {
        const errorData = axiosError.response.data as VettamAPIResponse;
        logger.error("Validation error during snapshot save", {
          draftId,
          versionId,
          checksum,
          error: errorData.error,
        });
        throw new Error(`Validation failed: ${errorData.error}`);
      }

      if (axiosError.response?.status === 404) {
        logger.error("Draft version not found", {
          draftId,
          versionId,
        });
        throw new Error(`Draft version ${draftId}/${versionId} not found`);
      }

      logger.error("Failed to save document snapshot", {
        draftId,
        versionId,
        checksum,
        error: (error as Error).message,
        status: axiosError.response?.status,
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
