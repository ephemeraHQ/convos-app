import React, { useCallback, useMemo } from "react"
import { ViewStyle } from "react-native"
import { DropdownMenu, IDropdownMenuAction } from "@/design-system/dropdown-menu/dropdown-menu"
import { HeaderAction } from "@/design-system/Header/HeaderAction"
import { useSafeCurrentSender } from "@/features/authentication/multi-inbox.store"
import { useClearDisappearingMessageSettings } from "@/features/disappearing-messages/clear-disappearing-message-settings.mutation"
import { useDisappearingMessageSettings } from "@/features/disappearing-messages/disappearing-message-settings.query"
import { DisappearingMessageDuration } from "@/features/disappearing-messages/disappearing-messages.constants"
import { useUpdateDisappearingMessageSettings } from "@/features/disappearing-messages/update-disappearing-message-settings.mutation"
import { IXmtpConversationId } from "@/features/xmtp/xmtp.types"
import { ThemedStyle, useAppTheme } from "@/theme/use-app-theme"
import { captureErrorWithToast } from "@/utils/capture-error"
import { GenericError } from "@/utils/error"

type IDisappearingMessageOptionId =
  | "header"
  | "off"
  | "sixty_days"
  | "thirty_days"
  | "one_week"
  | "one_day"
  | "eight_hours"
  | "one_hour"
  | "one_minute"
  | "ten_seconds"
  | "one_second"
  | "clear"

type IDisappearingMessageOptionItem = Omit<IDropdownMenuAction, "id"> & {
  id: IDisappearingMessageOptionId
  retentionDurationInNs?: number
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
  {
    id: "sixty_days",
    title: "60 days",
    retentionDurationInNs: DisappearingMessageDuration.SIXTY_DAYS,
  },
  {
    id: "thirty_days",
    title: "30 days",
    retentionDurationInNs: DisappearingMessageDuration.THIRTY_DAYS,
  },
  {
    id: "one_week",
    title: "7 days",
    retentionDurationInNs: DisappearingMessageDuration.ONE_WEEK,
  },
  {
    id: "one_day",
    title: "24 hours",
    retentionDurationInNs: DisappearingMessageDuration.ONE_DAY,
  },
  {
    id: "eight_hours",
    title: "8 hours",
    retentionDurationInNs: DisappearingMessageDuration.EIGHT_HOURS,
  },
  {
    id: "one_hour",
    title: "1 hour",
    retentionDurationInNs: DisappearingMessageDuration.ONE_HOUR,
  },
  {
    id: "one_minute",
    title: "1 minute",
    retentionDurationInNs: DisappearingMessageDuration.ONE_MINUTE,
  },
  {
    id: "ten_seconds",
    title: "10 seconds",
    retentionDurationInNs: DisappearingMessageDuration.TEN_SECONDS,
  },
  {
    id: "one_second",
    title: "1 second",
    retentionDurationInNs: DisappearingMessageDuration.ONE_SECOND,
  },
  {
    displayInline: true,
    id: "clear",
    title: "Clear chat",
  },
]

type DisappearingMessagesHeaderActionProps = {
  xmtpConversationId: IXmtpConversationId
}

export const DisappearingMessagesHeaderAction = ({
  xmtpConversationId,
}: DisappearingMessagesHeaderActionProps) => {
  const { theme, themed } = useAppTheme()
  const currentSender = useSafeCurrentSender()
  const { mutateAsync: updateSettingsMutateAsync } = useUpdateDisappearingMessageSettings()
  const { mutateAsync: clearSettingsMutateAsync } = useClearDisappearingMessageSettings()

  const { data: settings } = useDisappearingMessageSettings({
    clientInboxId: currentSender.inboxId,
    conversationId: xmtpConversationId,
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
          ? !settings?.retentionDurationInNs
            ? "checkmark"
            : ""
          : settings?.retentionDurationInNs &&
              option.retentionDurationInNs === settings?.retentionDurationInNs
            ? "checkmark"
            : "",
    }))
  }, [settings?.retentionDurationInNs])

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
