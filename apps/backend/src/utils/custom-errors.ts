export class AppError extends Error {
  statusCode: number;
  errorCode: string;
  isOperational: boolean = true;
  constructor(message: string, statusCode: number, errorCode: string) {
    super(message);

    this.statusCode = statusCode;
    this.errorCode = errorCode;

    Error.captureStackTrace(this, this.constructor);
  }
}

export class NotFoundError extends AppError {
  constructor(
    message = "Resource not found",
    errorCode = "RESOURCE_NOT_FOUND",
  ) {
    super(message, 404, errorCode);
  }
}

export class InternalServerError extends AppError {
  constructor(message = "Internal Server Error") {
    super(message, 500, "SERVER_ERROR");
  }
}
