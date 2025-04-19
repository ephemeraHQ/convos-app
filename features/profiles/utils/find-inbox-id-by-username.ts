import { IXmtpInboxId } from "@/features/xmtp/xmtp.types"
import { logger } from "@/utils/logger/logger"
import { captureError } from "@/utils/capture-error"
import { ValidationError, GenericError } from "@/utils/error"
import { convosPublicApi } from "@/utils/convos-api/convos-api-instance"
import { AxiosError } from "axios"
import { z } from "zod"
import { IEthereumAddress } from "@/utils/evm/address"

// Schema for the public profile response
const PublicProfileResponseSchema = z.object({
  name: z.string(),
  username: z.string(),
  description: z.string(),
  avatar: z.string().nullable(),
  xmtpId: z.custom<IXmtpInboxId>(),
  privyAddress: z.custom<IEthereumAddress>(),
})

type IPublicProfileResponse = z.infer<typeof PublicProfileResponseSchema>

/**
 * Finds a user's inbox ID by their username
 */
export async function findInboxIdByUsername(username: string): Promise<IXmtpInboxId | null> {
  try {
    if (!username) {
      throw new Error("Username is required")
    }

    logger.info(`Finding inbox ID by username: ${username}`)
    
    // Make the API request to find the user's profile by username
    const { data } = await convosPublicApi.get<IPublicProfileResponse>(
      `/api/v1/profiles/public/${encodeURIComponent(username)}`
    )
    
    // Validate the response data
    const result = PublicProfileResponseSchema.safeParse(data)
    
    if (!result.success) {
      captureError(new ValidationError({ error: result.error }))
      return null
    }
    
    // Extract the xmtpId which is the inbox ID we need
    return result.data.xmtpId
  } catch (error) {
    // Handle 404 (not found) errors
    if (error instanceof AxiosError && error.response?.status === 404) {
      logger.info(`No profile found for username: ${username}`)
      return null
    }
    
    // Handle error response with error message
    if (error instanceof AxiosError && error.response?.data?.error) {
      logger.info(`Error finding profile: ${error.response.data.error}`)
      return null
    }
    
    // Handle other errors
    captureError(
      new GenericError({
        error,
        additionalMessage: `Failed to find inbox ID by username: ${username}`,
      })
    )
    return null
  }
}
