import { Optional, queryOptions, skipToken, useQuery } from "@tanstack/react-query"
import { IEthereumAddress, isEthereumAddress } from "@/utils/evm/address"
import { reactQueryClient } from "@/utils/react-query/react-query.client"
import { getReactQueryKey } from "@/utils/react-query/react-query.utils"
import { TimeUtils } from "@/utils/time.utils"
import { fetchSocialProfilesForAddress } from "./social-profiles.api"

type IArgs = {
  ethAddress: IEthereumAddress | undefined
}

type IArgsWithCaller = IArgs & {
  caller: string
}

type IStrictArgs = {
  ethAddress: IEthereumAddress
}

type IStrictArgsWithCaller = IStrictArgs & {
  caller: string
}

const getSocialProfilesForAddressQueryOptions = (args: Optional<IArgsWithCaller, "caller">) => {
  const { ethAddress, caller } = args
  return queryOptions({
    queryKey: getReactQueryKey({
      baseStr: "social-profiles-for-eth-address",
      ethAddress,
    }),
    meta: {
      caller,
    },
    enabled: ethAddress && isEthereumAddress(ethAddress),
    queryFn:
      ethAddress && isEthereumAddress(ethAddress)
        ? () => {
            return fetchSocialProfilesForAddress({
              ethAddress,
            })
          }
        : skipToken,
    staleTime: TimeUtils.days(30).toMilliseconds(), // 30 days, it's very rare that this should change
  })
}

export const useSocialProfilesForAddressQuery = (args: IArgsWithCaller) => {
  return useQuery(getSocialProfilesForAddressQueryOptions(args))
}

export const ensureSocialProfilesForAddressQuery = async (args: IStrictArgsWithCaller) => {
  return reactQueryClient.ensureQueryData(getSocialProfilesForAddressQueryOptions(args))
}

export async function ensureSocialProfilesForAddressesQuery(args: {
  ethAddresses: IEthereumAddress[]
  caller: string
}) {
  return (
    await Promise.all(
      args.ethAddresses.map((ethAddress) =>
        reactQueryClient.fetchQuery(
          getSocialProfilesForAddressQueryOptions({ ethAddress, caller: args.caller }),
        ),
      ),
    )
  ).flat()
}

export function getSocialProfilesForEthAddressQueryData(args: IStrictArgs) {
  return reactQueryClient.getQueryData(getSocialProfilesForAddressQueryOptions(args).queryKey)
}
