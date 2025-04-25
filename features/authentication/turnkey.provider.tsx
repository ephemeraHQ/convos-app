import { TurnkeyProvider as TurnkeyProviderNative } from "@turnkey/sdk-react-native"
import { memo } from "react"
import { config } from "@/config"

export const TurnkeyProvider = memo(function TurnkeyProvider({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <TurnkeyProviderNative
      config={{
        apiBaseUrl: "https://api.turnkey.com",
        organizationId: config.turnkey.organizationId,
        onSessionCreated: (session: any) => {
          console.log("Session Created", session)
        },
        onSessionSelected: (session: any) => {
          console.log("Session Selected", session)
          // router.replace("Dashboard")
        },
        onSessionExpired: (session) => {
          console.log("Session Expired", session)
          // router.push("/")
        },
        onSessionCleared: (session) => {
          console.log("Session Cleared", session)
          // router.push("/")
        },
        onSessionExpiryWarning: (session) => {
          console.log("Session is expiring in 15 seconds", session)
        },
      }}
    >
      {children}
    </TurnkeyProviderNative>
  )
})
