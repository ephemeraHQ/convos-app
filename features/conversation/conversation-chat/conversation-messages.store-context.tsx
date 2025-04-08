import { createContext, memo, useContext, useRef } from "react"
import { createStore, useStore } from "zustand"
import { IXmtpMessageId } from "@/features/xmtp/xmtp.types"

type IConversationMessagesStoreProps = {
  latestXmtpMessageIdFromCurrentSender: IXmtpMessageId | null
}

type IConversationMessagesStoreState = IConversationMessagesStoreProps & {}

type IConversationMessagesStoreProviderProps =
  React.PropsWithChildren<IConversationMessagesStoreProps>

type IConversationMessagesStore = ReturnType<typeof createConversationMessagesStore>

export const ConversationMessagesStoreProvider = memo(
  ({ children, ...props }: IConversationMessagesStoreProviderProps) => {
    const storeRef = useRef<IConversationMessagesStore>()
    if (!storeRef.current) {
      storeRef.current = createConversationMessagesStore(props)
    }
    return (
      <ConversationMessagesStoreContext.Provider value={storeRef.current}>
        {children}
      </ConversationMessagesStoreContext.Provider>
    )
  },
)

const createConversationMessagesStore = (initProps: IConversationMessagesStoreProps) => {
  const DEFAULT_PROPS: IConversationMessagesStoreProps = {
    latestXmtpMessageIdFromCurrentSender: null,
  }
  return createStore<IConversationMessagesStoreState>()((set) => ({
    ...DEFAULT_PROPS,
    ...initProps,
  }))
}

const ConversationMessagesStoreContext = createContext<IConversationMessagesStore | null>(null)

export function useConversationMessagesStoreContext<T>(
  selector: (state: IConversationMessagesStoreState) => T,
): T {
  const store = useContext(ConversationMessagesStoreContext)
  if (!store) throw new Error("Missing ConversationMessagesStore.Provider in the tree")
  return useStore(store, selector)
}

export function useConversationMessagesStore() {
  const store = useContext(ConversationMessagesStoreContext)
  if (!store) throw new Error()
  return store
}
