import { IXmtpClientWithCodecs, IXmtpInboxId } from "@features/xmtp/xmtp.types"
import { PublicIdentity, Client as XmtpClient } from "@xmtp/react-native-sdk"
import { config } from "@/config"
import {
  cacheClientUnderBothKeys,
  getEthAddressCacheKey,
  xmtpClientCache,
} from "@/features/xmtp/xmtp-client/xmtp-client-cache"
import { getXmtpDbEncryptionKey } from "@/features/xmtp/xmtp-client/xmtp-client-db-encryption-key/xmtp-client-db-encryption-key"
import { formatDbEncryptionKeyToUint8Array } from "@/features/xmtp/xmtp-client/xmtp-client-db-encryption-key/xmtp-client-db-encryption-key.utils"
import { getXmtpDbDirectory, getXmtpLocalUrl } from "@/features/xmtp/xmtp-client/xmtp-client-utils"
import { ISupportedXmtpCodecs, supportedXmtpCodecs } from "@/features/xmtp/xmtp-codecs/xmtp-codecs"
import { isXmtpDbEncryptionKeyError } from "@/features/xmtp/xmtp-errors"
import { wrapXmtpCallWithDuration } from "@/features/xmtp/xmtp.helpers"
import { XMTPError } from "@/utils/error"
import { IEthereumAddress, lowercaseEthAddress } from "@/utils/evm/address"
import { xmtpLogger } from "@/utils/logger/logger"

async function _buildXmtpClient(args: {
  ethereumAddress: IEthereumAddress
  inboxId: IXmtpInboxId
  dbEncryptionKey: Uint8Array
  operationName: string
}): Promise<IXmtpClientWithCodecs> {
  const { ethereumAddress, inboxId, dbEncryptionKey, operationName } = args

  const dbDirectory = await getXmtpDbDirectory()

  if (!dbDirectory) {
    throw new XMTPError({
      error: new Error("Failed to get shared app group directory"),
      additionalMessage: "Failed to get shared app group directory",
    })
  }

  const client = await wrapXmtpCallWithDuration(operationName, () =>
    XmtpClient.build<ISupportedXmtpCodecs>(
      new PublicIdentity(ethereumAddress, "ETHEREUM"),
      {
        env: config.xmtp.env,
        codecs: supportedXmtpCodecs,
        dbEncryptionKey,
        dbDirectory,
        ...(config.xmtp.env === "local" && {
          customLocalUrl: getXmtpLocalUrl(),
        }),
      },
      inboxId,
    ),
  )

  const typedClient = client as IXmtpClientWithCodecs

  // Cache under both keys using the helper
  cacheClientUnderBothKeys({
    client: typedClient,
    ethAddress: ethereumAddress,
  })

  return typedClient
}

async function createXmtpBuildPromise(args: {
  ethereumAddress: IEthereumAddress
  inboxId: IXmtpInboxId
}): Promise<IXmtpClientWithCodecs> {
  const { ethereumAddress, inboxId } = args

  try {
    const ethAddress = lowercaseEthAddress(ethereumAddress)
    const dbEncryptionKey = await getXmtpDbEncryptionKey({
      ethAddress,
    })

    if (!dbEncryptionKey) {
      throw new XMTPError({
        error: new Error("No DB encryption key found while building XMTP client"),
      })
    }

    try {
      const client = await _buildXmtpClient({
        ethereumAddress,
        inboxId,
        dbEncryptionKey: formatDbEncryptionKeyToUint8Array(dbEncryptionKey),
        operationName: "buildXmtpClient",
      })

      return client
    } catch (error) {
      if (isXmtpDbEncryptionKeyError(error)) {
        // Weird error that we saw. It's like if there's a value in the keychain, we read it but the returned data is invalid.
        // So we try getting the value from the backup storage instead.
        xmtpLogger.warn(`PRAGMA key error detected in build, trying with backup key...`)

        const backupDbEncryptionKey = await getXmtpDbEncryptionKey({
          ethAddress,
          useBackupNumber: "second",
        })

        if (!backupDbEncryptionKey) {
          throw new XMTPError({
            error: new Error("No backup DB encryption key found while building XMTP client"),
          })
        }

        const client = await _buildXmtpClient({
          ethereumAddress,
          inboxId,
          dbEncryptionKey: formatDbEncryptionKeyToUint8Array(backupDbEncryptionKey),
          operationName: "buildXmtpClientWithBackupKey",
        })

        xmtpLogger.debug(
          `Successfully built XMTP client using backup key for address: ${ethereumAddress}`,
        )

        return client
      }

      throw error
    }
  } catch (error) {
    throw new XMTPError({
      error,
      additionalMessage: `Failed to build XMTP client for address: ${ethereumAddress}`,
    })
  }
}

export async function buildXmtpClient(args: {
  ethereumAddress: IEthereumAddress
  inboxId: IXmtpInboxId
}): Promise<IXmtpClientWithCodecs> {
  const { ethereumAddress, inboxId } = args

  return xmtpClientCache.getOrCreate({
    key: getEthAddressCacheKey(ethereumAddress),
    fn: () => createXmtpBuildPromise({ ethereumAddress, inboxId }),
  })
}
