import { Router, Request, Response } from "express";

const healthRouter = Router();

/**
 * Health check endpoint
 * GET /health
 */
healthRouter.get("/", (_req: Request, res: Response) => {
  res.json({
    status: "healthy",
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    version: process.env.npm_package_version || "1.0.0",
  });
});

export default healthRouter;
