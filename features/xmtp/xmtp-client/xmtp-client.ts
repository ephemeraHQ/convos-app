import { IXmtpClientWithCodecs, IXmtpInboxId, IXmtpSigner } from "@features/xmtp/xmtp.types"
import { PublicIdentity, Client as XmtpClient } from "@xmtp/react-native-sdk"
import Constants from "expo-constants"
import { config } from "@/config"
import { useMultiInboxStore } from "@/features/authentication/multi-inbox.store"
import {
  cleanXmtpDbEncryptionKey,
  getBackupXmtpDbEncryptionKey,
  getOrCreateXmtpDbEncryptionKey,
} from "@/features/xmtp/xmtp-client/xmtp-client-db-encryption-key"
import { ISupportedXmtpCodecs, supportedXmtpCodecs } from "@/features/xmtp/xmtp-codecs/xmtp-codecs"
import { xmtpIdentityIsEthereumAddress } from "@/features/xmtp/xmtp-identifier/xmtp-identifier"
import { setXmtpInstallationQueryData } from "@/features/xmtp/xmtp-installations/xmtp-installation.query"
import { wrapXmtpCallWithDuration } from "@/features/xmtp/xmtp.helpers"
import { XMTPError } from "@/utils/error"
import { IEthereumAddress, lowercaseEthAddress } from "@/utils/evm/address"
import { xmtpLogger } from "@/utils/logger/logger"

// Single unified cache for clients and in-progress builds, keyed by ethereum address
const clientCache = new Map<IEthereumAddress, Promise<IXmtpClientWithCodecs>>()

export async function getXmtpClientByInboxId(args: { inboxId: IXmtpInboxId }) {
  const { inboxId } = args

  try {
    // Get sender from store to find the ethereum address
    const sender = useMultiInboxStore.getState().senders.find((s) => s.inboxId === inboxId)
    if (!sender) {
      throw new XMTPError({
        error: new Error(`No sender found for inboxId: ${inboxId}`),
      })
    }

    // Check if client already exists or is being built for this address
    const existingClientPromise = clientCache.get(sender.ethereumAddress)
    if (existingClientPromise) {
      return existingClientPromise
    }

    // Create promise for building client and store in cache
    const clientPromise = buildXmtpClientInstance({
      ethereumAddress: sender.ethereumAddress,
      inboxId,
    })

    // Store in map by ethereum address only
    clientCache.set(sender.ethereumAddress, clientPromise)

    return clientPromise
  } catch (error) {
    throw new XMTPError({
      error,
      additionalMessage: `Failed to get XMTP client for inboxId: ${inboxId}`,
    })
  }
}

// Create a separate function to handle client creation to avoid closure issues
async function createClientPromiseImpl(ethAddress: IEthereumAddress, inboxSigner: IXmtpSigner) {
  try {
    // Convert to lowercase eth address
    const lowercasedAddress = lowercaseEthAddress(ethAddress)

    // Get the primary encryption key
    const dbEncryptionKey = await getOrCreateXmtpDbEncryptionKey({
      ethAddress: lowercasedAddress,
    })

    xmtpLogger.debug(`Creating XMTP client instance...`)
    try {
      const xmtpClientResult = await wrapXmtpCallWithDuration("createXmtpClient", () =>
        XmtpClient.create<ISupportedXmtpCodecs>(inboxSigner, {
          env: config.xmtp.env,
          dbEncryptionKey,
          codecs: supportedXmtpCodecs,
          ...(config.xmtp.env === "local" && {
            customLocalUrl: getXmtpLocalUrl(),
          }),
        }),
      )

      const typedClient = xmtpClientResult as IXmtpClientWithCodecs

      return typedClient
    } catch (error) {
      if (
        error instanceof Error &&
        error.message.includes("PRAGMA key or salt has incorrect value")
      ) {
        xmtpLogger.warn(`PRAGMA key error detected, trying with backup key...`)

        const backupDbEncryptionKey = await getBackupXmtpDbEncryptionKey({
          ethAddress: lowercasedAddress,
        })

        const xmtpClientResult = await wrapXmtpCallWithDuration(
          "createXmtpClientWithBackupKey",
          () =>
            XmtpClient.create<ISupportedXmtpCodecs>(inboxSigner, {
              env: config.xmtp.env,
              dbEncryptionKey: backupDbEncryptionKey,
              codecs: supportedXmtpCodecs,
              ...(config.xmtp.env === "local" && {
                customLocalUrl: getXmtpLocalUrl(),
              }),
            }),
        )

        const typedClient = xmtpClientResult as IXmtpClientWithCodecs
        xmtpLogger.debug(`Successfully created XMTP client using backup key`)

        return typedClient
      }

      throw error
    }
  } catch (error) {
    // Clean up cache on error
    clientCache.delete(ethAddress)
    throw new XMTPError({
      error,
      additionalMessage: `Failed to create XMTP client for address: ${ethAddress}`,
    })
  }
}

