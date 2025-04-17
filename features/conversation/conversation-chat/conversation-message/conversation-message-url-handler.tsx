import React, { memo, useCallback } from "react"
import { Alert, Linking } from "react-native"
import { Text, ITextProps } from "@/design-system/Text"
import { URL_REGEX } from "@/utils/regex"
import { deepLinkLogger } from "@/utils/logger/logger"
import { captureError } from "@/utils/capture-error"
import { GenericError } from "@/utils/error"
import { extractUsernameFromVanityUrl, handleVanityUrl } from "@/features/deep-linking/vanity-url-handler"

type IConversationMessageUrlHandlerProps = {
  text: string
} & ITextProps

/**
 * Component that renders message text and handles URL detection and clicks
 * Detects URLs including vanity URLs (username.convos.org or convos.org/username)
 */
export const ConversationMessageUrlHandler = memo(function ConversationMessageUrlHandler(
  props: IConversationMessageUrlHandlerProps
) {
  const { text, ...textProps } = props

  // Handle URL press
  const handleUrlPress = useCallback(async (url: string) => {
    try {
      // Check if it's a vanity URL 
      if (await handleVanityUrl(url)) {
        deepLinkLogger.info(`Handled as vanity URL: ${url}`)
        return
      }
      
      // Not a vanity URL, open as normal link
      deepLinkLogger.info(`Opening regular URL: ${url}`)
      
      // Make sure the URL has a protocol
      const urlWithProtocol = url.startsWith("http") ? url : `https://${url}`
      
      // Handle external URL
      await Linking.openURL(urlWithProtocol)
    } catch (error) {
      captureError(
        new GenericError({
          error,
          additionalMessage: `Failed to handle URL: ${url}`,
        })
      )
      
      Alert.alert(
        "Cannot Open Link",
        "There was a problem opening this link. Please try again later."
      )
    }
  }, [])
  
  // Process the text to find URLs and format them
  const renderText = useCallback(() => {
    const parts: JSX.Element[] = []
    let lastIndex = 0
    
    // Reset the regex state
    URL_REGEX.lastIndex = 0
    
    let match
    while ((match = URL_REGEX.exec(text)) !== null) {
      const matchText = match[0]
      const matchIndex = match.index
      
      // Add the text before the URL
      if (matchIndex > lastIndex) {
        parts.push(
          <Text key={`text-${lastIndex}`} {...textProps}>
            {text.substring(lastIndex, matchIndex)}
          </Text>
        )
      }
      
      // Check if it's a vanity URL
      const isVanityUrl = extractUsernameFromVanityUrl(matchText) !== null
      
      // Add the URL with special styling
      parts.push(
        <Text
          key={`url-${matchIndex}`}
          {...textProps}
          onPress={() => handleUrlPress(matchText)}
          style={[
            textProps.style, // Inherit text color from parent
            {
              textDecorationLine: "underline",
              color: isVanityUrl ? "#FF9500" : textProps.style?.color, // Orange for vanity URLs, parent text color for others
            },
          ]}
        >
          {matchText}
        </Text>
      )
      
      lastIndex = matchIndex + matchText.length
    }
    
    // Add the remaining text
    if (lastIndex < text.length) {
      parts.push(
        <Text key={`text-${lastIndex}`} {...textProps}>
          {text.substring(lastIndex)}
        </Text>
      )
    }
    
    return parts.length > 0 ? parts : <Text {...textProps}>{text}</Text>
  }, [text, textProps, handleUrlPress])
  
  return <>{renderText()}</>
})
