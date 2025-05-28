import { IXmtpClientWithCodecs, IXmtpInboxId } from "@features/xmtp/xmtp.types"
import { PublicIdentity, Client as XmtpClient } from "@xmtp/react-native-sdk"
import { config } from "@/config"
import { clientByEthAddress, clientByInboxId } from "@/features/xmtp/xmtp-client/xmtp-client-cache"
import {
  getBackupXmtpDbEncryptionKey,
  getOrCreateXmtpDbEncryptionKey,
} from "@/features/xmtp/xmtp-client/xmtp-client-db-encryption-key/xmtp-client-db-encryption-key"
import {
  getSharedAppGroupDirectory,
  getXmtpLocalUrl,
} from "@/features/xmtp/xmtp-client/xmtp-client-utils"
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

  const dbDirectory = await getSharedAppGroupDirectory()

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

  clientByInboxId.set(typedClient.inboxId, Promise.resolve(typedClient))

  return typedClient
}

async function createXmtpBuildPromise(args: {
  ethereumAddress: IEthereumAddress
  inboxId: IXmtpInboxId
}): Promise<IXmtpClientWithCodecs> {
  const { ethereumAddress, inboxId } = args

  try {
    const ethAddress = lowercaseEthAddress(ethereumAddress)
    const dbEncryptionKey = await getOrCreateXmtpDbEncryptionKey({
      ethAddress,
    })

    try {
      return await _buildXmtpClient({
        ethereumAddress,
        inboxId,
        dbEncryptionKey,
        operationName: "buildXmtpClient",
      })
    } catch (error) {
      if (isXmtpDbEncryptionKeyError(error)) {
        xmtpLogger.warn(`PRAGMA key error detected in build, trying with backup key...`)

        const backupDbEncryptionKey = await getBackupXmtpDbEncryptionKey({
          ethAddress,
        })

        const client = await _buildXmtpClient({
          ethereumAddress,
          inboxId,
          dbEncryptionKey: backupDbEncryptionKey,
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
    clientByEthAddress.delete(ethereumAddress)
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

  const existingPromise = clientByEthAddress.get(ethereumAddress)
  if (existingPromise) {
    return existingPromise
  }

  const buildPromise: Promise<IXmtpClientWithCodecs> = createXmtpBuildPromise({
    ethereumAddress,
    inboxId,
  })

  clientByEthAddress.set(ethereumAddress, buildPromise)
  clientByInboxId.set(inboxId, buildPromise)

  try {
    const client = await buildPromise
    return client
  } catch (error) {
    clientByEthAddress.delete(ethereumAddress)
    clientByInboxId.delete(inboxId)
    throw error
  }
}
