import { memo, useMemo } from "react"
import { FlatList } from "react-native"
import { ElapsedTimeCounter } from "@/components/elapsed-time-counter"
import { Screen } from "@/components/screen/screen"
import { ListItem } from "@/design-system/list-item"
import { Text } from "@/design-system/Text"
import { VStack } from "@/design-system/VStack"
import { IXmtpOperation, useXmtpActivityStore } from "@/features/xmtp/xmtp-activity.store"
import { useHeader } from "@/navigation/use-header"
import { useRouter } from "@/navigation/use-navigation"
import { useAppTheme } from "@/theme/use-app-theme"

export const XmtpActivityScreen = memo(function XmtpActivityScreen() {
  const { theme } = useAppTheme()
  const router = useRouter()

  useHeader({
    backgroundColor: theme.colors.background.surface,
    leftText: "Close",
    onLeftPress: () => router.goBack(),
  })

  const activeOperations = useXmtpActivityStore((state) => state.activeOperations)

  const operationsArray = useMemo(() => Object.values(activeOperations), [activeOperations])

  return (
    <Screen contentContainerStyle={{ flex: 1 }}>
      {operationsArray.length === 0 ? (
        <VStack style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
          <Text color="secondary">No active XMTP queries</Text>
        </VStack>
      ) : (
        <FlatList
          data={operationsArray}
          keyExtractor={(item) => item.id}
          ListHeaderComponent={() => (
            <VStack
              style={{
                paddingHorizontal: theme.spacing.sm,
              }}
            >
              <Text preset="small" color="secondary">
                List of active XMTP queries. This is useful to understand why sometimes the app can
                be slow or miss some data.
              </Text>
            </VStack>
          )}
          renderItem={({ item }: { item: IXmtpOperation }) => (
            <ListItem
              title={item.name}
              end={<ElapsedTimeCounter startTimeMs={item.startTime} showMilliseconds={false} />}
            />
          )}
          contentContainerStyle={{ paddingVertical: theme.spacing.sm }}
        />
      )}
    </Screen>
  )
})
