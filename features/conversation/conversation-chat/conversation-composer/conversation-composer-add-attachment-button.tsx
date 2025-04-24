import { Icon, iconRegistry } from "@design-system/Icon/Icon"
import { translate } from "@i18n"
import {
  compressAndResizeImage,
  getMimeTypeFromAsset,
  pickMultipleMediaFromLibrary,
  takePictureFromCamera,
} from "@utils/media"
import * as ImagePicker from "expo-image-picker"
import { memo, useCallback, useMemo } from "react"
import { ViewStyle } from "react-native"
import { showSnackbar } from "@/components/snackbar/snackbar.service"
import { Center } from "@/design-system/Center"
import { DropdownMenu } from "@/design-system/dropdown-menu/dropdown-menu"
import {
  IComposerAttachmentPicked,
  useConversationComposerStore,
} from "@/features/conversation/conversation-chat/conversation-composer/conversation-composer.store-context"
import { useConversationComposerIsEnabled } from "@/features/conversation/conversation-chat/conversation-composer/hooks/use-conversation-composer-is-enabled"
import { uploadFile } from "@/features/uploads/upload.api"
import { encryptXmtpAttachment } from "@/features/xmtp/xmtp-codecs/xmtp-codecs-attachments"
import { ThemedStyle, useAppTheme } from "@/theme/use-app-theme"
import { captureError, captureErrorWithToast } from "@/utils/capture-error"
import { GenericError } from "@/utils/error"
import { prefetchImageUrl } from "@/utils/image"
import { logger } from "@/utils/logger/logger"
import { customPromiseAllSettled } from "@/utils/promise-all-settlted"