export async function createXmtpClient(args: { inboxSigner: IXmtpSigner }) {
  const { inboxSigner } = args

  const identity = await inboxSigner.getIdentifier()

  if (!xmtpIdentityIsEthereumAddress(identity)) {
    throw new XMTPError({
      error: new Error("Identifier is not an Ethereum address"),
    })
  }

  const ethAddress = lowercaseEthAddress(identity.identifier)

  // Check if client is already being created for this address
  const existingPromise = clientCache.get(ethAddress)
  if (existingPromise) {
    return existingPromise
  }

  // Create a new client creation promise using the extracted function
  const clientPromise = createClientPromiseImpl(ethAddress, inboxSigner)

  // Store the promise in cache
  clientCache.set(ethAddress, clientPromise)

  return clientPromise
}

// Extract build promise implementation to avoid closure issues
async function buildXmtpClientPromiseImpl(
  ethereumAddress: IEthereumAddress,
  inboxId?: IXmtpInboxId,
) {
  try {
    const ethAddress = lowercaseEthAddress(ethereumAddress)
    const dbEncryptionKey = await getOrCreateXmtpDbEncryptionKey({
      ethAddress,
    })

    try {
      const client = await wrapXmtpCallWithDuration("buildXmtpClient", () =>
        XmtpClient.build<ISupportedXmtpCodecs>(
          new PublicIdentity(ethereumAddress, "ETHEREUM"),
          {
            env: config.xmtp.env,
            codecs: supportedXmtpCodecs,
            dbEncryptionKey,
            ...(config.xmtp.env === "local" && {
              customLocalUrl: getXmtpLocalUrl(),
            }),
          },
          inboxId,
        ),
      )

      const typedClient = client as IXmtpClientWithCodecs

      setXmtpInstallationQueryData({
        inboxId: typedClient.inboxId,
        installationId: typedClient.installationId,
      })

      return typedClient
    } catch (error) {
      if (
        error instanceof Error &&
        error.message.includes("PRAGMA key or salt has incorrect value")
      ) {
        xmtpLogger.warn(`PRAGMA key error detected in build, trying with backup key...`)

        const backupDbEncryptionKey = await getBackupXmtpDbEncryptionKey({
          ethAddress,
        })

        const client = await wrapXmtpCallWithDuration("buildXmtpClientWithBackupKey", () =>
          XmtpClient.build<ISupportedXmtpCodecs>(
            new PublicIdentity(ethereumAddress, "ETHEREUM"),
            {
              env: config.xmtp.env,
              codecs: supportedXmtpCodecs,
              dbEncryptionKey: backupDbEncryptionKey,
              ...(config.xmtp.env === "local" && {
                customLocalUrl: getXmtpLocalUrl(),
              }),
            },
            inboxId,
          ),
        )

        xmtpLogger.debug(
          `Successfully built XMTP client using backup key for address: ${ethereumAddress}`,
        )

        const typedClient = client as IXmtpClientWithCodecs

        setXmtpInstallationQueryData({
          inboxId: typedClient.inboxId,
          installationId: typedClient.installationId,
        })

        return typedClient
      }

      throw error
    }
  } catch (error) {
    // Clean up cache on error
    clientCache.delete(ethereumAddress)
    throw new XMTPError({
      error,
      additionalMessage: `Failed to build XMTP client for address: ${ethereumAddress}`,
    })
  }
}

