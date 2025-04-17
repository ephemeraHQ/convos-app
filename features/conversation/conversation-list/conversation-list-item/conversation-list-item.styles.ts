import { useAppTheme } from "@/theme/use-app-theme"

export function useConversationListItemStyle() {
  const { theme } = useAppTheme()

  return {
    listItemHeight: 80,
  }
}
