import { IXmtpInboxId } from "@/features/xmtp/xmtp.types"
import { logger } from "@/utils/logger/logger"
import { captureError } from "@/utils/capture-error"
import { GenericError } from "@/utils/error"
import { config } from "@/config"

type IProfileResponse = {
  name: string
  username: string
  description: string
  avatar: string | null
  xmtpId: string
  privyAddress: string
}

type IErrorResponse = {
  error: string
}

/**
 * Finds a user's inbox ID by their username
 * @param username The username to search for
 * @returns The inbox ID if found, null otherwise
 */
export async function findInboxIdByUsername(username: string): Promise<IXmtpInboxId | null> {
  try {
    if (!username) {
      throw new Error("Username is required")
    }

    logger.info(`Finding inbox ID by username: ${username}`)
    
    // Make the API request to find the user's profile by username
    const response = await fetch(`${config.app.apiUrl}/api/v1/profiles/public/${encodeURIComponent(username)}`)
    
    if (!response.ok) {
      if (response.status === 404) {
        logger.info(`No profile found for username: ${username}`)
        return null
      }
      
      throw new Error(`Failed to find profile by username: ${response.status} ${response.statusText}`)
    }
    
    const data = await response.json() as IProfileResponse | IErrorResponse
    
    // Check if the response contains an error
    if ('error' in data) {
      logger.info(`Error finding profile: ${data.error}`)
      return null
    }
    
    // Extract the xmtpId which is the inbox ID we need
    return data.xmtpId as IXmtpInboxId
  } catch (error) {
    captureError(
      new GenericError({
        error,
        additionalMessage: `Failed to find inbox ID by username: ${username}`,
      })
    )
    return null
  }
}
