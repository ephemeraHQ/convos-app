import { IXmtpInboxId } from "@features/xmtp/xmtp.types"
import React, { memo, useCallback, useEffect, useState } from "react"
import { useSafeAreaInsets } from "react-native-safe-area-context"
import { Screen } from "@/components/screen/screen"
import { ListItem } from "@/design-system/list-item"
import { Loader } from "@/design-system/loader"
import { Text } from "@/design-system/Text"
import { TextField } from "@/design-system/TextField/TextField"
import { VStack } from "@/design-system/VStack"
import { useLogout } from "@/features/authentication/use-logout"
import { ProfileContactCard } from "@/features/profiles/components/profile-contact-card/profile-contact-card"
import { ProfileContactCardEditableAvatar } from "@/features/profiles/components/profile-contact-card/profile-contact-card-editable-avatar"
import { ProfileContactCardEditableNameInput } from "@/features/profiles/components/profile-contact-card/profile-contact-card-editable-name-input"
import { ProfileContactCardImportName } from "@/features/profiles/components/profile-contact-card/profile-contact-card-import-name"
import { ProfileContactCardLayout } from "@/features/profiles/components/profile-contact-card/profile-contact-card-layout"
import { ProfileSection } from "@/features/profiles/components/profile-section"
import { ProfileSocialsNames } from "@/features/profiles/components/profile-social-names"
import { useProfileMeScreenHeader } from "@/features/profiles/profile-me.screen-header"
import {
  ProfileMeStoreProvider,
  useProfileMeStore,
  useProfileMeStoreValue,
} from "@/features/profiles/profile-me.store-context"
import { useProfileQuery } from "@/features/profiles/profiles.query"
import { useAddOrRemovePfp } from "@/hooks/use-add-pfp"
import { translate } from "@/i18n"
import { useRouter } from "@/navigation/use-navigation"
import { useAppStore } from "@/stores/app.store"
import { useAppTheme } from "@/theme/use-app-theme"
import { captureErrorWithToast } from "@/utils/capture-error"
import { ensureOurError, GenericError, UserCancelledError } from "@/utils/error"
import { getFirstDefined } from "@/utils/general"
import { useCurrentSender } from "../authentication/multi-inbox.store"

export function ProfileMe(props: { inboxId: IXmtpInboxId }) {
  return (
    <ProfileMeStoreProvider inboxId={props.inboxId}>
      <ProfileMeContent inboxId={props.inboxId} />
    </ProfileMeStoreProvider>
  )
}

function ProfileMeContent(props: { inboxId: IXmtpInboxId }) {
  const { inboxId } = props

  const { theme } = useAppTheme()

  const router = useRouter()

  const insets = useSafeAreaInsets()

  // Get the edit mode state from the store
  const editMode = useProfileMeStoreValue((state) => state.editMode)

  const isMyProfile = useCurrentSender()?.inboxId === inboxId

  const { data: profile } = useProfileQuery({ xmtpId: inboxId, caller: "ProfileMe" })

  // Set up the screen header with edit functionality
  useProfileMeScreenHeader({ inboxId })

  return (
    <Screen
      preset="scroll"
      backgroundColor={theme.colors.background.surface}
      keyboardOffset={insets.bottom}
      keyboardShouldPersistTaps="handled"
    >
      <ProfileSection
        style={{
          paddingHorizontal: 0, // Since the ProfileContactCardLayout already has margin for the shadow
          paddingVertical: 0, // Since the ProfileContactCardLayout already has margin for the shadow
        }}
      >
        {/* Show editable avatar and name when in edit mode */}
        {editMode ? (
          <ProfileContactCardLayout
            avatar={<EditableProfileContactCardAvatar inboxId={inboxId} />}
            name={<EditableProfileContactCardNameInput />}
            additionalOptions={<EditableProfileContactCardImportName inboxId={inboxId} />}
          />
        ) : (
          <ProfileContactCard inboxId={inboxId} />
        )}
      </ProfileSection>

      {/* Show different content based on edit mode */}
      {editMode ? (
        // In edit mode, show username and description input fields
        <ProfileSection withTopBorder>
          <VStack style={{ rowGap: theme.spacing.md }}>
            <EditableUsernameInput inboxId={inboxId} />
            <EditableDescriptionInput inboxId={inboxId} />
          </VStack>
        </ProfileSection>
      ) : (
        // In view mode, show profile info and settings
        <>
          {/* Show username and description if they exist */}
          {profile?.description && (
            <ProfileSection withTopBorder>
              <VStack style={{ rowGap: theme.spacing.md }}>
                {profile?.description && (
                  <VStack style={{ rowGap: theme.spacing.xxs }}>
                    <Text preset="formLabel">{translate("About")}</Text>
                    <Text preset="body">{profile.description}</Text>
                  </VStack>
                )}
              </VStack>
            </ProfileSection>
          )}

          <ProfileSocialsNames inboxId={inboxId} />

          {/* Only show settings when viewing your own profile and not in edit mode */}
          {isMyProfile && !editMode && (
            <ProfileSection
              withTopBorder
              style={{
                paddingHorizontal: 0,
              }}
            >
              <ListItem
                chevron
                title={translate("Archive")}
                onPress={() => {
                  router.navigate("Blocked")
                }}
              />
              <ListItem
                chevron
                title="Security line"
                onPress={() => {
                  router.navigate("ChatsRequests")
                }}
              />
              <LogoutListItem />
            </ProfileSection>
          )}
        </>
      )}
    </Screen>
  )
}

