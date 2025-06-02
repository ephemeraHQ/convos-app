import React, { useCallback, useMemo } from "react"
import { ViewStyle } from "react-native"
import { DropdownMenu, IDropdownMenuAction } from "@/design-system/dropdown-menu/dropdown-menu"
import { HeaderAction } from "@/design-system/Header/HeaderAction"
import { useSafeCurrentSender } from "@/features/authentication/multi-inbox.store"
import { useClearDisappearingMessageSettings } from "@/features/disappearing-messages/clear-disappearing-message-settings.mutation"
import { useDisappearingMessageSettingsQuery } from "@/features/disappearing-messages/disappearing-message-settings.query"
import {
  DisappearingMessageDuration,
  IDisappearingMessageDuration,
} from "@/features/disappearing-messages/disappearing-messages.constants"
import { useUpdateDisappearingMessageSettings } from "@/features/disappearing-messages/update-disappearing-message-settings.mutation"
import { IXmtpConversationId } from "@/features/xmtp/xmtp.types"
import { ThemedStyle, useAppTheme } from "@/theme/use-app-theme"
import { captureErrorWithToast } from "@/utils/capture-error"
import { GenericError } from "@/utils/error"

type IDisappearingMessageOptionId =
  | "header"
  | "off"
  | IDisappearingMessageDuration
  | "clear"
  | "how_it_works"

type IDisappearingMessageOptionItem = Omit<IDropdownMenuAction, "id"> & {
  id: IDisappearingMessageOptionId
  retentionDurationInNs?: number
}

const createDurationOptions = () => {
  return Object.entries(DisappearingMessageDuration).map(([key, entry]) => ({
    id: key as IDisappearingMessageDuration,
    title: entry.text,
    retentionDurationInNs: entry.value,
  }))
}

const DISAPPEARING_MESSAGE_OPTIONS: IDisappearingMessageOptionItem[] = [
  {
    displayInline: true,
    id: "header",
    title: "",
    subtitle: "New messages will disappear after the selected duration",
  },
  {
    id: "off",
    title: "Off",
  },
  ...createDurationOptions(),
]

type DisappearingMessagesHeaderActionProps = {
  xmtpConversationId: IXmtpConversationId
}

export const DisappearingMessagesHeaderAction = ({
  xmtpConversationId,
}: DisappearingMessagesHeaderActionProps) => {
  const { themed } = useAppTheme()
  const currentSender = useSafeCurrentSender()
  const { mutateAsync: updateSettingsMutateAsync } = useUpdateDisappearingMessageSettings()
  const { mutateAsync: clearSettingsMutateAsync } = useClearDisappearingMessageSettings()

  const { data: disappearingMessageSettings } = useDisappearingMessageSettingsQuery({
    clientInboxId: currentSender.inboxId,
    xmtpConversationId: xmtpConversationId,
    caller: "DisappearingMessagesHeaderAction",
  })

  const handleMenuPress = useCallback(
    async (opitonId: string) => {
      try {
        const option = DISAPPEARING_MESSAGE_OPTIONS.find((option) => option.id === opitonId)

        if (!option) {
          throw new Error("Invalid option")
        }

        if (option.id === "header") {
          return
        }

        if (option.id === "off") {
          await clearSettingsMutateAsync({
            clientInboxId: currentSender.inboxId,
            conversationId: xmtpConversationId,
          })
          return
        }

        if (option.id === "clear") {
          // TODO: Implement clear chat
          return
        }

        if (option.id === "how_it_works") {
          // TODO: Implement how it works
          return
        }

        if (!option.retentionDurationInNs) {
          throw new Error("Missing retention duration")
        }

        await updateSettingsMutateAsync({
          clientInboxId: currentSender.inboxId,
          conversationId: xmtpConversationId,
          retentionDurationInNs: option.retentionDurationInNs,
        })
      } catch (error) {
        captureErrorWithToast(
          new GenericError({
            error,
            additionalMessage: "Failed to update disappearing message settings",
          }),
          {
            message: "Failed to update disappearing message settings",
          },
        )
      }
    },
    [
      currentSender.inboxId,
      xmtpConversationId,
      updateSettingsMutateAsync,
      clearSettingsMutateAsync,
    ],
  )

  const menuActions = useMemo(() => {
    return DISAPPEARING_MESSAGE_OPTIONS.map((option) => ({
      ...option,
      // Add a checkmark icon if this is the current selection
      // For "off" option, show checkmark when there are no settings
      image:
        option.id === "off"
          ? !disappearingMessageSettings?.retentionDurationInNs
            ? "checkmark"
            : ""
          : disappearingMessageSettings?.retentionDurationInNs &&
              option.retentionDurationInNs === disappearingMessageSettings?.retentionDurationInNs
            ? "checkmark"
            : "",
    }))
  }, [disappearingMessageSettings?.retentionDurationInNs])

  return (
    <DropdownMenu actions={menuActions} onPress={handleMenuPress} style={themed($menuContainer)}>
      <HeaderAction disabled={false} icon="timer" />
    </DropdownMenu>
  )
}

const $menuContainer: ThemedStyle<ViewStyle> = (theme) => ({
  alignItems: "center",
  justifyContent: "center",
})
