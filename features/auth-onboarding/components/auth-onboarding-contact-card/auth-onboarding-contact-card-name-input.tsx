import { useIsFocused } from "@react-navigation/native"
import React, { memo, useCallback, useState } from "react"
import { useAuthOnboardingStore } from "@/features/auth-onboarding/stores/auth-onboarding.store"
import { ProfileContactCardEditableNameInput } from "@/features/profiles/components/profile-contact-card/profile-contact-card-editable-name-input"

// Props type for the name input component
type IAuthOnboardingContactCardNameInputProps = {
  onSubmitEditing?: () => void
}

export const AuthOnboardingContactCardNameInput = memo(function AuthOnboardingContactCardNameInput(
  props: IAuthOnboardingContactCardNameInputProps
) {
  const { onSubmitEditing } = props
  useIsFocused()
  
  const [nameValidationError, setNameValidationError] = useState<string>()
  const userFriendlyError = useAuthOnboardingStore((state) => state.userFriendlyError)
  const name = useAuthOnboardingStore((state) => state.name)

  const handleDisplayNameChange = useCallback((args: { text: string; error?: string }) => {
    const { text, error } = args
    const { actions } = useAuthOnboardingStore.getState()

    if (error) {
      setNameValidationError(error)
      actions.setUserFriendlyError(error)
      actions.setName(text)
      return
    }

    setNameValidationError(undefined)
    
    // Clear any error when user starts typing
    if (userFriendlyError) {
      actions.setUserFriendlyError(null)
    }
    
    actions.setName(text)
  }, [userFriendlyError])

  // Determine if we should show an error state
  const showError = nameValidationError || userFriendlyError
  
  // For now, let's not make input fields non-editable ever in onboarding
  const isOnchainName = false

  return (
    <ProfileContactCardEditableNameInput
      defaultValue={name}
      onChangeText={handleDisplayNameChange}
      status={showError ? "error" : undefined}
      isOnchainName={isOnchainName}
      onSubmitEditing={onSubmitEditing}
    />
  )
})
