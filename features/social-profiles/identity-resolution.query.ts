import { useQuery } from "@tanstack/react-query"
import { identityResolutionApi } from "@/features/social-profiles/identity-resolution.api"
import {
  isValidBaseName,
  isValidEnsName,
  isValidUnstoppableDomainName,
} from "@/features/social-profiles/name-validation.utils"
import { IEthereumAddress } from "@/utils/evm/address"
import { TimeUtils } from "@/utils/time.utils"

export function useEnsNameResolution(name: string | undefined) {
  const isValid = isValidEnsName(name)

  return useQuery({
    queryKey: ["identity", "ens", name],
    queryFn: async () =>
      (await identityResolutionApi.resolveEnsName({ name: name! })) as IEthereumAddress,
    enabled: Boolean(name) && isValid,
    staleTime: TimeUtils.days(30).toMilliseconds(), // 30 days, it's very rare that we need to refetch this
  })
}

export function useBaseNameResolution(name: string | undefined) {
  const isValid = isValidBaseName(name)

  return useQuery({
    queryKey: ["identity", "base", name],
    queryFn: async () =>
      (await identityResolutionApi.resolveBaseName({ name: name! })) as IEthereumAddress,
    enabled: Boolean(name) && isValid,
    staleTime: TimeUtils.days(30).toMilliseconds(), // 30 days, it's very rare that we need to refetch this
  })
}

export function useUnstoppableDomainNameResolution(name: string | undefined) {
  const isValid = isValidUnstoppableDomainName(name)

  return useQuery({
    queryKey: ["identity", "unstoppable-domains", name],
    queryFn: async () =>
      (await identityResolutionApi.resolveUnstoppableDomainName({
        name: name!,
      })) as IEthereumAddress,
    enabled: Boolean(name) && isValid,
    staleTime: TimeUtils.days(30).toMilliseconds(), // 30 days, it's very rare that we need to refetch this
  })
}
