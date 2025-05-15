import { IXmtpInboxId } from "@features/xmtp/xmtp.types"
import { create } from "zustand"
import { persist, subscribeWithSelector } from "zustand/middleware"
import { useAppStore } from "@/stores/app.store"
import { captureError } from "@/utils/capture-error"
import { GenericError } from "@/utils/error"
import { IEthereumAddress } from "@/utils/evm/address"
import { logger } from "@/utils/logger/logger"
import { multiInboxStorage, oldMultiInboxStorage } from "@/utils/storage/storages"

export type CurrentSender = {
  ethereumAddress: IEthereumAddress
  inboxId: IXmtpInboxId
}

type IMultiInboxStoreState = {
  currentSender: CurrentSender | undefined
  senders: CurrentSender[]
}

type IMultiInboxStoreActions = {
  reset: () => void
  setCurrentSender: (
    sender:
      | CurrentSender
      // We let users pass in a partial CurrentSender object and we will find the full object in the store using "senders"
      | { ethereumAddress: IEthereumAddress }
      | { inboxId: IXmtpInboxId }
      | undefined,
  ) => void
  removeSender: (
    senderIdentifier: { ethereumAddress: IEthereumAddress } | { inboxId: IXmtpInboxId },
  ) => void
}

// Combine State and Actions for the store type
type IMultiInboxStoreType = IMultiInboxStoreState & {
  actions: IMultiInboxStoreActions
}

const initialState: IMultiInboxStoreState = {
  currentSender: undefined,
  senders: [],
}

const STORE_NAME = "multi-inbox-store-v1" // NEVER CHANGE THIS
const CURRENT_STORE_VERSION = 1 // NEVER CHANGE THIS unless you know what you are doing

// Helper to check if two senders are the same
function isSameSender(a: CurrentSender, b: CurrentSender): boolean {
  return a.ethereumAddress === b.ethereumAddress && a.inboxId === b.inboxId
}

export const useMultiInboxStore = create<IMultiInboxStoreType>()(
  subscribeWithSelector(
    persist(
      (set, get) => ({
        ...initialState,
        actions: {
          reset: () => {
            set(initialState)
            multiInboxStorage.removeItem(STORE_NAME)
          },

          setCurrentSender: (sender) => {
            if (!sender) {
              return set({ currentSender: undefined })
            }

            const senders = get().senders

            // Case 1: Full CurrentSender object
            if ("ethereumAddress" in sender && "inboxId" in sender) {
              const fullSender = sender as CurrentSender

              // Check if this sender already exists in our list
              const existingIndex = senders.findIndex((s) => isSameSender(s, fullSender))

              if (existingIndex === -1) {
                // If not in list, add it and set as current
                set({
                  currentSender: fullSender,
                  senders: [...senders, fullSender],
                })
              } else {
                // If in list, just set as current
                set({ currentSender: fullSender })
              }

              return
            }

            // Case 2: Find by ethereumAddress or inboxId
            let foundSender: CurrentSender | undefined

            if ("ethereumAddress" in sender) {
              foundSender = senders.find((s) => s.ethereumAddress === sender.ethereumAddress)
            } else if ("inboxId" in sender) {
              foundSender = senders.find((s) => s.inboxId === sender.inboxId)
            }

            if (!foundSender) {
              throw new Error(
                `No sender found matching the provided criteria: ${JSON.stringify(sender)}`,
              )
            }

            set({ currentSender: foundSender })
          },

          removeSender: (senderIdentifier) =>
            set((state) => {
              // Find the sender to remove
              let senderToRemove: CurrentSender | undefined

              if ("ethereumAddress" in senderIdentifier) {
                senderToRemove = state.senders.find(
                  (s) => s.ethereumAddress === senderIdentifier.ethereumAddress,
                )
              } else if ("inboxId" in senderIdentifier) {
                senderToRemove = state.senders.find((s) => s.inboxId === senderIdentifier.inboxId)
              }

              if (!senderToRemove) {
                return state
              }

              // Remove from senders list
              const newSenders = state.senders.filter(
                (s) => !isSameSender(s, senderToRemove as CurrentSender),
              )

              // Update current sender if needed
              const isRemovingCurrentSender =
                state.currentSender &&
                isSameSender(state.currentSender, senderToRemove as CurrentSender)

              const newCurrentSender = isRemovingCurrentSender
                ? newSenders.length > 0
                  ? newSenders[0]
                  : undefined
                : state.currentSender

              return {
                senders: newSenders,
                currentSender: newCurrentSender,
              }
            }),
        },
      }),
      {
        name: STORE_NAME, // This name is used as the key within the storage
        storage: multiInboxStorage,
        version: CURRENT_STORE_VERSION,
        partialize: (state) => {
          const { actions, ...rest } = state
          return rest
        },
        migrate,
        onRehydrateStorage: () => (state, error) => {
          if (error) {
            captureError(
              new GenericError({
                error,
                additionalMessage: "Error during multi-inbox store hydration",
              }),
            )
          } else {
            logger.debug(
              `Multi-inbox store hydrated successfully: ${JSON.stringify(state, null, 2)}`,
            )
            useAppStore.getState().actions.setMultiInboxIsHydrated(true)
          }
        },
      },
    ),
  ),
)

