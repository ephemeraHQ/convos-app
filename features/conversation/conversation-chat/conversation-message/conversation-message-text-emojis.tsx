import { memo } from "react"
import { Text } from "@/design-system/Text"
import { textSizeStyles } from "@/design-system/Text/Text.styles"
import { VStack } from "@/design-system/VStack"
import { ConversationMessageGestures } from "@/features/conversation/conversation-chat/conversation-message/conversation-message-gestures"
import { useConversationMessageContextSelector } from "@/features/conversation/conversation-chat/conversation-message/conversation-message.store-context"
import { IConversationMessageText } from "@/features/conversation/conversation-chat/conversation-message/conversation-message.types"

export const ConversationMessageTextEmojis = memo(
  function ConversationMessageSimpleTextWithReactions(props: {
    message: IConversationMessageText
  }) {
    const { message } = props

    const fromMe = useConversationMessageContextSelector((state) => state.fromMe)

    return (
      <VStack
        style={{
          alignItems: fromMe ? "flex-end" : "flex-start",
        }}
      >
        <ConversationMessageGestures>
          <Text style={textSizeStyles["5xl"]}>{message.content.text}</Text>
        </ConversationMessageGestures>
      </VStack>
    )
  },
)
