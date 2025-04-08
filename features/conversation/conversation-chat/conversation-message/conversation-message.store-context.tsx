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

type IConversationMessageContextStoreProps = {
  message: IConversationMessage
  previousMessage: IConversationMessage | undefined
  nextMessage: IConversationMessage | undefined
}

type IConversationContextStoreState = {
  // message: IConversationMessage
  // previousMessage: IConversationMessage | undefined
  // nextMessage: IConversationMessage | undefined
  xmtpMessageId: IXmtpMessageId
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
    xmtpMessageId: props.message.xmtpId,
    isShowingTime: false,
    hasPreviousMessageInSeries: hasPreviousMessageInSeries({
      currentMessage: props.message,
      previousMessage: props.previousMessage,
    }),
    hasNextMessageInSeries: getHasNextMessageInSeries({
      currentMessage: props.message,
      nextMessage: props.nextMessage,
    }),
    fromMe: messageIsFromCurrentSenderInboxId({
      message: props.message,
    }),
    showDateChange: messageShouldShowDateChange({
      messageOne: props.message,
      messageTwo: props.previousMessage,
    }),
    isLastMessage: !props.nextMessage,
    isGroupUpdateMessage: isGroupUpdatedMessage(props.message),
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
    // const storeRef = useRef<MessageStore>()

    // if (!storeRef.current) {
    //   storeRef.current = createMessageStore(props)
    // } else {
    //   const storeCopy = getCalculatedState(props)
    //   storeRef.current?.setState(storeCopy)
    // }

    const store = useMemo(() => {
      return createMessageStore({
        message: props.message,
        previousMessage: props.previousMessage,
        nextMessage: props.nextMessage,
      })
    }, [props.message, props.previousMessage, props.nextMessage])

    // useEffect(() => {
    //   const storeCopy = getCalculatedState(props)
    //   storeRef.current?.setState(storeCopy)
    // }, [props])

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
