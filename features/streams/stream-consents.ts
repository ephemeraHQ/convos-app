import {
  startStreamXmtpConsent,
  stopStreamingXmtpConsent,
} from "@/features/xmtp/xmtp-preferences/xmtp-preferences-stream"
import { IXmtpInboxId } from "@/features/xmtp/xmtp.types"
import { streamLogger } from "@/utils/logger/logger"

export async function startConsentStreaming(args: { clientInboxId: IXmtpInboxId }) {
  const { clientInboxId } = args

  await startStreamXmtpConsent({
    clientInboxId,
    onConsentUpdated: (consent) => {
      streamLogger.debug("Consent updated", consent)
    },
  })
}

export async function stopConsentStreaming(args: { clientInboxId: IXmtpInboxId }) {
  const { clientInboxId } = args

  await stopStreamingXmtpConsent({ clientInboxId })
}
