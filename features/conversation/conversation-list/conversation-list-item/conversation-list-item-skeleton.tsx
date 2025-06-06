import { memo } from "react"
import { View } from "react-native"
import { useAppTheme } from "@/theme/use-app-theme"
import { useConversationListItemStyle } from "./conversation-list-item.styles"

export const ConversationListItemSkeleton = memo(function ConversationListItemSkeleton() {
  const { theme } = useAppTheme()
  const { listItemHeight } = useConversationListItemStyle()

  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        padding: theme.spacing.md,
        height: listItemHeight,
      }}
    >
      {/* Avatar skeleton */}
      <View
        style={{
          width: theme.avatarSize.lg,
          height: theme.avatarSize.lg,
          borderRadius: theme.avatarSize.lg / 2,
          backgroundColor: theme.colors.fill.secondary,
          marginRight: theme.spacing.md,
        }}
      />

      {/* Text content skeleton */}
      <View style={{ flex: 1 }}>
        {/* Title line */}
        <View
          style={{
            width: "70%",
            height: 16,
            backgroundColor: theme.colors.fill.secondary,
            borderRadius: 4,
            marginBottom: theme.spacing.xs,
          }}
        />

        {/* Subtitle line */}
        <View
          style={{
            width: "50%",
            height: 14,
            backgroundColor: theme.colors.fill.tertiary,
            borderRadius: 4,
          }}
        />
      </View>
    </View>
  )
})
