import React from "react"
import { View } from "react-native"
import { Chip, ChipText } from "@/design-system/chip"
import { HStack } from "@/design-system/HStack"
import { useAppTheme } from "@/theme/use-app-theme"
import { ITab } from "./conversation-requests-list.screen"

type IOption = {
  label: string
  value: ITab
}

type IConversationRequestsToggleProps = {
  options: IOption[]
  selectedTab: ITab
  onSelect: (tab: ITab) => void
}

export function ConversationRequestsToggle({
  options,
  selectedTab,
  onSelect,
}: IConversationRequestsToggleProps) {
  const { theme } = useAppTheme()

  return (
    <HStack
      style={{
        gap: theme.spacing.xxs,
        marginBottom: theme.spacing.xs,
        marginHorizontal: theme.spacing.xs,
      }}
    >
      {options.map((option, index) => (
        <View key={index} style={{ flex: 1 }}>
          <Chip
            key={index}
            isSelected={option.value === selectedTab}
            onPress={() => onSelect(option.value)}
          >
            <ChipText>{option.label}</ChipText>
          </Chip>
        </View>
      ))}
    </HStack>
  )
}
