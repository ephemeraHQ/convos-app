import React, { memo, useCallback, useImperativeHandle, useRef } from "react"
import {
  NativeSyntheticEvent,
  TextInput as RNTextInput,
  StyleProp,
  TextInputKeyPressEventData,
  ViewStyle,
} from "react-native"
import { Center } from "@/design-system/Center"
import { useChipStyles } from "@/design-system/chip"
import { HStack } from "@/design-system/HStack"
import { Text } from "@/design-system/Text"
import { TextInput } from "@/design-system/text-input"
import { VStack } from "@/design-system/VStack"
import { IXmtpInboxId } from "@/features/xmtp/xmtp.types"
import { useAppTheme } from "@/theme/use-app-theme"
import { Haptics } from "@/utils/haptics"
import { updateObjectAndMethods } from "@/utils/update-object-and-methods"
import { SearchUsersInputChip } from "./search-users-input-chip"
import { useSearchUsersInputStore } from "./search-users-input.store"

type ISearchUsersInputProps = {
  inputRef: React.MutableRefObject<RNTextInput | null>
  searchSelectedUserInboxIds: IXmtpInboxId[]
  onSearchTextChange: (text: string) => void
  onSelectedInboxIdsChange: (inboxIds: IXmtpInboxId[]) => void
  defaultSearchTextValue?: string
}

export const SearchUsersInput = memo(function SearchUsersInput(props: ISearchUsersInputProps) {
  const {
    inputRef: inputRefProp,
    searchSelectedUserInboxIds,
    onSearchTextChange,
    onSelectedInboxIdsChange,
    defaultSearchTextValue = "",
  } = props

  const styles = useSearchUsersInputStyles()
  const localInputRef = useRef<RNTextInput | null>(null)
  const textInputValueRef = useRef(defaultSearchTextValue)

  const selectedChipInboxId = useSearchUsersInputStore((state) => state.selectedChipInboxId)

  const handleKeyPress = (e: NativeSyntheticEvent<TextInputKeyPressEventData>) => {
    const { key } = e.nativeEvent

    const selectedInboxIdChip = useSearchUsersInputStore.getState().selectedChipInboxId

    if (key === "Backspace" && !textInputValueRef.current) {
      Haptics.softImpactAsync()

      if (selectedInboxIdChip !== null) {
        // Remove selected chip
        onSelectedInboxIdsChange(
          searchSelectedUserInboxIds.filter((inboxId) => inboxId !== selectedInboxIdChip),
        )
        useSearchUsersInputStore.getState().actions.setSelectedChipInboxId(null)
      } else if (searchSelectedUserInboxIds.length > 0) {
        // Select last chip for deletion
        useSearchUsersInputStore
          .getState()
          .actions.setSelectedChipInboxId(
            searchSelectedUserInboxIds[searchSelectedUserInboxIds.length - 1],
          )
      }
    } else {
      useSearchUsersInputStore.getState().actions.setSelectedChipInboxId(null)
    }
  }

  const handleChangeText = useCallback(
    (text: string) => {
      onSearchTextChange(text)
      textInputValueRef.current = text
    },
    [onSearchTextChange],
  )

  const handlePressOnChip = useCallback((inboxId: IXmtpInboxId) => {
    Haptics.softImpactAsync()
    useSearchUsersInputStore.getState().actions.setSelectedChipInboxId(inboxId)
    localInputRef.current?.focus() // In case we are focused on the composer input for example
  }, [])

  const handlePressOnTextInput = useCallback(() => {
    useSearchUsersInputStore.getState().actions.setSelectedChipInboxId(null)
  }, [])

  useImperativeHandle(inputRefProp, () => {
    const inputRef = updateObjectAndMethods(localInputRef.current, {
      clear: () => {
        localInputRef.current?.clear()
        textInputValueRef.current = ""
      },
    })
    return inputRef as RNTextInput
  })

  return (
    <VStack style={styles.$container}>
      <HStack style={styles.$inputContainer}>
        <Center style={styles.$toLabel}>
          <Text color="secondary">To</Text>
        </Center>
        <HStack style={styles.$chipContainer}>
          {searchSelectedUserInboxIds.map((inboxId) => (
            <SearchUsersInputChip key={inboxId} inboxId={inboxId} onPress={handlePressOnChip} />
          ))}
          <TextInput
            onPress={handlePressOnTextInput}
            ref={localInputRef}
            style={styles.$input}
            defaultValue={defaultSearchTextValue}
            onChangeText={handleChangeText}
            placeholder={searchSelectedUserInboxIds.length === 0 ? "Name, ENS, Base…" : ""}
            onKeyPress={handleKeyPress}
            autoCapitalize="none"
            autoCorrect={true}
            cursorColor={selectedChipInboxId ? "transparent" : undefined}
            caretHidden={Boolean(selectedChipInboxId)}
          />
        </HStack>
      </HStack>
    </VStack>
  )
})

function useSearchUsersInputStyles() {
  const { theme } = useAppTheme()

  const chipStyles = useChipStyles({ variant: "outlined" })

  const $container = {
    backgroundColor: theme.colors.background.surfaceless,
    padding: theme.spacing.sm,
  } satisfies StyleProp<ViewStyle>

  const $inputContainer = {
    columnGap: theme.spacing.xxs,
    alignItems: "center",
    minHeight: chipStyles.$content.height + chipStyles.$container.paddingVertical * 2,
  } satisfies StyleProp<ViewStyle>

  const $toLabel = {
    alignSelf: "flex-start",
    height: chipStyles.$content.height + chipStyles.$container.paddingVertical * 2,
  } satisfies StyleProp<ViewStyle>

  const $chipContainer = {
    flex: 1,
    gap: theme.spacing.xxs,
    alignItems: "center",
    flexWrap: "wrap",
  } satisfies StyleProp<ViewStyle>

  const $input = {
    flex: 1,
    minWidth: theme.layout.screen.width / 4,
  } satisfies StyleProp<ViewStyle>

  return {
    $container,
    $inputContainer,
    $toLabel,
    $chipContainer,
    $input,
  } as const
}
