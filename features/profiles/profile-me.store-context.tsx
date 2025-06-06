import { IXmtpInboxId } from "@features/xmtp/xmtp.types"
import { createContext, memo, useContext, useRef } from "react"
import { createStore, useStore } from "zustand"
import { subscribeWithSelector } from "zustand/middleware"

type IProfileMeStoreProps = {
  inboxId: IXmtpInboxId
}

type IProfileMeStoreState = {
  editMode: boolean
  nameTextValue: string | undefined
  usernameTextValue: string | undefined
  descriptionTextValue: string | undefined
  avatarUri: string | undefined | null
  isAvatarUploading: boolean
}

type IProfileMeStoreActions = {
  setEditMode: (editMode: boolean) => void
  setNameTextValue: (nameTextValue: string) => void
  setUsernameTextValue: (usernameTextValue: string) => void
  setDescriptionTextValue: (descriptionTextValue: string) => void
  setAvatarUri: (avatarUri?: string | null) => void
  setIsAvatarUploading: (isUploading: boolean) => void
  reset: () => void
}

type IProfileMeStoreProviderProps = React.PropsWithChildren<IProfileMeStoreProps>

type IProfileMeStore = ReturnType<typeof createProfileMeStore>

export const ProfileMeStoreProvider = memo(
  ({ children, inboxId }: IProfileMeStoreProviderProps) => {
    const storeRef = useRef<IProfileMeStore>()

    if (!storeRef.current) {
      storeRef.current = createProfileMeStore(inboxId)
    }

    return (
      <ProfileMeStoreContext.Provider value={storeRef.current}>
        {children}
      </ProfileMeStoreContext.Provider>
    )
  },
)

const DEFAULT_STATE: IProfileMeStoreState = {
  editMode: false,
  nameTextValue: "",
  usernameTextValue: "",
  descriptionTextValue: "",
  avatarUri: undefined,
  isAvatarUploading: false,
}

const createProfileMeStore = (inboxId: IXmtpInboxId) => {
  return createStore<IProfileMeStoreState & { actions: IProfileMeStoreActions }>()(
    subscribeWithSelector((set) => ({
      ...DEFAULT_STATE,
      actions: {
        setEditMode: (editMode) => set({ editMode }),
        setNameTextValue: (nameTextValue) => set({ nameTextValue }),
        setUsernameTextValue: (usernameTextValue) => set({ usernameTextValue }),
        setDescriptionTextValue: (descriptionTextValue) => set({ descriptionTextValue }),
        setAvatarUri: (avatarUri) => set({ avatarUri }),
        setIsAvatarUploading: (isAvatarUploading) => set({ isAvatarUploading }),
        reset: () => set(DEFAULT_STATE),
      },
    })),
  )
}

const ProfileMeStoreContext = createContext<IProfileMeStore | null>(null)

export function useProfileMeStoreValue<T>(
  selector: (state: IProfileMeStoreState & { actions: IProfileMeStoreActions }) => T,
): T {
  const store = useContext(ProfileMeStoreContext)
  if (!store) throw new Error("Missing ProfileMeStoreProvider in the tree")
  return useStore(store, selector)
}

export function useProfileMeStore() {
  const store = useContext(ProfileMeStoreContext)
  if (!store) throw new Error("Missing ProfileMeStoreProvider in the tree")
  return store
}
