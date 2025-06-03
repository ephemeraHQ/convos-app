import React, { memo } from "react"
import { ISwipeableProps, Swipeable } from "@/components/swipeable"
import { EDGE_BACK_GESTURE_HIT_SLOP } from "@/navigation/navigation.utils"
import { useAppTheme } from "@/theme/use-app-theme"
import { useConversationListItemSwipeableStyles } from "./conversation-list-item-swipeable.styles"

export const ConversationListItemSwipeable = memo(({ children, ...props }: ISwipeableProps) => {
  const { theme } = useAppTheme()

  const { swipeThreshold } = useConversationListItemSwipeableStyles()

  return (
    <Swipeable
      closeOnOpen
      leftThreshold={swipeThreshold}
      rightThreshold={swipeThreshold}
      leftHitSlop={-EDGE_BACK_GESTURE_HIT_SLOP}
      leftActionsBackgroundColor={theme.colors.fill.caution}
      rightActionsBackgroundColor={theme.colors.fill.secondary}
      overshootFriction={1}
      {...props}
    >
      {children}
    </Swipeable>
  )
})
