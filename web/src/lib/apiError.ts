/** An error returned by the API, or a failure to reach it (status 0 with code NETWORK / TIMEOUT). */
export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
    public details?: unknown,
    public code?: string,
    public requestId?: string,
    public url?: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

/** A mistake caught in the browser before anything is sent (e.g. two passwords that do not match). */
export class UserError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'UserError';
  }
}
