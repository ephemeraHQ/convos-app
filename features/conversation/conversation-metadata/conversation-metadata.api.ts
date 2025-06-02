import { z } from "zod"
import { IDeviceIdentityId } from "@/features/convos-identities/convos-identities.api"
import { ensureCurrentUserQueryData } from "@/features/current-user/current-user.query"
import { IXmtpConversationId } from "@/features/xmtp/xmtp.types"
import { captureError } from "@/utils/capture-error"
import { convosApi } from "@/utils/convos-api/convos-api-instance"
import { ValidationError } from "@/utils/error"

const ConversationMetadataSchema = z.object({
  deleted: z.boolean().optional(),
  pinned: z.boolean().optional(),
  unread: z.boolean().optional(),
  readUntil: z.string().datetime().nullable().optional(),
  updatedAt: z.string().datetime(),
  muted: z.boolean().optional(),
})

export type IConversationMetadata = z.infer<typeof ConversationMetadataSchema>

export type IGetConversationMetadataArgs = {
  xmtpConversationId: IXmtpConversationId
  deviceIdentityId: IDeviceIdentityId
}

export async function getConversationMetadata(args: IGetConversationMetadataArgs) {
  const { xmtpConversationId, deviceIdentityId } = args

  try {
    const { data } = await convosApi.get<IConversationMetadata>(
      `/api/v1/metadata/conversation/${deviceIdentityId}/${xmtpConversationId}`,
    )

    const parseResult = ConversationMetadataSchema.safeParse(data)

    if (!parseResult.success) {
      captureError(
        new ValidationError({
          error: parseResult.error,
        }),
      )
    }

    return data
  } catch (error) {
    // For other errors, rethrow
    throw error
  }
}

export async function markConversationMetadataAsRead(args: {
  deviceIdentityId: IDeviceIdentityId
  xmtpConversationId: IXmtpConversationId
  readUntil: string
}) {
  return updateConversationMetadata({
    deviceIdentityId: args.deviceIdentityId,
    xmtpConversationId: args.xmtpConversationId,
    updates: {
      unread: false,
      readUntil: args.readUntil,
    },
  })
}

export async function markConversationMetadataAsUnread(args: {
  deviceIdentityId: IDeviceIdentityId
  xmtpConversationId: IXmtpConversationId
}) {
  return updateConversationMetadata({
    deviceIdentityId: args.deviceIdentityId,
    xmtpConversationId: args.xmtpConversationId,
    updates: {
      unread: true,
    },
  })
}

export async function pinConversationMetadata(args: {
  deviceIdentityId: IDeviceIdentityId
  xmtpConversationId: IXmtpConversationId
}) {
  return updateConversationMetadata({
    deviceIdentityId: args.deviceIdentityId,
    xmtpConversationId: args.xmtpConversationId,
    updates: {
      pinned: true,
    },
  })
}

export async function unpinConversationMetadata(args: {
  deviceIdentityId: IDeviceIdentityId
  xmtpConversationId: IXmtpConversationId
}) {
  return updateConversationMetadata({
    deviceIdentityId: args.deviceIdentityId,
    xmtpConversationId: args.xmtpConversationId,
    updates: {
      pinned: false,
    },
  })
}

export async function restoreConversationMetadata(args: {
  deviceIdentityId: IDeviceIdentityId
  xmtpConversationId: IXmtpConversationId
}) {
  return updateConversationMetadata({
    deviceIdentityId: args.deviceIdentityId,
    xmtpConversationId: args.xmtpConversationId,
    updates: {
      deleted: false,
    },
  })
}

export async function deleteConversationMetadata(args: {
  deviceIdentityId: IDeviceIdentityId
  xmtpConversationId: IXmtpConversationId
}) {
  return updateConversationMetadata({
    deviceIdentityId: args.deviceIdentityId,
    xmtpConversationId: args.xmtpConversationId,
    updates: {
      deleted: true,
    },
  })
}

export async function muteConversationMetadata(args: {
  deviceIdentityId: IDeviceIdentityId
  xmtpConversationId: IXmtpConversationId
}) {
  return updateConversationMetadata({
    deviceIdentityId: args.deviceIdentityId,
    xmtpConversationId: args.xmtpConversationId,
    updates: {
      muted: true,
    },
  })
}

export async function unmuteConversationMetadata(args: {
  deviceIdentityId: IDeviceIdentityId
  xmtpConversationId: IXmtpConversationId
}) {
  return updateConversationMetadata({
    deviceIdentityId: args.deviceIdentityId,
    xmtpConversationId: args.xmtpConversationId,
    updates: {
      muted: false,
    },
  })
}

async function updateConversationMetadata(args: {
  xmtpConversationId: IXmtpConversationId
  deviceIdentityId: IDeviceIdentityId
  updates: {
    pinned?: boolean
    unread?: boolean
    deleted?: boolean
    readUntil?: string
    muted?: boolean
  }
}) {
  const { xmtpConversationId, deviceIdentityId, updates } = args

  const currentUser = await ensureCurrentUserQueryData({ caller: "updateConversationMetadata" })

  if (!currentUser) {
    throw new Error("No current user found")
  }

  const { data } = await convosApi.post<IConversationMetadata>(`/api/v1/metadata/conversation`, {
    conversationId: xmtpConversationId,
    deviceIdentityId,
    ...updates,
  })

  const parseResult = ConversationMetadataSchema.safeParse(data)

  if (!parseResult.success) {
    captureError(
      new ValidationError({
        error: parseResult.error,
      }),
    )
  }

  return data
}

export async function getConversationsMetadata(args: {
  deviceIdentityId: IDeviceIdentityId
  xmtpConversationIds: IXmtpConversationId[]
}) {
  const { deviceIdentityId, xmtpConversationIds } = args

  const { data } = await convosApi.get<IConversationMetadata[]>(
    `/api/v1/metadata/conversation/${deviceIdentityId}?conversationIds=${xmtpConversationIds.join(",")}`,
  )

  const parseResult = z.array(ConversationMetadataSchema).safeParse(data)

  if (!parseResult.success) {
    captureError(
      new ValidationError({
        error: parseResult.error,
      }),
    )
  }

  return data
}
