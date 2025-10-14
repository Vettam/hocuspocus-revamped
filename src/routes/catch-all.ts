import { Router, Request, Response } from "express";
import { APIErrorResponse } from "../types";

const catchAllRouter = Router();

/**
 * Catch-all route for unmatched endpoints
 * Matches all HTTP methods on all paths: *
 */
catchAllRouter.all("*", (req: Request, res: Response) => {
  const error: APIErrorResponse = {
    error: "Not Found",
    message: `Endpoint ${req.method} ${req.path} not found`,
    statusCode: 404,
    timestamp: new Date().toISOString(),
  };

  res.status(404).json(error);
});

export default catchAllRouter;
