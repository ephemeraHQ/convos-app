import { IXmtpConversationWithCodecs, IXmtpInboxId } from "@features/xmtp/xmtp.types"
import { wrapXmtpCallWithDuration } from "@/features/xmtp/xmtp.helpers"
import { XMTPError } from "@/utils/error"
import { getXmtpClientByInboxId } from "../xmtp-client/xmtp-client"

export async function streamConversations(args: {
  inboxId: IXmtpInboxId
  onNewConversation: (conversation: IXmtpConversationWithCodecs) => Promise<void>
}) {
  const { inboxId, onNewConversation } = args

  try {
    const client = await getXmtpClientByInboxId({
      inboxId,
    })

    await wrapXmtpCallWithDuration("streamConversations", async () => {
      await client.conversations.stream(onNewConversation)
      return Promise.resolve()
    })
  } catch (error) {
    throw new XMTPError({
      error,
      additionalMessage: "failed to stream conversations",
    })
  }
}

export async function stopStreamingConversations(args: { inboxId: IXmtpInboxId }) {
  const { inboxId } = args

  try {
    const client = await getXmtpClientByInboxId({
      inboxId,
    })

    await wrapXmtpCallWithDuration("cancelConversationStream", async () => {
      await client.conversations.cancelStream()
      return Promise.resolve()
    })
  } catch (error) {
    throw new XMTPError({
      error,
      additionalMessage: "failed to cancel conversation streaming",
    })
  }
}
