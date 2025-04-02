import { isEmpty } from "@/utils/objects"

export function ensureError(error: unknown): Error {
  if (error instanceof Error) {
    return error
  }
  if (typeof error === "string") {
    return new Error(error)
  }
  // If error is neither an instance of Error nor a string, create a generic error message
  return new Error("Unknown error occurred")
}

export type BaseErrorArgs = {
  error: unknown
  additionalMessage?: string // This could be an "extra" property but since we're using it a lot we prefer to have it as a separate property
  extra?: Record<string, unknown>
}

export class BaseError extends Error {
  extra?: Record<string, unknown>

  constructor(prefix: string, args: BaseErrorArgs) {
    const { error, additionalMessage, extra } = args

    const ensuredError = ensureError(error)

    // [ErrorType]: additionalMessage. originalErrorMessage.
    let message = ""
    if (prefix) {
      message = `${prefix} `
    }
    if (additionalMessage) {
      message += `${additionalMessage}${additionalMessage.endsWith(".") ? "" : "."}`
    }
    const needsSpace = ensuredError.message.startsWith("[") || message.endsWith(".")
    const needsPeriod = !ensuredError.message.endsWith(".")
    message += `${needsSpace ? " " : ""}${ensuredError.message}${needsPeriod ? "." : ""}`

    super(message, { cause: error })

    const originalExtra = ensuredError instanceof BaseError ? ensuredError.extra : {}

    if (!isEmpty(originalExtra) || !isEmpty(extra)) {
      this.extra = {
        ...originalExtra,
        ...extra,
      }
    }
  }

  hasErrorType(errorType: Function): boolean {
    if (this instanceof errorType) {
      return true
    }

    if (this.cause instanceof BaseError) {
      return this.cause.hasErrorType(errorType)
    }

    return this.cause instanceof errorType
  }
}

export class UserCancelledError extends BaseError {
  constructor(args: BaseErrorArgs) {
    super("[User Cancelled]", args)
  }
}

export class GenericError extends BaseError {
  constructor(args: BaseErrorArgs) {
    super("", args)
  }
}

export class HydrationError extends BaseError {
  constructor(args: BaseErrorArgs) {
    super("[Hydration]", args)
  }
}

export class XMTPError extends BaseError {
  constructor(args: BaseErrorArgs) {
    super("[XMTP]", args)
  }
}

export class StreamError extends BaseError {
  constructor(args: BaseErrorArgs) {
    super("[Stream]", args)
  }
}

export class AuthenticationError extends BaseError {
  constructor(args: BaseErrorArgs) {
    super("[Authentication]", args)
  }
}

export class ReactQueryError extends BaseError {
  constructor(args: BaseErrorArgs) {
    super("[React Query]", args)
  }
}

export class FeedbackError extends BaseError {
  constructor(args: BaseErrorArgs) {
    super("", args)
  }
}

export class NotificationError extends BaseError {
  constructor(args: BaseErrorArgs) {
    super("[Notification]", args)
  }
}

export class ReactQueryPersistError extends BaseError {
  constructor(args: BaseErrorArgs) {
    super("[React Query Persist]", args)
  }
}

export class NavigationError extends BaseError {
  constructor(args: BaseErrorArgs) {
    super("[Navigation]", args)
  }
}

export class ValidationError extends BaseError {
  constructor(args: BaseErrorArgs) {
    super("[Validation]", args)
  }
}

export class StorageError extends BaseError {
  constructor(args: BaseErrorArgs) {
    super("[Storage]", args)
  }
}

export class ConnectWalletError extends BaseError {
  constructor(args: BaseErrorArgs) {
    super("[Connect Wallet]", args)
  }
}
