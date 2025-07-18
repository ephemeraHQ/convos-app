import { z } from "zod"
import { IXmtpInboxId } from "@/features/xmtp/xmtp.types"
import { captureError } from "@/utils/capture-error"
import { ConvosApiError } from "@/utils/convos-api/convos-api-error"
import { convosApi } from "@/utils/convos-api/convos-api-instance"
import { ValidationError } from "@/utils/error"
import {
  ConvosProfileResponseSchema,
  CreateOrUpdateConvosProfileSchema,
  type IConvosProfile,
} from "./profiles.types"

export async function fetchProfile(args: { xmtpId: IXmtpInboxId; signal?: AbortSignal }) {
  const { xmtpId, signal } = args

  try {
    const { data } = await convosApi.get<IConvosProfile>(`/api/v1/profiles/${xmtpId}`, {
      signal,
    })

    const result = ConvosProfileResponseSchema.safeParse(data)

    if (!result.success) {
      captureError(
        new ValidationError({
          error: result.error,
          additionalMessage: `Error fetching profile for xmtpId ${xmtpId}`,
        }),
      )
    }

    return data
  } catch (error) {
    throw new ConvosApiError({ error })
  }
}

const fetchProfilesResponseSchema = z.object({
  profiles: z.record(z.custom<IXmtpInboxId>(), ConvosProfileResponseSchema),
})

type IFetchProfilesResponse = z.infer<typeof fetchProfilesResponseSchema>

export async function fetchProfiles(args: { xmtpIds: IXmtpInboxId[] }) {
  const { xmtpIds } = args

  try {
    const { data } = await convosApi.post<IFetchProfilesResponse>("/api/v1/profiles/batch", {
      xmtpIds,
    })

    const result = fetchProfilesResponseSchema.safeParse(data)

    if (!result.success) {
      captureError(
        new ValidationError({
          error: result.error,
          additionalMessage: `Validation error fetching profiles for xmtpIds ${xmtpIds}`,
        }),
      )
    }

    return data?.profiles
  } catch (error) {
    throw new ConvosApiError({ error })
  }
}

export type ISaveProfileUpdates = Partial<
  Pick<
    z.infer<typeof CreateOrUpdateConvosProfileSchema>,
    "name" | "username" | "description" | "avatar"
  >
>

// Main save profile function
export async function saveProfile(args: {
  profileUpdates: ISaveProfileUpdates
  inboxId: IXmtpInboxId
}) {
  const { profileUpdates, inboxId } = args

  const { data } = await convosApi.put<IConvosProfile>(
    `/api/v1/profiles/${inboxId}`,
    profileUpdates,
  )

  const result = ConvosProfileResponseSchema.safeParse(data)

  if (!result.success) {
    captureError(
      new ValidationError({
        error: result.error,
        additionalMessage: `Error saving profile for inboxId ${inboxId}`,
      }),
    )
  }

  return data
}
