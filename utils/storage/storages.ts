import { config } from "@/config"
import { createMmkvStorage } from "@/utils/storage/mmkv"
import { secureStorage } from "@/utils/storage/secure-storage"
import { sharedDefaults } from "@/utils/storage/shared-defaults"
import { getZustandMmkvStorage, getZustandStorageFromSharedDefaults } from "@/utils/storage/zustand"

// Using shared defaults because we're sure there's no problem with it. We have problems with MMKV sometimes right now.
export const multiInboxStoreStorage = getZustandStorageFromSharedDefaults()

// Don't change, this is temporary until all users migrated to new app which will use new storage
export const oldMultiInboxStoreStorage = getZustandMmkvStorage({ id: "mmkv.default" })

export const createProfileStoreStorage = getZustandMmkvStorage({ id: "profile-me" })
export const notificationsStoreStorage = getZustandMmkvStorage({ id: "notifications" })

export const reactQueryPersistingStorage = createMmkvStorage({
  id: "convos-react-query-persister",
})
export const favoritedEmojisStorage = createMmkvStorage({ id: "favorited-emojis" })
export const persistStateStorage = createMmkvStorage({ id: "persist-state" })

// Until we update MMKV to v3, this is the only way to share data between the app and the NSE. The id NEEDS to be config.app.bundleId
export const mmkvGroupSharedStorage = createMmkvStorage({ id: config.app.bundleId })

export const xmtpDbEncryptionKeySecureStorage = secureStorage
export const xmtpDbEncryptionKeySharedDefaultBackupStorage = sharedDefaults
export const xmtpDbEncryptionKeyMmkvStorage = mmkvGroupSharedStorage

// Using secure because we want the device id to persist if we delete the app
export const deviceIdStorage = secureStorage

export const notificationExtensionSharedDataStorage = mmkvGroupSharedStorage

export function clearAllNonImportantStorages() {
  // Clear all non important storages
  reactQueryPersistingStorage.clearAll()
  favoritedEmojisStorage.clearAll()
  persistStateStorage.clearAll()
}
