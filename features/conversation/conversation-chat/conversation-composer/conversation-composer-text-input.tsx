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
  // Track if a change comes from dictation ending
  const isDictationEndChange = useRef(false)

  const { theme, themed } = useAppTheme()

  const conversationComposerStore = useConversationComposerStore()
  const inputDefaultValue = conversationComposerStore.getState().inputValue
  const isEnabled = useConversationComposerIsEnabled()

  const handleChangeText = useCallback(
    (text: string) => {
      // If this is empty text after non-empty text AND we're on iOS, this might be
      // dictation ending - we need to preserve the previous value
      const currentValue = conversationComposerStore.getState().inputValue
      if (Platform.OS === "ios" && !text && currentValue) {
        // Potential dictation end detected
        isDictationEndChange.current = true
        // Don't update state with empty value, keep the last known value
        return
      }

      // Reset the dictation end flag
      isDictationEndChange.current = false

      // Store value in the zustand store
      conversationComposerStore.setState({
        inputValue: text,
      })
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
        // Don't clear if this might be a dictation end event
        if (isDictationEndChange.current) {
          // Preventing clear due to dictation end
          // Restore the previous text
          conversationComposerStore.setState({
            inputValue: prevState.inputValue, // Use previous value from store
          })
          return
        }

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

  // Reset dictation flag on blur (when focus leaves the input)
  const handleBlur = useCallback(() => {
    if (isDictationEndChange.current && Platform.OS === "ios") {
      // Handling dictation end on blur
      const currentStoreValue = conversationComposerStore.getState().inputValue
      
      // If dictation ended with empty text, we need to restore the previous value
      if (!currentStoreValue) {
        // Get the previous value from elsewhere in your app if needed
        // For now, we'll rely on the fact that we're preventing empty updates
        inputRef.current?.setNativeProps({ text: inputDefaultValue || "" })
      }
      
      // Reset the flag
      isDictationEndChange.current = false
    }
  }, [conversationComposerStore, inputDefaultValue])

  return (
    <TextInput
      style={themed($textInput)}
      onKeyPress={handleKeyPress}
      editable={isEnabled}
      ref={inputRef}
      onSubmitEditing={handleSubmitEditing}
      onChangeText={handleChangeText}
      onBlur={handleBlur}
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
