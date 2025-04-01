import { Optional, queryOptions, skipToken, useQueries, useQuery } from "@tanstack/react-query"
import { IEthereumAddress, isEthereumAddress } from "@/utils/evm/address"
import { reactQueryClient } from "@/utils/react-query/react-query.client"
import { getReactQueryKey } from "@/utils/react-query/react-query.utils"
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
    staleTime: 30 * 24 * 60 * 60 * 1000, // 30 days, it's very rare that we need to refetch this
  })
}

export const useSocialProfilesForAddressQuery = (args: IArgsWithCaller) => {
  return useQuery(getSocialProfilesForAddressQueryOptions(args))
}

export function useSocialProfilesForEthAddressQueries(args: {
  ethAddresses: IEthereumAddress[]
  caller: string
}) {
  const { ethAddresses, caller } = args
  return useQueries({
    queries: ethAddresses.map((ethAddress) =>
      getSocialProfilesForAddressQueryOptions({ ethAddress, caller }),
    ),
    combine: (results) => ({
      data: results.map((result) => result.data),
      isLoading: results.some((result) => result.isLoading),
      isError: results.some((result) => result.isError),
      error: results.find((result) => result.error)?.error,
    }),
  })
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
