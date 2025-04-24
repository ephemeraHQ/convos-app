import { Alert } from "react-native"
import { HeaderAction } from "@/design-system/Header/HeaderAction"
import { ITab } from "@/features/conversation/conversation-requests-list/conversation-requests-list.screen"
import { useConversationRequestsListItem } from "@/features/conversation/conversation-requests-list/use-conversation-requests-list-items"
import { translate } from "@/i18n"
import { useHeader } from "@/navigation/use-header"
import { useRouter } from "@/navigation/use-navigation"
import { captureErrorWithToast } from "@/utils/capture-error"
import { GenericError } from "@/utils/error"
import { useDeleteAllRequests } from "./hooks/use-delete-all-requests"

export function useConversationRequestsListScreenHeader(args: { selectedTab: ITab }) {
  const { selectedTab } = args

  const router = useRouter()
  const { mutateAsync: deleteAllRequestsAsync, isPending } = useDeleteAllRequests()

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
              await deleteAllRequestsAsync({
                conversationIds:
                  selectedTab === "you-might-know"
                    ? likelyNotSpamConversationIds
                    : likelySpamConversationIds,
              })
            } catch (error) {
              captureErrorWithToast(
                new GenericError({
                  error,
                  additionalMessage: translate("Error deleting all requests"),
                }),
                {
                  message: translate("Error deleting all requests")
                }
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
    title: translate("Requests"),
    RightActionComponent: (
      <HeaderAction icon="trash" onPress={handleDeleteAll} disabled={isPending} />
    ),
  })
}
