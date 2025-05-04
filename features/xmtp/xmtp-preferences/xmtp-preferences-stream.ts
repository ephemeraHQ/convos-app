import { IXmtpInboxId } from "@features/xmtp/xmtp.types"
import { ConsentRecord } from "@xmtp/react-native-sdk"
import { PreferenceUpdates } from "@xmtp/react-native-sdk/build/lib/PrivatePreferences"
import { wrapXmtpCallWithDuration } from "@/features/xmtp/xmtp.helpers"
import { XMTPError } from "@/utils/error"
import { getXmtpClientByInboxId } from "../xmtp-client/xmtp-client"

export const startStreamXmtpConsent = async (args: {
  clientInboxId: IXmtpInboxId
  onConsentUpdated: (consent: ConsentRecord) => void
}) => {
  const { clientInboxId, onConsentUpdated } = args

  const client = await getXmtpClientByInboxId({
    inboxId: clientInboxId,
  })

  try {
    await client.preferences.streamConsent(async (consent) => {
      onConsentUpdated(consent)
    })
  } catch (error) {
    throw new XMTPError({
      error,
      additionalMessage: "Failed to stream consent",
    })
  }
}

export const stopStreamingXmtpConsent = async (args: { clientInboxId: IXmtpInboxId }) => {
  const { clientInboxId } = args

  const client = await getXmtpClientByInboxId({
    inboxId: clientInboxId,
  })

  try {
    await wrapXmtpCallWithDuration("cancelStreamConsent", () =>
      Promise.resolve(client.preferences.cancelStreamConsent()),
    )
  } catch (error) {
    throw new XMTPError({
      error,
      additionalMessage: "Failed to stop consent stream",
    })
  }
}

export const startStreamingXmtpPreferences = async (args: {
  clientInboxId: IXmtpInboxId
  onPreferenceUpdated: (preference: PreferenceUpdates) => void
}) => {
  const { clientInboxId, onPreferenceUpdated } = args

  try {
    const client = await getXmtpClientByInboxId({
      inboxId: clientInboxId,
    })

    await wrapXmtpCallWithDuration("streamPreferenceUpdates", () =>
      client.preferences.streamPreferenceUpdates(async (preference) => {
        onPreferenceUpdated(preference)
      }),
    )
  } catch (error) {
    throw new XMTPError({
      error,
      additionalMessage: "Failed to stream preferences",
    })
  }
}

export const stopStreamingXmtpPreferences = async (args: { clientInboxId: IXmtpInboxId }) => {
  const { clientInboxId } = args

  const client = await getXmtpClientByInboxId({
    inboxId: clientInboxId,
  })

  try {
    await wrapXmtpCallWithDuration("cancelStreamPreferenceUpdates", () =>
      Promise.resolve(client.preferences.cancelStreamPreferenceUpdates()),
    )
  } catch (error) {
    throw new XMTPError({
      error,
      additionalMessage: "Failed to stop preferences stream",
    })
  }
}
