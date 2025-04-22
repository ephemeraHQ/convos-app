import { translate } from "@i18n"
import { useMutation } from "@tanstack/react-query"
import { executeAfterKeyboardClosed } from "@utils/keyboard"
import {
  compressAndResizeImage,
  pickSingleMediaFromLibrary,
  takePictureFromCamera,
} from "@utils/media"
import { ImagePickerAsset, ImagePickerOptions } from "expo-image-picker"
import { useCallback, useState } from "react"
import { showActionSheet } from "@/components/action-sheet"
import { uploadFile } from "@/features/uploads/upload.api"
import { captureError } from "@/utils/capture-error"
import { UserCancelledError } from "@/utils/error"
import { prefetchImageUrl } from "@/utils/image"
import { logger } from "@/utils/logger/logger"

type ImageSource = "camera" | "library"

type ActionSheetOption = {
  label: string
  onPress?: () => void
}

/**
 * Uploads an image asset to the server
 * Handles compression, getting presigned URL, and uploading
 */
async function uploadImage(imageAsset: ImagePickerAsset): Promise<string> {
  logger.debug("[useAddPfp] Starting image compression", {
    originalUri: imageAsset.uri,
    originalWidth: imageAsset.width,
    originalHeight: imageAsset.height,
  })

  // Compress and resize the image
  const resizedImage = await compressAndResizeImage(imageAsset.uri, true)

  logger.debug("[useAddPfp] Image compressed successfully", {
    compressedUri: resizedImage.uri,
    width: resizedImage.width,
    height: resizedImage.height,
  })

  // Get presigned URL for upload
  logger.debug("[useAddPfp] Getting presigned URL")

  // Upload the image
  const publicUrl = await uploadFile({
    filePath: resizedImage.uri,
    contentType: "image/jpeg",
  })

  prefetchImageUrl(publicUrl).catch(captureError)

  logger.debug("[useAddPfp] Profile picture upload complete", {
    publicUrl,
    originalSize: { width: imageAsset.width, height: imageAsset.height },
    finalSize: { width: resizedImage.width, height: resizedImage.height },
  })

  return publicUrl
}

export function useAddOrRemovePfp(args?: {
  currentImageUri?: string | null
  onRemove?: () => void
}) {
  const { currentImageUri, onRemove } = args ?? {}
  const [asset, setAsset] = useState<ImagePickerAsset>()

  const {
    mutateAsync: uploadImageAsync,
    isPending: isUploading,
    data: uploadedImageUrl,
    error: errorUploadingImage,
  } = useMutation({
    mutationFn: uploadImage,
  })

  /**
   * Shows an action sheet and lets the user pick a profile picture
   * Returns a promise that resolves with the uploaded image URL
   */
  const addPFP = useCallback(
    () => {
      console.log("test")
      return new Promise<string>((resolve, reject) => {
        const showOptions = () => {
          const defaultOptions: ActionSheetOption[] = [
            { label: translate("userProfile.mediaOptions.takePhoto") },
            { label: translate("userProfile.mediaOptions.chooseFromLibrary") },
          ]

          // Check if we have either imageUri or asset.uri to determine if we should show remove option
          const hasImage = Boolean(currentImageUri) || Boolean(asset?.uri)
          const removeOption: ActionSheetOption | undefined =
            hasImage && onRemove ? { label: translate("Remove"), onPress: onRemove } : undefined

          // Combine all options: default, dynamic remove, and cancel
          const allOptionItems: ActionSheetOption[] = [
            ...defaultOptions,
            ...(removeOption ? [removeOption] : []),
          ]

          const allOptionsLabels = [
            ...allOptionItems.map((o) => o.label),
            translate("userProfile.mediaOptions.cancel"), // Add cancel label
          ]

          showActionSheet({
            options: {
              options: allOptionsLabels,
              cancelButtonIndex: allOptionsLabels.length - 1,
            },
            callback: async (selectedIndex?: number) => {
              if (selectedIndex === undefined || selectedIndex === allOptionsLabels.length - 1) {
                // User cancelled
                reject(new UserCancelledError({ error: "Action sheet cancelled" }))
                return
              }

              try {
                let source: ImageSource | undefined
                const selectedOptionItem = allOptionItems[selectedIndex]

                // Handle default options
                if (selectedIndex === 0) {
                  source = "camera"
                } else if (selectedIndex === 1) {
                  source = "library"
                } else {
                  // Handle dynamic remove option
                  if (selectedOptionItem?.onPress) {
                    selectedOptionItem.onPress()
                    // Indicate that an action was taken but no image is being uploaded
                    // Rejecting here prevents the calling code from expecting a URL
                    reject(new UserCancelledError({ error: "Custom action selected" }))
                    return
                  } else {
                    // Should not happen if options are structured correctly
                    reject(new Error("Invalid option selected: No onPress handler"))
                    return
                  }
                }

                if (!source) {
                  // Should not happen if logic above is correct
                  reject(new Error("No source selected"))
                  return
                }

                const options: ImagePickerOptions = {
                  allowsEditing: true,
                  aspect: [1, 1],
                }

                // Get image from selected source
                const pickedAsset =
                  source === "camera"
                    ? await takePictureFromCamera(options)
                    : await pickSingleMediaFromLibrary(options)

                if (!pickedAsset) {
                  reject(new UserCancelledError({ error: "No image selected" }))
                  return
                }

                // Update state and upload
                setAsset(pickedAsset)
                const uploadedUrl = await uploadImageAsync(pickedAsset)
                resolve(uploadedUrl)
              } catch (error) {
                // Reject with the caught error (could be UserCancelledError or upload error)
                reject(error)
              }
            },
          })
        }

        executeAfterKeyboardClosed(showOptions)
      })
    },
    [uploadImageAsync, currentImageUri, onRemove, asset], // Add asset to dependencies to check for its existence
  )

  const reset = () => {
    setAsset(undefined)
  }

  return {
    addPFP,
    asset,
    isUploading,
    reset,
    uploadedImageUrl,
    errorUploadingImage,
  }
}
