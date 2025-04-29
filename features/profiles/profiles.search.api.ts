import { z } from "zod"
import { IXmtpInboxId } from "@/features/xmtp/xmtp.types"
import { captureError } from "@/utils/capture-error"
import { convosApi } from "@/utils/convos-api/convos-api-instance"
import { ValidationError } from "@/utils/error"
import { IEthereumAddress } from "@/utils/evm/address"

// Schema for individual profile
const ProfileSchema = z.object({
  id: z.string(),
  name: z.string(),
  avatar: z.string().nullable(),
  description: z.string().nullable(),
  xmtpId: z.custom<IXmtpInboxId>(),
  turnkeyAddress: z.custom<IEthereumAddress>(),
})

// Schema for the API response
const SearchProfilesResponseSchema = z.array(ProfileSchema)

type ISearchProfilesResponse = z.infer<typeof SearchProfilesResponseSchema>

export type ISearchProfilesResult = z.infer<typeof ProfileSchema>

export const searchProfiles = async (args: { searchQuery: string; signal?: AbortSignal }) => {
  const { searchQuery, signal } = args

  const { data } = await convosApi.get<ISearchProfilesResponse>("/api/v1/profiles/search", {
    params: { query: searchQuery },
    signal,
  })

  const result = SearchProfilesResponseSchema.safeParse(data)

  if (!result.success) {
    captureError(new ValidationError({ error: result.error }))
  }

  return data
}
