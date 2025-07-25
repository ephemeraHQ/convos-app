import { memo, useCallback, useMemo } from "react"
import { Modal, Platform, StyleSheet } from "react-native"
import { useDropdownMenuCustomStyles } from "@/design-system/dropdown-menu/dropdown-menu-custom"
import { AnimatedVStack, VStack } from "@/design-system/VStack"
import { useSafeCurrentSender } from "@/features/authentication/multi-inbox.store"
import { ConversationMessage } from "@/features/conversation/conversation-chat/conversation-message/conversation-message"
import { MessageContextMenuBackdrop } from "@/features/conversation/conversation-chat/conversation-message/conversation-message-context-menu/conversation-message-context-menu-backdrop"
import { MessageContextMenuEmojiPicker } from "@/features/conversation/conversation-chat/conversation-message/conversation-message-context-menu/conversation-message-context-menu-emoji-picker/conversation-message-context-menu-emoji-picker"
import { openMessageContextMenuEmojiPicker } from "@/features/conversation/conversation-chat/conversation-message/conversation-message-context-menu/conversation-message-context-menu-emoji-picker/conversation-message-context-menu-emoji-picker-utils"
import { MessageContextMenuItems } from "@/features/conversation/conversation-chat/conversation-message/conversation-message-context-menu/conversation-message-context-menu-items"
import { MessageContextMenuReactors } from "@/features/conversation/conversation-chat/conversation-message/conversation-message-context-menu/conversation-message-context-menu-reactors"
import {
  IConversationMessageContextMenuStoreState,
  useConversationMessageContextMenuStore,
  useConversationMessageContextMenuStoreContext,
} from "@/features/conversation/conversation-chat/conversation-message/conversation-message-context-menu/conversation-message-context-menu.store-context"
import { useConversationMessageContextMenuStyles } from "@/features/conversation/conversation-chat/conversation-message/conversation-message-context-menu/conversation-message-context-menu.styles"
import { useConversationMessageReactionsQuery } from "@/features/conversation/conversation-chat/conversation-message/conversation-message-reactions.query"
import { getConversationMessageQueryData } from "@/features/conversation/conversation-chat/conversation-message/conversation-message.query"
import { ConversationMessageContextStoreProvider } from "@/features/conversation/conversation-chat/conversation-message/conversation-message.store-context"
import { getAllConversationMessageIds } from "@/features/conversation/conversation-chat/conversation-messages-simple.query"
import { useCurrentXmtpConversationIdSafe } from "@/features/conversation/conversation-chat/conversation.store-context"
import { useReactOnMessage } from "@/features/conversation/conversation-chat/use-react-on-message.mutation"
import { useRemoveReactionOnMessage } from "@/features/conversation/conversation-chat/use-remove-reaction-on-message.mutation"
import { messageIsFromCurrentSenderInboxId } from "@/features/conversation/utils/message-is-from-current-user"
import { getCurrentUserAlreadyReactedOnMessage } from "../utils/get-current-user-already-reacted-on-message"
import { MessageContextMenuAboveMessageReactions } from "./conversation-message-context-menu-above-message-reactions"
import { MessageContextMenuContainer } from "./conversation-message-context-menu-container"
import { useMessageContextMenuItems } from "./conversation-message-context-menu.utils"

export const ConversationMessageContextMenu = memo(function ConversationMessageContextMenu() {
  const messageContextMenuData = useConversationMessageContextMenuStoreContext(
    (state) => state.messageContextMenuData,
  )

  if (!messageContextMenuData) {
    return null
  }

  return <ConversationMessageContextMenuContent messageContextMenuData={messageContextMenuData} />
})

