/**
 * Maybe need to move this file somewhere else? Not sure which specific feature it belongs to.
 */
import { IXmtpInboxId } from "@features/xmtp/xmtp.types"
import { queryOptions, skipToken, useQuery } from "@tanstack/react-query"
import { create, windowScheduler } from "@yornaath/batshit"
import { reactQueryClient } from "@/utils/react-query/react-query.client"
import { reactQueryLongCacheQueryOptions } from "@/utils/react-query/react-query.constants"
import { getReactQueryKey } from "@/utils/react-query/react-query.utils"
import { getEthAddressesFromInboxIds } from "./eth-addresses-from-xmtp-inbox-id"

type IArgs = {
  clientInboxId: IXmtpInboxId
  inboxId: IXmtpInboxId | undefined
}

type IStrictArgs = {
  clientInboxId: IXmtpInboxId
  inboxId: IXmtpInboxId
}

export function getEthAddressesForXmtpInboxIdQueryOptions(args: IArgs & { caller?: string }) {
  const { clientInboxId, inboxId, caller } = args
  const enabled = !!clientInboxId && !!inboxId

  return queryOptions({
    queryKey: getReactQueryKey({
      baseStr: "eth-addresses-for-xmtp-inbox-id",
      clientInboxId,
      inboxId,
    }),
    meta: {
      caller,
    },
    enabled,
    queryFn: enabled
      ? () => {
          const batcher = getBatcher(clientInboxId)
          return batcher.fetch(inboxId)
        }
      : skipToken,
    ...reactQueryLongCacheQueryOptions,
  })
}

export function useEthAddressesForXmtpInboxIdQuery(args: IArgs & { caller: string }) {
  return useQuery(getEthAddressesForXmtpInboxIdQueryOptions(args))
}

export function ensureEthAddressesForXmtpInboxIdQueryData(args: IStrictArgs & { caller: string }) {
  return reactQueryClient.ensureQueryData(getEthAddressesForXmtpInboxIdQueryOptions(args))
}

export function invalidateEthAddressesForXmtpInboxIdQuery(args: IStrictArgs) {
  return reactQueryClient.invalidateQueries(getEthAddressesForXmtpInboxIdQueryOptions(args))
}

export function getEthAddressesForXmtpInboxIdQueryData(args: IStrictArgs) {
  return reactQueryClient.getQueryData(getEthAddressesForXmtpInboxIdQueryOptions(args).queryKey)
}

// Create a batcher for each client inbox ID
const batchersByClientInboxId = new Map<IXmtpInboxId, ReturnType<typeof createBatcher>>()

function createBatcher(clientInboxId: IXmtpInboxId) {
  return create({
    name: `eth-addresses-for-xmtp-inbox-id-${clientInboxId}`,
    fetcher: async (inboxIds: IXmtpInboxId[]) => {
      return await getEthAddressesFromInboxIds({
        clientInboxId,
        inboxIds,
      })
    },
    scheduler: windowScheduler(100),
    resolver: (addressesByInboxId, inboxId) => {
      return addressesByInboxId[inboxId] || []
    },
  })
}

// Get or create a batcher for a specific client inbox ID
function getBatcher(clientInboxId: IXmtpInboxId) {
  let batcher = batchersByClientInboxId.get(clientInboxId)
  if (!batcher) {
    batcher = createBatcher(clientInboxId)
    batchersByClientInboxId.set(clientInboxId, batcher)
  }
  return batcher
}