async function buildXmtpClientInstance(args: {
  ethereumAddress: IEthereumAddress
  inboxId?: IXmtpInboxId
}) {
  const { ethereumAddress, inboxId } = args

  try {
    // Check if there's already a client or build in progress for this address
    const existingPromise = clientCache.get(ethereumAddress)
    if (existingPromise) {
      return existingPromise
    }

    // Create a new build promise using the extracted function
    const buildPromise = buildXmtpClientPromiseImpl(ethereumAddress, inboxId)

    // Store the promise in cache by ethereum address only
    clientCache.set(ethereumAddress, buildPromise)

    return buildPromise
  } catch (error) {
    throw new XMTPError({
      error,
      additionalMessage: `Failed to build XMTP client for address: ${ethereumAddress}`,
    })
  }
}

export async function logoutXmtpClient(
  args:
    | {
        inboxId: IXmtpInboxId
        ethAddress: IEthereumAddress
        deleteDatabase: true
      }
    | {
        inboxId: IXmtpInboxId
        ethAddress?: never
        deleteDatabase?: false
      },
) {
  const { inboxId, ethAddress: providedEthAddress, deleteDatabase = false } = args

  xmtpLogger.debug(`Logging out XMTP client for inboxId: ${inboxId}`)

  try {
    // Find the ethereum address for this inbox if not provided
    let ethAddress = providedEthAddress
    if (!ethAddress) {
      const sender = useMultiInboxStore.getState().senders.find((s) => s.inboxId === inboxId)
      if (!sender) {
        xmtpLogger.debug(`No sender found in store for inboxId: ${inboxId}`)
        return
      }
      ethAddress = sender.ethereumAddress
    }

    // Get client promise from cache using ethereum address
    const clientPromise = clientCache.get(ethAddress)
    if (!clientPromise) {
      xmtpLogger.debug(`No client found in cache for address: ${ethAddress}`)
      return
    }

    // Wait for client to resolve
    const xmtpClient = await clientPromise

    // If requested, delete the local database
    if (deleteDatabase) {
      xmtpLogger.debug(`Deleting local database for inboxId: ${inboxId}`)
      await xmtpClient.deleteLocalDatabase()
    }

    // Drop the client from XMTP
    xmtpLogger.debug(`Dropping client for inboxId: ${inboxId}`)
    await XmtpClient.dropClient(xmtpClient.installationId)

    // Remove from cache
    clientCache.delete(ethAddress)

    // Always clean up encryption key if we're deleting the database
    if (deleteDatabase) {
      await cleanXmtpDbEncryptionKey({ ethAddress: lowercaseEthAddress(ethAddress) })
      xmtpLogger.debug(`Cleaned DB encryption key for address: ${ethAddress}`)
    }

    xmtpLogger.debug(`Successfully logged out XMTP client for inboxId: ${inboxId}`)
  } catch (error) {
    throw new XMTPError({
      error,
      additionalMessage: `Failed to properly logout XMTP client for inboxId: ${inboxId}`,
    })
  }
}

function getXmtpLocalUrl() {
  const hostIp = Constants.expoConfig?.hostUri?.split(":")[0]

  if (!hostIp) {
    throw new XMTPError({
      error: new Error("No host IP found"),
      additionalMessage: "Failed to get device IP for local XMTP environment",
    })
  }

  xmtpLogger.debug(`Getting XMTP local URL for host IP: ${hostIp}`)

  return hostIp
}
