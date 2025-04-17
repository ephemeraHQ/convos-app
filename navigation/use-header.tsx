import { useIsFocused, useNavigation } from "@react-navigation/native"
import { memo, useLayoutEffect } from "react"
import { Header, HeaderProps } from "@/design-system/Header/Header"
import { HeaderAction } from "@/design-system/Header/HeaderAction"
import { HStack } from "@/design-system/HStack"
import { Loader } from "@/design-system/loader"
import { Pressable } from "@/design-system/Pressable"
import { useXmtpActivityStore } from "@/features/xmtp/xmtp-activity.store"
import { useRouter } from "@/navigation/use-navigation"
import { useAppTheme } from "@/theme/use-app-theme"

// Internal component to handle rendering based on loading state
const HeaderRenderer = memo(function HeaderRenderer(props: { headerProps: HeaderProps }) {
  const { headerProps } = props
  const { theme } = useAppTheme()
  const router = useRouter()

  // If we find at least one operation has been active for more than 3 seconds, we consider it loading
  const showXmtpLoaderInHeader = useXmtpActivityStore((state) =>
    Object.values(state.activeOperations).some((operation) => {
      if (!operation.startTime) {
        return false
      }
      return Date.now() - operation.startTime > (__DEV__ ? 0 : 5000)
    }),
  )

  // Calculate final props based on loading state
  const finalHeaderProps: HeaderProps = { ...headerProps }
  const LoaderComponent = (
    <Pressable onPress={() => router.navigate("XmtpActivity")}>
      <Loader size="sm" />
    </Pressable>
  )

  const hasOriginalRightAction =
    headerProps.RightActionComponent ||
    headerProps.rightIcon ||
    headerProps.rightText ||
    headerProps.rightTx

  if (showXmtpLoaderInHeader) {
    if (hasOriginalRightAction) {
      const OriginalRightAction = headerProps.RightActionComponent ? (
        headerProps.RightActionComponent
      ) : (
        <HeaderAction
          tx={headerProps.rightTx}
          text={headerProps.rightText}
          icon={headerProps.rightIcon}
          iconColor={headerProps.rightIconColor}
          onPress={headerProps.onRightPress}
          txOptions={headerProps.rightTxOptions}
          backgroundColor={headerProps.backgroundColor}
        />
      )

      finalHeaderProps.RightActionComponent = (
        <HStack style={{ alignItems: "center", gap: theme.spacing.sm }}>
          {LoaderComponent}
          {OriginalRightAction}
        </HStack>
      )
      finalHeaderProps.rightTx = undefined
      finalHeaderProps.rightText = undefined
      finalHeaderProps.rightIcon = undefined
      finalHeaderProps.onRightPress = undefined
    } else {
      finalHeaderProps.RightActionComponent = LoaderComponent
      finalHeaderProps.rightTx = undefined
      finalHeaderProps.rightText = undefined
      finalHeaderProps.rightIcon = undefined
      finalHeaderProps.onRightPress = undefined
    }
  }

  // Render the actual Header with the final props
  return <Header {...finalHeaderProps} />
})

/**
 * A hook that can be used to easily set the Header of a react-navigation screen from within the screen's component.
 *
 * Header Background Convention:
 * - By default, headers use a 'surfaceless' background to match content screens like conversation list and chat
 * - For settings-like screens (Profile, AppSettings, etc.) that use a 'surface' background,
 *   explicitly set backgroundColor: theme.colors.background.surface in the header config
 * @see [Documentation and Examples]{@link https://docs.infinite.red/ignite-cli/boilerplate/utility/useHeader/}
 * @param {HeaderProps} headerProps - The props for the `Header` component.
 * @param {any[]} deps - The dependencies to watch for changes to update the header.
 */
export function useHeader(
  headerProps: HeaderProps,
  deps: Parameters<typeof useLayoutEffect>[1] = [],
) {
  const navigation = useNavigation()

  const isFocused = useIsFocused()

  useLayoutEffect(() => {
    if (!isFocused) {
      return
    }

    // The effect now only depends on the original deps, navigation, and headerProps
    navigation.setOptions({
      headerShown: true,
      // Use the internal HeaderRenderer component
      header: () => <HeaderRenderer headerProps={headerProps} />,
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, navigation, headerProps]) // Dependencies ensure header updates if original props change
}
