import { Text } from "@design-system/Text"
import { useCallback } from "react"
import { Pressable } from "@/design-system/Pressable"
import { useConversationMessageContextSelector } from "@/features/conversation/conversation-chat/conversation-message/conversation-message.store-context"
import { usePreferredDisplayInfo } from "@/features/preferred-display-info/use-preferred-display-info"
import { useRouter } from "@/navigation/use-navigation"
import { useAppTheme } from "@/theme/use-app-theme"

export function ConversationMessageSenderName() {
  const currentMessageSenderInboxId = useConversationMessageContextSelector(
    (s) => s.currentMessage.senderInboxId,
  )

  const { theme } = useAppTheme()

  const { displayName } = usePreferredDisplayInfo({
    inboxId: currentMessageSenderInboxId,
  })

  const router = useRouter()

  const openProfile = useCallback(() => {
    router.push("Profile", {
      inboxId: currentMessageSenderInboxId,
    })
  }, [currentMessageSenderInboxId, router])

  return (
    <Pressable hitSlop={theme.spacing.xxxs} onPress={openProfile}>
      <Text preset="smaller" color="secondary">
        {displayName ??
          // Add empty space so that the component height doesn't
          " "}
      </Text>
    </Pressable>
  )
}
