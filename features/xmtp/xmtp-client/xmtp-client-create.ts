import { IXmtpClientWithCodecs, IXmtpSigner } from "@features/xmtp/xmtp.types"
import { Client as XmtpClient } from "@xmtp/react-native-sdk"
import { config } from "@/config"
import { clientByEthAddress, clientByInboxId } from "@/features/xmtp/xmtp-client/xmtp-client-cache"
import {
  getBackupXmtpDbEncryptionKey,
  getOrCreateXmtpDbEncryptionKey,
} from "@/features/xmtp/xmtp-client/xmtp-client-db-encryption-key"
import { getXmtpLocalUrl } from "@/features/xmtp/xmtp-client/xmtp-client-utils"
import { ISupportedXmtpCodecs, supportedXmtpCodecs } from "@/features/xmtp/xmtp-codecs/xmtp-codecs"
import { xmtpIdentityIsEthereumAddress } from "@/features/xmtp/xmtp-identifier/xmtp-identifier"
import { wrapXmtpCallWithDuration } from "@/features/xmtp/xmtp.helpers"
import { XMTPError } from "@/utils/error"
import { lowercaseEthAddress } from "@/utils/evm/address"
import { xmtpLogger } from "@/utils/logger/logger"

export async function createXmtpClient(args: { inboxSigner: IXmtpSigner }) {
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
      const resolvedClientPromise = Promise.resolve(typedClient)

      // Cache the client by both Ethereum address and inbox ID
      clientByEthAddress.set(ethAddress, resolvedClientPromise)
      clientByInboxId.set(typedClient.inboxId, resolvedClientPromise)

      return typedClient
    } catch (error) {
      if (
        error instanceof Error &&
        error.message.includes("PRAGMA key or salt has incorrect value")
      ) {
        xmtpLogger.warn(`PRAGMA key error detected, trying with backup key...`)

        const backupDbEncryptionKey = await getBackupXmtpDbEncryptionKey({
          ethAddress,
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

        const resolvedClientPromise = Promise.resolve(typedClient)

        // Cache the client by both Ethereum address and inbox ID
        clientByEthAddress.set(ethAddress, resolvedClientPromise)
        clientByInboxId.set(typedClient.inboxId, resolvedClientPromise)

        return typedClient
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
