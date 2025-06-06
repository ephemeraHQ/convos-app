import { queryOptions, skipToken, useQuery } from "@tanstack/react-query"
import {
  getStoredRemoteAttachment,
  storeRemoteAttachment,
} from "@/features/conversation/conversation-chat/conversation-attachment/conversation-attachment.storage"
import { downloadRemoteAttachment } from "@/features/conversation/conversation-chat/conversation-attachment/download-remote-attachment"
import { refetchConversationMessageQuery } from "@/features/conversation/conversation-chat/conversation-message/conversation-message.query"
import { IConversationMessageRemoteAttachmentContent } from "@/features/conversation/conversation-chat/conversation-message/conversation-message.types"
import { decryptXmtpAttachment } from "@/features/xmtp/xmtp-codecs/xmtp-codecs-attachments"
import { IXmtpConversationId, IXmtpInboxId, IXmtpMessageId } from "@/features/xmtp/xmtp.types"
import { WithUndefined } from "@/types/general"
import { captureError } from "@/utils/capture-error"
import { GenericError } from "@/utils/error"
import { logger } from "@/utils/logger/logger"

type IArgs = {
  xmtpMessageId: IXmtpMessageId
  encryptedRemoteAttachmentContent: IConversationMessageRemoteAttachmentContent
  clientInboxId: IXmtpInboxId
  xmtpConversationId: IXmtpConversationId
}

export function useRemoteAttachmentQuery(args: IArgs) {
  return useQuery(getRemoteAttachmentQueryOptions(args))
}

function getRemoteAttachmentQueryOptions(
  args: WithUndefined<IArgs, "encryptedRemoteAttachmentContent" | "xmtpMessageId">,
) {
  const { xmtpMessageId, encryptedRemoteAttachmentContent, clientInboxId, xmtpConversationId } =
    args

  return queryOptions({
    // eslint-disable-next-line @tanstack/query/exhaustive-deps
    queryKey: ["remote-attachment", xmtpMessageId, clientInboxId, xmtpConversationId],
    queryFn:
      xmtpMessageId && encryptedRemoteAttachmentContent
        ? () =>
            getRemoteAttachment({
              xmtpMessageId,
              encryptedRemoteAttachmentContent,
              clientInboxId,
              xmtpConversationId,
            })
        : skipToken,
    enabled: !!xmtpMessageId && !!encryptedRemoteAttachmentContent,
  })
}

async function getRemoteAttachment(args: IArgs) {
  const { xmtpMessageId, encryptedRemoteAttachmentContent, clientInboxId, xmtpConversationId } =
    args

  logger.debug(`Getting remote stored attachment for message ${xmtpMessageId}`)
  const storedAttachment = await getStoredRemoteAttachment(xmtpMessageId)

  if (storedAttachment) {
    logger.debug(`Found remote stored attachment for message ${xmtpMessageId}`)
    return storedAttachment
  }

  logger.debug(`No remote stored attachment found for message ${xmtpMessageId}, downloading...`)

  try {
    const res = await downloadAndStoreAttachment({
      xmtpMessageId,
      encryptedRemoteAttachmentContent,
    })
    logger.debug(`Downloaded and stored remote attachment for message ${xmtpMessageId}`)
    return res
  } catch (error) {
    /**
     * If attachment download fails, refetch the message from XMTP and retry
     */

    captureError(
      new GenericError({
        error,
        additionalMessage: `First attempt failed for attachment ${xmtpMessageId}, refetching message and retrying...`,
      }),
    )

    try {
      await refetchConversationMessageQuery({
        clientInboxId,
        xmtpMessageId,
        xmtpConversationId,
      })

      const res = await downloadAndStoreAttachment({
        xmtpMessageId,
        encryptedRemoteAttachmentContent,
      })

      logger.debug(
        `Downloaded and stored remote attachment for message ${xmtpMessageId} after retry`,
      )
      return res
    } catch (retryError) {
      throw new GenericError({
        error: retryError,
        additionalMessage: `Failed to download attachment after refetching message for ${xmtpMessageId}`,
      })
    }
  }
}

async function downloadAndStoreAttachment(args: {
  xmtpMessageId: IXmtpMessageId
  encryptedRemoteAttachmentContent: IConversationMessageRemoteAttachmentContent
}) {
  const { xmtpMessageId, encryptedRemoteAttachmentContent } = args

  const encryptedLocalTmpFileUri = await downloadRemoteAttachment({
    url: encryptedRemoteAttachmentContent.url,
  })

  const decryptedAttachment = await decryptXmtpAttachment({
    encryptedLocalFileUri: encryptedLocalTmpFileUri,
    metadata: encryptedRemoteAttachmentContent,
  })

  const res = await storeRemoteAttachment({
    xmtpMessageId,
    decryptedAttachment,
  })

  return res
}
