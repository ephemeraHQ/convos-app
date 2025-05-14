import React, { useCallback, useMemo } from "react"
import { Alert, ViewStyle } from "react-native"
import { DropdownMenu, IDropdownMenuAction } from "@/design-system/dropdown-menu/dropdown-menu"
import { HeaderAction } from "@/design-system/Header/HeaderAction"
import { useSafeCurrentSender } from "@/features/authentication/multi-inbox.store"
import { useClearDisappearingMessageSettings } from "@/features/disappearing-messages/clear-disappearing-message-settings.mutation"
import { useDisappearingMessageSettings } from "@/features/disappearing-messages/disappearing-message-settings.query"
import {
  DisappearingMessageDuration,
  IDisappearingMessageDuration,
  MIN_RETENTION_DURATION_NS,
} from "@/features/disappearing-messages/disappearing-messages.constants"
import { useUpdateDisappearingMessageSettings } from "@/features/disappearing-messages/update-disappearing-message-settings.mutation"
import { refetchConversationMessagesInfiniteQuery } from "@/features/conversation/conversation-chat/conversation-messages.query"
import { IXmtpConversationId } from "@/features/xmtp/xmtp.types"
import { ThemedStyle, useAppTheme } from "@/theme/use-app-theme"
import { captureErrorWithToast } from "@/utils/capture-error"
import { GenericError } from "@/utils/error"

type IDisappearingMessageOptionId =
  | "header"
  | "off"
  | IDisappearingMessageDuration
  | "clear_chat"
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
  {
    id: "clear_chat",
    title: "Clear Chat",
  },
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

        if (option.id === "clear_chat") {
          Alert.alert(
            "Clear Chat for Everyone",
            "This action is irreversible and will clear chat history for everyone. All participants will permanently lose access to the chat history.",
            [
              {
                text: "Cancel",
                style: "cancel",
              },
              {
                text: "Clear",
                style: "destructive",
                onPress: async () => {
                  try {
                    // Save current settings if they exist
                    const previousRetentionDurationInNs = settings?.retentionDurationInNs;

                    // Step 1: Clear all existing messages by setting minimal retention duration (1ns)
                    // and a special flag that uses earliest possible timestamp in XMTP protocol
                    await updateSettingsMutateAsync({
                      clientInboxId: currentSender.inboxId,
                      conversationId: xmtpConversationId,
                      retentionDurationInNs: MIN_RETENTION_DURATION_NS,
                      clearChat: true,
                    });

                    // Step 2: Restore previous settings if they existed, otherwise turn disappearing messages off
                    // This ensures we keep user's preferences for new messages after clearing chat history
                    if (previousRetentionDurationInNs && previousRetentionDurationInNs > 0) {
                      await updateSettingsMutateAsync({
                        clientInboxId: currentSender.inboxId,
                        conversationId: xmtpConversationId,
                        retentionDurationInNs: previousRetentionDurationInNs,
                      });
                    } else {
                      await clearSettingsMutateAsync({
                        clientInboxId: currentSender.inboxId,
                        conversationId: xmtpConversationId,
                      });
                    }
                    
                    // Refresh the conversation messages to immediately show cleared state
                    await refetchConversationMessagesInfiniteQuery({
                      clientInboxId: currentSender.inboxId,
                      xmtpConversationId,
                      caller: "ClearChatAction",
                    });
                    
                    Alert.alert("Chat Cleared", "Chat history has been cleared for everyone in the conversation")
                  } catch (error) {
                    captureErrorWithToast(
                      new GenericError({
                        error,
                        additionalMessage: "Failed to clear chat",
                      }),
                      {
                        message: "Failed to clear chat",
                      },
                    )
                  }
                },
              },
            ]
          )
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
      settings?.retentionDurationInNs,
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
