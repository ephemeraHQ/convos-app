import { textSizeStyles } from "@design-system/Text/Text.styles"
import React, { memo, useCallback, useEffect, useRef } from "react"
import {
  NativeSyntheticEvent,
  Platform,
  TextInput as RNTextInput,
  TextInputKeyPressEventData,
  TextStyle,
} from "react-native"
import { TextInput } from "@/design-system/text-input"
import { useConversationComposerIsEnabled } from "@/features/conversation/conversation-chat/conversation-composer/hooks/use-conversation-composer-is-enabled"
import { ThemedStyle, useAppTheme } from "@/theme/use-app-theme"
import { useConversationComposerStore } from "./conversation-composer.store-context"

export const ConversationComposerTextInput = memo(function ConversationComposerTextInput(props: {
  onSubmitEditing: () => Promise<void>
}) {
  const { onSubmitEditing } = props

  const inputRef = useRef<RNTextInput>(null)

  const { theme, themed } = useAppTheme()

  const conversationComposerStore = useConversationComposerStore()
  const inputDefaultValue = conversationComposerStore.getState().inputValue
  const isEnabled = useConversationComposerIsEnabled()

  const handleChangeText = useCallback(
    (text: string) => {
      conversationComposerStore.setState((state) => ({
        inputValue: text,
      }))
    },
    [conversationComposerStore],
  )

  // If we clear the input (i.e after sending a message)
  // we need to clear the input value in the text input
  // Doing this since we are using a uncontrolled component
  useEffect(() => {
    const unsubscribe = conversationComposerStore.subscribe((state, prevState) => {
      // Handle clearing the input
      if (prevState.inputValue && !state.inputValue) {
        inputRef.current?.clear()
        // This timeout fixes the issue where the autocorrect suggestions isn't cleared
        setTimeout(() => {
          inputRef.current?.setNativeProps({ text: state.inputValue })
        }, 10)
      } else if (state.inputValue !== prevState.inputValue) {
        // Handle prefill value changes
        inputRef.current?.setNativeProps({ text: state.inputValue })
      }
    })

    return () => unsubscribe()
  }, [conversationComposerStore])

  const handleSubmitEditing = useCallback(() => {
    onSubmitEditing()
  }, [onSubmitEditing])

  const handleKeyPress = useCallback(
    (event: NativeSyntheticEvent<TextInputKeyPressEventData>) => {
      // Only handle Enter key on macOS
      if (Platform.OS === "macos") {
        const hasModifier =
          // @ts-ignore - macOS keyboard events have modifier properties
          event.nativeEvent.shiftKey || event.nativeEvent.altKey || event.nativeEvent.metaKey

        if (!hasModifier) {
          event.preventDefault()
          onSubmitEditing()
        }
      }
    },
    [onSubmitEditing],
  )

  return (
    <TextInput
      style={themed($textInput)}
      onKeyPress={handleKeyPress}
      editable={isEnabled}
      ref={inputRef}
      onSubmitEditing={handleSubmitEditing}
      onChangeText={handleChangeText}
      multiline
      defaultValue={inputDefaultValue}
      placeholder="Message"
      autoCorrect={true}
      placeholderTextColor={theme.colors.text.tertiary}
    />
  )
})

const $textInput: ThemedStyle<TextStyle> = ({ colors, spacing, borderWidth }) => ({
  ...textSizeStyles.sm,
  color: colors.text.primary,
  flex: 1,
  paddingHorizontal: spacing.xs,
  paddingVertical:
    spacing.xxs -
    // Because we input container to be exactly 36 pixels and borderWidth add with total height in react-native
    borderWidth.sm,
})
