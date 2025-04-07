/**
 * This store/context is to avoid prop drilling in message components.
 */

import { IXmtpInboxId, IXmtpMessageId } from "@features/xmtp/xmtp.types"
import { createContext, memo, useContext, useEffect, useRef } from "react"
import { createStore, useStore } from "zustand"
import { subscribeWithSelector } from "zustand/middleware"
import { isGroupUpdatedMessage } from "@/features/conversation/conversation-chat/conversation-message/utils/conversation-message-assertions"
import { hasPreviousMessageInSeries } from "@/features/conversation/utils/has-previous-message-in-serie"
import { messageIsFromCurrentSenderInboxId } from "@/features/conversation/utils/message-is-from-current-user"
import { convertNanosecondsToMilliseconds } from "@/utils/date"
import { isDifferent } from "@/utils/objects"
import { IConversationMessage } from "./conversation-message.types"

type IConversationMessageContextStoreProps = {
  message: IConversationMessage
  previousMessage: IConversationMessage | undefined
  nextMessage: IConversationMessage | undefined
}

type IConversationContextStoreState = {
  message: IConversationMessage
  previousMessage: IConversationMessage | undefined
  nextMessage: IConversationMessage | undefined
  xmtpMessageId: IXmtpMessageId
  hasPreviousMessageInSeries: boolean
  fromMe: boolean
  sentAtMs: number
  senderInboxId: IXmtpInboxId
  isShowingTime: boolean
  isSystemMessage: boolean
}

// Function to calculate derived state from props
function getCalculatedState(
  props: IConversationMessageContextStoreProps,
): IConversationContextStoreState {
  return {
    ...props,
    xmtpMessageId: props.message.xmtpId,
    hasPreviousMessageInSeries: hasPreviousMessageInSeries({
      currentMessage: props.message,
      previousMessage: props.previousMessage,
    }),
    fromMe: messageIsFromCurrentSenderInboxId({
      message: props.message,
    }),
    sentAtMs: Math.floor(convertNanosecondsToMilliseconds(props.message.sentNs)),
    senderInboxId: props.message.senderInboxId,
    isShowingTime: false,
    isSystemMessage: isGroupUpdatedMessage(props.message),
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
    const storeRef = useRef<MessageStore>()

    // Create the store once
    if (!storeRef.current) {
      storeRef.current = createMessageStore(props)
    }

    // Update store state when props change
    // Not happy with this solution because it means we'll first render with the old state...
    useEffect(() => {
      if (storeRef.current) {
        const newState = getCalculatedState(props)
        const currentState = storeRef.current.getState()
        if (isDifferent(currentState, newState)) {
          console.log("update")
          // logJson("newState", newState)

          storeRef.current.setState(newState)
        }
      }
    }, [props])

    return (
      <MessageStoreContext.Provider value={storeRef.current}>
        {children}
      </MessageStoreContext.Provider>
    )
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
