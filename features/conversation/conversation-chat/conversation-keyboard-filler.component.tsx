import { AnimatedVStack } from "@design-system/VStack"
import { memo, useEffect, useRef } from "react"
import { TextInput } from "react-native"
import { useAnimatedStyle, useSharedValue } from "react-native-reanimated"
import { useSafeAreaInsets } from "react-native-safe-area-context"
import { useConversationMessageContextMenuStoreContext } from "@/features/conversation/conversation-chat/conversation-message/conversation-message-context-menu/conversation-message-context-menu.store-context"
import { useAnimatedKeyboard } from "@/hooks/use-animated-keyboard"

type IConversationKeyboardFillerProps = {}

export const ConversationKeyboardFiller = memo(function ConversationKeyboardFiller(
  props: IConversationKeyboardFillerProps,
) {
  const { keyboardHeightAV, progressAV, previousOpenKeyboardHeightAV, keyboardIsShownAV } =
    useAnimatedKeyboard()
  const insets = useSafeAreaInsets()
  const textInputRef = useRef<TextInput>(null)

  const keyboardWasShownBeforeWeShowMessageContextAV = useSharedValue(false)

  const messageContextMenuData = useConversationMessageContextMenuStoreContext(
    (state) => state.messageContextMenuData,
  )

  // We want to store if the keyboard was up when we focused on a message
  useEffect(() => {
    if (messageContextMenuData) {
      keyboardWasShownBeforeWeShowMessageContextAV.value = keyboardIsShownAV.value
    }
  }, [messageContextMenuData, keyboardIsShownAV, keyboardWasShownBeforeWeShowMessageContextAV])

  const fillerAnimatedStyle = useAnimatedStyle(() => {
    // If the keyboard was up when we focused on a message, we want to fill the space of the keyboard
    // So that the messages don't jump
    if (messageContextMenuData && keyboardWasShownBeforeWeShowMessageContextAV.value) {
      return {
        height: previousOpenKeyboardHeightAV.value - insets.bottom,
      }
    }

    const baseHeight = typeof keyboardHeightAV.value === "number" ? keyboardHeightAV.value : 0
    const currentHeight = baseHeight * progressAV.value

    return {
      height: Math.max(currentHeight - insets.bottom, 0),
    }
  })

  return (
    <>
      <AnimatedVStack style={fillerAnimatedStyle} />
      {/* Hidden TextInput for keyboard focus management */}
      <TextInput
        ref={textInputRef}
        style={{ height: 0, width: 0, opacity: 0, position: "absolute" }}
      />
    </>
  )
})
