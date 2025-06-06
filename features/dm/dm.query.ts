/**
 * TODO: Maybe delete this and just use the conversation query instead and add a "peer" argument?
 */
import { QueryKey, queryOptions, useQuery, UseQueryOptions } from "@tanstack/react-query"
import { IDm } from "@/features/dm/dm.types"
import { reactQueryClient } from "@/utils/react-query/react-query.client"
import { getConversationQueryOptions } from "../conversation/queries/conversation.query"
import { IXmtpConversationId, IXmtpInboxId } from "../xmtp/xmtp.types"

type IDmQueryArgs = {
  clientInboxId: IXmtpInboxId
  xmtpConversationId: IXmtpConversationId
}

export function getDmQueryOptions(args: IDmQueryArgs & { caller?: string }) {
  const { clientInboxId, xmtpConversationId, caller = "getDmQueryOptions" } = args
  return queryOptions({
    ...(getConversationQueryOptions({
      clientInboxId,
      xmtpConversationId,
      caller,
    }) as UseQueryOptions<IDm | null, Error, IDm | null, QueryKey>),
  })
}

export function useDmQuery(args: IDmQueryArgs & { caller: string }) {
  return useQuery({
    ...getDmQueryOptions(args),
  })
}

export function setDmQueryData(args: IDmQueryArgs & { dm: IDm }) {
  const { clientInboxId, xmtpConversationId, dm } = args
  return reactQueryClient.setQueryData(
    getDmQueryOptions({ clientInboxId, xmtpConversationId }).queryKey,
    dm,
  )
}

export function getDmQueryData(args: IDmQueryArgs) {
  return reactQueryClient.getQueryData(getDmQueryOptions(args).queryKey) as IDm | null
}
