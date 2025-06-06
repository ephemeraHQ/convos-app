import { memo } from "react"
import { ClickableText } from "@/components/clickable-text"
import { useAppTheme } from "@/theme/use-app-theme"
import { createVanityUrlParser } from "./conversation-message-parsers"

export const ConversationMessageSimpleText = memo(function ConversationMessageSimpleText({
  children,
  inverted,
}: {
  children: string
  inverted?: boolean
}) {
  const { theme } = useAppTheme()

  const vanityUrlParser = createVanityUrlParser(theme.colors.global.orange)

  return (
    <ClickableText
      additionalParsers={[vanityUrlParser]}
      style={{
        color: inverted ? theme.colors.text.inverted.primary : theme.colors.text.primary,
      }}
    >
      {children}
    </ClickableText>
  )
})
