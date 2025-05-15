import {
  ensureCurrentUserQueryData,
  useCurrentUserQuery,
} from "@/features/current-user/current-user.query"
import { IXmtpInboxId } from "@/features/xmtp/xmtp.types"
import { ensureUserIdentitiesQueryData, useUserIdentitiesQuery } from "./convos-identities.query"

export async function ensureDeviceIdentityForInboxId(inboxId: IXmtpInboxId) {
  const currentUser = await ensureCurrentUserQueryData({
    caller: "ensureDeviceIdentityForInboxId",
  })

  const identities = await ensureUserIdentitiesQueryData({
    userId: currentUser.id,
  })

  const deviceIdentity = identities.find((identity) => identity.xmtpId === inboxId)

  if (!deviceIdentity) {
    throw new Error("No device identity found for inbox id")
  }

  return deviceIdentity
}

export function useDeviceIdentityForInboxId(inboxId: IXmtpInboxId) {
  const { data: currentUser } = useCurrentUserQuery()

  const { data: identities } = useUserIdentitiesQuery({
    userId: currentUser?.id,
  })

  return {
    data: identities?.find((identity) => identity.xmtpId === inboxId),
  }
}
