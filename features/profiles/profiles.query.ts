import { IXmtpInboxId } from "@features/xmtp/xmtp.types"
import { queryOptions, skipToken, useQueries, useQuery } from "@tanstack/react-query"
import { fetchProfile } from "@/features/profiles/profiles.api"
import { Optional } from "@/types/general"
import { isConvosApi404Error } from "@/utils/convos-api/convos-api-error"
import { reactQueryClient } from "@/utils/react-query/react-query.client"

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
    queryKey: ["profile", xmtpId],
    queryFn: enabled
      ? async () => {
          try {
            return await fetchProfile({ xmtpId })
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
