export class DomainError extends Error {
  constructor(
    message: string,
    readonly code: "INVALID_TRANSITION" | "NOT_FOUND" | "FORBIDDEN" | "CONFLICT" | "VALIDATION",
    readonly statusCode: number,
  ) {
    super(message);
    this.name = "DomainError";
  }
}

export class InvalidTransitionError extends DomainError {
  constructor(from: string, to: string) {
    super(`Cannot change status from ${from} to ${to}`, "INVALID_TRANSITION", 409);
  }
}

export class NotFoundError extends DomainError {
  constructor(message = "Payment session not found") {
    super(message, "NOT_FOUND", 404);
  }
}

export class ForbiddenError extends DomainError {
  constructor(message = "You cannot access this payment session") {
    super(message, "FORBIDDEN", 403);
  }
}

export class ConflictError extends DomainError {
  constructor(message: string) {
    super(message, "CONFLICT", 409);
  }
}
