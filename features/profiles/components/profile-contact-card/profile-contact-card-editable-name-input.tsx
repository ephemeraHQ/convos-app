import { memo, useCallback } from "react"
import { Center } from "@/design-system/Center"
import { IconButton } from "@/design-system/IconButton/IconButton"
import { TextField } from "@/design-system/TextField/TextField"
import { TextFieldAccessoryProps, TextFieldProps } from "@/design-system/TextField/TextField.props"
import { useAuthOnboardingStore } from "@/features/auth-onboarding/stores/auth-onboarding.store"
import { translate } from "@/i18n"
import { useAppTheme } from "@/theme/use-app-theme"

type IProfileContactCardEditableNameInputProps = Omit<TextFieldProps, "onChangeText"> & {
  onChangeText: (args: { text: string; error: string | undefined }) => void
  isOnchainName?: boolean
}

export const ProfileContactCardEditableNameInput = memo(
  function ProfileContactCardEditableNameInput(props: IProfileContactCardEditableNameInputProps) {
    const { onChangeText, isOnchainName, ...rest } = props

    const { theme } = useAppTheme()

    const handleChangeText = useCallback(
      (text: string) => {
        // Handle dot error or clear error
        const dotErrorMessage = text.includes(".") 
          ? translate("userProfile.inputs.displayName.errors.noDots")
          : null
          
        // Set error state in store
        useAuthOnboardingStore.getState().actions.setUserFriendlyError(dotErrorMessage)
          
        // Pass to parent component
        onChangeText?.({
          text,
          error: dotErrorMessage ?? undefined,
        })
      },
      [onChangeText],
    )

    const renderClearTextAccessory = useCallback(
      (props: TextFieldAccessoryProps) => {
        return (
          <Center
            style={{
              paddingRight: theme.spacing.xxs,
            }}
          >
            <IconButton
              iconName="xmark.circle.fill"
              onPress={() => {
                handleChangeText("")
              }}
            />
          </Center>
        )
      },
      [handleChangeText, theme.spacing.xxs],
    )

    return (
      <TextField
        label={translate("contactCard.name")}
        placeholder={translate("userProfile.inputs.displayName.placeholder")}
        containerStyle={{ backgroundColor: "transparent" }}
        inputWrapperStyle={{
          backgroundColor: "transparent",
          borderWidth: theme.borderWidth.sm,
          borderColor:
            props.status === "error"
              ? theme.colors.global.caution
              : theme.colors.border.inverted.subtle,
          borderRadius: theme.borderRadius.xs,
          paddingHorizontal: theme.spacing.sm,
          paddingVertical: theme.spacing.xs,
        }}
        style={{
          color: theme.colors.text.inverted.primary,
        }}
        cursorColor={theme.colors.text.inverted.primary}
        maxLength={32}
        autoCorrect={false}
        onChangeText={handleChangeText}
        editable={!isOnchainName}
        RightAccessory={isOnchainName ? renderClearTextAccessory : undefined}
        returnKeyType="done"
        {...rest}
      />
    )
  },
)
