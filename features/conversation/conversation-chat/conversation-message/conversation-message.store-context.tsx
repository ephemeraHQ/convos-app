/**
 * This store/context is to avoid prop drilling in message components.
 */

import { IXmtpMessageId } from "@features/xmtp/xmtp.types"
import { createContext, memo, useContext, useMemo } from "react"
import { createStore, useStore } from "zustand"
import { subscribeWithSelector } from "zustand/middleware"
import { IConversationMessage } from "@/features/conversation/conversation-chat/conversation-message/conversation-message.types"
import { isGroupUpdatedMessage } from "@/features/conversation/conversation-chat/conversation-message/utils/conversation-message-assertions"
import { getHasNextMessageInSeries } from "@/features/conversation/utils/has-next-message-in-serie"
import { hasPreviousMessageInSeries } from "@/features/conversation/utils/has-previous-message-in-serie"
import { messageIsFromCurrentSenderInboxId } from "@/features/conversation/utils/message-is-from-current-user"
import { messageShouldShowDateChange } from "@/features/conversation/utils/message-should-show-date-change"
import { Nullable } from "@/types/general"

type IConversationMessageContextStoreProps = {
  currentMessage: IConversationMessage
  previousMessage: Nullable<IConversationMessage>
  nextMessage: Nullable<IConversationMessage>
}

type IConversationContextStoreState = IConversationMessageContextStoreProps & {
  currentMessageId: IXmtpMessageId
  previousMessageId: Nullable<IXmtpMessageId>
  nextMessageId: Nullable<IXmtpMessageId>
  isShowingTime: boolean
  hasPreviousMessageInSeries: boolean
  hasNextMessageInSeries: boolean
  fromMe: boolean
  showDateChange: boolean
  isLastMessage: boolean
  isGroupUpdateMessage: boolean
}

// Function to calculate derived state from props
function getCalculatedState(
  props: IConversationMessageContextStoreProps,
): IConversationContextStoreState {
  return {
    ...props,
    currentMessage: props.currentMessage,
    previousMessage: props.previousMessage,
    nextMessage: props.nextMessage,
    currentMessageId: props.currentMessage.xmtpId,
    previousMessageId: props.previousMessage?.xmtpId,
    nextMessageId: props.nextMessage?.xmtpId,
    isShowingTime: false,
    hasPreviousMessageInSeries: hasPreviousMessageInSeries({
      currentMessage: props.currentMessage,
      previousMessage: props.previousMessage,
    }),
    hasNextMessageInSeries: getHasNextMessageInSeries({
      currentMessage: props.currentMessage,
      nextMessage: props.nextMessage,
    }),
    fromMe: messageIsFromCurrentSenderInboxId({
      message: props.currentMessage,
    }),
    showDateChange: messageShouldShowDateChange({
      messageOne: props.currentMessage,
      messageTwo: props.previousMessage,
    }),
    isLastMessage: !props.nextMessage,
    isGroupUpdateMessage: isGroupUpdatedMessage(props.currentMessage),
  }
}

// Create a vanilla store for the message context
const createMessageStore = (initProps: IConversationMessageContextStoreProps) => {
  return createStore<IConversationContextStoreState>()(
    subscribeWithSelector((set) => ({
      ...getCalculatedState(initProps),
    })),
  )
}

type MessageStore = ReturnType<typeof createMessageStore>

const MessageStoreContext = createContext<MessageStore | null>(null)

export const ConversationMessageContextStoreProvider = memo(
  ({ children, ...props }: React.PropsWithChildren<IConversationMessageContextStoreProps>) => {
    // Using useMemo to prevent glitches from message list item rendering before the correct state is set
    const store = useMemo(() => {
      return createMessageStore({
        currentMessage: props.currentMessage,
        previousMessage: props.previousMessage,
        nextMessage: props.nextMessage,
      })
    }, [props.currentMessage, props.previousMessage, props.nextMessage])

    return <MessageStoreContext.Provider value={store}>{children}</MessageStoreContext.Provider>
  },
)

// Hook to get the store instance
export function useConversationMessageStore() {
  const store = useContext(MessageStoreContext)
  if (!store) throw new Error("Missing ConversationMessageContextStore.Provider in the tree")
  return store
}

// Hook to subscribe to store state with a selector
export function useConversationMessageContextSelector<T>(
  selector: (state: IConversationContextStoreState) => T,
): T {
  const store = useConversationMessageStore()
  return useStore(store, selector)
}
