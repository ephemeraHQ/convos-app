import { IXmtpConversationId, IXmtpInboxId } from "@features/xmtp/xmtp.types"
import { queryOptions, skipToken, useQuery } from "@tanstack/react-query"
import { IGroupPermissionPolicySet } from "@/features/groups/group.types"
import { getGroupPermissions } from "@/features/xmtp/xmtp-conversations/xmtp-conversations-group"
import { reactQueryClient } from "@/utils/react-query/react-query.client"
import { getReactQueryKey } from "@/utils/react-query/react-query.utils"

type IArgs = {
  clientInboxId: IXmtpInboxId
  xmtpConversationId: IXmtpConversationId
}

type IArgsWithCaller = IArgs & {
  caller: string
}

export const getGroupPermissionsQueryConfig = (args: IArgsWithCaller) => {
  const { clientInboxId, xmtpConversationId, caller } = args
  const enabled = !!clientInboxId && !!xmtpConversationId

  return queryOptions({
    meta: {
      caller,
    },
    enabled,
    queryKey: getReactQueryKey({
      baseStr: "group-permissions",
      clientInboxId,
      xmtpConversationId,
    }),
    queryFn: enabled
      ? async () => {
          return getGroupPermissions({
            clientInboxId,
            conversationId: xmtpConversationId,
          })
        }
      : skipToken,
  })
}

export const useGroupPermissionsQuery = (args: IArgsWithCaller) => {
  return useQuery(getGroupPermissionsQueryConfig(args))
}

export const setGroupPermissionsQueryData = (
  args: IArgs & { permissions: IGroupPermissionPolicySet },
) => {
  const { permissions } = args
  return reactQueryClient.setQueryData(
    getGroupPermissionsQueryConfig({ ...args, caller: "set" }).queryKey,
    permissions,
  )
}

export const ensureGroupPermissionsQueryData = (args: IArgsWithCaller) => {
  return reactQueryClient.ensureQueryData(getGroupPermissionsQueryConfig(args))
}

export const invalidateGroupPermissionsQuery = (args: IArgsWithCaller) => {
  return reactQueryClient.invalidateQueries({
    queryKey: getGroupPermissionsQueryConfig(args).queryKey,
  })
}

export const getGroupPermissionsQueryData = (args: IArgs) => {
  return reactQueryClient.getQueryData(
    getGroupPermissionsQueryConfig({ ...args, caller: "get" }).queryKey,
  )
}
