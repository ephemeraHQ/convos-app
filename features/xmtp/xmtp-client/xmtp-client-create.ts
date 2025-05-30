import { IXmtpClientWithCodecs, IXmtpSigner } from "@features/xmtp/xmtp.types"
import { Client as XmtpClient } from "@xmtp/react-native-sdk"
import { config } from "@/config"
import { clientByEthAddress, clientByInboxId } from "@/features/xmtp/xmtp-client/xmtp-client-cache"
import {
  createXmtpDbEncryptionKey,
  getXmtpDbEncryptionKey,
} from "@/features/xmtp/xmtp-client/xmtp-client-db-encryption-key/xmtp-client-db-encryption-key"
import { formatDbEncryptionKeyToUint8Array } from "@/features/xmtp/xmtp-client/xmtp-client-db-encryption-key/xmtp-client-db-encryption-key.utils"
import { getXmtpDbDirectory, getXmtpLocalUrl } from "@/features/xmtp/xmtp-client/xmtp-client-utils"
import { ISupportedXmtpCodecs, supportedXmtpCodecs } from "@/features/xmtp/xmtp-codecs/xmtp-codecs"
import { xmtpIdentityIsEthereumAddress } from "@/features/xmtp/xmtp-identifier/xmtp-identifier"
import { wrapXmtpCallWithDuration } from "@/features/xmtp/xmtp.helpers"
import { XMTPError } from "@/utils/error"
import { IEthereumAddress, lowercaseEthAddress } from "@/utils/evm/address"
import { xmtpLogger } from "@/utils/logger/logger"
import { isXmtpDbEncryptionKeyError } from "../xmtp-errors"

async function _createXmtpClient(args: {
  inboxSigner: IXmtpSigner
  dbEncryptionKey: Uint8Array
  operationName: string
  ethAddress: IEthereumAddress
}): Promise<IXmtpClientWithCodecs> {
  const { inboxSigner, dbEncryptionKey, operationName, ethAddress } = args

  const dbDirectory = await getXmtpDbDirectory()

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

  const identity = await inboxSigner.getIdentifier()

  if (!xmtpIdentityIsEthereumAddress(identity)) {
    throw new XMTPError({
      error: new Error("Identifier is not an Ethereum address"),
    })
  }

  const ethAddress = lowercaseEthAddress(identity.identifier)

  try {
    let dbEncryptionKey = await getXmtpDbEncryptionKey({
      ethAddress,
    })

    if (!dbEncryptionKey) {
      dbEncryptionKey = await createXmtpDbEncryptionKey({
        ethAddress,
      })

      if (!dbEncryptionKey) {
        throw new XMTPError({
          error: new Error("Failed to create DB encryption key while creating XMTP client"),
        })
      }
    }

    try {
      return await _createXmtpClient({
        inboxSigner,
        dbEncryptionKey: formatDbEncryptionKeyToUint8Array(dbEncryptionKey),
        operationName: "createXmtpClient",
        ethAddress,
      })
    } catch (error) {
      if (isXmtpDbEncryptionKeyError(error)) {
        // Weird error that we saw. It's like if there's a value in the keychain, we read it but the returned data is invalid.
        // So we try getting the value from the backup storage instead.
        xmtpLogger.warn(`PRAGMA key error detected, trying with backup key...`)

        const backupDbEncryptionKey = await getXmtpDbEncryptionKey({
          ethAddress,
          useBackupNumber: "first",
        })

        if (!backupDbEncryptionKey) {
          throw new XMTPError({
            error: new Error("No backup DB encryption key found while creating XMTP client"),
          })
        }

        const client = await _createXmtpClient({
          inboxSigner,
          dbEncryptionKey: formatDbEncryptionKeyToUint8Array(backupDbEncryptionKey),
          operationName: "createXmtpClientWithBackupKey",
          ethAddress,
        })

        xmtpLogger.debug(`Successfully created XMTP client using backup key`)
        return client
      }

      throw error
    }
  } catch (error) {
    clientByEthAddress.delete(ethAddress)

    throw new XMTPError({
      error,
      additionalMessage: `Failed to create XMTP client`,
    })
  }
}
