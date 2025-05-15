import { createContext, memo, useContext, useEffect, useRef } from "react"
import { createStore, useStore } from "zustand"
import { createJSONStorage, persist, subscribeWithSelector } from "zustand/middleware"
import { IConversationMessageRemoteAttachmentContent } from "@/features/conversation/conversation-chat/conversation-message/conversation-message.types"
import { useCurrentXmtpConversationId } from "@/features/conversation/conversation-chat/conversation.store-context"
import { IXmtpConversationId, IXmtpMessageId } from "@/features/xmtp/xmtp.types"
import { usePrevious } from "@/hooks/use-previous-value"
import { getZustandStorage } from "@/utils/zustand/zustand"

export type IComposerAttachmentStatus = "picked" | "uploading" | "error" | "uploaded"

export type IComposerMediaPreview = {
  mediaURI: string
  mediaType: string
  mediaDuration?: number
  mediaDimensions?: { width: number; height: number }
}

export type IComposerAttachmentPicked = IComposerMediaPreview & {
  status: "picked"
}

export type IComposerAttachmentError = IComposerMediaPreview & {
  status: "error"
  error: string
}

export type IComposerAttachmentUploading = IComposerMediaPreview & {
  status: "uploading"
}

export type IComposerAttachmentUploaded = IComposerMediaPreview &
  IConversationMessageRemoteAttachmentContent & {
    status: "uploaded"
    // secret: string
    // salt: string
    // nonce: string
    // contentDigest: string

    // scheme: "https://"
    // url: string
    // contentLength: string
    // url: string
    // type: string
    // name: string
    // size: number
  }

export type IComposerAttachment =
  | IComposerAttachmentPicked
  | IComposerAttachmentUploading
  | IComposerAttachmentError
  | IComposerAttachmentUploaded

type IConversationComposerStoreProps = {
  inputValue?: string
}

type IConversationComposerState = IConversationComposerStoreProps & {
  inputValue: string
  replyingToMessageId: IXmtpMessageId | null
  composerAttachments: IComposerAttachment[]
}

type IConversationComposerActions = {
  reset: () => void
  setInputValue: (value: string) => void
  setReplyToMessageId: (messageId: IXmtpMessageId | null) => void
  addComposerAttachment: (attachment: IComposerAttachment) => void
  removeComposerAttachment: (mediaURI: string) => void
  updateComposerAttachment: (args: {
    mediaURI: string
    attachment: Partial<IComposerAttachment>
  }) => void
}

type IConversationComposerStoreState = IConversationComposerState & IConversationComposerActions

type IConversationComposerStoreProviderProps =
  React.PropsWithChildren<IConversationComposerStoreProps>

type IConversationComposerStore = ReturnType<typeof createConversationComposerStore>

export const ConversationComposerStoreProvider = memo(
  ({ children, inputValue, ...props }: IConversationComposerStoreProviderProps) => {
    const storeRef = useRef<IConversationComposerStore>()
    const xmtpConversationId = useCurrentXmtpConversationId()
    const previousConversationId = usePrevious(xmtpConversationId)

    // Initialize store on mount
    if (!storeRef.current) {
      storeRef.current = createConversationComposerStore({
        inputValue,
        storeName: getStoreName(xmtpConversationId),
        ...props,
      })
    }

    // Handle conversation changes
    useEffect(() => {
      const store = storeRef.current

      if (!store) {
        return
      }

      if (xmtpConversationId !== previousConversationId) {
        // Update the store name for the new conversation
        store.persist.setOptions({
          name: getStoreName(xmtpConversationId),
        })

        // Reset state for new conversation
        store.setState({
          inputValue: inputValue ?? "",
          composerAttachments: [],
          replyingToMessageId: null,
        })
      }
    }, [xmtpConversationId, previousConversationId, inputValue])

    return (
      <ConversationComposerStoreContext.Provider value={storeRef.current}>
        {children}
      </ConversationComposerStoreContext.Provider>
    )
  },
)

const createConversationComposerStore = (
  initProps: IConversationComposerStoreProps & { storeName: string },
) => {
  const DEFAULT_STATE: IConversationComposerState = {
    inputValue: initProps.inputValue ?? "",
    composerAttachments: [],
    replyingToMessageId: null,
  }

  return createStore<IConversationComposerStoreState>()(
    subscribeWithSelector(
      persist(
        (set) => ({
          ...DEFAULT_STATE,
          reset: () =>
            set((state) => ({
              ...state,
              ...DEFAULT_STATE,
            })),
          setInputValue: (value) => set({ inputValue: value }),
          setReplyToMessageId: (messageId) => set({ replyingToMessageId: messageId }),
          addComposerAttachment: (attachment) =>
            set((state) => ({
              composerAttachments: [...state.composerAttachments, attachment],
            })),
          removeComposerAttachment: (mediaURI) =>
            set((state) => ({
              composerAttachments: state.composerAttachments.filter(
                (attachment) => attachment.mediaURI !== mediaURI,
              ),
            })),
          updateComposerAttachment: ({ mediaURI, attachment }) =>
            set((state) => ({
              composerAttachments: state.composerAttachments.map((existing) =>
                existing.mediaURI === mediaURI
                  ? ({
                      ...existing,
                      ...attachment,
                      status: attachment.status,
                    } as IComposerAttachment)
                  : existing,
              ),
            })),
        }),
        {
          storage: getZustandStorage({ id: initProps.storeName }),
          name: initProps.storeName,
          partialize: (state) => ({
            inputValue: state.inputValue,
            replyingToMessageId: state.replyingToMessageId,
            composerAttachments: state.composerAttachments,
          }),
        },
      ),
    ),
  )
}

function getStoreName(xmtpConversationId: IXmtpConversationId | null) {
  return xmtpConversationId ? `composer-${xmtpConversationId}` : "new"
}

const ConversationComposerStoreContext = createContext<IConversationComposerStore | null>(null)

export function useConversationComposerStoreContext<T>(
  selector: (state: IConversationComposerStoreState) => T,
): T {
  const store = useContext(ConversationComposerStoreContext)
  if (!store) throw new Error("Missing ConversationComposerStore.Provider in the tree")
  return useStore(store, selector)
}

export function useConversationComposerStore() {
  const store = useContext(ConversationComposerStoreContext)
  if (!store) throw new Error()
  return store
}
