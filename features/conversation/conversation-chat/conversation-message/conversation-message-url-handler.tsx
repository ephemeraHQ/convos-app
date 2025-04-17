import React, { memo, useCallback, useMemo } from "react"
import { Alert, Linking, StyleSheet } from "react-native"
import { Text, ITextProps } from "@/design-system/Text"
import { URL_REGEX } from "@/utils/regex"
import { deepLinkLogger } from "@/utils/logger/logger"
import { captureError } from "@/utils/capture-error"
import { GenericError } from "@/utils/error"
import { extractUsernameFromVanityUrl, handleVanityUrl } from "@/features/deep-linking/vanity-url-handler"

type IConversationMessageUrlHandlerProps = {
  text: string
} & ITextProps

type TextSegment = {
  type: 'text'
  content: string
}

type UrlSegment = {
  type: 'url'
  content: string
  isVanity: boolean
}

type Segment = TextSegment | UrlSegment

/**
 * Component that renders message text with clickable URLs
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
      
      // Open as regular link
      deepLinkLogger.info(`Opening regular URL: ${url}`)
      
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
      
      Alert.alert(
        "Cannot Open Link",
        "There was a problem opening this link. Please try again later."
      )
    }
  }, [])
  
  // Extract text color from style props
  const textColor = useMemo(() => {
    if (!textProps.style) return undefined

    if (Array.isArray(textProps.style)) {
      for (const style of textProps.style) {
        if (style && typeof style === 'object' && 'color' in style) {
          return style.color
        }
      }
    } 
    else if (typeof textProps.style === 'object' && 'color' in textProps.style) {
      return textProps.style.color
    }

    return undefined
  }, [textProps.style])
  
  // Parse text into segments (regular text and URLs)
  const segments = useMemo<Segment[]>(() => {
    if (!text) return []
    
    const result: Segment[] = []
    let lastIndex = 0
    
    // Reset regex state
    URL_REGEX.lastIndex = 0
    
    // Find all URLs in the text
    let match
    while ((match = URL_REGEX.exec(text)) !== null) {
      const matchText = match[0]
      const matchIndex = match.index
      
      // Add text before the URL
      if (matchIndex > lastIndex) {
        result.push({
          type: 'text',
          content: text.substring(lastIndex, matchIndex)
        })
      }
      
      // Add the URL
      result.push({
        type: 'url',
        content: matchText,
        isVanity: extractUsernameFromVanityUrl(matchText) !== null
      })
      
      lastIndex = matchIndex + matchText.length
    }
    
    // Add remaining text
    if (lastIndex < text.length) {
      result.push({
        type: 'text',
        content: text.substring(lastIndex)
      })
    }
    
    return result
  }, [text])
  
  // If no URLs found, just render the plain text
  if (segments.length === 0) {
    return <Text {...textProps}>{text}</Text>
  }
  
  // Render text with URL spans
  return (
    <Text {...textProps}>
      {segments.map((segment, index) => {
        if (segment.type === 'text') {
          return segment.content
        }
        
        // URL segment
        return (
          <Text
            key={`url-${index}`}
            style={[
              styles.link,
              { color: segment.isVanity ? "#FF9500" : textColor }
            ]}
            onPress={() => handleUrlPress(segment.content)}
          >
            {segment.content}
          </Text>
        )
      })}
    </Text>
  )
})

const styles = StyleSheet.create({
  link: {
    textDecorationLine: "underline"
  }
})
