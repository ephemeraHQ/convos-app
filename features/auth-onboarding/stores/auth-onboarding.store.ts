import { create } from "zustand"
import { formatRandomUsername } from "@/features/auth-onboarding/utils/format-random-user-name"

type IPage = "welcome" | "contact-card"

type IAuthOnboardingState = {
  // Global
  page: IPage
  isProcessingWeb3Stuff: boolean // Used to track if we're still processing creating embedded wallet, smart contract wallet, XMTP inbox, etc.
  userFriendlyError: string | null // Simplified error message to display to the user

  // Contact card
  name: string
  username: string
  nameValidationError: string
  avatar: string | null
  isAvatarUploading: boolean
}

type IAuthOnboardingActions = {
  reset: () => void
  setIsProcessingWeb3Stuff: (isProcessingWeb3Stuff: boolean) => void
  setPage: (page: IPage) => void
  setUserFriendlyError: (error: string | null) => void

  // Contact card
  setName: (name: string) => void
  setUsername: (username: string) => void
  setNameValidationError: (nameValidationError: string) => void
  setAvatar: (avatar: string | null) => void
  setIsAvatarUploading: (isUploading: boolean) => void
}

type IAuthOnboardingStore = IAuthOnboardingState & {
  actions: IAuthOnboardingActions
}

const initialState: IAuthOnboardingState = {
  // Global
  page: "welcome",
  isProcessingWeb3Stuff: false,
  userFriendlyError: null,

  // Contact card
  name: "",
  username: "",
  nameValidationError: "",
  avatar: null,
  isAvatarUploading: false,
}

export const useAuthOnboardingStore = create<IAuthOnboardingStore>((set) => ({
  ...initialState,
  actions: {
    setIsProcessingWeb3Stuff: (isProcessingWeb3Stuff) => set({ isProcessingWeb3Stuff }),
    setPage: (page) => set({ page }),
    setUserFriendlyError: (userFriendlyError) => set({ userFriendlyError }),

    // Contact card
    setName: (name: string) =>
      set((state) => ({
        name,
        // For now, we're generating the username from the name
        username: formatRandomUsername({ displayName: name }),
      })),
    setUsername: (username: string) => set({ username }),
    setNameValidationError: (nameValidationError: string) => set({ nameValidationError }),
    setAvatar: (avatar: string | null) => set({ avatar }),
    setIsAvatarUploading: (isAvatarUploading: boolean) => set({ isAvatarUploading }),
    reset: () => set(initialState),
  },
}))
