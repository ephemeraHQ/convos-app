import { config } from "@/config"
import { navigateWithReset } from "@/navigation/navigation.utils"
import { deepLinkLogger } from "@/utils/logger/logger"
import { findInboxIdByUsername } from "@/features/profiles/utils/find-inbox-id-by-username"

/**
 * Checks if a URL matches a vanity profile URL pattern
 * Pattern 1: username.convos.org (subdomain)
 * Pattern 2: convos.org/username (path)
 */
export function extractUsernameFromVanityUrl(url: string): string | null {
  try {
    // Make sure we have a valid URL
    if (!url) return null
    
    // Normalize URL to ensure it has a protocol
    const normalizedUrl = url.startsWith("http") ? url : `https://${url}`
    
    let parsedUrl: URL
    try {
      parsedUrl = new URL(normalizedUrl)
    } catch {
      // Not a valid URL
      return null
    }
    
    const { hostname, pathname } = parsedUrl
    const webDomain = config.app.webDomain
    
    // Check for username.webDomain pattern (subdomain)
    if (hostname !== webDomain && hostname.endsWith(`.${webDomain}`)) {
      const parts = hostname.split(".")
      // For username.convos.org, parts will be ["username", "convos", "org"]
      if (parts.length >= 3) {
        const username = parts[0]
        if (username && username.length > 0) {
          return username
        }
      }
    }
    
    // Check for webDomain/username pattern (path)
    if (hostname === webDomain && pathname.length > 1) {
      // Remove leading slash and split by remaining slashes
      const path = pathname.substring(1).split("/")[0]
      
      // Skip known deep link paths
      const knownPaths = ["dm", "group", "group-invite", "coinbase", "conversation", "profile"]
      if (path && path.length > 0 && !knownPaths.includes(path)) {
        return path
      }
    }
    
    return null
  } catch (error) {
    deepLinkLogger.warn(`Error extracting username from vanity URL: ${error}`)
    return null
  }
}

/**
 * Handles a URL that might be a vanity profile URL
 * If it matches a valid pattern, navigates to the user's conversation
 */
export async function handleVanityUrl(url: string): Promise<boolean> {
  try {
    const username = extractUsernameFromVanityUrl(url)
    
    if (!username) {
      return false
    }
    
    deepLinkLogger.info(`Handling vanity URL for username: ${username}`)
    
    // Find the inbox ID by username
    const inboxId = await findInboxIdByUsername(username)
    
    if (!inboxId) {
      deepLinkLogger.warn(`No inbox ID found for username: ${username}`)
      return false
    }
    
    deepLinkLogger.info(`Found inbox ID for username ${username}: ${inboxId}`)
    
    // Navigate to the conversation with this user
    await navigateWithReset("Conversation", {
      searchSelectedUserInboxIds: [inboxId],
      isNew: true,
    })
    
    return true
  } catch (error) {
    deepLinkLogger.error(`Error handling vanity URL: ${error}`)
    return false
  }
}
