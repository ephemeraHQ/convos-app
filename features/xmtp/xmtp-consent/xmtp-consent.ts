import { IXmtpConsentState, IXmtpConversationId, IXmtpInboxId } from "@features/xmtp/xmtp.types"
import { getXmtpClientByInboxId } from "@/features/xmtp/xmtp-client/xmtp-client"
import { wrapXmtpCallWithDuration } from "@/features/xmtp/xmtp.helpers"
import { XMTPError } from "@/utils/error"
import { IEthereumAddress } from "@/utils/evm/address"

export async function xmtpInboxIdCanMessageEthAddress(args: {
  inboxId: IXmtpInboxId
  ethAddress: IEthereumAddress
}) {
  const { inboxId, ethAddress } = args

  const client = await getXmtpClientByInboxId({
    inboxId,
  })

  if (!client) {
    throw new Error("Client not found")
  }

  const canMessageResult = await wrapXmtpCallWithDuration("canMessage", () =>
    client.canMessage([{ kind: "ETHEREUM", identifier: ethAddress }]),
  )

  return canMessageResult[ethAddress.toLowerCase()]
}

// export const updateConsentForAddressesForAccount = async (args: {
//   account: string
//   addresses: string[]
//   consent: ConsentState
// }) => {
//   const { account, addresses, consent } = args

//   const client = await getXmtpClientByEthAddress({
//     ethAddress: account,
//   })

//   if (!client) {
//     throw new Error("Client not found")
//   }

//   const start = new Date().getTime()

//   if (consent === "allowed") {
//     for (const address of addresses) {
//       await client.preferences.setConsentState({
//         value: address,
//         entryType: "address",
//         state: "allowed",
//       })
//     }
//   } else if (consent === "denied") {
//     for (const address of addresses) {
//       await client.preferences.setConsentState({
//         value: address,
//         entryType: "address",
//         state: "denied",
//       })
//     }
//   } else {
//     throw new Error(`Invalid consent type: ${consent}`)
//   }

//   const end = new Date().getTime()
//     `[XMTPRN Contacts] Consented to addresses on protocol in ${(end - start) / 1000} sec`,
//   )
// }

export const syncXmtpConsent = async (inboxId: IXmtpInboxId) => {
  const client = await getXmtpClientByInboxId({
    inboxId,
  })
  try {
    await wrapXmtpCallWithDuration("syncConsent", () => client.preferences.syncConsent())
  } catch (error) {
    throw new XMTPError({
      error,
      additionalMessage: "failed to sync consent",
    })
  }
}

export async function setXmtpConsentStateForInboxId(args: {
  peerInboxId: IXmtpInboxId
  consent: IXmtpConsentState
}) {
  const { peerInboxId, consent } = args

  try {
    const client = await getXmtpClientByInboxId({
      inboxId: peerInboxId,
    })

    await wrapXmtpCallWithDuration("setConsentState", () =>
      client.preferences.setConsentState({
        value: peerInboxId,
        entryType: "inbox_id",
        state: consent,
      }),
    )
  } catch (error) {
    throw new XMTPError({
      error,
      additionalMessage: "failed to set XMTP consent state for inboxId",
    })
  }
}

export const updateXmtpConsentForGroupsForInbox = async (args: {
  groupIds: IXmtpConversationId[]
  consent: IXmtpConsentState
  clientInboxId: IXmtpInboxId
}) => {
  const { clientInboxId, groupIds, consent } = args
  try {
    const client = await getXmtpClientByInboxId({
      inboxId: clientInboxId,
    })

    if (!client) {
      throw new Error("Client not found")
    }

    for (const groupId of groupIds) {
      await wrapXmtpCallWithDuration("setConsentState (group)", () =>
        client.preferences.setConsentState({
          value: groupId,
          entryType: "conversation_id",
          state: consent,
        }),
      )
    }
  } catch (error) {
    throw new XMTPError({
      error,
      additionalMessage: "Failed to update consent for groups",
    })
  }
}
