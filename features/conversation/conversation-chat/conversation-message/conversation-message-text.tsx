import { memo } from "react"
import { useAppTheme } from "@/theme/use-app-theme"
import { ConversationMessageUrlHandler } from "./conversation-message-url-handler"

type IMessageTextProps = {
  children: string
  inverted?: boolean
}

export const MessageText = memo(function MessageText(args: IMessageTextProps) {
  const { children, inverted } = args

  const { theme } = useAppTheme()

  // Use the ConversationMessageUrlHandler for URL detection and handling
  return (
    <ConversationMessageUrlHandler
      text={children}
      style={{
        color: inverted ? theme.colors.text.inverted.primary : theme.colors.text.primary,
      }}
    />
  )
})
