// eslint-disable-next-line import/named
import { Session, TurnkeyProvider as TurnkeyProviderNative } from "@turnkey/sdk-react-native"
import { memo } from "react"
import { config } from "@/config"
import { authLogger } from "@/utils/logger/logger"

const sessionConfig = {
  apiBaseUrl: "https://api.turnkey.com",
  organizationId: config.turnkey.organizationId,
  onSessionCreated: (session: Session) => {
    authLogger.debug("Turnkey session Created", session)
  },
  onSessionSelected: (session: Session) => {
    authLogger.debug("Turnkey session Selected", session)
  },
  onSessionExpired: (session: Session) => {
    authLogger.debug("Turnkey session Expired", session)
  },
  onSessionCleared: (session: Session) => {
    authLogger.debug("Turnkey session Cleared", session)
  },
  onSessionExpiryWarning: (session: Session) => {
    authLogger.debug("Turnkey session is expiring in 15 seconds", session)
  },
}

export const TurnkeyProvider = memo(function TurnkeyProvider({
  children,
}: {
  children: React.ReactNode
}) {
  return <TurnkeyProviderNative config={sessionConfig}>{children}</TurnkeyProviderNative>
})
