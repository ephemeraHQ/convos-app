import { logger } from "@/utils/logger/logger"
import Constants from "expo-constants"

// Get the app scheme from Expo constants (e.g. "convos-dev")
const APP_SCHEME = Constants.expoConfig?.scheme as string

/**
 * Deep link URL parsing
 * Takes a URL string and extracts information needed for handling deep links
 *
 * @param url The URL to parse
 * @returns An object with parsed information from the URL, including:
 *   - path: The path of the URL
 *   - segments: The path segments
 *   - params: URL query parameters
 */
export function parseURL(url: string) {
  try {
    const parsedURL = new URL(url)
    logger.info(`Parsing deep link URL: ${url}`)

    // Check if this is our app scheme
    // URL protocol includes colon (e.g. "convos-dev:") while our APP_SCHEME is just "convos-dev"
    const urlProtocol = `${APP_SCHEME}:`
    const isAppScheme = parsedURL.protocol === urlProtocol
    
    // Extract the path without leading slash
    let path = parsedURL.pathname.replace(/^\/+/, "")
    
    // For app scheme URLs, include the host as the first path segment
    if (isAppScheme && parsedURL.host) {
      path = parsedURL.host + (path ? '/' + path : '')
    }

    // Split path into segments
    const segments = path.split("/").filter(Boolean)

    // Parse query parameters
    const params: Record<string, string> = {}
    parsedURL.searchParams.forEach((value, key) => {
      params[key] = value
    })

    return {
      path,
      segments,
      params,
    }
  } catch (error) {
    logger.warn(`Error parsing URL: ${url}, error: ${error}`)
    return {
      path: "",
      segments: [],
      params: {},
    }
  }
}
