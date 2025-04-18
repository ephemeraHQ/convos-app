import { queryOptions, useQuery } from "@tanstack/react-query"
import { RemoteAttachmentMetadata } from "@xmtp/react-native-sdk"
import { downloadRemoteAttachment } from "@/features/conversation/conversation-chat/conversation-attachment/download-remote-attachment"
import {
  getStoredRemoteAttachment,
  storeRemoteAttachment,
} from "@/features/conversation/conversation-chat/conversation-attachment/remote-attachment-local-storage"
import { decryptXmtpAttachment } from "@/features/xmtp/xmtp-codecs/xmtp-codecs-attachments"
import { IXmtpMessageId } from "@/features/xmtp/xmtp.types"

type IArgs = {
  xmtpMessageId: IXmtpMessageId
  url: string
  metadata: RemoteAttachmentMetadata
}

export function useRemoteAttachmentQuery(args: IArgs) {
  return useQuery(getRemoteAttachmentQueryOptions(args))
}

function getRemoteAttachmentQueryOptions(args: IArgs) {
  return queryOptions({
    // eslint-disable-next-line @tanstack/query/exhaustive-deps
    queryKey: ["remote-attachment", args.xmtpMessageId, args.url],
    queryFn: () => fetchRemoteAttachment(args),
    enabled: !!args.xmtpMessageId && !!args.url,
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
