import { skipToken, useQuery } from "@tanstack/react-query"
import { identityResolutionApi } from "@/features/social-profiles/identity-resolution.api"
import {
  isValidBaseName,
  isValidEnsName,
  isValidUnstoppableDomainName,
} from "@/features/social-profiles/name-validation.utils"
import { IEthereumAddress } from "@/utils/evm/address"
import { TimeUtils } from "@/utils/time.utils"

export function useEnsNameResolution(name: string | undefined) {
  const trimmedName = name?.trim()
  const isValid = isValidEnsName(trimmedName)

  return useQuery({
    queryKey: ["identity", "ens", trimmedName],
    queryFn: async () =>
      (await identityResolutionApi.resolveEnsName({ name: trimmedName! })) as IEthereumAddress,
    enabled: Boolean(trimmedName) && isValid,
    staleTime: TimeUtils.days(30).toMilliseconds(), // 30 days, it's very rare that we need to refetch this
    gcTime: TimeUtils.days(30).toMilliseconds(), // 30 days, it's very rare that we need to refetch this
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
    staleTime: TimeUtils.days(30).toMilliseconds(), // 30 days, it's very rare that we need to refetch this
    gcTime: TimeUtils.days(30).toMilliseconds(), // 30 days, it's very rare that we need to refetch this
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
    staleTime: TimeUtils.days(30).toMilliseconds(), // 30 days, it's very rare that we need to refetch this
    gcTime: TimeUtils.days(30).toMilliseconds(), // 30 days, it's very rare that we need to refetch this
  })
}
