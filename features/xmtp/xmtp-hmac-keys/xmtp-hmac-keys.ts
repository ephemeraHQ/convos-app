import { IXmtpConversationTopic, IXmtpInboxId } from "@features/xmtp/xmtp.types"
import { getHmacKeys } from "@xmtp/react-native-sdk"
import { IHmacKey } from "@/features/notifications/notifications.api"
import { ensureXmtpInstallationQueryData } from "@/features/xmtp/xmtp-installations/xmtp-installation.query"
import { wrapXmtpCallWithDuration } from "@/features/xmtp/xmtp.helpers"
import { XMTPError } from "@/utils/error"
import { logger } from "@/utils/logger/logger"

/**
 * Gets HMAC keys for a specific conversation
 * Used for push notifications
 */
export async function getXmtpHmacKeysForConversation(args: {
  clientInboxId: IXmtpInboxId
  conversationTopic: IXmtpConversationTopic
}) {
  const { clientInboxId, conversationTopic } = args

  try {
    const installationId = await ensureXmtpInstallationQueryData({
      inboxId: clientInboxId,
    })

    const response = await wrapXmtpCallWithDuration("getHmacKeys", () =>
      getHmacKeys(installationId),
    )
    return response.hmacKeys[
      conversationTopic
    ] as (typeof response.hmacKeys)[IXmtpConversationTopic]
  } catch (error) {
    throw new XMTPError({
      error,
      additionalMessage: `Failed to get HMAC keys for conversation: ${conversationTopic}`,
    })
  }
}

/**
 * Gets HMAC keys for the welcome topic (for new conversations)
 */
export async function getXmtpWelcomeTopicHmacKeys(args: { clientInboxId: IXmtpInboxId }): Promise<{
  topic: string
  hmacKeys: IHmacKey[]
}> {
  const { clientInboxId } = args

  try {
    // First get the client installation ID
    const installationId = await ensureXmtpInstallationQueryData({
      inboxId: clientInboxId,
    })

    logger.debug("[getXmtpWelcomeTopicHmacKeys] Getting HMAC keys", { clientInboxId })

    // Get all HMAC keys
    const hmacKeysResponse = await wrapXmtpCallWithDuration("getHmacKeys (welcome)", () =>
      getHmacKeys(installationId),
    )

    // Get the welcome topic
    // Format is typically: /xmtp/mls/1/w-${installationId}/proto
    const welcomeTopic = `/xmtp/mls/1/w-${installationId}/proto`

    // Extract the keys for the welcome topic
    const topicHmacKeys = hmacKeysResponse.hmacKeys[welcomeTopic]

    logger.debug("[getXmtpWelcomeTopicHmacKeys] Converting HMAC keys", {
      welcomeTopic,
      hasKeys: !!topicHmacKeys,
      keyCount: topicHmacKeys?.values?.length ?? 0,
    })

    // Convert HMAC keys to the format expected by the backend
    const hmacKeysArray: IHmacKey[] = []

    if (topicHmacKeys && Array.isArray(topicHmacKeys.values)) {
      topicHmacKeys.values.forEach((key) => {
        hmacKeysArray.push({
          thirtyDayPeriodsSinceEpoch: key.thirtyDayPeriodsSinceEpoch,
          // Convert Uint8Array to string
          key: Buffer.from(key.hmacKey).toString("hex"),
        })
      })
    }

    return {
      topic: welcomeTopic,
      hmacKeys: hmacKeysArray,
    }
  } catch (error) {
    throw new XMTPError({
      error,
      additionalMessage: `Failed to get HMAC keys for welcome topic`,
    })
  }
}
