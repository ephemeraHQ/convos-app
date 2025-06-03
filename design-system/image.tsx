import { Image as ExpoImage, type ImageProps as ExpoImageProps, type ImageSource } from "expo-image"
import { memo, useMemo } from "react"
import { StyleSheet } from "react-native"

export type IImageProps = ExpoImageProps

function getCacheVersion() {
  const now = new Date()
  const weekly = Math.floor(now.getTime() / (7 * 24 * 60 * 60 * 1000))
  return `v${weekly}`
}

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
      uri = source.uri
    }

    if (!uri) {
      return source
    }

    // Include dimensions in cache key only if both width and height are positive numbers
    const dimensionKey =
      numericWidth && numericWidth > 0 && numericHeight && numericHeight > 0
        ? `_w${numericWidth}_h${numericHeight}`
        : ""

    const cacheVersion = getCacheVersion()
    const cacheKey = `${uri}${dimensionKey}_${cacheVersion}`

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