const LogoutListItem = memo(function LogoutListItem() {
  const { logout } = useLogout()

  const isLoggingOut = useAppStore((state) => state.isLoggingOut)

  return (
    <ListItem
      chevron
      title={translate("Log out")}
      {...(isLoggingOut && {
        end: <Loader size="xs" />,
      })}
      onPress={() => {
        logout({ caller: "ProfileMe" }).catch((error) => {
          captureErrorWithToast(ensureOurError(error), {
            message: "Error logging out, please restart the app.",
          })
        })
      }}
    />
  )
})

const EditableProfileContactCardNameInput = memo(function EditableProfileContactCardNameInput() {
  const profileMeStore = useProfileMeStore()

  const nameDefaultTextValue = profileMeStore.getState().nameTextValue

  const isOnChainName = useProfileMeStoreValue((state) => state.nameTextValue?.includes("."))

  const [nameValidationError, setNameValidationError] = useState<string>()

  const handleDisplayNameChange = useCallback(
    (args: { text: string; error?: string }) => {
      if (args.error) {
        setNameValidationError(args.error)
        profileMeStore.getState().actions.setNameTextValue("")
      } else {
        setNameValidationError(undefined)
      }
      profileMeStore.getState().actions.setNameTextValue(args.text)
    },
    [profileMeStore],
  )

  return (
    <ProfileContactCardEditableNameInput
      defaultValue={nameDefaultTextValue}
      onChangeText={handleDisplayNameChange}
      status={nameValidationError ? "error" : undefined}
      helper={nameValidationError}
      isOnchainName={isOnChainName}
    />
  )
})

const EditableUsernameInput = memo(function EditableUsernameInput({
  inboxId,
}: {
  inboxId: IXmtpInboxId
}) {
  const { theme } = useAppTheme()
  const profileMeStore = useProfileMeStore()
  const { data: profile } = useProfileQuery({ xmtpId: inboxId, caller: "ProfileMe" })

  const usernameDefaultTextValue = profile?.username || ""

  const handleUsernameChange = useCallback(
    (text: string) => {
      profileMeStore.getState().actions.setUsernameTextValue(text)
    },
    [profileMeStore],
  )

  return (
    <VStack style={{ rowGap: theme.spacing.xxs }}>
      <TextField
        label="convos.org/"
        defaultValue={usernameDefaultTextValue}
        onChangeText={handleUsernameChange}
        helper={translate("Your unique sharable link")}
      />
    </VStack>
  )
})

const EditableProfileContactCardImportName = memo(function EditableProfileContactCardImportName({
  inboxId,
}: {
  inboxId: IXmtpInboxId
}) {
  const router = useRouter()

  return (
    <ProfileContactCardImportName
      onPress={() => {
        router.navigate("ProfileImportInfo")
      }}
    />
  )
})

const EditableDescriptionInput = memo(function EditableDescriptionInput({
  inboxId,
}: {
  inboxId: IXmtpInboxId
}) {
  const { theme } = useAppTheme()
  const profileMeStore = useProfileMeStore()
  const { data: profile } = useProfileQuery({ xmtpId: inboxId, caller: "ProfileMe" })

  const descriptionDefaultTextValue = profile?.description || ""

  const handleDescriptionChange = useCallback(
    (text: string) => {
      profileMeStore.getState().actions.setDescriptionTextValue(text)
    },
    [profileMeStore],
  )

  return (
    <VStack style={{ rowGap: theme.spacing.xxs }}>
      <TextField
        defaultValue={descriptionDefaultTextValue}
        onChangeText={handleDescriptionChange}
        multiline
        numberOfLines={3}
        label={translate("About")}
      />
    </VStack>
  )
})

const EditableProfileContactCardAvatar = memo(function EditableProfileContactCardAvatar({
  inboxId,
}: {
  inboxId: IXmtpInboxId
}) {
  const profileMeStore = useProfileMeStore()
  const { data: profile } = useProfileQuery({ xmtpId: inboxId, caller: "ProfileMe" })
  const storeAvatar = useProfileMeStoreValue((state) => state.avatarUri)

  // Get current avatar URI to pass to the hook
  const currentAvatarUri = getFirstDefined([storeAvatar, profile?.avatar])

  // Use the hook with arguments
  const { addPFP, asset, isUploading, reset } = useAddOrRemovePfp({
    currentImageUri: currentAvatarUri,
    onRemove: () => {
      reset()
      profileMeStore.getState().actions.setAvatarUri(null)
    },
  })

  // Priority for display: local asset (during upload) > store avatar > profile avatar
  const avatarUri = getFirstDefined([asset?.uri, storeAvatar, profile?.avatar])

  useEffect(() => {
    profileMeStore.getState().actions.setIsAvatarUploading(isUploading)
  }, [isUploading, profileMeStore])

  const addAvatar = useCallback(async () => {
    try {
      const url = await addPFP()
      if (url) {
        profileMeStore.getState().actions.setAvatarUri(url)
      }
    } catch (error) {
      if (error instanceof UserCancelledError) {
        return
      }
      captureErrorWithToast(
        new GenericError({ error, additionalMessage: "Failed to add avatar" }),
        {
          message: "Failed to add avatar",
        },
      )
    }
  }, [addPFP, profileMeStore])

  return (
    <ProfileContactCardEditableAvatar
      avatarUri={avatarUri}
      avatarName={profile?.name}
      onPress={addAvatar}
    />
  )
})
