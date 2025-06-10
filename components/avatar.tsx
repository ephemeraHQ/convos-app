import React, { memo, useCallback, useMemo, useState } from "react"
import { ImageSourcePropType, Platform, StyleProp, ViewStyle } from "react-native"
import { Center } from "@/design-system/Center"
import { Icon } from "@/design-system/Icon/Icon"
import { Image } from "@/design-system/image"
import { Text } from "@/design-system/Text"
import { useAppTheme } from "@/theme/use-app-theme"
import { Nullable } from "@/types/general"
import { getCapitalizedLettersForAvatar } from "@/utils/get-capitalized-letters-for-avatar"

export type IAvatarProps = {
  name: Nullable<string>
  source?: Nullable<string | ImageSourcePropType>
  uri?: Nullable<string> // Kept for backward compatibility
  size?: "sm" | "md" | "lg" | "xl" | "xxl"
  sizeNumber?: number
  style?: StyleProp<ViewStyle>
}

export const Avatar = memo(function Avatar({
  source,
  uri,
  sizeNumber,
  size = "md",
  style,
  name,
}: IAvatarProps) {
  const { theme } = useAppTheme()
  const [didError, setDidError] = useState(false)

  const avatarSize = useMemo(() => {
    return (
      sizeNumber ??
      {
        sm: theme.avatarSize.sm,
        md: theme.avatarSize.md,
        lg: theme.avatarSize.lg,
        xl: theme.avatarSize.xl,
        xxl: theme.avatarSize.xxl,
      }[size]
    )
  }, [sizeNumber, size, theme.avatarSize])

  const firstLetter = useMemo(() => {
    return getCapitalizedLettersForAvatar(name ?? "")
  }, [name])

  const imageSource = useMemo(() => {
    return source ?? uri
  }, [source, uri])

  const hasImageSource = useMemo(() => {
    return !!imageSource && !didError
  }, [imageSource, didError])

  const containerStyle = useMemo(
    () => [
      {
        borderRadius: 9999,
        width: avatarSize,
        height: avatarSize,
        backgroundColor: theme.colors.fill.tertiary,
      },
      style,
    ],
    [avatarSize, theme.colors.fill.tertiary, style],
  )

  const imageStyle = useMemo(
    () => ({
      position: "absolute" as const,
      borderRadius: avatarSize / 2,
      width: avatarSize,
      height: avatarSize,
    }),
    [avatarSize],
  )

  const textStyle = useMemo(
    () => ({
      color: theme.colors.global.white,
      fontSize: avatarSize / 2.4,
      lineHeight: avatarSize / 2.4,
      paddingTop: avatarSize / 15,
    }),
    [avatarSize, theme.colors.global.white],
  )

  const iconSize = useMemo(() => {
    return Platform.OS === "ios" ? avatarSize / 3 : avatarSize / 2
  }, [avatarSize])

  const getImageSource = useCallback(() => {
    if (typeof imageSource === "string") {
      return { uri: imageSource }
    }
    return imageSource
  }, [imageSource])

  const handleImageError = useCallback(() => {
    setDidError(true)
  }, [])

  const handleImageLoad = useCallback(() => {
    setDidError(false)
  }, [])

  return (
    <Center style={containerStyle} testID="avatar-placeholder">
      {hasImageSource ? (
        <Image
          onLoad={handleImageLoad}
          onError={handleImageError}
          source={getImageSource()}
          style={imageStyle}
          cachePolicy="memory-disk"
          testID="avatar-image"
        />
      ) : name ? (
        <Text weight="medium" style={textStyle}>
          {firstLetter}
        </Text>
      ) : (
        <Icon icon="photo" size={iconSize} color="white" />
      )}
    </Center>
  )
})
