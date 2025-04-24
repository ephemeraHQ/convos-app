import {
  IXmtpConversationId,
  IXmtpDisappearingMessageSettings,
  IXmtpInboxId,
} from "@features/xmtp/xmtp.types"
import {
  addAdmin,
  addGroupMembers,
  addSuperAdmin,
  permissionPolicySet,
  removeAdmin,
  removeGroupMembers,
  removeSuperAdmin,
  updateGroupDescription,
  updateGroupImageUrl,
  updateGroupName,
} from "@xmtp/react-native-sdk"
import { PermissionPolicySet } from "@xmtp/react-native-sdk/build/lib/types/PermissionPolicySet"
import { ensureXmtpInstallationQueryData } from "@/features/xmtp/xmtp-installations/xmtp-installation.query"
import { wrapXmtpCallWithDuration } from "@/features/xmtp/xmtp.helpers"
import { XMTPError } from "@/utils/error"
import { getXmtpClientByInboxId } from "../xmtp-client/xmtp-client"

const defaultCreateGroupPermissionPolicySet: PermissionPolicySet = {
  addMemberPolicy: "admin",
  removeMemberPolicy: "admin",
  updateGroupNamePolicy: "admin",
  updateGroupDescriptionPolicy: "admin",
  updateGroupImagePolicy: "admin",
  updateMessageDisappearingPolicy: "admin",
  addAdminPolicy: "superAdmin",
  removeAdminPolicy: "superAdmin",
}

export async function createXmtpGroup(args: {
  clientInboxId: IXmtpInboxId
  inboxIds: IXmtpInboxId[]
  permissionPolicySet?: PermissionPolicySet
  groupName?: string
  groupPhoto?: string
  groupDescription?: string
  disappearingMessageSettings?: IXmtpDisappearingMessageSettings
}) {
  try {
    const {
      clientInboxId,
      inboxIds,
      permissionPolicySet = defaultCreateGroupPermissionPolicySet,
      groupName,
      groupPhoto,
      groupDescription,
      disappearingMessageSettings,
    } = args

    const client = await getXmtpClientByInboxId({
      inboxId: clientInboxId,
    })

    const group = await wrapXmtpCallWithDuration("newGroupCustomPermissions", () =>
      client.conversations.newGroupCustomPermissions(inboxIds, permissionPolicySet, {
        name: groupName,
        imageUrl: groupPhoto,
        description: groupDescription,
        disappearingMessageSettings,
      }),
    )

    return group
  } catch (error) {
    throw new XMTPError({
      error,
      additionalMessage: "failed to create XMTP group",
    })
  }
}

export async function addXmtpGroupMembers(args: {
  clientInboxId: IXmtpInboxId
  groupId: IXmtpConversationId
  inboxIds: IXmtpInboxId[]
}) {
  try {
    const { clientInboxId, groupId, inboxIds } = args

    const client = await getXmtpClientByInboxId({
      inboxId: clientInboxId,
    })

    return wrapXmtpCallWithDuration("addGroupMembers", () =>
      addGroupMembers(client.installationId, groupId, inboxIds),
    )
  } catch (error) {
    throw new XMTPError({
      error,
      additionalMessage: "failed to add group members",
    })
  }
}

export async function removeXmtpGroupMembers(args: {
  clientInboxId: IXmtpInboxId
  groupId: IXmtpConversationId
  inboxIds: IXmtpInboxId[]
}) {
  try {
    const { clientInboxId, groupId, inboxIds } = args

    const client = await getXmtpClientByInboxId({
      inboxId: clientInboxId,
    })

    await wrapXmtpCallWithDuration("removeGroupMembers", () =>
      removeGroupMembers(client.installationId, groupId, inboxIds),
    )
  } catch (error) {
    throw new XMTPError({
      error,
      additionalMessage: "failed to remove group members",
    })
  }
}

export async function updateXmtpGroupDescription(args: {
  clientInboxId: IXmtpInboxId
  xmtpConversationId: IXmtpConversationId
  description: string
}) {
  const { clientInboxId, xmtpConversationId, description } = args
  try {
    const client = await getXmtpClientByInboxId({
      inboxId: clientInboxId,
    })

    await wrapXmtpCallWithDuration("updateGroupDescription", () =>
      updateGroupDescription(client.installationId, xmtpConversationId, description),
    )
  } catch (error) {
    throw new XMTPError({
      error,
      additionalMessage: "failed to update group description",
    })
  }
}

