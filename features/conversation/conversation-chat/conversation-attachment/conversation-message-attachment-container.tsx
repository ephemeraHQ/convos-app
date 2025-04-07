import { IVStackProps, VStack } from "@design-system/VStack"
import { memo } from "react"
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

    return (
      <VStack
        style={[
          {
            // ...debugBorder(),
            overflow: "hidden",
            borderRadius: theme.borderRadius.sm,
            width: "100%",
            justifyContent: "center",
            alignItems: "center",
            backgroundColor: theme.colors.fill.tertiary,
            aspectRatio: 1.5, // Default aspect ratio for attachments
            borderWidth: theme.borderWidth.sm,
            borderColor: inverted ? theme.colors.border.inverted.subtle : theme.colors.border.edge,
          },
          style,
        ]}
        {...rest}
      />
    )
  },
)
