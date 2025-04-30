import { useCallback } from "react"
import { Avatar } from "@/components/avatar"
import { Pressable } from "@/design-system/Pressable"
import { useConversationMessageContextSelector } from "@/features/conversation/conversation-chat/conversation-message/conversation-message.store-context"
import { useConversationMessageStyles } from "@/features/conversation/conversation-chat/conversation-message/conversation-message.styles"
import { usePreferredDisplayInfo } from "@/features/preferred-display-info/use-preferred-display-info"
import { useRouter } from "@/navigation/use-navigation"
import { useAppTheme } from "@/theme/use-app-theme"

export function ConversationSenderAvatar() {
  const { theme } = useAppTheme()

  const currentMessageSenderInboxId = useConversationMessageContextSelector(
    (s) => s.currentMessage.senderInboxId,
  )

  const { senderAvatarSize } = useConversationMessageStyles()
  const { displayName, avatarUrl } = usePreferredDisplayInfo({
    inboxId: currentMessageSenderInboxId,
    caller: "ConversationSenderAvatar",
  })

  const router = useRouter()

  const openProfile = useCallback(() => {
    router.push("Profile", { inboxId: currentMessageSenderInboxId })
  }, [currentMessageSenderInboxId, router])

  return (
    <Pressable onPress={openProfile} hitSlop={theme.spacing.xxxs}>
      <Avatar sizeNumber={senderAvatarSize} uri={avatarUrl} name={displayName ?? ""} />
    </Pressable>
  )
}
