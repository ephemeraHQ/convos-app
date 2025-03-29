import { ConsentState, syncAllConversations, syncConversation } from "@xmtp/react-native-sdk"
import { ensureXmtpInstallationQueryData } from "@/features/xmtp/xmtp-installations/xmtp-installation.query"
import { wrapXmtpCallWithDuration } from "@/features/xmtp/xmtp.helpers"
import { IXmtpConversationId, IXmtpInboxId } from "@/features/xmtp/xmtp.types"
import { XMTPError } from "@/utils/error"
import { getXmtpClientByInboxId } from "../xmtp-client/xmtp-client"

export async function syncOneXmtpConversation(args: {
  clientInboxId: IXmtpInboxId
  conversationId: IXmtpConversationId
}) {
  const { clientInboxId, conversationId } = args

  const client = await getXmtpClientByInboxId({
    inboxId: clientInboxId,
  })

  try {
    await wrapXmtpCallWithDuration("syncConversation", () =>
      syncConversation(client.installationId, conversationId),
    )
  } catch (error) {
    throw new XMTPError({
      error,
      additionalMessage: `Error syncing conversation ${conversationId}`,
    })
  }
}

export async function syncAllXmtpConversations(args: {
  clientInboxId: IXmtpInboxId
  consentStates?: ConsentState[]
}) {
  const { clientInboxId, consentStates = ["allowed", "unknown", "denied"] } = args

  try {
    const installationId = await ensureXmtpInstallationQueryData({
      inboxId: clientInboxId,
    })

    await wrapXmtpCallWithDuration("syncAllConversations", () =>
      syncAllConversations(installationId, consentStates),
    )
  } catch (error) {
    throw new XMTPError({
      error,
      additionalMessage: `Failed to sync conversations for inbox: ${clientInboxId}`,
    })
  }
}
