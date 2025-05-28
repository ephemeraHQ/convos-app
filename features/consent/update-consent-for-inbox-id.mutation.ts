import { IXmtpInboxId } from "@features/xmtp/xmtp.types"
import { MutationObserver, MutationOptions, useMutation } from "@tanstack/react-query"
import { IConsentState } from "@/features/consent/consent.types"
import { setXmtpConsentStateForInboxId } from "@/features/xmtp/xmtp-consent/xmtp-consent"
import { reactQueryClient } from "@/utils/react-query/react-query.client"
import {
  getConsentForInboxIdQueryData,
  setConsentForInboxIdQueryData,
} from "./consent-for-inbox-id.query"

export type IUpdateConsentForInboxIdMutationArgs = {
  clientInboxId: IXmtpInboxId
  peerInboxId: IXmtpInboxId
  consent: IConsentState
}

export function getUpdateConsentForInboxIdMutationOptions(): MutationOptions<
  void,
  Error,
  IUpdateConsentForInboxIdMutationArgs,
  { previousConsent: IConsentState }
> {
  return {
    mutationFn: async (args: IUpdateConsentForInboxIdMutationArgs) => {
      const { clientInboxId, peerInboxId, consent } = args

      // eslint-disable-next-line custom-plugin/require-promise-error-handling
      await setXmtpConsentStateForInboxId({
        clientInboxId,
        peerInboxId,
        consent,
      })
    },
    onMutate: async (variables) => {
      // Get the previous data before updating
      const previousConsent = getConsentForInboxIdQueryData({
        clientInboxId: variables.clientInboxId,
        inboxIdToCheck: variables.peerInboxId,
      })

      // Update the data optimistically
      setConsentForInboxIdQueryData({
        clientInboxId: variables.clientInboxId,
        inboxIdToCheck: variables.peerInboxId,
        consent: variables.consent,
      })

      return { previousConsent }
    },
    onError: (_, variables, context) => {
      // On error, roll back to the previous value
      if (context?.previousConsent) {
        setConsentForInboxIdQueryData({
          clientInboxId: variables.clientInboxId,
          inboxIdToCheck: variables.peerInboxId,
          consent: context.previousConsent,
        })
      }
    },
  }
}

export function executeUpdateConsentForInboxIdMutation(args: IUpdateConsentForInboxIdMutationArgs) {
  const mutationObserver = new MutationObserver(
    reactQueryClient,
    getUpdateConsentForInboxIdMutationOptions(),
  )
  return mutationObserver.mutate(args)
}

export function useUpdateConsentForInboxIdMutation() {
  return useMutation(getUpdateConsentForInboxIdMutationOptions())
}
