import { z } from "zod"
import { IXmtpInboxId } from "@/features/xmtp/xmtp.types"
import { captureError } from "@/utils/capture-error"
import { ConvosApiError } from "@/utils/convos-api/convos-api-error"
import { convosApi } from "@/utils/convos-api/convos-api-instance"
import { ValidationError } from "@/utils/error"
import { ConvosProfileSchema, type IConvosProfile } from "./profiles.types"

export const fetchProfile = async (args: { xmtpId: IXmtpInboxId; signal?: AbortSignal }) => {
  const { xmtpId, signal } = args

  try {
    const { data } = await convosApi.get<IConvosProfile>(`/api/v1/profiles/${xmtpId}`, {
      signal,
    })

    const result = ConvosProfileSchema.safeParse(data)

    if (!result.success) {
      captureError(new ValidationError({ error: result.error }))
    }

    return data
  } catch (error) {
    throw new ConvosApiError({ error })
  }
}

export type ISaveProfileUpdates = Partial<
  Pick<z.infer<typeof ConvosProfileSchema>, "name" | "username" | "description" | "avatar">
>

// Main save profile function
export const saveProfile = async (args: {
  profileUpdates: ISaveProfileUpdates
  inboxId: IXmtpInboxId
}) => {
  const { profileUpdates, inboxId } = args

  const { data } = await convosApi.put<IConvosProfile>(
    `/api/v1/profiles/${inboxId}`,
    profileUpdates,
  )

  const result = ConvosProfileSchema.safeParse(data)

  if (!result.success) {
    captureError(new ValidationError({ error: result.error }))
  }

  return data
}