export async function updateXmtpGroupImage(args: {
  clientInboxId: IXmtpInboxId
  xmtpConversationId: IXmtpConversationId
  imageUrl: string
}) {
  const { clientInboxId, xmtpConversationId, imageUrl } = args

  try {
    const installationId = await ensureXmtpInstallationQueryData({
      inboxId: clientInboxId,
    })

    await wrapXmtpCallWithDuration("updateGroupImageUrl", () =>
      updateGroupImageUrl(installationId, xmtpConversationId, imageUrl),
    )
  } catch (error) {
    throw new XMTPError({
      error,
      additionalMessage: "failed to update group image",
    })
  }
}

export async function updateXmtpGroupName(args: {
  clientInboxId: IXmtpInboxId
  xmtpConversationId: IXmtpConversationId
  name: string
}) {
  const { clientInboxId, xmtpConversationId, name } = args

  try {
    const client = await getXmtpClientByInboxId({
      inboxId: clientInboxId,
    })

    await wrapXmtpCallWithDuration("updateGroupName", () =>
      updateGroupName(client.installationId, xmtpConversationId, name),
    )
  } catch (error) {
    throw new XMTPError({
      error,
      additionalMessage: "failed to update group name",
    })
  }
}

export async function removeAdminFromXmtpGroup(args: {
  clientInboxId: IXmtpInboxId
  groupId: IXmtpConversationId
  adminInboxId: IXmtpInboxId
}) {
  const { clientInboxId, groupId, adminInboxId } = args

  try {
    const client = await getXmtpClientByInboxId({
      inboxId: clientInboxId,
    })

    await wrapXmtpCallWithDuration("removeAdmin", () =>
      removeAdmin(client.installationId, groupId, adminInboxId),
    )
  } catch (error) {
    throw new XMTPError({
      error,
      additionalMessage: "Failed to remove admin from group",
    })
  }
}

export async function removeSuperAdminFromXmtpGroup(args: {
  clientInboxId: IXmtpInboxId
  groupId: IXmtpConversationId
  superAdminInboxId: IXmtpInboxId
}) {
  const { clientInboxId, groupId, superAdminInboxId } = args

  try {
    const client = await getXmtpClientByInboxId({
      inboxId: clientInboxId,
    })

    await wrapXmtpCallWithDuration("removeSuperAdmin", () =>
      removeSuperAdmin(client.installationId, groupId, superAdminInboxId),
    )
  } catch (error) {
    throw new XMTPError({
      error,
      additionalMessage: "Failed to remove super admin from group",
    })
  }
}

export async function addAdminToXmtpGroup(args: {
  clientInboxId: IXmtpInboxId
  groupId: IXmtpConversationId
  adminInboxId: IXmtpInboxId
}) {
  const { clientInboxId, groupId, adminInboxId } = args

  try {
    const client = await getXmtpClientByInboxId({
      inboxId: clientInboxId,
    })

    await wrapXmtpCallWithDuration("addAdmin", () =>
      addAdmin(client.installationId, groupId, adminInboxId),
    )
  } catch (error) {
    throw new XMTPError({
      error,
      additionalMessage: "Failed to add admin to group",
    })
  }
}

export async function addSuperAdminToXmtpGroup(args: {
  clientInboxId: IXmtpInboxId
  groupId: IXmtpConversationId
  superAdminInboxId: IXmtpInboxId
}) {
  const { clientInboxId, groupId, superAdminInboxId } = args

  try {
    const client = await getXmtpClientByInboxId({
      inboxId: clientInboxId,
    })

    await wrapXmtpCallWithDuration("addSuperAdmin", () =>
      addSuperAdmin(client.installationId, groupId, superAdminInboxId),
    )
  } catch (error) {
    throw new XMTPError({
      error,
      additionalMessage: "Failed to add super admin to group",
    })
  }
}

export async function getGroupPermissions(args: {
  clientInboxId: IXmtpInboxId
  conversationId: IXmtpConversationId
}) {
  const { clientInboxId, conversationId } = args

  try {
    const client = await getXmtpClientByInboxId({
      inboxId: clientInboxId,
    })

    return await wrapXmtpCallWithDuration("getGroupPermissions", () =>
      permissionPolicySet(client.installationId, conversationId),
    )
  } catch (error) {
    throw new XMTPError({
      error,
      additionalMessage: "Failed to get group permissions",
    })
  }
}
