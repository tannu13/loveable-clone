declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string;
      };
      validated?: {
        query?: Record<string, unknown>;
      };
    }
  }
}

export {};
