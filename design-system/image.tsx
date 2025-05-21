import { Image as ExpoImage, type ImageProps as ExpoImageProps, type ImageSource } from "expo-image"
import { memo, useMemo } from "react"
import { StyleSheet } from "react-native"

export type IImageProps = ExpoImageProps

function useImageSource({
  source,
  numericWidth,
  numericHeight,
}: {
  source: IImageProps["source"]
  numericWidth?: number
  numericHeight?: number
}) {
  return useMemo(() => {
    if (!source) {
      return undefined
    }

    let uri: string | undefined = undefined
    let existingCacheKey: string | undefined = undefined

    // Check if source already has a cacheKey
    if (typeof source === "object" && source !== null && !Array.isArray(source)) {
      existingCacheKey = (source as ImageSource).cacheKey
    }

    // If source already has a cacheKey, return it as is
    if (existingCacheKey) {
      return source
    }

    // Determine the base URI from the source prop
    if (typeof source === "string") {
      uri = source
    } else if (
      source &&
      typeof source === "object" &&
      !Array.isArray(source) &&
      "uri" in source &&
      typeof source.uri === "string"
    ) {
      // Handles ImageSource-like objects with a 'uri' string property
      uri = source.uri
    }
    // Other source types (number for static assets, array of sources, SharedRef) won't have a simple URI
    // for this logic. Expo Image handles their caching internally. We won't generate a custom
    // dimension-based cacheKey for them to keep this logic targeted.

    if (!uri) {
      return source
    }

    // Include dimensions in cache key only if both width and height are positive numbers
    const dimensionKey =
      numericWidth && numericWidth > 0 && numericHeight && numericHeight > 0
        ? `_w${numericWidth}_h${numericHeight}`
        : ""
    const cacheKey = `${uri}${dimensionKey}`

    // Transform the source with the new cacheKey
    if (typeof source === "string") {
      return { uri: source, cacheKey }
    }

    if (typeof source === "object" && source !== null && !Array.isArray(source)) {
      return {
        ...(source as ImageSource),
        cacheKey,
      }
    }

    return source
  }, [source, numericWidth, numericHeight])
}

export const Image = memo(function Image(props: IImageProps) {
  const { style, source, ...rest } = props

  const flatStyle = StyleSheet.flatten(style)
  const styledWidth = flatStyle?.width
  const styledHeight = flatStyle?.height

  const numericWidth = typeof styledWidth === "number" ? styledWidth : undefined
  const numericHeight = typeof styledHeight === "number" ? styledHeight : undefined

  const sourceWithCacheKey = useImageSource({ source, numericWidth, numericHeight })

  return <ExpoImage cachePolicy="memory-disk" style={style} source={sourceWithCacheKey} {...rest} />
})
