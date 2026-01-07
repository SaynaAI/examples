import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';
import {
  SaynaError,
  SaynaValidationError,
  SaynaServerError,
  SaynaConnectionError,
  SaynaNotConnectedError,
  SaynaNotReadyError,
} from '@sayna-ai/node-sdk';

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
 * Exception filter that handles all Sayna SDK errors.
 * Maps SDK-specific errors to appropriate HTTP status codes
 * and returns user-friendly error messages.
 */
@Catch(SaynaError)
export class SaynaExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(SaynaExceptionFilter.name);

  catch(exception: SaynaError, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const { status, message } = this.mapException(exception);

    // Log full error details internally
    this.logger.error(`Sayna SDK error on ${request.method} ${request.url}`, {
      errorType: exception.name,
      message: exception.message,
      status,
      stack: exception.stack,
    });

    const errorResponse: ErrorResponse = {
      statusCode: status,
      message,
      timestamp: new Date().toISOString(),
      path: request.url,
    };

    response.status(status).json(errorResponse);
  }

  /**
   * Maps a Sayna SDK error to HTTP status code and client-safe message.
   */
  private mapException(exception: SaynaError): {
    status: number;
    message: string;
  } {
    // Validation errors - client provided invalid input
    if (exception instanceof SaynaValidationError) {
      return {
        status: HttpStatus.BAD_REQUEST,
        message: exception.message,
      };
    }

    // Connection errors - WebSocket/network issues
    if (exception instanceof SaynaConnectionError) {
      this.logger.error('Connection error cause:', exception.cause);
      return {
        status: HttpStatus.SERVICE_UNAVAILABLE,
        message: 'Voice service is temporarily unavailable',
      };
    }

    // State errors - indicate bugs in our code
    if (exception instanceof SaynaNotConnectedError) {
      this.logger.error(
        'Internal state error: operation attempted before connection',
      );
      return {
        status: HttpStatus.INTERNAL_SERVER_ERROR,
        message: 'Internal server error',
      };
    }

    if (exception instanceof SaynaNotReadyError) {
      this.logger.error(
        'Internal state error: operation attempted before ready',
      );
      return {
        status: HttpStatus.INTERNAL_SERVER_ERROR,
        message: 'Internal server error',
      };
    }

    // Server errors - forward status from Sayna API
    if (exception instanceof SaynaServerError) {
      const status = exception.status ?? HttpStatus.BAD_GATEWAY;

      // Log endpoint information for debugging
      if (exception.endpoint) {
        this.logger.error(`Sayna API error on endpoint: ${exception.endpoint}`);
      }

      // Return sanitized messages based on status
      let message = 'Voice service error';
      if (status === 403) {
        message = 'Access denied to this resource';
      } else if (status === 404) {
        message = 'Resource not found';
      } else if (status === 401) {
        message = 'Authentication failed';
      } else if (status >= 500) {
        message = 'Voice service temporarily unavailable';
      }

      return { status, message };
    }

    // Unknown SaynaError subtype
    this.logger.error('Unknown Sayna error type:', exception.name);
    return {
      status: HttpStatus.INTERNAL_SERVER_ERROR,
      message: 'An unexpected error occurred',
    };
  }
}
