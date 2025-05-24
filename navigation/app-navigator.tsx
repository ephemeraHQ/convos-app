import { LinkingOptions, NavigationContainer } from "@react-navigation/native"
import { createNativeStackNavigator } from "@react-navigation/native-stack"
import * as Linking from "expo-linking"
import React, { memo, useCallback } from "react"
import { config } from "@/config"
import { AppSettingsScreen } from "@/features/app-settings/app-settings.screen"
import { ArchivedConversationsScreen } from "@/features/archived-conversations/archived-conversations.screen"
import { AuthOnboardingContactCardImportInfoScreen } from "@/features/auth-onboarding/screens/auth-onboarding-contact-card-import-info.screen"
import { AuthOnboardingScreen } from "@/features/auth-onboarding/screens/auth-onboarding.screen"
import { useAuthenticationStore } from "@/features/authentication/authentication.store"
import { useHydrateAuth } from "@/features/authentication/hydrate-auth"
import { ConversationScreen } from "@/features/conversation/conversation-chat/conversation.screen"
import { ConversationListScreen } from "@/features/conversation/conversation-list/conversation-list.screen"
import { ConversationRequestsListScreen } from "@/features/conversation/conversation-requests-list/conversation-requests-list.screen"
import { ConversationUnclearedRequestsScreen } from "@/features/conversation/conversation-requests-list/conversation-uncleared-requests.screen"
// import { ShareProfileNav, ShareProfileScreenConfig } from "../screens/ShareProfileNav"
import { DeepLinkHandler } from "@/features/deep-linking/deep-link-handler.component"
import { getStateFromPath } from "@/features/deep-linking/navigation-handlers"
import { AddGroupMembersScreen } from "@/features/groups/screens/add-group-members.screen"
import { EditGroupScreen } from "@/features/groups/screens/edit-group.screen"
import { GroupDetailsScreen } from "@/features/groups/screens/group-details.screen"
import { GroupMembersListScreen } from "@/features/groups/screens/group-members-list.screen"
import { ProfileImportInfoScreen } from "@/features/profiles/profile-import-info.screen"
import { ProfileScreen } from "@/features/profiles/profile.screen"
import { useEffectOnce } from "@/hooks/use-effect-once"
import { translate } from "@/i18n"
import { NavigationParamList } from "@/navigation/navigation.types"
import { navigationRef } from "@/navigation/navigation.utils"
import { ShareProfileScreen } from "@/screens/ShareProfile"
import { WebviewPreview } from "@/screens/WebviewPreview"
import { ITheme, IThemed, useAppTheme, useThemeProvider } from "@/theme/use-app-theme"
import { captureError, captureErrorWithToast } from "@/utils/capture-error"
import { ensureOurError } from "@/utils/error"
import { logger } from "@/utils/logger/logger"
import { navigationIntegration } from "@/utils/sentry/sentry-init"
import { hideSplashScreen } from "@/utils/splash/splash"

const prefix = Linking.createURL("/")
const schemes = [prefix, ...config.app.universalLinks]

// Add custom app URL schemes for each environment
if (config.app.scheme) {
  schemes.push(`${config.app.scheme}://`)
}

const linking: LinkingOptions<NavigationParamList> = {
  prefixes: schemes,
  config: {
    initialRouteName: "Chats",
    screens: {
      Chats: "/",
      Conversation: {
        path: "/conversation",
        parse: {
          topic: decodeURIComponent,
        },
        stringify: {
          topic: encodeURIComponent,
        },
      },
      Profile: {
        path: "/profile",
      },
      ShareProfile: {
        path: "/shareProfile",
      },
      GroupDetails: {
        path: "/group-details",
        parse: {
          xmtpConversationId: decodeURIComponent,
        },
        stringify: {
          xmtpConversationId: encodeURIComponent,
        },
      },
      AddGroupMembers: {
        path: "/add-group-members",
        parse: {
          xmtpConversationId: decodeURIComponent,
        },
        stringify: {
          xmtpConversationId: encodeURIComponent,
        },
      },
      GroupMembersList: {
        path: "/group-members-list",
        parse: {
          xmtpConversationId: decodeURIComponent,
        },
        stringify: {
          xmtpConversationId: encodeURIComponent,
        },
      },
    },
  },
  getStateFromPath,
}

