import { IXmtpDecodedMessage, IXmtpInboxId } from "@features/xmtp/xmtp.types"
import { wrapXmtpCallWithDuration } from "@/features/xmtp/xmtp.helpers"
import { XMTPError } from "@/utils/error"
import { xmtpLogger } from "@/utils/logger/logger"
import { getXmtpClientByInboxId } from "../xmtp-client/xmtp-client"

export const streamAllMessages = async (args: {
  inboxId: IXmtpInboxId
  onNewMessage: (message: IXmtpDecodedMessage) => Promise<void>
}) => {
  const { inboxId, onNewMessage } = args

  const client = await getXmtpClientByInboxId({
    inboxId,
  })

  xmtpLogger.debug(`Streaming messages for ${inboxId}`)

  try {
    // Not wrapping the stream initiation itself as it's long-running
    await client.conversations.streamAllMessages(onNewMessage)
  } catch (error) {
    throw new XMTPError({
      error,
      additionalMessage: "failed to stream messages",
    })
  }
}

export const stopStreamingAllMessage = async (args: { inboxId: IXmtpInboxId }) => {
  const { inboxId } = args

  try {
    const client = await getXmtpClientByInboxId({
      inboxId,
    })

    await wrapXmtpCallWithDuration("cancelStreamAllMessages", async () => {
      await client.conversations.cancelStreamAllMessages()
      return Promise.resolve()
    })

    xmtpLogger.debug(`Stopped streaming messages for ${inboxId}`)
  } catch (error) {
    throw new XMTPError({
      error,
      additionalMessage: "failed to cancel message streaming",
    })
  }
}
