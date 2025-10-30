import { Hocuspocus } from "@hocuspocus/server";
import { logger } from "../config/logger";

/**
 * Singleton service to hold the Hocuspocus instance
 * This allows routes and other services to access the Hocuspocus instance
 */
class HocuspocusInstanceService {
  private instance: Hocuspocus | null = null;

  /**
   * Set the Hocuspocus instance
   */
  setInstance(hocuspocus: Hocuspocus): void {
    if (this.instance) {
      logger.warn("Hocuspocus instance already set, overwriting");
    }
    this.instance = hocuspocus;
    logger.info("Hocuspocus instance set in service");
  }

  /**
   * Get the Hocuspocus instance
   */
  getInstance(): Hocuspocus {
    if (!this.instance) {
      throw new Error("Hocuspocus instance not initialized. Call setInstance() first.");
    }
    return this.instance;
  }

  /**
   * Check if instance is set
   */
  isInitialized(): boolean {
    return this.instance !== null;
  }
}

// Export singleton instance
export const hocuspocusInstance = new HocuspocusInstanceService();
export default hocuspocusInstance;
