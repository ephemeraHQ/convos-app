import { IXmtpClientWithCodecs, IXmtpInboxId } from "@features/xmtp/xmtp.types"
import { Client as XmtpClient } from "@xmtp/react-native-sdk"
import { useMultiInboxStore } from "@/features/authentication/multi-inbox.store"
import { buildXmtpClient } from "@/features/xmtp/xmtp-client/xmtp-client-build"
import { cleanXmtpDbEncryptionKey } from "@/features/xmtp/xmtp-client/xmtp-client-db-encryption-key"
import { XMTPError } from "@/utils/error"
import { IEthereumAddress, lowercaseEthAddress } from "@/utils/evm/address"
import { xmtpLogger } from "@/utils/logger/logger"
import { clientByEthAddress, clientByInboxId } from "./xmtp-client-cache"

export { buildXmtpClient as buildXmtpClientInstance } from "./xmtp-client-build"
export { createXmtpClient } from "./xmtp-client-create"

export async function getXmtpClientByInboxId(args: { inboxId: IXmtpInboxId }) {
  const { inboxId } = args

  try {
    // Check cache first
    const cachedClient = clientByInboxId.get(inboxId)
    if (cachedClient) {
      return cachedClient
    }

    // Try to get from store
    const sender = useMultiInboxStore.getState().senders.find((s) => s.inboxId === inboxId)
    if (!sender) {
      throw new XMTPError({
        error: new Error(`No sender found for inboxId: ${inboxId}`),
      })
    }

    const client = await buildXmtpClient({
      ethereumAddress: sender.ethereumAddress,
      inboxId,
    })

    // Store in cache
    clientByInboxId.set(inboxId, Promise.resolve(client))

    return client
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
    // Get client from appropriate cache
    let clientPromise: Promise<IXmtpClientWithCodecs> | undefined
    let lookupId = ethAddress ? String(ethAddress) : String(inboxId)

    if (ethAddress) {
      clientPromise = clientByEthAddress.get(ethAddress)
    } else if (inboxId) {
      clientPromise = clientByInboxId.get(inboxId)
    }

    if (!clientPromise) {
      xmtpLogger.debug(`No client found in cache for: ${lookupId}`)
      return
    }

    // Wait for client to resolve
    const xmtpClient = await clientPromise

    // If requested, delete the local database
    if (deleteDatabase) {
      xmtpLogger.debug(`Deleting local database for client: ${lookupId}`)
      await xmtpClient.deleteLocalDatabase()
    }

    // Drop the client from XMTP
    xmtpLogger.debug(`Dropping client: ${lookupId}`)
    await XmtpClient.dropClient(xmtpClient.installationId)

    // Remove from caches
    if (ethAddress) {
      clientByEthAddress.delete(ethAddress)
    }
    if (inboxId) {
      clientByInboxId.delete(inboxId)
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
