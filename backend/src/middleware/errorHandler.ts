import { Request, Response, NextFunction } from 'express';

/**
 * Central error handler — never exposes stack traces or internal details to the client.
 */
export function errorHandler(
  err: Error & { status?: number; code?: string },
  _req: Request,
  res: Response,
  _next: NextFunction,
): void {
  // Log internally
  console.error('[Error]', err.message);

  // Multer file size error
  if (err.message?.includes('File too large') || err.code === 'LIMIT_FILE_SIZE') {
    res.status(413).json({
      error: `Image is too large. Maximum allowed size is ${process.env.MAX_IMAGE_SIZE_MB || 10} MB.`,
    });
    return;
  }

  // Multer file type error
  if (err.message?.includes('File type not supported')) {
    res.status(415).json({ error: err.message });
    return;
  }

  // OpenRouter / API key missing
  if (err.message?.includes('OPENROUTER_API_KEY is not configured')) {
    res.status(503).json({
      error: 'AI service is not configured. Please contact support.',
    });
    return;
  }

  // MongoDB connection issues
  if (err.message?.includes('MongoDB')) {
    res.status(503).json({ error: 'Database temporarily unavailable. Please try again.' });
    return;
  }

  // Default: generic error (no stack trace exposed)
  const status = err.status || 500;
  res.status(status).json({
    error: status === 500
      ? 'An unexpected error occurred. Please try again in a moment.'
      : err.message,
  });
}
