import { DecryptedLocalAttachment } from "@xmtp/react-native-sdk"
import { Platform } from "react-native"
import RNFS from "react-native-fs"
import { IXmtpMessageId } from "@/features/xmtp/xmtp.types"
import { captureError } from "@/utils/capture-error"
import { GenericError } from "@/utils/error"
import {
  createFolderIfNotExists,
  fileExists,
  getFileSize,
  moveFileAndReplaceIfExist,
  saveFile,
} from "@/utils/file-system/file-system"
import { getSharedAppGroupDirectory } from "@/utils/ios-extension/ios-extensions"
import { getImageSize, isImageMimetype } from "@/utils/media"

// NEVER CHANGE THIS PREFIX - must match iOS extension
const SHARED_ATTACHMENT_PREFIX = "SHARED_ATTACHMENT_"

type IDecryptedStoredAttachmentMetadata = {
  filename: string
  mimeType: string | undefined
  imageSize?: { width: number; height: number }
  mediaType: "IMAGE" | "UNSUPPORTED"
  mediaURL: string
  contentLength: number
  storedAt: number
  messageId: IXmtpMessageId
}

function getAttachmentPaths(args: { messageId: IXmtpMessageId; filename?: string }) {
  const { messageId, filename } = args

  return {
    metadataFileName: `${SHARED_ATTACHMENT_PREFIX}${messageId}.json`,
    attachmentFileName: filename ? `${SHARED_ATTACHMENT_PREFIX}${messageId}_${filename}` : "",
  }
}

async function getAttachmentDirectory() {
  if (Platform.OS !== "ios") {
    // For non-iOS, use local documents directory
    const attachmentDir = `${RNFS.DocumentDirectoryPath}/attachments`
    await createFolderIfNotExists({
      path: attachmentDir,
      options: { NSURLIsExcludedFromBackupKey: true },
    })
    return attachmentDir
  }

  // For iOS, use shared App Group directory
  const sharedDir = await getSharedAppGroupDirectory()
  if (!sharedDir) {
    throw new Error("Shared App Group directory not available")
  }

  const attachmentDir = `${sharedDir}/attachments`
  await createFolderIfNotExists({
    path: attachmentDir,
    options: { NSURLIsExcludedFromBackupKey: true },
  })

  return attachmentDir
}

export async function getStoredRemoteAttachment(messageId: IXmtpMessageId) {
  try {
    const attachmentDir = await getAttachmentDirectory()
    const { metadataFileName } = getAttachmentPaths({ messageId })
    const metadataPath = `${attachmentDir}/${metadataFileName}`

    const exists = await fileExists(metadataPath)
    if (!exists) {
      return null
    }

    const metadata = JSON.parse(
      await RNFS.readFile(metadataPath, "utf8"),
    ) as IDecryptedStoredAttachmentMetadata

    const { attachmentFileName } = getAttachmentPaths({
      messageId,
      filename: metadata.filename,
    })
    const attachmentPath = `${attachmentDir}/${attachmentFileName}`

    const attachmentFileExists = await fileExists(attachmentPath)
    if (!attachmentFileExists) {
      return null
    }

    return {
      ...metadata,
      mediaURL: `file://${attachmentPath}`,
    }
  } catch (error) {
    captureError(
      new GenericError({
        error,
        additionalMessage: "Error getting stored remote attachment",
      }),
    )
    return null
  }
}

export async function storeRemoteAttachment(args: {
  xmtpMessageId: IXmtpMessageId
  decryptedAttachment: DecryptedLocalAttachment
}) {
  const { xmtpMessageId: messageId, decryptedAttachment } = args
  const { fileUri, filename: originalFilename, mimeType } = decryptedAttachment

  const filename = originalFilename || fileUri.split("/").pop() || `attachment_${Date.now()}`

  const attachmentDir = await getAttachmentDirectory()
  const { metadataFileName, attachmentFileName } = getAttachmentPaths({ messageId, filename })

  const destinationPath = `${attachmentDir}/${attachmentFileName}`
  const metadataPath = `${attachmentDir}/${metadataFileName}`

  // Move file to storage location
  const normalizedFileUri = fileUri.replace(/^file:\/\/\/?/, "")
  await moveFileAndReplaceIfExist({
    filePath: normalizedFileUri,
    destPath: destinationPath,
  })

  // Create metadata with proper file size and image dimensions
  const isImage = isImageMimetype(mimeType)
  const imageSize = isImage ? await getImageSize(`file://${destinationPath}`) : undefined

  // Get actual file size using our utility
  const contentLength = await getFileSize(destinationPath)

  const metadata: IDecryptedStoredAttachmentMetadata = {
    filename,
    mimeType,
    imageSize,
    mediaType: isImage ? "IMAGE" : "UNSUPPORTED",
    mediaURL: `file://${destinationPath}`,
    contentLength,
    storedAt: Date.now(),
    messageId,
  }

  // Save metadata using our utility
  await saveFile({
    path: metadataPath,
    data: JSON.stringify(metadata),
    encodingOrOptions: "utf8",
  })

  return metadata
}

// Cleanup old attachments
export async function cleanupOldAttachments(maxAgeMs = 7 * 24 * 60 * 60 * 1000) {
  // 7 days
  try {
    const attachmentDir = await getAttachmentDirectory()
    const files = await RNFS.readDir(attachmentDir)
    const now = Date.now()

    for (const file of files) {
      if (file.name.startsWith(SHARED_ATTACHMENT_PREFIX) && file.name.endsWith(".json")) {
        try {
          const metadata = JSON.parse(
            await RNFS.readFile(file.path, "utf8"),
          ) as IDecryptedStoredAttachmentMetadata

          if (now - metadata.storedAt > maxAgeMs) {
            // Delete metadata file
            await RNFS.unlink(file.path)

            // Delete attachment file if it exists
            const { attachmentFileName } = getAttachmentPaths({
              messageId: metadata.messageId,
              filename: metadata.filename,
            })
            const attachmentPath = `${attachmentDir}/${attachmentFileName}`

            const attachmentFileExists = await fileExists(attachmentPath)
            if (attachmentFileExists) {
              await RNFS.unlink(attachmentPath)
            }
          }
        } catch (error) {
          captureError(
            new GenericError({
              error,
              additionalMessage: "Error cleaning up old attachments",
            }),
          )
          // If we can't read the metadata, just delete the file
          await RNFS.unlink(file.path)
        }
      }
    }
  } catch (error) {
    captureError(
      new GenericError({
        error,
        additionalMessage: "Error cleaning up old attachments",
      }),
    )
  }
}
