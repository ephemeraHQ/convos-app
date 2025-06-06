import { memo } from "react"
import {
  BubbleContainer,
  BubbleContentContainer,
} from "@/features/conversation/conversation-chat/conversation-message/conversation-message-bubble"
import { ConversationMessageGestures } from "@/features/conversation/conversation-chat/conversation-message/conversation-message-gestures"
import { ConversationMessageSimpleText } from "@/features/conversation/conversation-chat/conversation-message/conversation-message-simple-text"
import { useConversationMessageContextSelector } from "@/features/conversation/conversation-chat/conversation-message/conversation-message.store-context"
import { IConversationMessageText } from "./conversation-message.types"

export const ConversationMessageText = memo(function ConversationMessageText(props: {
  message: IConversationMessageText
}) {
  const { message } = props

  const fromMe = useConversationMessageContextSelector((state) => state.fromMe)

  return (
    <BubbleContainer>
      <ConversationMessageGestures>
        <BubbleContentContainer>
          <ConversationMessageSimpleText inverted={fromMe}>
            {message.content.text}
          </ConversationMessageSimpleText>
        </BubbleContentContainer>
      </ConversationMessageGestures>
    </BubbleContainer>
  )
})