export const ConversationComposerAddAttachmentButton = memo(
  function ConversationComposerAddAttachmentButton() {
    const { theme, themed } = useAppTheme()

    const conversationComposerStore = useConversationComposerStore()
    const isEnabled = useConversationComposerIsEnabled()

    const handleAsset = useCallback(
      async (asset: ImagePicker.ImagePickerAsset) => {
        logger.debug("[ConversationComposerAddAttachmentButton] Creating media preview", {
          uri: asset.uri,
          mimeType: asset.mimeType,
          dimensions: { width: asset.width, height: asset.height },
        })

        const mediaPreview: IComposerAttachmentPicked = {
          status: "picked",
          mediaURI: asset.uri,
          mediaType: asset.mimeType || "image",
          mediaDimensions: {
            width: asset.width,
            height: asset.height,
          },
        }

        try {
          logger.debug(
            "[ConversationComposerAddAttachmentButton] Adding composer attachment",
            mediaPreview,
          )
          conversationComposerStore.getState().addComposerAttachment(mediaPreview)

          logger.debug(
            "[ConversationComposerAddAttachmentButton] Updating attachment status to uploading",
          )
          conversationComposerStore.getState().updateComposerAttachment({
            mediaURI: mediaPreview.mediaURI,
            attachment: {
              status: "uploading",
            },
          })

          // Compress and resize image
          const resizedImage = await compressAndResizeImage(asset.uri)

          const mimeType = getMimeTypeFromAsset(asset)

          if (!mimeType) {
            throw new GenericError({
              error: new Error("Failed to get mime type"),
            })
          }

          // Encrypt and upload attachment
          const encryptedAttachment = await encryptXmtpAttachment({
            fileUri: resizedImage.uri,
            mimeType,
          })

          // Upload file
          const publicUrl = await uploadFile({
            filePath: encryptedAttachment.encryptedLocalFileUri,
            contentType: mimeType,
          })

          prefetchImageUrl(publicUrl).catch(captureError)

          // Add uploaded attachment
          conversationComposerStore.getState().updateComposerAttachment({
            mediaURI: mediaPreview.mediaURI,
            attachment: {
              url: publicUrl,
              contentDigest: encryptedAttachment.metadata.contentDigest,
              secret: encryptedAttachment.metadata.secret,
              salt: encryptedAttachment.metadata.salt,
              nonce: encryptedAttachment.metadata.nonce,
              filename:
                encryptedAttachment.metadata.filename || asset.uri.split("/").pop() || "attachment",
              contentLength: String(encryptedAttachment.metadata.contentLength) || "0",
              scheme: "https://",
              status: "uploaded",
            },
          })
        } catch (error) {
          conversationComposerStore.getState().removeComposerAttachment(mediaPreview.mediaURI)
          throw new GenericError({ error, additionalMessage: "Failed to process attachment" })
        }
      },
      [conversationComposerStore],
    )

    const pickMedia = useCallback(async () => {
      try {
        logger.debug("[pickMedia] Picking multiple media from library")
        const assets = await pickMultipleMediaFromLibrary()

        if (!assets) {
          logger.debug("[pickMedia] No assets selected")
          return
        }

        logger.debug("[pickMedia] Processing assets", { count: assets.length })
        const results = await customPromiseAllSettled(
          assets.map((asset) => {
            return handleAsset(asset)
          }),
        )
        logger.debug("[pickMedia] Results", results)

        const failedResults = results.filter((result) => result.status === "rejected")
        const failedCount = failedResults.length
        const successCount = results.length - failedCount

        logger.debug("[pickMedia] Finished processing assets", {
          total: results.length,
          success: successCount,
          failed: failedCount,
        })

        if (failedCount > 0) {
          // Capture errors from failed results
          failedResults.forEach((result) => {
            logger.error("[pickMedia] Failed to process attachment", { error: result.reason })
            captureError(
              new GenericError({
                error: result.reason,
                additionalMessage: "Failed to process attachment",
              }),
            )
          })

          showSnackbar({
            message: `Failed to process ${failedCount} attachment${failedCount > 1 ? "s" : ""}`,
            type: "error",
          })
        }
      } catch (error) {
        captureErrorWithToast(
          new GenericError({ error, additionalMessage: "Failed to pick media" }),
          {
            message: "Failed to select media"
          }
        )
      }
    }, [handleAsset])

    const openCamera = useCallback(async () => {
      try {
        const asset = await takePictureFromCamera()

        if (!asset) {
          return
        }

        await handleAsset(asset)
      } catch (error) {
        captureErrorWithToast(
          new GenericError({
            error,
            additionalMessage: "Failed to process attachment from camera",
          }),
          {
            message: "Failed to process camera photo"
          }
        )
      }
    }, [handleAsset])

    const onDropdownMenuPress = useCallback(
      (actionId: string) => {
        switch (actionId) {
          case "camera":
            openCamera()
            break
          case "mediaLibrary":
            pickMedia()
            break
        }
      },
      [openCamera, pickMedia],
    )

    const dropdownMenuActions = useMemo(() => {
      return [
        {
          id: "mediaLibrary",
          title: translate("photo_library"),
          image: iconRegistry["photos"],
        },
        {
          id: "camera",
          title: translate("camera"),
          image: iconRegistry["camera"],
        },
      ]
    }, [])

    return (
      <DropdownMenu
        disabled={!isEnabled}
        style={themed($dropdownMenu)}
        onPress={onDropdownMenuPress}
        actions={dropdownMenuActions}
      >
        <Center style={themed($button)}>
          <Icon
            color={theme.colors.text.secondary}
            icon="plus"
            size={theme.iconSize.sm}
            weight="medium"
          />
        </Center>
      </DropdownMenu>
    )
  },
)

const $dropdownMenu: ThemedStyle<ViewStyle> = ({ spacing }) => ({
  margin: spacing.xxxs,
  alignSelf: "flex-end",
})

const $button: ThemedStyle<ViewStyle> = ({ colors }) => ({
  height: 36, // Value from Figma
  width: 36, // Value from Figma
  backgroundColor: colors.fill.minimal,
  borderRadius: 36,
})
