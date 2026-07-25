declare global {
  namespace Express {
    interface Request {
      validated?: {
        query?: Record<string, unknown>;
      };
    }
  }
}

export {};
