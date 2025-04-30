import { z } from "zod"
import { IXmtpInboxId } from "@/features/xmtp/xmtp.types"
import { captureError } from "@/utils/capture-error"
import { isConvosApi404Error } from "@/utils/convos-api/convos-api-error"
import { convosPublicApi } from "@/utils/convos-api/convos-api-instance"
import { GenericError, ValidationError } from "@/utils/error"
import { IEthereumAddress } from "@/utils/evm/address"
import { logger } from "@/utils/logger/logger"

// Schema for the public profile response
const PublicProfileResponseSchema = z.object({
  name: z.string(),
  username: z.string(),
  description: z.string(),
  avatar: z.string().nullable(),
  xmtpId: z.custom<IXmtpInboxId>(),
  turnkeyAddress: z.custom<IEthereumAddress>(),
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
      `/api/v1/profiles/public/${encodeURIComponent(username)}`,
    )

    // Validate the response data
    const result = PublicProfileResponseSchema.safeParse(data)

    if (!result.success) {
      captureError(new ValidationError({ error: result.error }))
      return null
    }

    return result.data.xmtpId
  } catch (error) {
    // Handle 404 (not found) - this is an expected case, not an error
    if (isConvosApi404Error(error)) {
      logger.info(`No profile found for username: ${username}`)
      return null
    }

    // Handle all other errors
    captureError(
      new GenericError({
        error,
        additionalMessage: `Failed to find inbox ID by username: ${username}`,
      }),
    )
    return null
  }
}
