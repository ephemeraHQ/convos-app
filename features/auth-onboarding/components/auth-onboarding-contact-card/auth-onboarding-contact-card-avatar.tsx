import React, { memo, useCallback, useEffect } from "react"
import { useAuthOnboardingStore } from "@/features/auth-onboarding/stores/auth-onboarding.store"
import { ProfileContactCardEditableAvatar } from "@/features/profiles/components/profile-contact-card/profile-contact-card-editable-avatar"
import { useAddOrRemovePfp } from "@/hooks/use-add-pfp"
import { captureErrorWithToast } from "@/utils/capture-error"
import { GenericError, UserCancelledError } from "@/utils/error"

export const AuthOnboardingContactCardAvatar = memo(function AuthOnboardingContactCardAvatar() {
  const name = useAuthOnboardingStore((state) => state.name)
  const avatar = useAuthOnboardingStore((state) => state.avatar)

  // Pass arguments to useAddPfp hook
  const { addPFP, asset, isUploading, reset } = useAddOrRemovePfp({
    currentImageUri: avatar,
    onRemove: () => {
      reset()
      useAuthOnboardingStore.getState().actions.setAvatar("")
    },
  })

  // Update upload status in the store
  useEffect(() => {
    useAuthOnboardingStore.getState().actions.setIsAvatarUploading(isUploading)
  }, [isUploading])

  const addAvatar = useCallback(async () => {
    try {
      // No arguments needed since they're passed to the hook
      const url = await addPFP()
      if (url) {
        useAuthOnboardingStore.getState().actions.setAvatar(url)
      }
    } catch (error) {
      if (error instanceof UserCancelledError) {
        return // Ignore cancel errors
      }
      captureErrorWithToast(new GenericError({ error, additionalMessage: "Error adding avatar" }))
    }
  }, [addPFP])

  return (
    <ProfileContactCardEditableAvatar
      avatarUri={avatar || asset?.uri}
      avatarName={name}
      onPress={addAvatar}
    />
  )
})
