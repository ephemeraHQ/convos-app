import { useHeaderHeight } from "@react-navigation/elements"
import { NativeStackScreenProps } from "@react-navigation/native-stack"
import { shortAddress } from "@utils/strings/shortAddress"
import React, { useState } from "react"
import { Platform, Share } from "react-native"
import QRCode from "react-native-qrcode-svg"
import { Avatar } from "@/components/avatar"
import Button from "@/components/Button/Button"
import { Screen } from "@/components/screen/screen"
import { config } from "@/config"
import { Center } from "@/design-system/Center"
import { Text } from "@/design-system/Text"
import { VStack } from "@/design-system/VStack"
import { useSafeCurrentSender } from "@/features/authentication/multi-inbox.store"
import { usePreferredDisplayInfo } from "@/features/preferred-display-info/use-preferred-display-info"
import { generateProfileUrl } from "@/features/profiles/utils/profile-url"
import { translate } from "@/i18n"
import { NavigationParamList } from "@/navigation/navigation.types"
import { useHeader } from "@/navigation/use-header"
import { SCREEN_WIDTH } from "@/theme/layout"
import { $globalStyles } from "@/theme/styles"
import { useAppTheme } from "@/theme/use-app-theme"
import { captureErrorWithToast } from "@/utils/capture-error"
import { GenericError } from "@/utils/error"

type IShareProfileScreenProps = NativeStackScreenProps<NavigationParamList, "ShareProfile">

export function ShareProfileScreen({ route, navigation }: IShareProfileScreenProps) {
  const { theme } = useAppTheme()
  const { inboxId } = useSafeCurrentSender()
  const headerHeight = useHeaderHeight()
  const [copiedLink, setCopiedLink] = useState(false)

  const { username, displayName, avatarUrl } = usePreferredDisplayInfo({
    inboxId,
    caller: "ShareProfileScreen",
  })

  const profileUrl = generateProfileUrl({ username, inboxId })

  const shareDict = Platform.OS === "ios" ? { url: profileUrl } : { message: profileUrl }

  const shareButtonText = copiedLink ? translate("Link copied") : translate("Copy link")

  useHeader({
    title: "Share Profile",
    onBack: () => navigation.goBack(),
    backgroundColor: theme.colors.background.surface,
  })

  async function handleShare() {
    try {
      await Share.share(shareDict)
      setCopiedLink(true)
    } catch (error) {
      captureErrorWithToast(
        new GenericError({ error, additionalMessage: "Error sharing profile" }),
        {
          message: "Error sharing profile",
        },
      )
    }
  }

  return (
    <Screen
      backgroundColor={theme.colors.background.surface}
      safeAreaEdges={["bottom"]}
      contentContainerStyle={$globalStyles.flex1}
    >
      <VStack
        style={{
          flex: 1,
          justifyContent: "space-between",
        }}
      >
        <VStack
          style={{ alignItems: "center", justifyContent: "center", rowGap: theme.spacing.xxxs }}
        >
          <Avatar uri={avatarUrl} name={displayName} style={{ alignSelf: "center" }} />
          <Text
            preset="title"
            style={{
              textAlign: "center",
            }}
          >
            {displayName || shortAddress(inboxId)}
          </Text>
          {username && (
            <Text
              preset="formLabel"
              style={{
                marginHorizontal: theme.spacing.xl,
                textAlign: "center",
              }}
            >
              {`${username}.${config.app.webDomain}`}
            </Text>
          )}
        </VStack>

        <Center
          style={{
            marginTop: theme.spacing.xxl,
          }}
        >
          <QRCode
            size={SCREEN_WIDTH * 0.5}
            value={profileUrl}
            backgroundColor={theme.colors.background.surface}
            color={theme.colors.text.primary}
          />
        </Center>

        <VStack
          style={{
            flex: 1,
            justifyContent: "flex-end",
            alignItems: "center",
            paddingHorizontal: theme.spacing.lg,
          }}
        >
          <Button
            style={{ width: "100%" }}
            title={shareButtonText}
            picto={copiedLink ? "checkmark" : "doc.on.doc"}
            onPress={handleShare}
          />
        </VStack>

        <VStack style={{ height: headerHeight }} />
      </VStack>
    </Screen>
  )
}
