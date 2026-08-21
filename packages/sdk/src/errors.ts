export class HubspotError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly statusCode?: number
  ) {
    super(message);
    this.name = "HubspotError";
  }
}

export class HubspotAuthError extends HubspotError {
  constructor(message = "Authentication failed. Check HUBSPOT_ACCESS_TOKEN.") {
    super(message, "AUTH_ERROR", 401);
    this.name = "HubspotAuthError";
  }
}

export class HubspotNotFoundError extends HubspotError {
  constructor(message = "Resource not found.") {
    super(message, "NOT_FOUND", 404);
    this.name = "HubspotNotFoundError";
  }
}

export class HubspotValidationError extends HubspotError {
  constructor(message = "Request validation failed.") {
    super(message, "VALIDATION_ERROR", 400);
    this.name = "HubspotValidationError";
  }
}

export class HubspotRateLimitError extends HubspotError {
  constructor(
    message = "Rate limit exceeded. Retry after the indicated delay.",
    public readonly retryAfter?: number
  ) {
    super(message, "RATE_LIMITED", 429);
    this.name = "HubspotRateLimitError";
  }
}
