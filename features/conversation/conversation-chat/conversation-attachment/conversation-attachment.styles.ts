import { useAppTheme } from "@/theme/use-app-theme"

export function useConversationAttachmentStyles() {
  const { theme } = useAppTheme()

  return {
    borderRadius: theme.borderRadius.sm,
  }
}
