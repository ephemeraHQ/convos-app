import { config } from "@/config"
import { createMmkvStorage } from "@/utils/storage/mmkv"
import { secureStorage } from "@/utils/storage/secure-storage"
import { sharedDefaults } from "@/utils/storage/shared-defaults"
import { getZustandMmkvStorage, getZustandStorageFromSharedDefaults } from "@/utils/storage/zustand"

// Using shared defaults because we're sure there's no problem with it. We have problems with MMKV sometimes right now.
export const multiInboxStorage = getZustandStorageFromSharedDefaults()

// Don't change, this is temporary until all users migrated to new app which will use new storage
export const oldMultiInboxStorage = getZustandMmkvStorage({ id: "mmkv.default" })

export const createProfileStorage = getZustandMmkvStorage({ id: "profile-me" })
export const notificationsStorage = getZustandMmkvStorage({ id: "notifications" })

export const reactQueryPersistingStorage = createMmkvStorage({
  id: "convos-react-query-persister",
})
export const favoritedEmojisStorage = createMmkvStorage({ id: "favorited-emojis" })
export const persistStateStorage = createMmkvStorage({ id: "persist-state" })

export const xmtpDbEncryptionKeySecureStorageStorage = secureStorage
export const xmtpDbEncryptionKeyMmkvStorage = createMmkvStorage({ id: config.app.bundleId })
export const xmtpDbEncryptionKeySharedDefaultBackupStorage = sharedDefaults

// Using secure because we want the device id to persist if we delete the app
export const deviceIdStorage = secureStorage

export function clearAllNonImportantStorages() {
  // Clear all MMKV storages
  reactQueryPersistingStorage.clearAll()
  favoritedEmojisStorage.clearAll()
  persistStateStorage.clearAll()
  xmtpDbEncryptionKeyMmkvStorage.clearAll()
}
