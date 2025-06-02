import { IconButton } from "@design-system/IconButton/IconButton"
import { VStack } from "@design-system/VStack"
import React, { memo } from "react"
import { useAppTheme } from "@/theme/use-app-theme"
import { useConversationComposerStoreContext } from "./conversation-composer.store-context"

export const ConversationComposerSendButton = memo(function ConversationComposerSendButton(props: {
  isLoading: boolean
  onPress: () => void
}) {
  const { isLoading, onPress } = props
  const { theme } = useAppTheme()

  const canSend = useConversationComposerStoreContext((state) => {
    return (
      state.inputValue.length > 0 ||
      state.composerAttachments.some((attachment) => attachment.status === "uploaded")
    )
  })

  const margin = (36 - theme.spacing.lg) / 2 - theme.borderWidth.sm

  return (
    <VStack
      style={{
        marginHorizontal: margin,
        marginVertical: margin,
        alignSelf: "flex-end",
      }}
    >
      <IconButton
        preventDoubleTap
        hitSlop={theme.spacing.xs}
        size="sm"
        onPress={onPress}
        disabled={!canSend}
        iconName="arrow.up"
        iconWeight="medium"
        isLoading={isLoading}
      />
    </VStack>
  )
})
