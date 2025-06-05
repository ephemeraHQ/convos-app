import { memo } from "react"
import { Loader } from "@/design-system/loader"
import { useAppTheme } from "@/theme/use-app-theme"

export const ConversationAttachmentLoading = memo(function ConversationAttachmentLoading() {
  const { theme } = useAppTheme()
  return <Loader color={theme.colors.text.inverted.primary} />
})
