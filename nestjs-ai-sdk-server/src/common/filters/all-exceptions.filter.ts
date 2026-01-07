import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';

/**
 * Error response structure returned to clients.
 */
interface ErrorResponse {
  statusCode: number;
  message: string;
  timestamp: string;
  path: string;
}

/**
 * Catch-all exception filter for unhandled exceptions.
 * Ensures all errors return a consistent response format
 * and prevents sensitive information from leaking to clients.
 */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    let status: number = HttpStatus.INTERNAL_SERVER_ERROR;
    let message = 'Internal server error';

    // Handle NestJS HttpExceptions (including BadRequest, NotFound, etc.)
    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const exceptionResponse = exception.getResponse();

      if (typeof exceptionResponse === 'string') {
        message = exceptionResponse;
      } else if (
        typeof exceptionResponse === 'object' &&
        exceptionResponse !== null
      ) {
        const responseObj = exceptionResponse as Record<string, unknown>;
        if (typeof responseObj.message === 'string') {
          message = responseObj.message;
        } else if (Array.isArray(responseObj.message)) {
          // Validation errors return an array of messages
          message = responseObj.message.join(', ');
        }
      }
    }

    // Log full error details internally (but not for client errors)
    if (status >= 500) {
      this.logger.error(
        `Unhandled exception on ${request.method} ${request.url}`,
        {
          status,
          exception:
            exception instanceof Error
              ? {
                  name: exception.name,
                  message: exception.message,
                  stack: exception.stack,
                }
              : String(exception),
        },
      );
    } else {
      this.logger.warn(
        `Client error on ${request.method} ${request.url}: ${status} - ${message}`,
      );
    }

    const errorResponse: ErrorResponse = {
      statusCode: status,
      message,
      timestamp: new Date().toISOString(),
      path: request.url,
    };

    response.status(status).json(errorResponse);
  }
}
