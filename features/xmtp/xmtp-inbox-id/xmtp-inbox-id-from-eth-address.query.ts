import { queryOptions, skipToken, useQuery } from "@tanstack/react-query"
import { getInboxIdFromEthAddress } from "@/features/xmtp/xmtp-inbox-id/xmtp-inbox-id-from-eth-address"
import { IXmtpInboxId } from "@/features/xmtp/xmtp.types"
import { IEthereumAddress } from "@/utils/evm/address"
import { reactQueryClient } from "@/utils/react-query/react-query.client"
import { reactQueryLongCacheQueryOptions } from "@/utils/react-query/react-query.constants"

type IArgs = {
  clientInboxId: IXmtpInboxId | undefined
  targetEthAddress: IEthereumAddress | undefined
}

type IStrictArgs = {
  clientInboxId: IXmtpInboxId
  targetEthAddress: IEthereumAddress
}

export function getXmtpInboxIdFromEthAddressQueryOptions(args: IArgs & { caller?: string }) {
  const { clientInboxId, targetEthAddress, caller } = args

  return queryOptions({
    queryKey: ["xmtp-inbox-id-from-eth-address", clientInboxId, targetEthAddress],
    meta: { caller },
    queryFn:
      clientInboxId && targetEthAddress
        ? () => {
            return getInboxIdFromEthAddress({
              clientInboxId,
              targetEthAddress,
            })
          }
        : skipToken,
    ...reactQueryLongCacheQueryOptions,
  })
}

export function useXmtpInboxIdFromEthAddressQuery(args: IArgs & { caller: string }) {
  return useQuery(getXmtpInboxIdFromEthAddressQueryOptions(args))
}

export async function invalidateXmtpInboxIdFromEthAddressQuery(args: IStrictArgs) {
  await reactQueryClient.invalidateQueries(getXmtpInboxIdFromEthAddressQueryOptions(args))
}

export function getXmtpInboxIdFromEthAddressQueryData(args: IArgs) {
  return reactQueryClient.getQueryData(getXmtpInboxIdFromEthAddressQueryOptions(args).queryKey)
}
export function ensureXmtpInboxIdFromEthAddressQueryData(args: IArgs & { caller: string }) {
  return reactQueryClient.ensureQueryData(getXmtpInboxIdFromEthAddressQueryOptions(args))
}