const ConversationMessageContextMenuContent = memo(
  function ConversationMessageContextMenuContent(props: {
    messageContextMenuData: NonNullable<
      IConversationMessageContextMenuStoreState["messageContextMenuData"]
    >
  }) {
    const { messageContextMenuData } = props

    const { messageId, itemRectX, itemRectY, itemRectHeight, itemRectWidth } =
      messageContextMenuData

    const xmtpConversationId = useCurrentXmtpConversationIdSafe()
    const messageContextMenuStore = useConversationMessageContextMenuStore()
    const currentSender = useSafeCurrentSender()

    const { data: reactions } = useConversationMessageReactionsQuery({
      clientInboxId: currentSender.inboxId,
      xmtpMessageId: messageId,
    })

    const { message, previousMessage, nextMessage } = useMemo(() => {
      const message = getConversationMessageQueryData({
        xmtpMessageId: messageId,
        clientInboxId: currentSender.inboxId,
        xmtpConversationId,
      })

      const messageIds =
        getAllConversationMessageIds({
          clientInboxId: currentSender.inboxId,
          xmtpConversationId,
        }) || []

      const messageIndex = messageIds.findIndex((m) => m === messageId)

      const nextMessageId = messageIndex ? messageIds[messageIndex + 1] : undefined
      const previousMessageId = messageIndex ? messageIds[messageIndex - 1] : undefined

      const nextMessage = nextMessageId
        ? getConversationMessageQueryData({
            xmtpMessageId: nextMessageId,
            clientInboxId: currentSender.inboxId,
            xmtpConversationId,
          })
        : undefined

      const previousMessage = previousMessageId
        ? getConversationMessageQueryData({
            xmtpMessageId: previousMessageId,
            clientInboxId: currentSender.inboxId,
            xmtpConversationId,
          })
        : undefined

      return {
        message,
        previousMessage,
        nextMessage,
      }
    }, [messageId, xmtpConversationId, currentSender])

    const fromMe = Boolean(message && messageIsFromCurrentSenderInboxId({ message }))
    const menuItems = useMessageContextMenuItems({
      messageId: messageId,
      xmtpConversationId,
    })

    const { itemHeight } = useDropdownMenuCustomStyles()
    const menuHeight = itemHeight * menuItems.length

    const { reactOnMessage } = useReactOnMessage({
      xmtpConversationId,
    })
    const { removeReactionOnMessage } = useRemoveReactionOnMessage({
      xmtpConversationId,
    })

    const handlePressBackdrop = useCallback(() => {
      messageContextMenuStore.getState().setMessageContextMenuData(null)
    }, [messageContextMenuStore])

    const handleSelectReaction = useCallback(
      (emoji: string) => {
        const currentUserAlreadyReacted = getCurrentUserAlreadyReactedOnMessage({
          messageId,
          emoji,
        })

        if (currentUserAlreadyReacted) {
          removeReactionOnMessage({
            messageId: messageId,
            emoji,
          })
        } else {
          reactOnMessage({ messageId: messageId, emoji })
        }
        messageContextMenuStore.getState().setMessageContextMenuData(null)
      },
      [reactOnMessage, messageId, removeReactionOnMessage, messageContextMenuStore],
    )

    const handleChooseMoreEmojis = useCallback(() => {
      openMessageContextMenuEmojiPicker()
    }, [])

    const hasReactions = Boolean(reactions && Object.keys(reactions.bySender).length > 0)

    const { verticalSpaceBetweenSections } = useConversationMessageContextMenuStyles()

    return (
      <>
        <Modal
          visible={true}
          transparent={true}
          animationType="fade"
          statusBarTranslucent={Platform.OS === "android"}
        >
          <AnimatedVStack style={StyleSheet.absoluteFill}>
            <MessageContextMenuBackdrop handlePressBackdrop={handlePressBackdrop}>
              <AnimatedVStack style={StyleSheet.absoluteFill}>
                {!!reactions && <MessageContextMenuReactors reactors={reactions.bySender} />}
                <MessageContextMenuContainer
                  itemRectY={itemRectY}
                  itemRectX={itemRectX}
                  itemRectHeight={itemRectHeight}
                  itemRectWidth={itemRectWidth}
                  menuHeight={menuHeight}
                  fromMe={fromMe}
                  hasReactions={hasReactions}
                >
                  <MessageContextMenuAboveMessageReactions
                    reactors={reactions?.bySender ?? {}}
                    messageId={messageId}
                    onChooseMoreEmojis={handleChooseMoreEmojis}
                    onSelectReaction={handleSelectReaction}
                    originX={fromMe ? itemRectX + itemRectWidth : itemRectX}
                    originY={itemRectHeight}
                  />

                  {/* Replace with rowGap when we refactored menu items and not using rn-paper TableView */}
                  <VStack
                    style={{
                      height: verticalSpaceBetweenSections,
                    }}
                  />

                  {message && (
                    <ConversationMessageContextStoreProvider
                      currentMessage={message}
                      nextMessage={nextMessage}
                      previousMessage={previousMessage}
                    >
                      {/* TODO: maybe make ConversationMessage more dumb to not need any context? */}
                      <ConversationMessage />
                    </ConversationMessageContextStoreProvider>
                  )}

                  <MessageContextMenuItems
                    originX={fromMe ? itemRectX + itemRectWidth : itemRectX}
                    originY={itemRectHeight}
                    menuItems={menuItems}
                  />
                </MessageContextMenuContainer>
              </AnimatedVStack>
            </MessageContextMenuBackdrop>
          </AnimatedVStack>
        </Modal>
        <MessageContextMenuEmojiPicker onSelectReaction={handleSelectReaction} />
      </>
    )
  },
)
