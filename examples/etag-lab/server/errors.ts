import type { NextFunction, Request, Response } from 'express';

type AsyncHandler = (request: Request, response: Response) => Promise<void>;

export const handleAsync = (handler: AsyncHandler) => (request: Request, response: Response, next: NextFunction): void => {
  handler(request, response).catch(next);
};

export const answerErrors = (error: Error, request: Request, response: Response, _next: NextFunction): void => {
  console.error(`[etag-lab] ${request.method} ${request.originalUrl} failed`, error);
  response.status(500).json({ error: error.message });
};
