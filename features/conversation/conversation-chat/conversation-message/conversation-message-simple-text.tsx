import { Text } from "@design-system/Text"
import { textSizeStyles } from "@design-system/Text/Text.styles"
import { VStack } from "@design-system/VStack"
import emojiRegex from "emoji-regex"
import { memo } from "react"
import {
  BubbleContainer,
  BubbleContentContainer,
} from "@/features/conversation/conversation-chat/conversation-message/conversation-message-bubble"
import { ConversationMessageGestures } from "@/features/conversation/conversation-chat/conversation-message/conversation-message-gestures"
import { MessageText } from "@/features/conversation/conversation-chat/conversation-message/conversation-message-text"
import { useConversationMessageContextSelector } from "@/features/conversation/conversation-chat/conversation-message/conversation-message.store-context"
import { IConversationMessageText } from "./conversation-message.types"

export const ConversationMessageSimpleText = memo(function ConversationMessageSimpleText(props: {
  message: IConversationMessageText
}) {
  const { message } = props

  const fromMe = useConversationMessageContextSelector((state) => state.fromMe)

  if (shouldRenderBigEmoji(message.content.text)) {
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
  }

  return (
    <BubbleContainer>
      <ConversationMessageGestures>
        <BubbleContentContainer>
          <MessageText inverted={fromMe}>{message.content.text}</MessageText>
        </BubbleContentContainer>
      </ConversationMessageGestures>
    </BubbleContainer>
  )
})

// Compile emoji regex once
const compiledEmojiRegex = emojiRegex()

const shouldRenderBigEmoji = (text: string) => {
  const trimmedContent = text.trim()
  const emojis = trimmedContent.match(compiledEmojiRegex) || []

  const hasEmojis = emojis.length > 0
  const hasFewerThanFourEmojis = emojis.length < 4
  const containsOnlyEmojis = emojis.join("") === trimmedContent

  return hasEmojis && hasFewerThanFourEmojis && containsOnlyEmojis
}
