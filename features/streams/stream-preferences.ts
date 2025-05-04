import { subscribeToAllAllowedConsentConversationsNotifications } from "@/features/notifications/notifications-conversations-subscriptions"
import {
  startStreamingXmtpPreferences,
  stopStreamingXmtpPreferences,
} from "@/features/xmtp/xmtp-preferences/xmtp-preferences-stream"
import { IXmtpInboxId } from "@/features/xmtp/xmtp.types"
import { captureError } from "@/utils/capture-error"
import { streamLogger } from "@/utils/logger/logger"

export async function startStreamingPreferences(args: { clientInboxId: IXmtpInboxId }) {
  const { clientInboxId } = args

  await startStreamingXmtpPreferences({
    clientInboxId,
    onPreferenceUpdated: (preferences) => {
      streamLogger.debug("Preferences updated", preferences)
      subscribeToAllAllowedConsentConversationsNotifications({
        clientInboxId,
      }).catch(captureError)
    },
  })
}

export async function stopStreamingPreferences(args: { clientInboxId: IXmtpInboxId }) {
  const { clientInboxId } = args

  await stopStreamingXmtpPreferences({ clientInboxId })
}
