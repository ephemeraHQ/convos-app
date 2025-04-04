import { showSnackbar } from "@/components/snackbar/snackbar.service"
import {
  BaseError,
  ensureError,
  FeedbackError,
  GenericError,
  UserCancelledError,
} from "@/utils/error"
import { logger } from "@/utils/logger/logger"
import { sentryTrackError } from "./sentry/sentry-track-error"

export async function captureError(error: BaseError) {
  try {
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
  const { message } = options || {}

  captureError(error)

  const snackMessage = message || error?.message || "Something went wrong"

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
