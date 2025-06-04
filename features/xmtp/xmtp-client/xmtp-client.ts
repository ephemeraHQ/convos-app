import { IXmtpClientWithCodecs, IXmtpInboxId } from "@features/xmtp/xmtp.types"
import { Client as XmtpClient } from "@xmtp/react-native-sdk"
import { useMultiInboxStore } from "@/features/authentication/multi-inbox.store"
import { buildXmtpClient } from "@/features/xmtp/xmtp-client/xmtp-client-build"
import {
  getEthAddressCacheKey,
  getInboxIdCacheKey,
  xmtpClientCache,
} from "@/features/xmtp/xmtp-client/xmtp-client-cache"
import { cleanXmtpDbEncryptionKey } from "@/features/xmtp/xmtp-client/xmtp-client-db-encryption-key/xmtp-client-db-encryption-key"
import { XMTPError } from "@/utils/error"
import { IEthereumAddress, lowercaseEthAddress } from "@/utils/evm/address"
import { xmtpLogger } from "@/utils/logger/logger"

export { buildXmtpClient as buildXmtpClientInstance } from "./xmtp-client-build"
export { createXmtpClient } from "./xmtp-client-create"

export async function getXmtpClientByInboxId(args: { inboxId: IXmtpInboxId }) {
  const { inboxId } = args

  try {
    return await xmtpClientCache.getOrCreate({
      key: getInboxIdCacheKey(inboxId),
      fn: async () => {
        // If not in cache, build it
        const sender = useMultiInboxStore.getState().senders.find((s) => s.inboxId === inboxId)
        if (!sender) {
          throw new Error(`No sender found for inboxId: ${inboxId}`)
        }

        return buildXmtpClient({
          ethereumAddress: sender.ethereumAddress,
          inboxId,
        })
      },
    })
  } catch (error) {
    throw new XMTPError({
      error,
      additionalMessage: `Failed to get XMTP client for inboxId: ${inboxId}`,
    })
  }
}

export async function logoutXmtpClient(args: {
  inboxId?: IXmtpInboxId
  ethAddress?: IEthereumAddress
  deleteDatabase?: boolean
}) {
  const { inboxId, ethAddress, deleteDatabase = false } = args

  if (!inboxId && !ethAddress) {
    throw new XMTPError({
      error: new Error("Either inboxId or ethAddress must be provided"),
    })
  }

  try {
    let lookupId = ethAddress ? String(ethAddress) : String(inboxId)
    let cacheKey: string

    if (ethAddress) {
      cacheKey = getEthAddressCacheKey(ethAddress)
    } else if (inboxId) {
      cacheKey = getInboxIdCacheKey(inboxId)
    } else {
      throw new Error("No valid lookup key")
    }

    // Try to get client from cache
    let xmtpClient: IXmtpClientWithCodecs | undefined
    try {
      xmtpClient = await xmtpClientCache.getOrCreate({
        key: cacheKey,
        fn: async () => {
          throw new Error("Client not found in cache")
        },
      })
    } catch (error) {
      xmtpLogger.debug(`No client found in cache for: ${lookupId}`)
      return
    }

    // If requested, delete the local database
    if (deleteDatabase) {
      xmtpLogger.debug(`Deleting local database for client: ${lookupId}`)
      await xmtpClient.deleteLocalDatabase()
    }

    // Drop the client from XMTP
    xmtpLogger.debug(`Dropping client: ${lookupId}`)
    await dropXmtpClient({ xmtpClient })

    // Remove from cache (both keys)
    if (ethAddress) {
      xmtpClientCache.delete(getEthAddressCacheKey(ethAddress))
      xmtpClientCache.delete(getInboxIdCacheKey(xmtpClient.inboxId))
    } else if (inboxId) {
      xmtpClientCache.delete(getInboxIdCacheKey(inboxId))
      // We don't have ethAddress here, so we can't clean up that key
    }

    // Always clean up encryption key if we're deleting the database
    if (deleteDatabase && ethAddress) {
      await cleanXmtpDbEncryptionKey({ ethAddress: lowercaseEthAddress(ethAddress) })
      xmtpLogger.debug(`Cleaned DB encryption key for address: ${ethAddress}`)
    }

    xmtpLogger.debug(`Successfully logged out XMTP client: ${lookupId}`)
  } catch (error) {
    throw new XMTPError({
      error,
      additionalMessage: `Failed to properly logout XMTP client`,
    })
  }
}

export async function dropXmtpClient(args: {
  xmtpClient: IXmtpClientWithCodecs
  ethAddress: IEthereumAddress
}) {
  const { xmtpClient, ethAddress } = args
  await XmtpClient.dropClient(xmtpClient.installationId)
  xmtpClientCache.delete(getEthAddressCacheKey(ethAddress))
  xmtpClientCache.delete(getInboxIdCacheKey(xmtpClient.inboxId))
}
