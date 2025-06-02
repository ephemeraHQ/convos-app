import type { IXmtpConversationId, IXmtpInboxId } from "@features/xmtp/xmtp.types"
import { queryOptions, useQuery } from "@tanstack/react-query"
import { create, windowScheduler } from "@yornaath/batshit"
import {
  getConversationMetadata,
  getConversationsMetadata,
} from "@/features/conversation/conversation-metadata/conversation-metadata.api"
import { IDeviceIdentityId } from "@/features/convos-identities/convos-identities.api"
import { ensureUserIdentitiesQueryData } from "@/features/convos-identities/convos-identities.query"
import { ensureCurrentUserQueryData } from "@/features/current-user/current-user.query"
import { ObjectTyped } from "@/utils/object-typed"
import { getReactQueryKey } from "@/utils/react-query/react-query.utils"
import { TimeUtils } from "@/utils/time.utils"
import { reactQueryClient } from "../../../utils/react-query/react-query.client"

export type IConversationMetadataQueryData = Awaited<ReturnType<typeof getConversationMetadata>>

type IArgs = {
  xmtpConversationId: IXmtpConversationId
  clientInboxId: IXmtpInboxId
}

async function getConversationMetadataQueryFn({ xmtpConversationId, clientInboxId }: IArgs) {
  const currentUser = await ensureCurrentUserQueryData({
    caller: "getConversationMetadataQueryFn",
  })

  if (!currentUser) {
    throw new Error("No current user found in getConversationMetadataQueryFn")
  }

  const deviceIdentities = await ensureUserIdentitiesQueryData({
    userId: currentUser.id,
  })
  const deviceIdentityId = deviceIdentities.find(
    (identity) => identity.xmtpId === clientInboxId,
  )?.id

  if (!deviceIdentityId) {
    throw new Error("No matching device identity found for the given inbox ID")
  }

  return batcher.fetch({ xmtpConversationId, deviceIdentityId })
}

export function getConversationMetadataQueryOptions({
  xmtpConversationId,
  clientInboxId,
  caller,
}: IArgs & { caller?: string }) {
  const enabled = !!xmtpConversationId
  return queryOptions({
    queryKey: getReactQueryKey({
      baseStr: "conversation-metadata",
      xmtpConversationId,
      clientInboxId,
    }),
    meta: {
      caller,
    },
    queryFn: () => getConversationMetadataQueryFn({ xmtpConversationId, clientInboxId }),
    enabled,
    gcTime: TimeUtils.days(30).toMilliseconds(),
    staleTime: Infinity,
  })
}

export function useConversationMetadataQuery(args: IArgs) {
  return useQuery(getConversationMetadataQueryOptions(args))
}

export function prefetchConversationMetadataQuery(args: IArgs & { caller: string }) {
  const { xmtpConversationId, clientInboxId, caller } = args
  return reactQueryClient.prefetchQuery(
    getConversationMetadataQueryOptions({ xmtpConversationId, clientInboxId, caller }),
  )
}

export const getConversationMetadataQueryData = (args: IArgs) => {
  const { xmtpConversationId, clientInboxId } = args
  return reactQueryClient.getQueryData(
    getConversationMetadataQueryOptions({ xmtpConversationId, clientInboxId }).queryKey,
  )
}

export const ensureConversationMetadataQueryData = (args: IArgs & { caller: string }) => {
  return reactQueryClient.ensureQueryData(getConversationMetadataQueryOptions(args))
}

export function updateConversationMetadataQueryData(
  args: IArgs & { updateData: Partial<IConversationMetadataQueryData> },
) {
  const { updateData, xmtpConversationId, clientInboxId } = args
  reactQueryClient.setQueryData(
    getConversationMetadataQueryOptions({ xmtpConversationId, clientInboxId }).queryKey,
    (previousData) => ({
      xmtpConversationId: args.xmtpConversationId,
      deleted: false,
      pinned: false,
      unread: false,
      updatedAt: new Date().toISOString(),
      ...(previousData ?? {}),
      ...updateData,
    }),
  )
}

export function refetchConversationMetadataQuery(args: IArgs) {
  const { xmtpConversationId, clientInboxId } = args
  return reactQueryClient.refetchQueries({
    queryKey: getConversationMetadataQueryOptions({ xmtpConversationId, clientInboxId }).queryKey,
  })
}

export function invalidateConversationMetadataQuery(args: IArgs) {
  const { xmtpConversationId, clientInboxId } = args
  return reactQueryClient.invalidateQueries({
    queryKey: getConversationMetadataQueryOptions({ xmtpConversationId, clientInboxId }).queryKey,
  })
}

const batcher = create({
  name: `conversation-metadata`,
  fetcher: async (
    requests: Array<{
      xmtpConversationId: IXmtpConversationId
      deviceIdentityId: IDeviceIdentityId
    }>,
  ) => {
    const deviceIdentityGroups = requests.reduce(
      (groups, request) => {
        const { deviceIdentityId } = request
        if (!groups[deviceIdentityId]) {
          groups[deviceIdentityId] = []
        }
        groups[deviceIdentityId].push(request)
        return groups
      },
      {} as Record<
        IDeviceIdentityId,
        Array<{ xmtpConversationId: IXmtpConversationId; deviceIdentityId: IDeviceIdentityId }>
      >,
    )

    const results = await Promise.all(
      ObjectTyped.entries(deviceIdentityGroups).map(async ([deviceIdentityId, groupRequests]) => {
        const xmtpConversationIds = groupRequests.map((req) => req.xmtpConversationId)
        const metadataArray = await getConversationsMetadata({
          deviceIdentityId,
          xmtpConversationIds,
        })

        const metadataByConversationId: Record<
          IXmtpConversationId,
          IConversationMetadataQueryData
        > = {}
        xmtpConversationIds.forEach((conversationId, index) => {
          metadataByConversationId[conversationId] = metadataArray[index] || null
        })

        return metadataByConversationId
      }),
    )

    const combinedResults: Record<IXmtpConversationId, IConversationMetadataQueryData> = {}
    results.forEach((result) => {
      Object.assign(combinedResults, result)
    })

    return combinedResults
  },
  scheduler: windowScheduler(100),
  resolver: (metadataByConversationId, request) => {
    return metadataByConversationId[request.xmtpConversationId] || null
  },
})
