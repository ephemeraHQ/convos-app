import { queryOptions, skipToken, useQuery } from "@tanstack/react-query"
import { fetchUserIdentities } from "@/features/convos-identities/convos-identities.api"
import { IConvosUserId } from "@/features/current-user/current-user.types"
import { reactQueryClient } from "@/utils/react-query/react-query.client"
import { getReactQueryKey } from "@/utils/react-query/react-query.utils"

export function getUserIdentitiesQueryOptions(args: {
  userId: IConvosUserId | undefined
  caller?: string
}) {
  const { userId, caller } = args
  return queryOptions({
    queryKey: getReactQueryKey({
      baseStr: "current-user-identities",
      userId,
    }),
    meta: {
      caller,
    },
    queryFn: userId ? () => fetchUserIdentities({ userId }) : skipToken,
  })
}

export async function ensureUserIdentitiesQueryData(args: { userId: IConvosUserId }) {
  const { userId } = args
  return reactQueryClient.ensureQueryData(getUserIdentitiesQueryOptions({ userId }))
}

export function useUserIdentitiesQuery(args: { userId: IConvosUserId | undefined }) {
  return useQuery({
    ...getUserIdentitiesQueryOptions(args),
  })
}

export function getUserIdentitiesQueryData(args: { userId: IConvosUserId }) {
  const { userId } = args
  return reactQueryClient.getQueryData(getUserIdentitiesQueryOptions({ userId }).queryKey)
}
