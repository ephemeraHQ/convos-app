import { ICustomParseShape } from "@/components/parsed-text/parsed-text.types"
import { URL_REGEX } from "@/utils/regex"
import { extractUsernameFromVanityUrl, handleVanityUrl } from "@/features/deep-linking/vanity-url-handler"
import { Linking } from "react-native"
import { captureError } from "@/utils/capture-error"
import { GenericError } from "@/utils/error"
import { deepLinkLogger } from "@/utils/logger/logger"

/**
 * Creates a parser that handles URLs, with special treatment for vanity URLs
 */
export function createVanityUrlParser(highlightColor: string): ICustomParseShape {
  return {
    pattern: URL_REGEX,
    onPress: async (url: string) => {
      try {
        // Check if it's a vanity URL
        if (await handleVanityUrl(url)) {
          deepLinkLogger.debug(`Handled as vanity URL: ${url}`)
          return
        }
        
        // Handle as regular URL
        deepLinkLogger.debug(`Opening regular URL: ${url}`)
        
        // Make sure the URL has a protocol
        const urlWithProtocol = url.startsWith("http") ? url : `https://${url}`
        await Linking.openURL(urlWithProtocol)
      } catch (error) {
        captureError(
          new GenericError({
            error,
            additionalMessage: `Failed to handle URL: ${url}`,
          })
        )
      }
    },
    renderText: (matchingString: string) => {
      const username = extractUsernameFromVanityUrl(matchingString)
      return username ? `@${username}` : matchingString
    },
    style: { 
      textDecorationLine: "underline",
      color: highlightColor
    }
  }
} 
