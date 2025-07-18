import { IXmtpInboxId } from "@features/xmtp/xmtp.types"
import React, { memo, useCallback, useMemo } from "react"
import { ViewStyle } from "react-native"
import { IExtendedEdge } from "@/components/screen/screen.helpers"
import { Button } from "@/design-system/Button/Button"
import { IButtonProps } from "@/design-system/Button/Button.props"
import { DropdownMenu } from "@/design-system/dropdown-menu/dropdown-menu"
import { HeaderAction } from "@/design-system/Header/HeaderAction"
import { HStack } from "@/design-system/HStack"
import { iconRegistry } from "@/design-system/Icon/Icon"
import { useSaveProfile } from "@/features/profiles/hooks/use-save-profile"
import {
  useProfileMeStore,
  useProfileMeStoreValue,
} from "@/features/profiles/profile-me.store-context"
import { getProfileQueryData } from "@/features/profiles/profiles.query"
import { translate } from "@/i18n"
import { navigate } from "@/navigation/navigation.utils"
import { useHeader } from "@/navigation/use-header"
import { useRouter } from "@/navigation/use-navigation"
import { ThemedStyle, useAppTheme } from "@/theme/use-app-theme"
import { captureErrorWithToast } from "@/utils/capture-error"
import { ConvosApiError } from "@/utils/convos-api/convos-api-error"
import { Haptics } from "@/utils/haptics"
import { AccountSwitcher } from "../authentication/components/account-switcher"

export function useProfileMeScreenHeader(args: { inboxId: IXmtpInboxId }) {
  const { inboxId } = args

  const { theme, themed } = useAppTheme()
  const router = useRouter()
  const editMode = useProfileMeStoreValue((s) => s.editMode)
  const profileMeStore = useProfileMeStore()
  const { saveProfile } = useSaveProfile()
  const profile = getProfileQueryData({ xmtpId: inboxId })
  const isAvatarUploading = useProfileMeStoreValue((state) => state.isAvatarUploading)

  const handleContextMenuAction = useCallback(
    async (actionId: string) => {
      Haptics.selectionAsync()
      switch (actionId) {
        case "edit":
          // Initialize the store with current profile values before entering edit mode
          if (profile) {
            // Set the store values to match the current profile
            profileMeStore.getState().actions.setNameTextValue(profile.name || "")
            profileMeStore.getState().actions.setUsernameTextValue(profile.username || "")
            profileMeStore.getState().actions.setDescriptionTextValue(profile.description || "")
            profileMeStore.getState().actions.setAvatarUri(profile.avatar || undefined)
          }
          // Enable edit mode to show editable fields
          profileMeStore.getState().actions.setEditMode(true)
          break
        case "share":
          router.navigate("ShareProfile")
          break
      }
    },
    [profileMeStore, router, profile],
  )

  // Handle canceling edit mode
  const handleCancelEdit = useCallback(() => {
    // Reset the store and exit edit mode
    profileMeStore.getState().actions.reset()
    profileMeStore.getState().actions.setEditMode(false)
  }, [profileMeStore])

  const handleDoneEditProfile = useCallback(async () => {
    // Get all the profile data from the store
    const state = profileMeStore.getState()

    // This ensures we're sending the actual values from the form
    const profileUpdate = {
      id: profile?.id,
      name: state.nameTextValue,
      username: state.usernameTextValue,
      description: state.descriptionTextValue,
      avatar: state.avatarUri,
    }

    // Reset store immediately since we expect success most of the time
    profileMeStore.getState().actions.reset()

    try {
      await saveProfile({
        profileUpdates: profileUpdate,
        inboxId,
      })
    } catch (error) {
      const apiError = new ConvosApiError({
        error,
        additionalMessage: "Failed to save profile",
      })

      captureErrorWithToast(apiError, { message: apiError.getErrorMessage() })
      profileMeStore.getState().actions.setEditMode(true)
    }
  }, [profileMeStore, profile, inboxId, saveProfile])

  const headerOptions = useMemo(() => {
    return {
      backgroundColor: theme.colors.background.surface,
      safeAreaEdges: ["top"] as IExtendedEdge[],
      titleComponent: editMode ? undefined : <AccountSwitcher noAvatar />,
      LeftActionComponent: editMode ? (
        // Show Cancel button when in edit mode
        <Button text={translate("Cancel")} variant="text" onPress={handleCancelEdit} />
      ) : (
        // Show back button when not in edit mode
        <HeaderAction
          icon="chevron.left"
          onPress={() => {
            router.goBack()
          }}
        />
      ),
      RightActionComponent: (
        <HStack style={themed($headerRightContainer)}>
          {editMode ? (
            <DoneAction onPress={handleDoneEditProfile} loading={isAvatarUploading} />
          ) : (
            <>
              <HeaderAction
                icon="qrcode"
                onPress={() => {
                  navigate("ShareProfile")
                }}
              />
              <DropdownMenu
                style={themed($dropdownMenu)}
                onPress={handleContextMenuAction}
                actions={[
                  {
                    id: "edit",
                    title: translate("Edit"),
                    image: iconRegistry["pencil"],
                  },
                  {
                    id: "share",
                    title: translate("Share"),
                    image: iconRegistry["square.and.arrow.up"],
                  },
                ]}
              >
                <HeaderAction icon="more_vert" />
              </DropdownMenu>
            </>
          )}
        </HStack>
      ),
    }
  }, [
    theme,
    themed,
    editMode,
    handleCancelEdit,
    handleDoneEditProfile,
    handleContextMenuAction,
    router,
    isAvatarUploading,
  ])

  useHeader(headerOptions, [headerOptions])
}

const DoneAction = memo(function DoneAction(props: IButtonProps) {
  return <Button text={translate("Done")} variant="text" {...props} />
})

const $headerRightContainer: ThemedStyle<ViewStyle> = ({ spacing }) => ({
  alignItems: "center",
  columnGap: spacing.xxs,
})

const $dropdownMenu: ThemedStyle<ViewStyle> = ({ spacing }) => ({
  paddingVertical: spacing.sm,
  paddingRight: spacing.xxxs,
})
