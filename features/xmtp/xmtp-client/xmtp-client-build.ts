import { IXmtpClientWithCodecs, IXmtpInboxId } from "@features/xmtp/xmtp.types"
import { PublicIdentity, Client as XmtpClient } from "@xmtp/react-native-sdk"
import { config } from "@/config"
import { clientByEthAddress, clientByInboxId } from "@/features/xmtp/xmtp-client/xmtp-client-cache"
import {
  getBackupXmtpDbEncryptionKey,
  getOrCreateXmtpDbEncryptionKey,
} from "@/features/xmtp/xmtp-client/xmtp-client-db-encryption-key"
import { getXmtpLocalUrl } from "@/features/xmtp/xmtp-client/xmtp-client-utils"
import { ISupportedXmtpCodecs, supportedXmtpCodecs } from "@/features/xmtp/xmtp-codecs/xmtp-codecs"
import { setXmtpInstallationQueryData } from "@/features/xmtp/xmtp-installations/xmtp-installation.query"
import { wrapXmtpCallWithDuration } from "@/features/xmtp/xmtp.helpers"
import { XMTPError } from "@/utils/error"
import { IEthereumAddress, lowercaseEthAddress } from "@/utils/evm/address"
import { xmtpLogger } from "@/utils/logger/logger"

export async function buildXmtpClientInstance(args: {
  ethereumAddress: IEthereumAddress
  inboxId: IXmtpInboxId
}) {
  const { ethereumAddress, inboxId } = args

  try {
    // Check if there's already a client build in progress for this address
    const existingPromise = clientByEthAddress.get(ethereumAddress)
    if (existingPromise) {
      return existingPromise
    }

    // Create the build promise logic inline
    const buildPromise = (async () => {
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

          // Store in inboxIdCache once we have the actual inboxId
          clientByInboxId.set(typedClient.inboxId, Promise.resolve(typedClient))

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

            // Store in inboxIdCache once we have the actual inboxId
            clientByInboxId.set(typedClient.inboxId, Promise.resolve(typedClient))

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
        clientByEthAddress.delete(ethereumAddress)
        throw new XMTPError({
          error,
          additionalMessage: `Failed to build XMTP client for address: ${ethereumAddress}`,
        })
      }
    })()

    // Store the promise in both caches
    clientByEthAddress.set(ethereumAddress, buildPromise)
    clientByInboxId.set(inboxId, buildPromise)

    return buildPromise
  } catch (error) {
    throw new XMTPError({
      error,
      additionalMessage: `Failed to build XMTP client for address: ${ethereumAddress}`,
    })
  }
}
