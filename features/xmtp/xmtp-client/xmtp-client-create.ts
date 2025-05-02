import { IXmtpClientWithCodecs, IXmtpSigner } from "@features/xmtp/xmtp.types"
import { Client as XmtpClient } from "@xmtp/react-native-sdk"
import { config } from "@/config"
import { clientByEthAddress, clientByInboxId } from "@/features/xmtp/xmtp-client/xmtp-client-cache"
import {
  getBackupXmtpDbEncryptionKey,
  getOrCreateXmtpDbEncryptionKey,
} from "@/features/xmtp/xmtp-client/xmtp-client-db-encryption-key"
import {
  getSharedAppGroupDirectory,
  getXmtpLocalUrl,
} from "@/features/xmtp/xmtp-client/xmtp-client-utils"
import { ISupportedXmtpCodecs, supportedXmtpCodecs } from "@/features/xmtp/xmtp-codecs/xmtp-codecs"
import { xmtpIdentityIsEthereumAddress } from "@/features/xmtp/xmtp-identifier/xmtp-identifier"
import { wrapXmtpCallWithDuration } from "@/features/xmtp/xmtp.helpers"
import { XMTPError } from "@/utils/error"
import { IEthereumAddress, lowercaseEthAddress } from "@/utils/evm/address"
import { xmtpLogger } from "@/utils/logger/logger"
import { isXmtpDbEncryptionKeyError } from "../xmtp-errors"

console.log("config.xmtp.env:", config.xmtp.env)

async function _createXmtpClient(args: {
  inboxSigner: IXmtpSigner
  dbEncryptionKey: Uint8Array
  operationName: string
  ethAddress: IEthereumAddress
}): Promise<IXmtpClientWithCodecs> {
  const { inboxSigner, dbEncryptionKey, operationName, ethAddress } = args

  const dbDirectory = await getSharedAppGroupDirectory()

  if (!dbDirectory) {
    throw new XMTPError({
      error: new Error("Failed to get shared app group directory"),
      additionalMessage: "Failed to get shared app group directory",
    })
  }

  const xmtpClientResult = await wrapXmtpCallWithDuration(operationName, () =>
    XmtpClient.create<ISupportedXmtpCodecs>(inboxSigner, {
      env: config.xmtp.env,
      dbEncryptionKey,
      codecs: supportedXmtpCodecs,
      dbDirectory,
      ...(config.xmtp.env === "local" && {
        customLocalHost: getXmtpLocalUrl(),
      }),
    }),
  )

  const typedClient = xmtpClientResult as IXmtpClientWithCodecs
  const resolvedClientPromise = Promise.resolve(typedClient)

  // Cache the client by both Ethereum address and inbox ID
  clientByEthAddress.set(ethAddress, resolvedClientPromise)
  clientByInboxId.set(typedClient.inboxId, resolvedClientPromise)

  return typedClient
}

export async function createXmtpClient(args: {
  inboxSigner: IXmtpSigner
}): Promise<IXmtpClientWithCodecs> {
  const { inboxSigner } = args

  try {
    const identity = await inboxSigner.getIdentifier()

    if (!xmtpIdentityIsEthereumAddress(identity)) {
      throw new XMTPError({
        error: new Error("Identifier is not an Ethereum address"),
      })
    }

    const ethAddress = lowercaseEthAddress(identity.identifier)
    const dbEncryptionKey = await getOrCreateXmtpDbEncryptionKey({
      ethAddress,
    })

    xmtpLogger.debug(`Creating XMTP client instance...`)

    try {
      return await _createXmtpClient({
        inboxSigner,
        dbEncryptionKey,
        operationName: "createXmtpClient",
        ethAddress,
      })
    } catch (error) {
      if (isXmtpDbEncryptionKeyError(error)) {
        xmtpLogger.warn(`PRAGMA key error detected, trying with backup key...`)

        const backupDbEncryptionKey = await getBackupXmtpDbEncryptionKey({
          ethAddress,
        })

        const client = await _createXmtpClient({
          inboxSigner,
          dbEncryptionKey: backupDbEncryptionKey,
          operationName: "createXmtpClientWithBackupKey",
          ethAddress,
        })

        xmtpLogger.debug(`Successfully created XMTP client using backup key`)
        return client
      }

      throw error
    }
  } catch (error) {
    throw new XMTPError({
      error,
      additionalMessage: `Failed to create XMTP client`,
    })
  }
}
