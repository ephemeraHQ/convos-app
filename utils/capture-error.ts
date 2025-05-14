import { showSnackbar } from "@/components/snackbar/snackbar.service"
import {
  BaseError,
  ensureError,
  ExternalCancellationError,
  FeedbackError,
  GenericError,
  UserCancelledError,
} from "@/utils/error"
import { logger } from "@/utils/logger/logger"
import { sentryTrackError } from "./sentry/sentry-track-error"

export async function captureError(error: BaseError) {
  // If the error is not a BaseError, we need to wrap it in a GenericError
  if (!(error instanceof BaseError)) {
    error = new GenericError({ error })
  }

  try {
    if (error.hasErrorType(ExternalCancellationError)) {
      return
    }

    if (error.hasErrorType(FeedbackError)) {
      return
    }

    if (error.hasErrorType(UserCancelledError)) {
      return
    }

    if (error.extra) {
      logger.error(error, error.extra)
    } else {
      logger.error(error)
    }

    sentryTrackError({
      error: ensureError(error),
      extras: error.extra,
    })
  } catch (error) {
    logger.error("Failed to capture error", error)
    sentryTrackError({
      error: new GenericError({
        error,
        additionalMessage: "Failed to capture error",
      }),
    })
  }
}

export function captureErrorWithToast(
  error: BaseError,
  options?: {
    message?: string
  },
) {
  captureError(error)

  const snackMessage = options?.message || error?.message || "Something went wrong"

  showSnackbar({
    message: snackMessage,
    type: "error",
  })
}

export function captureErrorWithFriendlyToast(error: BaseError) {
  captureErrorWithToast(error, {
    message: "Something went wrong",
  })
}
