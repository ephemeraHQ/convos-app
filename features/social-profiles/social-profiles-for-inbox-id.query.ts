import { ensureEthAddressesForXmtpInboxIdQueryData } from "@features/xmtp/xmtp-inbox-id/eth-addresses-for-xmtp-inbox-id.query"
import { IXmtpInboxId } from "@features/xmtp/xmtp.types"
import { queryOptions, useQuery } from "@tanstack/react-query"
import { ensureSocialProfilesForAddressesQuery } from "@/features/social-profiles/social-profiles.query"
import { reactQueryClient } from "@/utils/react-query/react-query.client"
import { getReactQueryKey } from "@/utils/react-query/react-query.utils"
import { TimeUtils } from "@/utils/time.utils"

type IArgs = {
  inboxId: IXmtpInboxId | undefined
  clientInboxId: IXmtpInboxId
  caller: string
}

export function getSocialProfilesForInboxIdQueryOptions(args: IArgs) {
  const { inboxId, clientInboxId, caller } = args

  return queryOptions({
    // eslint-disable-next-line @tanstack/query/exhaustive-deps
    queryKey: getReactQueryKey({
      baseStr: "social-profiles-for-inbox-id",
      inboxId,
      clientInboxId,
    }),
    meta: {
      caller,
    },
    gcTime: TimeUtils.days(30).toMilliseconds(),
    staleTime: TimeUtils.days(30).toMilliseconds(),
    queryFn: async () => {
      if (!inboxId || !clientInboxId) {
        return []
      }

      const ethAddresses = await ensureEthAddressesForXmtpInboxIdQueryData({
        inboxId,
        clientInboxId,
        caller,
      })

      if (!ethAddresses || ethAddresses.length === 0) {
        return []
      }

      return ensureSocialProfilesForAddressesQuery({
        ethAddresses,
        caller,
      })
    },
    enabled: Boolean(inboxId) && Boolean(clientInboxId),
  })
}

export function useSocialProfilesForInboxIdQuery(args: IArgs) {
  return useQuery(getSocialProfilesForInboxIdQueryOptions(args))
}

export async function ensureSocialProfilesForInboxIdQueryData(args: IArgs) {
  return reactQueryClient.ensureQueryData(getSocialProfilesForInboxIdQueryOptions(args))
}

export function invalidateSocialProfilesForInboxIdQuery(args: IArgs) {
  return reactQueryClient.invalidateQueries(getSocialProfilesForInboxIdQueryOptions(args))
}

export function getSocialProfilesForInboxIdQueryData(args: IArgs) {
  return reactQueryClient.getQueryData(getSocialProfilesForInboxIdQueryOptions(args).queryKey)
}
