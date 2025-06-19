import { IXmtpClientWithCodecs, IXmtpSigner } from "@features/xmtp/xmtp.types"
import { Client as XmtpClient } from "@xmtp/react-native-sdk"
import { config } from "@/config"
import {
  cacheClientUnderBothKeys,
  getEthAddressCacheKey,
  xmtpClientCache,
} from "@/features/xmtp/xmtp-client/xmtp-client-cache"
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

  // Cache under both keys using the helper
  cacheClientUnderBothKeys({
    client: typedClient,
    ethAddress,
  })

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
        xmtpLogger.warn(`PRAGMA key error detected, trying with backup keys...`)

        const backupMethods: Array<"first" | "second" | "third"> = ["first", "second", "third"]

        for (const backupMethod of backupMethods) {
          try {
            const backupDbEncryptionKey = await getXmtpDbEncryptionKey({
              ethAddress,
              useBackupNumber: backupMethod,
            })

            if (!backupDbEncryptionKey) {
              xmtpLogger.debug(`No ${backupMethod} backup DB encryption key found`)
              continue
            }

            const client = await _createXmtpClient({
              inboxSigner,
              dbEncryptionKey: formatDbEncryptionKeyToUint8Array(backupDbEncryptionKey),
              operationName: `createXmtpClientWith${backupMethod}BackupKey`,
              ethAddress,
            })

            xmtpLogger.debug(`Successfully created XMTP client using ${backupMethod} backup key`)
            return client
          } catch (backupError) {
            if (isXmtpDbEncryptionKeyError(backupError)) {
              xmtpLogger.warn(
                `${backupMethod} backup key also failed with PRAGMA error, trying next backup...`,
              )
              continue
            }

            throw backupError
          }
        }

        throw new XMTPError({
          error: new Error("All backup DB encryption keys failed"),
          additionalMessage: "No working backup DB encryption key found while creating XMTP client",
        })
      }

      throw error
    }
  } catch (error) {
    // Clean up cache on failure
    xmtpClientCache.delete(getEthAddressCacheKey(ethAddress))

    throw new XMTPError({
      error,
      additionalMessage: `Failed to create XMTP client`,
    })
  }
}