// Need this since we changed the way we store the data in the storage so need to take what was in old storage and migrate it to the new storage
async function migrate(persistedStateFromNewStorage: unknown, oldVersionInNewStorage: number) {
  logger.debug(
    `MultiInboxStore: Migrate check. Version in new storage ('${STORE_NAME}'): ${oldVersionInNewStorage}. Current code version: ${CURRENT_STORE_VERSION}.`,
  )
  const newStorageState = persistedStateFromNewStorage as IMultiInboxStoreState | null

  // Priority 1: If new storage is populated (e.g., has a currentSender), use it.
  // This means the user has interacted with the app using the new storage,
  // or it's already up-to-date.
  if (newStorageState?.currentSender) {
    logger.debug(
      `MultiInboxStore: New storage ('${STORE_NAME}') is already populated (currentSender exists, version ${oldVersionInNewStorage}). Prioritizing this state. No migration from old 'mmkv.default' needed.`,
    )
    // If oldVersionInNewStorage < CURRENT_STORE_VERSION, Zustand will update the version
    // when it saves this state back.
    return newStorageState
  }

  // Priority 2: If new storage is empty/unpopulated, AND its version is up-to-date
  // (this case is less likely if currentSender check above passed, but good for completeness if "populated" definition changes)
  // then there's nothing to migrate from old storage because new storage is "correctly empty" and current.
  if (oldVersionInNewStorage >= CURRENT_STORE_VERSION) {
    logger.debug(
      `MultiInboxStore: New storage ('${STORE_NAME}') is not populated but its version (${oldVersionInNewStorage}) is current. No migration from old 'mmkv.default' needed.`,
    )
    return newStorageState // Which would be null or an empty state shell
  }

  // Priority 3: New storage is empty/unpopulated AND its version is outdated.
  // Now, try to load from the old 'mmkv.default' storage.
  logger.debug(
    `MultiInboxStore: New storage ('${STORE_NAME}') is not populated (or version ${oldVersionInNewStorage} is outdated). Attempting to load from old 'mmkv.default' storage.`,
  )
  try {
    const rawOldStateString = await oldMultiInboxStorage.getItem(STORE_NAME)

    if (rawOldStateString && typeof rawOldStateString === "string") {
      logger.debug(
        `MultiInboxStore: Found data in old 'mmkv.default' storage (key '${STORE_NAME}'). Attempting to migrate.`,
      )
      const parsedOldJson = JSON.parse(rawOldStateString) as {
        state: IMultiInboxStoreState
        version?: number // Old persisted state also had a version
      }
      const oldActualState = parsedOldJson.state

      if (oldActualState && typeof oldActualState === "object") {
        logger.debug(
          "MultiInboxStore: Successfully parsed state from old 'mmkv.default' storage. This state will be used:",
          oldActualState,
        )

        try {
          await oldMultiInboxStorage.removeItem(STORE_NAME)
          logger.debug(
            `MultiInboxStore: Successfully removed data from old 'mmkv.default' storage (key '${STORE_NAME}').`,
          )
        } catch (removeError) {
          captureError(
            new GenericError({
              error: removeError,
              additionalMessage: `MultiInboxStore: Failed to remove item '${STORE_NAME}' from old 'mmkv.default' storage after successful read. Migrated data will still be used by the new store.`,
            }),
          )
        }
        return oldActualState // This state will be written to the new storage with CURRENT_STORE_VERSION
      }
      logger.warn(
        "MultiInboxStore: Old 'mmkv.default' storage data was not in the expected format (missing 'state' property or not an object). Will proceed without it.",
      )
    } else {
      logger.debug(
        `MultiInboxStore: No data found in old 'mmkv.default' storage (key '${STORE_NAME}'). User might be new, or migration already occurred and old data was cleaned.`,
      )
    }
  } catch (error) {
    captureError(
      new GenericError({
        error,
        additionalMessage: `MultiInboxStore: Error during fetch/parse from old 'mmkv.default' storage (key '${STORE_NAME}') in migration.`,
      }),
    )
  }

  // Fallback: If no data from old storage, and new storage was also unpopulated/outdated,
  // use whatever was in the new storage (which would be null/empty based on earlier checks) or initial state.
  logger.debug(
    `MultiInboxStore: Fallback: Using data from new storage (if any, version ${oldVersionInNewStorage}, likely empty at this point) or initial state.`,
  )
  return (newStorageState || initialState) as IMultiInboxStoreState
}

export function useCurrentSender() {
  return useMultiInboxStore((state) => state.currentSender)
}

export function getCurrentSender(): CurrentSender | undefined {
  return useMultiInboxStore.getState().currentSender
}

export function getSafeCurrentSender(): CurrentSender {
  const currentSender = getCurrentSender()
  if (!currentSender) {
    throw new Error("No current sender in getSafeCurrentSender")
  }
  return currentSender
}

export function useSafeCurrentSender(): CurrentSender {
  const currentSender = useCurrentSender()
  if (!currentSender) {
    throw new Error("No current sender in useSafeCurrentSender")
  }
  return currentSender
}

export function isCurrentSender(sender: Partial<CurrentSender>) {
  const currentSender = getSafeCurrentSender()
  if (!sender) return false
  return (
    currentSender.inboxId === sender.inboxId ||
    currentSender.ethereumAddress === sender.ethereumAddress
  )
}

export function resetMultiInboxStore() {
  useMultiInboxStore.getState().actions.reset()
}

export function getAllSenders() {
  return useMultiInboxStore.getState().senders
}
