import { useIsFocused, useNavigation } from "@react-navigation/native"
import { useLayoutEffect } from "react"
import { Header, HeaderProps } from "@/design-system/Header/Header"

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
      // Use the Header component directly
      header: () => <Header {...headerProps} />,
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, navigation, headerProps]) // Dependencies ensure header updates if original props change
}
