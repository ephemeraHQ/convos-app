import { BottomSheetContentContainer } from "@design-system/BottomSheet/BottomSheetContentContainer"
import { BottomSheetHeader } from "@design-system/BottomSheet/BottomSheetHeader"
import { BottomSheetModal } from "@design-system/BottomSheet/BottomSheetModal"
import { Text } from "@design-system/Text"
import { TextField } from "@design-system/TextField/TextField"
import { VStack } from "@design-system/VStack"
import { translate } from "@i18n"
import { memo, useCallback, useRef, useState } from "react"
import { TextInput, TextStyle, ViewStyle } from "react-native"
import { useSafeAreaInsets } from "react-native-safe-area-context"
import { EmojiRowList } from "@/features/conversation/conversation-chat/conversation-message/conversation-message-context-menu/conversation-message-context-menu-emoji-picker/conversation-message-context-menu-emoji-picker-list"
import { messageContextMenuEmojiPickerBottomSheetRef } from "@/features/conversation/conversation-chat/conversation-message/conversation-message-context-menu/conversation-message-context-menu-emoji-picker/conversation-message-context-menu-emoji-picker-utils"
import { useConversationMessageContextMenuEmojiPickerStore } from "@/features/conversation/conversation-chat/conversation-message/conversation-message-context-menu/conversation-message-context-menu-emoji-picker/conversation-message-context-menu-emoji-picker.store"
import { ThemedStyle, useAppTheme } from "@/theme/use-app-theme"
import { emojiTrie } from "@/utils/emojis/emoji-trie"
import { ICategorizedEmojisRecord, IEmoji } from "@/utils/emojis/emoji.types"
import { emojis } from "@/utils/emojis/emojis.data"

// Flatten all emoji categories into a single array
const flatEmojis = emojis.flatMap((category) => category.data)

// Group emojis into rows of 6 for display
const EMOJIS_PER_ROW = 6

function sliceEmojis(emojis: IEmoji[]): ICategorizedEmojisRecord[] {
  const records: ICategorizedEmojisRecord[] = []

  for (let i = 0; i < emojis.length; i += EMOJIS_PER_ROW) {
    const rowEmojis = emojis.slice(i, i + EMOJIS_PER_ROW)
    const firstEmoji = rowEmojis[0]

    records.push({
      id: firstEmoji.emoji,
      category: firstEmoji.emoji,
      emojis: rowEmojis,
    })
  }

  return records
}

// Create categorized emoji records preserving category info
const categorizedEmojis: ICategorizedEmojisRecord[] = emojis.flatMap((category, index) => {
  const records: ICategorizedEmojisRecord[] = []

  for (let i = 0; i < category.data.length; i += EMOJIS_PER_ROW) {
    records.push({
      id: `${category.title}-${index}-${i}`,
      category: category.title,
      emojis: category.data.slice(i, i + EMOJIS_PER_ROW),
    })
  }

  return records
})

const defaultEmojis = sliceEmojis(flatEmojis)

export const MessageContextMenuEmojiPicker = memo(function MessageContextMenuEmojiPicker({
  onSelectReaction,
}: {
  onSelectReaction: (emoji: string) => void
}) {
  const textInputRef = useRef<TextInput>(null)

  const insets = useSafeAreaInsets()
  const { themed } = useAppTheme()

  const [filteredReactions, setFilteredReactions] = useState(defaultEmojis)
  const [hasInput, setHasInput] = useState(false)

  const closeMenu = useCallback(() => {
    textInputRef.current?.blur()
  }, [])

  const handleReaction = useCallback(
    (emoji: string) => {
      onSelectReaction(emoji)
      closeMenu()
    },
    [onSelectReaction, closeMenu],
  )

  const onTextInputChange = useCallback((value: string) => {
    const trimmedValue = value.trim()

    if (trimmedValue === "") {
      setFilteredReactions(defaultEmojis)
      setHasInput(false)
      return
    }

    // Find matching emojis and remove duplicates
    const emojis = emojiTrie.findAllContaining(trimmedValue)
    const uniqueEmojis = Array.from(new Set(emojis.map((emoji) => emoji.emoji)))
      .map((emoji) => emojis.find((e) => e.emoji === emoji))
      .filter(Boolean)

    const slicedEmojis = sliceEmojis(uniqueEmojis)
    setFilteredReactions(slicedEmojis)
    setHasInput(true)
  }, [])

  const handleChange = useCallback((index: number) => {
    useConversationMessageContextMenuEmojiPickerStore.getState().setIsEmojiPickerOpen(index >= 0)
  }, [])

  const handleSearchTextFieldFocus = useCallback(() => {
    messageContextMenuEmojiPickerBottomSheetRef.current?.expand()
  }, [])

  return (
    <BottomSheetModal
      onClose={closeMenu}
      onChange={handleChange}
      ref={messageContextMenuEmojiPickerBottomSheetRef}
      topInset={insets.top}
      snapPoints={["100%"]}
    >
      <BottomSheetContentContainer>
        <BottomSheetHeader title={translate("choose_a_reaction")} hasClose />
        <TextField
          ref={textInputRef}
          onChangeText={onTextInputChange}
          placeholder={translate("search_emojis")}
          clearButtonMode="always"
          containerStyle={themed($inputContainer)}
          onFocus={handleSearchTextFieldFocus}
        />
      </BottomSheetContentContainer>

      <VStack style={themed($container)}>
        {hasInput ? (
          <EmojiRowList emojis={filteredReactions} onPress={handleReaction} />
        ) : (
          <EmojiRowList
            emojis={categorizedEmojis}
            onPress={handleReaction}
            ListHeader={
              <Text preset="smaller" style={themed($headerText)}>
                {translate("emoji_picker_all")}
              </Text>
            }
          />
        )}
      </VStack>
    </BottomSheetModal>
  )
})

const $inputContainer: ThemedStyle<ViewStyle> = ({ spacing }) => ({
  marginVertical: spacing.xxs,
  marginHorizontal: spacing.xxs,
})

const $container: ThemedStyle<ViewStyle> = ({ spacing }) => ({
  marginHorizontal: spacing.xxs,
})

const $headerText: ThemedStyle<TextStyle> = ({ spacing }) => ({
  marginLeft: spacing.sm,
})
