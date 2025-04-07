import React, { memo } from "react"
import { FlatList, Platform } from "react-native"
import { ActivityIndicator } from "@/design-system/activity-indicator"
import { Center } from "@/design-system/Center"
import { EmptyState } from "@/design-system/empty-state"
import { Text } from "@/design-system/Text"
import { VStack } from "@/design-system/VStack"
import {
  getSafeCurrentSender,
  useSafeCurrentSender,
} from "@/features/authentication/multi-inbox.store"
import { ConversationMessage } from "@/features/conversation/conversation-chat/conversation-message/conversation-message"
import { ConversationMessageContextMenuStoreProvider } from "@/features/conversation/conversation-chat/conversation-message/conversation-message-context-menu/conversation-message-context-menu.store-context"
import { ConversationMessageLayout } from "@/features/conversation/conversation-chat/conversation-message/conversation-message-layout"
import { ConversationMessageReactions } from "@/features/conversation/conversation-chat/conversation-message/conversation-message-reactions/conversation-message-reactions"
import { ConversationMessageTimestamp } from "@/features/conversation/conversation-chat/conversation-message/conversation-message-timestamp"
import { ConversationMessageContextStoreProvider } from "@/features/conversation/conversation-chat/conversation-message/conversation-message.store-context"
import { useConversationMessagesInfiniteQueryAllMessageIds } from "@/features/conversation/conversation-chat/conversation-messages.query"
import { ConversationStoreProvider } from "@/features/conversation/conversation-chat/conversation.store-context"
import { useConversationQuery } from "@/features/conversation/queries/conversation.query"
import { IXmtpConversationId, IXmtpMessageId } from "@/features/xmtp/xmtp.types"
import { $globalStyles } from "@/theme/styles"
import { useConversationMessageQuery } from "../conversation-chat/conversation-message/conversation-message.query"
import { useMessageHasReactions } from "../conversation-chat/conversation-message/hooks/use-message-has-reactions"

type ConversationPreviewProps = {
  xmtpConversationId: IXmtpConversationId
}

export const ConversationPreview = ({ xmtpConversationId }: ConversationPreviewProps) => {
  const currentSender = getSafeCurrentSender()

  const { data: messageIds = [], isLoading: isLoadingMessages } =
    useConversationMessagesInfiniteQueryAllMessageIds({
      clientInboxId: currentSender.inboxId,
      xmtpConversationId,
      caller: "Conversation Preview",
    })

  const { data: conversation, isLoading: isLoadingConversation } = useConversationQuery({
    clientInboxId: currentSender.inboxId,
    xmtpConversationId,
    caller: "Conversation Preview",
  })

  const isLoading = isLoadingMessages || isLoadingConversation

  return (
    <VStack style={$globalStyles.flex1}>
      {isLoading ? (
        <Center style={$globalStyles.flex1}>
          <ActivityIndicator />
        </Center>
      ) : !conversation ? (
        <Center style={$globalStyles.flex1}>
          <Text>Conversation not found</Text>
        </Center>
      ) : messageIds?.length === 0 ? (
        <Center style={$globalStyles.flex1}>
          <EmptyState title="Empty conversation" description="This conversation has no messages" />
        </Center>
      ) : (
        // Shouldn't need this provider here but for now we need it because we use ConversationMessageGestures inside ConversationMessage
        <ConversationMessageContextMenuStoreProvider>
          <ConversationStoreProvider xmtpConversationId={xmtpConversationId}>
            {/* Using basic Flatlist instead of the Animated one to try to fix the context menu crashes https://github.com/dominicstop/react-native-ios-context-menu/issues/70 */}
            <FlatList
              style={$globalStyles.flex1}
              inverted={true}
              keyboardDismissMode="interactive"
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={Platform.OS === "ios"} // Size glitch on Android
              keyExtractor={keyExtractor}
              // 15 is enough
              data={messageIds?.slice(0, 15)}
              renderItem={({ item, index }) => {
                const message = item
                const previousMessage = messageIds[index + 1]
                const nextMessage = messageIds[index - 1]

                return (
                  <MessageWrapper
                    messageId={message}
                    previousMessageId={previousMessage}
                    nextMessageId={nextMessage}
                  />
                )
              }}
            />
          </ConversationStoreProvider>
        </ConversationMessageContextMenuStoreProvider>
      )}
    </VStack>
  )
}

function keyExtractor(messageId: IXmtpMessageId) {
  return messageId
}

const MessageWrapper = memo(function MessageWrapper({
  messageId,
  previousMessageId,
  nextMessageId,
}: {
  messageId: IXmtpMessageId
  previousMessageId: IXmtpMessageId | undefined
  nextMessageId: IXmtpMessageId | undefined
}) {
  const currentSender = useSafeCurrentSender()

  const hasReactions = useMessageHasReactions({
    xmtpMessageId: messageId,
  })

  const { data: message } = useConversationMessageQuery({
    xmtpMessageId: messageId,
    clientInboxId: currentSender.inboxId,
  })

  const { data: previousMessage } = useConversationMessageQuery({
    xmtpMessageId: previousMessageId,
    clientInboxId: currentSender.inboxId,
  })

  const { data: nextMessage } = useConversationMessageQuery({
    xmtpMessageId: nextMessageId,
    clientInboxId: currentSender.inboxId,
  })

  if (!message) {
    return null
  }

  return (
    <ConversationMessageContextStoreProvider
      message={message}
      previousMessage={previousMessage ?? undefined}
      nextMessage={nextMessage ?? undefined}
    >
      <VStack>
        <ConversationMessageTimestamp />
        <ConversationMessageLayout
          message={<ConversationMessage />}
          reactions={hasReactions && <ConversationMessageReactions />}
        />
      </VStack>
    </ConversationMessageContextStoreProvider>
  )
})
