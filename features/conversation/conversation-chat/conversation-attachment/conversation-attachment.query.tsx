import { queryOptions, skipToken, useQuery } from "@tanstack/react-query"
import { RemoteAttachmentMetadata } from "@xmtp/react-native-sdk"
import { downloadRemoteAttachment } from "@/features/conversation/conversation-chat/conversation-attachment/download-remote-attachment"
import {
  getStoredRemoteAttachment,
  storeRemoteAttachment,
} from "@/features/conversation/conversation-chat/conversation-attachment/remote-attachment-local-storage"
import { decryptXmtpAttachment } from "@/features/xmtp/xmtp-codecs/xmtp-codecs-attachments"
import { IXmtpMessageId } from "@/features/xmtp/xmtp.types"
import { WithUndefined } from "@/types/general"

type IArgs = {
  xmtpMessageId: IXmtpMessageId
  url: string
  metadata: RemoteAttachmentMetadata
}

export function useRemoteAttachmentQuery(args: IArgs) {
  return useQuery(getRemoteAttachmentQueryOptions(args))
}

function getRemoteAttachmentQueryOptions(args: WithUndefined<IArgs, "url" | "xmtpMessageId">) {
  const { xmtpMessageId, url, metadata } = args

  return queryOptions({
    // eslint-disable-next-line @tanstack/query/exhaustive-deps
    queryKey: ["remote-attachment", xmtpMessageId, url],
    queryFn:
      xmtpMessageId && url && metadata
        ? () => fetchRemoteAttachment({ xmtpMessageId, url, metadata })
        : skipToken,
    enabled: !!xmtpMessageId && !!url && !!metadata,
  })
}

async function fetchRemoteAttachment(args: IArgs) {
  const { xmtpMessageId, url, metadata } = args

  // Check local cache first
  const storedAttachment = await getStoredRemoteAttachment(xmtpMessageId)

  if (storedAttachment) {
    return storedAttachment
  }

  const encryptedLocalFileUri = await downloadRemoteAttachment({
    url,
  })

  const decryptedAttachment = await decryptXmtpAttachment({
    encryptedLocalFileUri: encryptedLocalFileUri,
    metadata,
  })

  return storeRemoteAttachment({
    xmtpMessageId,
    decryptedAttachment,
  })
}
