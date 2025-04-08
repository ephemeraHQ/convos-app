import { textSizeStyles } from "@design-system/Text/Text.styles"
import React, { memo, useCallback, useEffect, useRef } from "react"
import {
  NativeSyntheticEvent,
  Platform,
  TextInput as RNTextInput,
  TextInputKeyPressEventData,
} from "react-native"
import { TextInput } from "@/design-system/text-input"
import { useConversationComposerIsEnabled } from "@/features/conversation/conversation-chat/conversation-composer/hooks/use-conversation-composer-is-enabled"
import { useAppTheme } from "@/theme/use-app-theme"
import { useConversationComposerStore } from "./conversation-composer.store-context"
import { logger } from "@/utils/logger/logger"

export const ConversationComposerTextInput = memo(function ConversationComposerTextInput(props: {
  onSubmitEditing: () => Promise<void>
}) {
  const { onSubmitEditing } = props

  const inputRef = useRef<RNTextInput>(null)
  const initialValueRef = useRef<string | null>(null)

  const { theme } = useAppTheme()

  const store = useConversationComposerStore()
  const inputValue = store.getState().inputValue
  const isEnabled = useConversationComposerIsEnabled()

  logger.info(`ConversationComposerTextInput: inputValue=${inputValue}`)

  const handleChangeText = useCallback(
    (text: string) => {
      logger.info(`ConversationComposerTextInput: handleChangeText text=${text}`)
      store.setState((state) => ({
        ...state,
        inputValue: text,
      }))
    },
    [store],
  )

  // If we clear the input (i.e after sending a message)
  // we need to clear the input value in the text input
  // Doing this since we are using a uncontrolled component
  useEffect(() => {
    const unsubscribe = store.subscribe((state, prevState) => {
      logger.info(`ConversationComposerTextInput: store subscription state=${state.inputValue} prevState=${prevState.inputValue}`)
      if (prevState.inputValue && !state.inputValue) {
        inputRef.current?.clear()
      }
    })

    return () => unsubscribe()
  }, [store])

  // Handle prefill value changes
  useEffect(() => {
    logger.info(`ConversationComposerTextInput: prefill effect inputValue=${inputValue} initialValueRef=${initialValueRef.current}`)
    if (inputValue && !initialValueRef.current) {
      initialValueRef.current = inputValue
      inputRef.current?.setNativeProps({ text: inputValue })
    }
  }, [inputValue])

  const handleSubmitEditing = useCallback(() => {
    onSubmitEditing()
  }, [onSubmitEditing])

  return (
    <TextInput
      style={{
        ...textSizeStyles.sm,
        color: theme.colors.text.primary,
        flex: 1,
        paddingHorizontal: theme.spacing.xs,
        paddingVertical:
          theme.spacing.xxs -
          // Because we input container to be exactly 36 pixels and borderWidth add with total height in react-native
          theme.borderWidth.sm,
      }}
      onKeyPress={(event: NativeSyntheticEvent<TextInputKeyPressEventData>) => {
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
      }}
      editable={isEnabled}
      ref={inputRef}
      onSubmitEditing={handleSubmitEditing}
      onChangeText={handleChangeText}
      multiline
      defaultValue={inputValue}
      placeholder="Message"
      autoCorrect={true}
      placeholderTextColor={theme.colors.text.tertiary}
    />
  )
})
