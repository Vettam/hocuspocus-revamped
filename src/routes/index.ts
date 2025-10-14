import { Router, Request, Response } from "express";

const indexRouter = Router();

/**
 * API info endpoint (root endpoint)
 * GET /
 */
indexRouter.get("/", (_req: Request, res: Response) => {
  res.json({
    name: "Vettam Hocuspocus Backend",
    description:
      "Modular TypeScript server with Hocuspocus CRDT collaboration and Express REST API",
    version: process.env.npm_package_version || "1.0.0",
    endpoints: {
      health: "/health",
      refresh: "/v1/room/:id/refresh",
    },
  });
});

export default indexRouter;
