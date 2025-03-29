import { RemoteAttachmentMetadata } from "@xmtp/react-native-sdk"
import { getSafeCurrentSender } from "@/features/authentication/multi-inbox.store"
import { wrapXmtpCallWithDuration } from "@/features/xmtp/xmtp.helpers"
import { IXmtpInboxId } from "@/features/xmtp/xmtp.types"
import { XMTPError } from "@/utils/error"
import { calculateFileDigest, fileExists } from "@/utils/file-system/file-system"
import { getXmtpClientByInboxId } from "../xmtp-client/xmtp-client"

export const MAX_AUTOMATIC_DOWNLOAD_ATTACHMENT_SIZE = 10000000 // 10MB

export const encryptAttachment = async (args: {
  fileUri: string
  mimeType: string | undefined
  clientInboxId?: IXmtpInboxId
}) => {
  const { fileUri, mimeType, clientInboxId = getSafeCurrentSender().inboxId } = args

  const client = await getXmtpClientByInboxId({
    inboxId: clientInboxId,
  })

  const encryptedAttachment = await wrapXmtpCallWithDuration("encryptAttachment", () =>
    client.encryptAttachment({ fileUri, mimeType }),
  )

  // Calculate and verify content digest
  const digest = await calculateFileDigest(encryptedAttachment.encryptedLocalFileUri)

  if (digest !== encryptedAttachment.metadata.contentDigest) {
    throw new XMTPError({
      error: new Error("Content digest mismatch"),
      additionalMessage: "The encrypted file appears to be corrupted or modified",
    })
  }

  return encryptedAttachment
}

export const decryptAttachment = async (args: {
  encryptedLocalFileUri: string
  metadata: RemoteAttachmentMetadata
  clientInboxId?: IXmtpInboxId
}) => {
  const { encryptedLocalFileUri, metadata, clientInboxId = getSafeCurrentSender().inboxId } = args

  const client = await getXmtpClientByInboxId({
    inboxId: clientInboxId,
  })

  const exists = await fileExists(encryptedLocalFileUri)

  if (!exists) {
    throw new XMTPError({
      error: new Error("Encrypted file not found"),
      additionalMessage: `File not found at path: ${encryptedLocalFileUri}`,
    })
  }

  // Calculate digest directly from the file
  const downloadedDigest = await calculateFileDigest(encryptedLocalFileUri)

  if (metadata.contentDigest !== downloadedDigest) {
    throw new XMTPError({
      error: new Error("Content digest mismatch"),
      additionalMessage: "The downloaded file appears to be corrupted or modified",
    })
  }

  const decryptedAttachment = await wrapXmtpCallWithDuration("decryptAttachment", () =>
    client.decryptAttachment({ encryptedLocalFileUri, metadata }),
  )

  return decryptedAttachment
}
