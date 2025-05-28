import { IXmtpDecodedMessage, IXmtpInboxId } from "@features/xmtp/xmtp.types"
import { isSupportedXmtpMessage } from "@/features/xmtp/xmtp-messages/xmtp-messages-supported"
import { wrapXmtpCallWithDuration } from "@/features/xmtp/xmtp.helpers"
import { XMTPError } from "@/utils/error"
import { getEnv } from "@/utils/getEnv"
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

  try {
    // Not wrapping the stream initiation itself as it's long-running
    await wrapXmtpCallWithDuration("streamAllMessages", async () => {
      return client.conversations.streamAllMessages((newMessage) => {
        if (!isSupportedXmtpMessage(newMessage)) {
          xmtpLogger.debug(`Skipping message streamed because it's not supported`)
          return Promise.resolve()
        }

        if (getEnv() === "production") {
          xmtpLogger.debug(`Received new message from messages stream: ${newMessage.id}`)
        } else {
          xmtpLogger.debug(`Received new message from messages stream`, newMessage)
        }
        return onNewMessage(newMessage)
      })
    })
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
  } catch (error) {
    throw new XMTPError({
      error,
      additionalMessage: "failed to cancel message streaming",
    })
  }
}
