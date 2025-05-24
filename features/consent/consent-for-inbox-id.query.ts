import { IXmtpInboxId } from "@features/xmtp/xmtp.types"
import { queryOptions, skipToken, useQuery } from "@tanstack/react-query"
import { IConsentState } from "@/features/consent/consent.types"
import { convertXmtpConsentStateToConsentState } from "@/features/consent/consent.utils"
import { getXmtpConsentStateForInboxId } from "@/features/xmtp/xmtp-consent/xmtp-consent"
import { reactQueryClient } from "@/utils/react-query/react-query.client"
import { reactQueryLongCacheQueryOptions } from "@/utils/react-query/react-query.constants"
import { getReactQueryKey } from "@/utils/react-query/react-query.utils"

type IArgs = {
  clientInboxId: IXmtpInboxId
  inboxIdToCheck: IXmtpInboxId | undefined
}

type IStrictArgs = {
  clientInboxId: IXmtpInboxId
  inboxIdToCheck: IXmtpInboxId
}

export function getConsentForInboxIdQueryOptions(args: IArgs & { caller?: string }) {
  const { clientInboxId, inboxIdToCheck, caller } = args
  const enabled = !!clientInboxId && !!inboxIdToCheck

  return queryOptions({
    queryKey: getReactQueryKey({
      baseStr: "consent-for-inbox-id",
      clientInboxId,
      inboxIdToCheck,
    }),
    meta: {
      caller,
    },
    enabled,
    queryFn: enabled
      ? async () => {
          // eslint-disable-next-line custom-plugin/require-promise-error-handling
          const xmtpConsent = await getXmtpConsentStateForInboxId({
            clientInboxId,
            inboxIdToCheck,
          })

          const convosConsent = convertXmtpConsentStateToConsentState(xmtpConsent)

          return convosConsent
        }
      : skipToken,
    ...reactQueryLongCacheQueryOptions,
  })
}

export function useConsentForInboxIdQuery(args: IArgs & { caller: string }) {
  return useQuery(getConsentForInboxIdQueryOptions(args))
}

export function ensureConsentForInboxIdQueryData(args: IStrictArgs & { caller: string }) {
  return reactQueryClient.ensureQueryData(getConsentForInboxIdQueryOptions(args))
}

export function invalidateConsentForInboxIdQuery(args: IStrictArgs) {
  return reactQueryClient.invalidateQueries(getConsentForInboxIdQueryOptions(args))
}

export function getConsentForInboxIdQueryData(args: IStrictArgs) {
  return reactQueryClient.getQueryData(getConsentForInboxIdQueryOptions(args).queryKey)
}

export function setConsentForInboxIdQueryData(
  args: IStrictArgs & {
    consent: IConsentState
  },
) {
  return reactQueryClient.setQueryData(getConsentForInboxIdQueryOptions(args).queryKey, args)
}
