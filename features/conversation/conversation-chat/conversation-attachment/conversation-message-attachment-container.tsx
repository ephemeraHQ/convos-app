import { IVStackProps, VStack } from "@design-system/VStack"
import { memo } from "react"
import { useConversationAttachmentStyles } from "@/features/conversation/conversation-chat/conversation-attachment/conversation-attachment.styles"
import { useAppTheme } from "@/theme/use-app-theme"

export type IConversationMessageAttachmentContainerProps = IVStackProps & {
  inverted?: boolean
}

export const ConversationMessageAttachmentContainer = memo(
  function ConversationMessageAttachmentContainer(
    props: IConversationMessageAttachmentContainerProps,
  ) {
    const { style, inverted, ...rest } = props

    const { theme } = useAppTheme()

    const { borderRadius } = useConversationAttachmentStyles()

    return (
      <VStack
        style={[
          {
            // ...debugBorder(),
            overflow: "hidden",
            borderRadius,
            width: "100%",
            justifyContent: "center",
            alignItems: "center",
            backgroundColor: theme.colors.fill.tertiary,
            aspectRatio: 3 / 4, // Vertical images by default
            borderWidth: theme.borderWidth.sm,
            borderColor: inverted ? theme.colors.border.inverted.subtle : theme.colors.border.edge,
            shadowColor: theme.colors.global.black,
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.1,
            shadowRadius: 4,
            elevation: 3,
          },
          style,
        ]}
        {...rest}
      />
    )
  },
)
