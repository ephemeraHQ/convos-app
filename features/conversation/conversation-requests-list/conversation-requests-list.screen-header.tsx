import { Alert } from "react-native"
import { HeaderAction } from "@/design-system/Header/HeaderAction"
import { useDeleteConversationsMutation } from "@/features/conversation/conversation-requests-list/delete-conversations.mutation"
import { useConversationRequestsListItem } from "@/features/conversation/conversation-requests-list/use-conversation-requests-list-items"
import { translate } from "@/i18n"
import { useHeader } from "@/navigation/use-header"
import { useRouter } from "@/navigation/use-navigation"
import { captureErrorWithToast } from "@/utils/capture-error"
import { GenericError } from "@/utils/error"

export function useConversationRequestsListScreenHeader() {
  const router = useRouter()
  const { mutateAsync: deleteConversationsAsync, isPending } = useDeleteConversationsMutation()

  const { likelyNotSpamConversationIds, likelySpamConversationIds } =
    useConversationRequestsListItem()

  const handleDeleteAll = () => {
    Alert.alert(
      translate("Delete all requests"),
      translate("Would you like to delete all requests?"),
      [
        {
          text: translate("cancel"),
          style: "cancel",
        },
        {
          text: translate("delete"),
          style: "destructive",
          onPress: async () => {
            try {
              await deleteConversationsAsync([
                ...likelyNotSpamConversationIds,
                ...likelySpamConversationIds,
              ])
            } catch (error) {
              captureErrorWithToast(
                new GenericError({
                  error,
                  additionalMessage: translate("Error deleting all requests"),
                }),
                {
                  message: translate("Error deleting all requests"),
                },
              )
            }
          },
        },
      ],
    )
  }

  useHeader({
    safeAreaEdges: ["top"],
    onBack: () => {
      router.goBack()
    },
    title: "Security line",
    RightActionComponent: (
      <HeaderAction icon="trash" onPress={handleDeleteAll} disabled={isPending} />
    ),
  })
}
