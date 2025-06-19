import { skipToken, useQuery } from "@tanstack/react-query"
import { identityResolutionApi } from "@/features/social-profiles/identity-resolution.api"
import {
  isValidBaseName,
  isValidEnsName,
  isValidUnstoppableDomainName,
} from "@/features/social-profiles/name-validation.utils"
import { IEthereumAddress } from "@/utils/evm/address"
import { reactQueryLongCacheQueryOptions } from "@/utils/react-query/react-query.constants"

export function useEnsNameResolution(name: string | undefined) {
  const trimmedName = name?.trim()
  const isValid = isValidEnsName(trimmedName)

  return useQuery({
    queryKey: ["identity", "ens", trimmedName],
    queryFn: async () =>
      (await identityResolutionApi.resolveEnsName({ name: trimmedName! })) as IEthereumAddress,
    enabled: Boolean(trimmedName) && isValid,
    ...reactQueryLongCacheQueryOptions,
  })
}

export function useBaseNameResolution(name: string | undefined) {
  const trimmedName = name?.trim()
  const isValid = isValidBaseName(trimmedName)

  return useQuery({
    queryKey: ["identity", "base", trimmedName],
    queryFn: async () =>
      (await identityResolutionApi.resolveBaseName({ name: trimmedName! })) as IEthereumAddress,
    enabled: Boolean(trimmedName) && isValid,
    ...reactQueryLongCacheQueryOptions,
  })
}

export function useUnstoppableDomainNameResolution(name: string | undefined) {
  const trimmedName = name?.trim()
  const isValid = isValidUnstoppableDomainName(trimmedName)

  return useQuery({
    queryKey: ["identity", "unstoppable-domains", trimmedName],
    queryFn: trimmedName
      ? async () =>
          (await identityResolutionApi.resolveUnstoppableDomainName({
            name: trimmedName,
          })) as IEthereumAddress
      : skipToken,
    enabled: Boolean(trimmedName) && isValid,
    ...reactQueryLongCacheQueryOptions,
  })
}