export const AppNavigator = memo(function AppNavigator() {
  const { themeScheme, navigationTheme, setThemeContextOverride, ThemeProvider } =
    useThemeProvider()

  const { hydrateAuth } = useHydrateAuth()

  useEffectOnce(() => {
    hydrateAuth().catch((err) =>
      captureErrorWithToast(ensureOurError(err), {
        message: "Failed to hydrate auth please restart app",
      }),
    )
  })

  const handleOnReady = useCallback(() => {
    navigationIntegration.registerNavigationContainer(navigationRef)
    logger.debug(`Navigator ready, now hiding splash screen...`)
    hideSplashScreen()
      .then(() => {
        logger.debug(`Splash screen hidden`)
      })
      .catch(captureError)
  }, [])

  return (
    <ThemeProvider value={{ themeScheme, setThemeContextOverride }}>
      <NavigationContainer<NavigationParamList>
        theme={navigationTheme}
        linking={linking}
        ref={navigationRef}
        onReady={handleOnReady}
      >
        <DeepLinkHandler />
        <AppStacks />
      </NavigationContainer>
    </ThemeProvider>
  )
})

export const AppNativeStack = createNativeStackNavigator<NavigationParamList>()

const AppStacks = memo(function AppStacks() {
  const { theme } = useAppTheme()

  const authStatus = useAuthenticationStore((state) => state.status)

  const isUndetermined = authStatus === "undetermined"
  const isSignedOut = authStatus === "signedOut"
  const isSignedIn = authStatus === "signedIn"

  return (
    <AppNativeStack.Navigator
      screenOptions={{
        // Since we handle with useHeader hook
        header: () => null,
      }}
      // https://github.com/react-navigation/react-navigation/issues/11113#issuecomment-2102035739
      initialRouteName={isUndetermined ? "Idle" : isSignedOut ? "Auth" : "Chats"}
    >
      {isUndetermined && renderUndeterminedScreens()}
      {isSignedOut && renderSignedOutScreens(theme)}
      {isSignedIn && renderSignedInScreens(theme)}
    </AppNativeStack.Navigator>
  )
})

function renderUndeterminedScreens() {
  return (
    <AppNativeStack.Screen
      name="Idle"
      component={IdleScreen}
      // Fade animation for auth state changes
      options={{ animation: "fade" }}
    />
  )
}

function renderSignedOutScreens(theme: ITheme) {
  return (
    <AppNativeStack.Group>
      <AppNativeStack.Screen
        name="Auth"
        component={AuthOnboardingScreen}
        // Fade animation when transitioning to signed out state
        options={{ animation: "fade" }}
      />
      <AppNativeStack.Screen
        name="OnboardingCreateContactCardImportName"
        component={AuthOnboardingContactCardImportInfoScreen}
        options={{
          presentation: "formSheet",
          sheetAllowedDetents: [0.5],
          // sheetCornerRadius: theme.borderRadius.sm, // Not sure why but adding this breaks the animation between different height transitions
          contentStyle: {
            backgroundColor: theme.colors.background.raised,
          },
        }}
      />
    </AppNativeStack.Group>
  )
}

function renderSignedInScreens(theme: ITheme) {
  return (
    <AppNativeStack.Group>
      <AppNativeStack.Screen
        name="Chats"
        component={ConversationListScreen}
        // Fade animation when transitioning to authenticated state
        options={{ animation: "fade" }}
      />
      <AppNativeStack.Screen name="Blocked" component={ArchivedConversationsScreen} />
      <AppNativeStack.Screen name="ChatsRequests" component={ConversationRequestsListScreen} />
      <AppNativeStack.Screen
        name="ChatsRequestsUncleared"
        component={ConversationUnclearedRequestsScreen}
      />
      <AppNativeStack.Screen name="Conversation" component={ConversationScreen} />
      <AppNativeStack.Screen
        options={{ presentation: "modal" }}
        name="ShareProfile"
        component={ShareProfileScreen}
      />
      <AppNativeStack.Screen
        options={{ presentation: "modal" }}
        name="WebviewPreview"
        component={WebviewPreview}
      />
      <AppNativeStack.Screen name="Profile" component={ProfileScreen} />
      <AppNativeStack.Screen name="GroupDetails" component={GroupDetailsScreen} />
      <AppNativeStack.Screen name="AddGroupMembers" component={AddGroupMembersScreen} />
      <AppNativeStack.Screen
        options={{
          title: translate("edit_group"),
        }}
        name="EditGroup"
        component={EditGroupScreen}
      />
      <AppNativeStack.Screen name="GroupMembersList" component={GroupMembersListScreen} />
      <AppNativeStack.Screen
        name="ProfileImportInfo"
        component={ProfileImportInfoScreen}
        options={{
          presentation: "formSheet",
          sheetAllowedDetents: [0.5],
          // sheetCornerRadius: theme.borderRadius.sm, // Not sure why but adding this breaks the animation between different height transitions
          contentStyle: {
            backgroundColor: theme.colors.background.raised,
          },
        }}
      />
      <AppNativeStack.Screen name="AppSettings" component={AppSettingsScreen} />
    </AppNativeStack.Group>
  )
}

// TODO: Maybe show animated splash screen or something
function IdleScreen() {
  return null
}
