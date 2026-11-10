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
  constructor(message = "Authentication failed. Check HUBSPOT_ACCESS_TOKEN (`hubspot auth list` shows which source supplied it).") {
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

/** Input rejected by HubSpot (400/409) or before any request was sent (bad flag). */
export class HubspotValidationError extends HubspotError {
  public readonly hint?: string;

  constructor(message = "Request validation failed.", options: { hint?: string } = {}) {
    super(message, "VALIDATION_ERROR", 400);
    this.name = "HubspotValidationError";
    this.hint = options.hint;
  }
}

/** Missing or unusable configuration: no access token, unreadable keychain, bad env value. */
export class HubspotConfigError extends HubspotError {
  public readonly hint?: string;
  public readonly got?: string;

  constructor(message: string, options: { hint?: string; got?: string; cause?: unknown } = {}) {
    super(message, "CONFIG_ERROR");
    this.name = "HubspotConfigError";
    this.hint = options.hint;
    this.got = options.got;
    if (options.cause !== undefined) this.cause = options.cause;
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
