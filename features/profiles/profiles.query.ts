import { IXmtpInboxId } from "@features/xmtp/xmtp.types"
import { queryOptions, skipToken, useQuery } from "@tanstack/react-query"
import { fetchProfile, fetchProfilesBatch } from "@/features/profiles/profiles.api"
import { Optional } from "@/types/general"
import { isConvosApi404Error } from "@/utils/convos-api/convos-api-error"
import { reactQueryClient } from "@/utils/react-query/react-query.client"
import { getReactQueryKey } from "@/utils/react-query/react-query.utils"
import { TimeUtils } from "@/utils/time.utils"

type IProfileQueryData = Awaited<ReturnType<typeof fetchProfile>>

type IArgs = {
  xmtpId: IXmtpInboxId | undefined
}

type IArgsWithCaller = IArgs & {
  caller: string
}

export const getProfileQueryConfig = (args: Optional<IArgsWithCaller, "caller">) => {
  const { xmtpId, caller } = args
  const enabled = !!xmtpId

  return queryOptions({
    meta: {
      caller,
    },
    enabled,
    queryKey: getReactQueryKey({
      baseStr: "profile",
      xmtpId,
    }),
    staleTime: TimeUtils.hours(1).toMilliseconds(),
    queryFn: enabled
      ? async ({ signal }) => {
          try {
            return await fetchProfile({ xmtpId, signal })
          } catch (error) {
            // For now do this because if we chat with a bot for example, we'll never have a Convos profile
            if (isConvosApi404Error(error)) {
              return null
            }
            throw error
          }
        }
      : skipToken,
  })
}

export const useProfileQuery = (args: IArgsWithCaller) => {
  return useQuery(getProfileQueryConfig(args))
}

export const setProfileQueryData = (args: IArgs & { profile: IProfileQueryData }) => {
  const { profile } = args
  return reactQueryClient.setQueryData(getProfileQueryConfig(args).queryKey, profile)
}

export function updateProfileQueryData(args: IArgs & { data: Partial<IProfileQueryData> }) {
  const { data } = args
  return reactQueryClient.setQueryData(getProfileQueryConfig(args).queryKey, (oldData) => {
    if (!oldData) {
      return oldData
    }
    return {
      ...oldData,
      ...data,
    }
  })
}

export const ensureProfileQueryData = (args: IArgsWithCaller) => {
  return reactQueryClient.ensureQueryData(getProfileQueryConfig(args))
}

export const invalidateProfileQuery = (args: IArgsWithCaller) => {
  return reactQueryClient.invalidateQueries({
    queryKey: getProfileQueryConfig(args).queryKey,
  })
}

export const getProfileQueryData = (args: IArgs) => {
  return reactQueryClient.getQueryData(getProfileQueryConfig(args).queryKey)
}

export const getProfilesBatchQueryConfig = (args: {
  xmtpIds: IXmtpInboxId[]
  caller?: string
}) => {
  const { xmtpIds, caller } = args
  
  return queryOptions({
    meta: {
      caller,
    },
    enabled: xmtpIds.length > 0,
    queryKey: ["profiles-batch", JSON.stringify(xmtpIds)],
    staleTime: TimeUtils.hours(1).toMilliseconds(),
    queryFn: async ({ signal }) => {
      if (!xmtpIds.length) return { profiles: {} }
      
      const result = await fetchProfilesBatch({ 
        xmtpIds, 
        signal 
      })
      
      // Populate individual profile cache entries for all profiles received
      Object.entries(result.profiles).forEach(([id, profile]) => {
        const queryKey = getProfileQueryConfig({ xmtpId: id as IXmtpInboxId }).queryKey
        reactQueryClient.setQueryData(queryKey, profile)
      })
      
      return result
    },
  })
}

export const useProfilesBatchQuery = (args: { 
  xmtpIds: IXmtpInboxId[]
  caller: string 
}) => {
  return useQuery(getProfilesBatchQueryConfig(args))
}

export const ensureProfilesBatchData = async (args: {
  xmtpIds: IXmtpInboxId[]
  caller: string
}) => {
  const { xmtpIds, caller } = args
  
  if (!xmtpIds.length) return { profiles: {} }
  
  return reactQueryClient.ensureQueryData(getProfilesBatchQueryConfig({ xmtpIds, caller }))
}
