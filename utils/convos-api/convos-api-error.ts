import { AxiosError } from "axios"
import { BaseError, BaseErrorArgs } from "@/utils/error"

/**
 * API validation error structure
 */
type IApiValidationErrors = {
  [field: string]: {
    message?: string
    [key: string]: any
  }
}

/**
 * Checks if the object matches the API validation errors structure
 */
function isApiValidationErrors(obj: unknown): obj is IApiValidationErrors {
  if (!obj || typeof obj !== "object") return false

  const entries = Object.entries(obj)
  if (entries.length === 0) return false

  return entries.some(([_, value]) => value && typeof value === "object" && "message" in value)
}

export class ConvosApiError extends BaseError {
  private origError: unknown

  constructor(args: BaseErrorArgs) {
    // Extract errors if they exist in the response
    if (args.error instanceof AxiosError && args.error.response?.data?.errors) {
      const errors = args.error.response.data.errors
      if (isApiValidationErrors(errors)) {
        args.extra = {
          ...args.extra,
          apiErrors: errors,
        }
      }
    }

    super("[CONVOS API]", args)

    // Store original error after super() call
    this.origError = args.error
  }

  /**
   * Gets the first error message from the API errors object
   */
  getErrorMessage(): string {
    // Check for API validation error messages first
    const apiErrors = this.extra?.apiErrors as IApiValidationErrors | undefined
    if (apiErrors) {
      for (const field in apiErrors) {
        if (apiErrors[field]?.message) {
          return apiErrors[field].message
        }
      }
    }

    // Get message from response data if available
    if (this.origError instanceof AxiosError && this.origError.response?.data?.message) {
      return this.origError.response.data.message
    }

    // Fallback to our message
    return this.message
  }

  /**
   * Checks if this error represents a 404 Not Found error
   */
  is404Error(): boolean {
    return this.origError instanceof AxiosError && this.origError.response?.status === 404
  }
}

export function isConvosApi404Error(error: unknown): boolean {
  if (error instanceof AxiosError) {
    return error.response?.status === 404
  }
  if (error instanceof ConvosApiError) {
    return error.is404Error()
  }
  return false
}
