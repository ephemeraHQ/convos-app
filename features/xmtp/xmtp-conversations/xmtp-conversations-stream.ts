import { IXmtpConversationWithCodecs, IXmtpInboxId } from "@features/xmtp/xmtp.types"
import { wrapXmtpCallWithDuration } from "@/features/xmtp/xmtp.helpers"
import { getXmtpClientByInboxId } from "../xmtp-client/xmtp-client"

export async function streamConversations(args: {
  inboxId: IXmtpInboxId
  onNewConversation: (conversation: IXmtpConversationWithCodecs) => Promise<void>
}) {
  const { inboxId, onNewConversation } = args

  const client = await getXmtpClientByInboxId({
    inboxId,
  })

  await client.conversations.stream(onNewConversation)
}

export async function stopStreamingConversations(args: { inboxId: IXmtpInboxId }) {
  const { inboxId } = args

  const client = await getXmtpClientByInboxId({
    inboxId,
  })

  await wrapXmtpCallWithDuration("cancelConversationStream", async () => {
    await client.conversations.cancelStream()
    return Promise.resolve()
  })
}
