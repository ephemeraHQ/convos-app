import { IXmtpInboxId } from "@features/xmtp/xmtp.types"
import { queryOptions, skipToken, useQuery } from "@tanstack/react-query"
import { reactQueryClient } from "@/utils/react-query/react-query.client"
import { getReactQueryKey } from "@/utils/react-query/react-query.utils"
import { xmtpInboxIdExists } from "./xmtp-inbox-id-exist"

type IArgs = {
  clientInboxId: IXmtpInboxId
  inboxId: IXmtpInboxId | undefined
}

type IStrictArgs = {
  clientInboxId: IXmtpInboxId
  inboxId: IXmtpInboxId
}

export function getXmtpInboxIdExistQueryOptions(args: IArgs) {
  const { clientInboxId, inboxId } = args

  return queryOptions({
    queryKey: getReactQueryKey({
      baseStr: "xmtp-inbox-id-exist",
      clientInboxId,
      inboxId,
    }),
    queryFn:
      clientInboxId && inboxId
        ? () => {
            return xmtpInboxIdExists({
              clientInboxId,
              inboxId,
            })
          }
        : skipToken,
  })
}

export function useXmtpInboxIdExistQuery(args: IArgs) {
  return useQuery(getXmtpInboxIdExistQueryOptions(args))
}

export function ensureXmtpInboxIdExistQueryData(args: IStrictArgs) {
  return reactQueryClient.ensureQueryData(getXmtpInboxIdExistQueryOptions(args))
}

export function invalidateXmtpInboxIdExistQuery(args: IStrictArgs) {
  return reactQueryClient.invalidateQueries(getXmtpInboxIdExistQueryOptions(args))
}

export function getXmtpInboxIdExistQueryData(args: IStrictArgs) {
  return reactQueryClient.getQueryData(getXmtpInboxIdExistQueryOptions(args).queryKey)
}
