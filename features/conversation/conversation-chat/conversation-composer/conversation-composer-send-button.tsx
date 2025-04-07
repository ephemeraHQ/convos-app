import { IconButton } from "@design-system/IconButton/IconButton"
import { VStack } from "@design-system/VStack"
import React, { memo } from "react"
import { useTrackRenders } from "@/hooks/use-track-renders"
import { useAppTheme } from "@/theme/use-app-theme"
import { useConversationComposerStoreContext } from "./conversation-composer.store-context"

export const SendButton = memo(function SendButton(props: { onPress: () => void }) {
  const { onPress } = props

  const { theme } = useAppTheme()

  const canSend = useConversationComposerStoreContext((state) => {
    return (
      state.inputValue.length > 0 ||
      state.composerMediaPreviews.some((preview) => preview?.status === "uploaded")
    )
  })

  const margin = (36 - theme.spacing.lg) / 2 - theme.borderWidth.sm

  useTrackRenders({
    componentName: "SendButton",
    allowedDependencies: {
      onPress,
      canSend,
    },
  })

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
      />
    </VStack>
  )
})
