import { memo } from "react"
import { Avatar } from "@/components/avatar"
import { Center } from "@/design-system/Center"
import { Icon } from "@/design-system/Icon/Icon"
import { Pressable } from "@/design-system/Pressable"
import { VStack } from "@/design-system/VStack"
import { useAppTheme } from "@/theme/use-app-theme"
import { Nullable } from "@/types/general"
import { HStack } from "@/design-system/HStack"

export const ProfileContactCardEditableAvatar = memo(function (props: {
  avatarUri: Nullable<string>
  avatarName: Nullable<string>
  onPress: () => void
}) {
  const { avatarUri, avatarName, onPress } = props

  const { theme } = useAppTheme()

  return (
    <Pressable onPress={onPress}>
      <VStack>
        {avatarUri ? (
          <HStack>
            <Avatar uri={avatarUri} name={avatarName} sizeNumber={theme.avatarSize.xxl} />
            <Center
              style={{
                position: "absolute",
                bottom: 0,
                left: 0,
                width: theme.avatarSize.md,
                height: theme.avatarSize.md,
                borderRadius: theme.borderRadius.md,
                borderWidth: theme.borderWidth.sm,
                borderColor: theme.colors.border.inverted.subtle,
                backgroundColor: theme.colors.fill.primary,
              }}
            >
              <Icon
                icon="camera"
                size={theme.iconSize.md}
                color={theme.colors.fill.inverted.primary}
              />
            </Center>
          </HStack>
        ) : (
          <Center
            style={{
              width: theme.avatarSize.xxl,
              height: theme.avatarSize.xxl,
              borderRadius: theme.borderRadius.xxl,
              borderWidth: theme.borderWidth.sm,
              borderColor: theme.colors.border.inverted.subtle,
              backgroundColor: theme.colors.fill.primary,
            }}
          >
            <Icon
              icon="camera"
              size={theme.iconSize.lg}
              color={theme.colors.fill.inverted.primary}
            />
          </Center>
        )}
      </VStack>
    </Pressable>
  )
})
