import { getXmtpClientByInboxId } from "@/features/xmtp/xmtp-client/xmtp-client"
import { wrapXmtpCallWithDuration } from "@/features/xmtp/xmtp.helpers"
import { IXmtpClientWithCodecs, IXmtpInboxId, IXmtpSigner } from "@/features/xmtp/xmtp.types"
import { XMTPError } from "@/utils/error"

export async function getXmtpClientOtherInstallations(args: { clientInboxId: IXmtpInboxId }) {
  const { clientInboxId } = args

  try {
    const client = await getXmtpClientByInboxId({ inboxId: clientInboxId })
    const inboxState = await wrapXmtpCallWithDuration("client.inboxState(true)", () =>
      client.inboxState(true),
    )
    const installationIds = inboxState.installations.map((i) => i.id)
    const otherInstallations = installationIds.filter((id) => id !== client.installationId)
    return otherInstallations
  } catch (error) {
    throw new XMTPError({
      error,
      additionalMessage: "Failed to get other XMTP installations",
    })
  }
}

export async function validateXmtpInstallation(args: { inboxId: IXmtpInboxId }) {
  const { inboxId } = args

  try {
    const client = await getXmtpClientByInboxId({ inboxId })

    const inboxState = await wrapXmtpCallWithDuration("getInboxState", () =>
      client.inboxState(true),
    )
    const installationsIds = inboxState.installations.map((i) => i.id)
    return installationsIds.includes(client.installationId)
  } catch (error) {
    throw new XMTPError({
      error,
      additionalMessage: "Failed to validate XMTP installation",
    })
  }
}

export async function revokeOtherInstallations(args: {
  signer: IXmtpSigner
  client: IXmtpClientWithCodecs
  otherInstallationsCount: number
}) {
  // const { client, otherInstallationsCount } = args
  // if (otherInstallationsCount === 0) return false
  // logger.warn(`Inbox ${client.inboxId} has ${otherInstallationsCount} installations to revoke`)
  // // We're on a mobile wallet so we need to ask the user first
  // const doRevoke = await awaitableAlert(
  //   translate("other_installations_count", {
  //     count: otherInstallationsCount,
  //   }),
  //   translate("revoke_description"),
  //   "Yes",
  //   "No",
  // )
  // if (!doRevoke) {
  //   logger.debug(`[Onboarding] User decided not to revoke`)
  //   return false
  // }
  // logger.debug(`[Onboarding] User decided to revoke ${otherInstallationsCount} installation`)
  // // TODO
  // // await client.revokeAllOtherInstallations(ethersSignerToXmtpSigner(signer));
  // logger.debug(`[Onboarding] Installations revoked.`)
  // return true
}

export async function signWithXmtpInstallationId(args: {
  clientInboxId: IXmtpInboxId
  message: string
}) {
  const { clientInboxId, message } = args

  try {
    const client = await getXmtpClientByInboxId({ inboxId: clientInboxId })

    const signature = await wrapXmtpCallWithDuration("signWithInstallationKey", () =>
      client.signWithInstallationKey(message),
    )

    return signature
  } catch (error) {
    throw new XMTPError({
      error,
      additionalMessage: "Failed to sign with XMTP installation ID",
    })
  }
}
