import * as Sentry from "@sentry/react-native"
import { useEffect } from "react"
import { useAuthenticationStore } from "@/features/authentication/authentication.store"
import { useMultiInboxStore } from "@/features/authentication/multi-inbox.store"
import {
  getCurrentUserQueryData,
  getCurrentUserQueryOptions,
} from "@/features/current-user/current-user.query"
import { getProfileQueryConfig, getProfileQueryData } from "@/features/profiles/profiles.query"
import type { IXmtpInboxId } from "@/features/xmtp/xmtp.types"
import { sentryLogger } from "@/utils/logger/logger"
import { isEqual } from "@/utils/objects"
import { createQueryObserverWithPreviousData } from "@/utils/react-query/react-query.helpers"

export function useUpdateSentryUser() {
  useEffect(() => {
    // Function to check conditions and setup tracking
    const checkAndSetupTracking = () => {
      const authStatus = useAuthenticationStore.getState().status
      const currentSender = useMultiInboxStore.getState().currentSender

      if (authStatus === "signedIn" && currentSender) {
        setupSentryIdentityTracking(currentSender.inboxId)
      } else {
        cleanupSentryIdentityTracking()
      }
    }

    // Subscribe to auth changes
    const unsubscribeAuth = useAuthenticationStore.subscribe(
      (state) => state.status,
      () => checkAndSetupTracking(),
    )

    // Subscribe to multi-inbox changes
    const unsubscribeMultiInbox = useMultiInboxStore.subscribe(
      (state) => state.currentSender,
      () => checkAndSetupTracking(),
    )

    // Initial setup
    checkAndSetupTracking()

    // Cleanup subscriptions on unmount
    return () => {
      unsubscribeAuth()
      unsubscribeMultiInbox()
      cleanupSentryIdentityTracking()
    }
  }, []) // No dependencies needed since we're using store subscriptions
}

let unsubscribeFromUserQueryObserver: (() => void) | undefined
let unsubscribeFromProfileQueryObserver: (() => void) | undefined

function setupSentryIdentityTracking(inboxId: IXmtpInboxId) {
  // Clean up any existing subscriptions
  if (unsubscribeFromUserQueryObserver) {
    unsubscribeFromUserQueryObserver()
  }
  if (unsubscribeFromProfileQueryObserver) {
    unsubscribeFromProfileQueryObserver()
  }

  // Track user changes with createQueryObserverWithPreviousData
  const { unsubscribe: newUnsubscribeFromUserQueryObserver } = createQueryObserverWithPreviousData({
    queryOptions: getCurrentUserQueryOptions({ caller: "setupSentryIdentityTracking" }),
    observerCallbackFn: (result) => {
      if (isEqual(result.data, result.previousData)) {
        return
      }

      updateSentryIdentity(inboxId)
    },
  })

  unsubscribeFromUserQueryObserver = newUnsubscribeFromUserQueryObserver

  // Track profile changes with createQueryObserverWithPreviousData
  const { unsubscribe: newUnsubscribeFromProfileQueryObserver } =
    createQueryObserverWithPreviousData({
      queryOptions: getProfileQueryConfig({
        xmtpId: inboxId,
        caller: "setupSentryIdentityTracking",
      }),
      observerCallbackFn: (result) => {
        if (isEqual(result.data, result.previousData)) {
          return
        }

        updateSentryIdentity(inboxId)
      },
    })

  unsubscribeFromProfileQueryObserver = newUnsubscribeFromProfileQueryObserver

  // Initial identity update if data is available
  updateSentryIdentity(inboxId)
}

function cleanupSentryIdentityTracking() {
  if (unsubscribeFromUserQueryObserver) {
    unsubscribeFromUserQueryObserver()
    unsubscribeFromUserQueryObserver = undefined
  }
  if (unsubscribeFromProfileQueryObserver) {
    unsubscribeFromProfileQueryObserver()
    unsubscribeFromProfileQueryObserver = undefined
  }

  // Clear Sentry user data
  Sentry.setUser(null)
}

// Function to update Sentry user identity with latest data
function updateSentryIdentity(inboxId: IXmtpInboxId) {
  const currentUser = getCurrentUserQueryData({ caller: "updateSentryIdentity" })

  if (!currentUser?.id) {
    return
  }

  const currentProfile = getProfileQueryData({
    xmtpId: inboxId,
  })

  sentryIdentifyUser({
    userId: currentUser.id,
    username: currentProfile?.username,
    name: currentProfile?.name,
  })
}

export function sentryIdentifyUser(args: { userId?: string; username?: string; name?: string }) {
  sentryLogger.debug("Identifying user", {
    userId: args.userId,
    username: args.username,
    name: args.name,
  })

  Sentry.setUser({
    id: args.userId,
    username: args.username,
    name: args.name,
  })

  Sentry.setContext("user", {
    id: args.userId,
    username: args.username,
    name: args.name,
  })
}
