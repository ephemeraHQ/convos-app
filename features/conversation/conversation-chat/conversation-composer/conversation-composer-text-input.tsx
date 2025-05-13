import { textSizeStyles } from "@design-system/Text/Text.styles"
import React, { memo, useCallback, useRef } from "react"
import {
  TextInput as RNTextInput,
  TextStyle,
} from "react-native"
import { TextInput } from "@/design-system/text-input"
import { useConversationComposerIsEnabled } from "@/features/conversation/conversation-chat/conversation-composer/hooks/use-conversation-composer-is-enabled"
import { ThemedStyle, useAppTheme } from "@/theme/use-app-theme"
import { useConversationComposerStore, useConversationComposerStoreContext } from "./conversation-composer.store-context"

export const ConversationComposerTextInput = memo(function ConversationComposerTextInput(props: {
  onSubmitEditing: () => Promise<void>
}) {
  const { onSubmitEditing } = props

  const inputRef = useRef<RNTextInput>(null)
  const { theme, themed } = useAppTheme()

  const conversationComposerStore = useConversationComposerStore()
  const inputValue = useConversationComposerStoreContext((state) => state.inputValue)
  const isEnabled = useConversationComposerIsEnabled()

  const handleChangeText = useCallback(
    (text: string) => {
      conversationComposerStore.setState({
        inputValue: text,
      })
    },
    [conversationComposerStore],
  )

  const handleSubmitEditing = useCallback(() => {
    onSubmitEditing()
  }, [onSubmitEditing])

  return (
    <TextInput
      style={themed($textInput)}
      editable={isEnabled}
      ref={inputRef}
      onSubmitEditing={handleSubmitEditing}
      onChangeText={handleChangeText}
      multiline
      value={inputValue}
      placeholder="Message"
      // Disable autocorrect as it breaks both the dictation input and the autocorrect on iOS
      autoCorrect={false}
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
