import { memo, useCallback } from "react"
import { Snackbars } from "@/components/snackbar/snackbars"
import { useProfileMeStore } from "@/features/profiles/profile-me.store-context"
import { ConnectWallet } from "@/features/wallets/connect-wallet/connect-wallet"

export const ProfileImportInfoScreen = memo(function ProfileImportInfoScreen() {
  const profileMeStore = useProfileMeStore()

  const handleSelectName = useCallback(
    (info: { name: string; avatar: string | undefined }) => {
      profileMeStore.getState().actions.setNameTextValue(info.name)
      if (info.avatar) {
        profileMeStore.getState().actions.setAvatarUri(info.avatar)
      }
    },
    [profileMeStore],
  )

  return (
    <>
      <ConnectWallet onSelectInfo={handleSelectName} />
      {/* Not sure why but if not here, they appear behind the screen? (formSheet problem?) */}
      <Snackbars />
    </>
  )
})
