import { queryOptions } from "@tanstack/react-query"
import { reactQueryClient } from "@/utils/react-query/react-query.client"
import { getReactQueryKey } from "@/utils/react-query/react-query.utils"
import { fetchCurrentUser } from "./current-user.api"
import { IConvosCurrentUser } from "./current-user.types"

type ICurrentUserQueryArgs = {}

export function getCurrentUserQueryOptions(args: ICurrentUserQueryArgs & { caller?: string }) {
  const { caller } = args

  return queryOptions({
    meta: {
      caller,
    },
    queryKey: getReactQueryKey({
      baseStr: "current-user",
    }),
    queryFn: () => fetchCurrentUser(),
  })
}

export function setCurrentUserQueryData(
  args: ICurrentUserQueryArgs & { user: IConvosCurrentUser },
) {
  const { user } = args
  return reactQueryClient.setQueryData(getCurrentUserQueryOptions({}).queryKey, user)
}

export function invalidateCurrentUserQuery(args: ICurrentUserQueryArgs) {
  return reactQueryClient.invalidateQueries({
    queryKey: getCurrentUserQueryOptions({}).queryKey,
  })
}

export function getCurrentUserQueryData(args: ICurrentUserQueryArgs) {
  return reactQueryClient.getQueryData(getCurrentUserQueryOptions({}).queryKey)
}

export function ensureCurrentUserQueryData(args: ICurrentUserQueryArgs & { caller: string }) {
  const { caller } = args
  return reactQueryClient.ensureQueryData(getCurrentUserQueryOptions({ caller }))
}
