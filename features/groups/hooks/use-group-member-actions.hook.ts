import { IXmtpConversationId, IXmtpInboxId } from "@features/xmtp/xmtp.types"
import { useMemo } from "react"
import { useSafeCurrentSender } from "@/features/authentication/multi-inbox.store"
import { useGroupMember } from "@/features/groups/hooks/use-group-member"
import { useGroupPermissions } from "@/features/groups/hooks/use-group-permissions.hook"
import { useGroupPermissionsQuery } from "@/features/groups/queries/group-permissions.query"
import { 
  getGroupMemberIsAdmin, 
  getGroupMemberIsSuperAdmin 
} from "@/features/groups/utils/group-admin.utils"
import { userCanDoGroupActions } from "@/features/groups/utils/user-can-do-group-actions"

export function useGroupMemberActions(args: { 
  memberInboxId: IXmtpInboxId | undefined
  xmtpConversationId: IXmtpConversationId 
}) {
  const { memberInboxId, xmtpConversationId } = args
  const currentSender = useSafeCurrentSender()
  
  // Get current user permissions
  const { 
    isSuperAdmin: isCurrentUserSuperAdmin,
    isAdmin: isCurrentUserAdmin,
  } = useGroupPermissions({
    xmtpConversationId,
  })
  
  // Get the group's permission policy directly
  const { data: permissionPolicy } = useGroupPermissionsQuery({
    clientInboxId: currentSender.inboxId,
    xmtpConversationId,
    caller: "useGroupMemberActions",
  })
  
  // Get target member info - useGroupMember already handles undefined memberInboxId
  const { groupMember: targetMember } = useGroupMember({
    memberInboxId,
    xmtpConversationId,
  })
  
  const isTargetSuperAdmin = useMemo(
    () => targetMember && getGroupMemberIsSuperAdmin({ member: targetMember }),
    [targetMember]
  )
  
  const isTargetAdmin = useMemo(
    () => targetMember && getGroupMemberIsAdmin({ member: targetMember }),
    [targetMember]
  )
  
  // Check if the target is the current user
  const isCurrentUser = memberInboxId ? currentSender.inboxId === memberInboxId : false
  
  // Check if the current user can add admins according to policy
  const hasAddAdminPermission = useMemo(() => 
    userCanDoGroupActions(
      permissionPolicy, 
      "addAdminPolicy", 
      isCurrentUserSuperAdmin, 
      isCurrentUserAdmin
    ),
    [permissionPolicy, isCurrentUserSuperAdmin, isCurrentUserAdmin]
  )
  
  // Check if the current user can remove admins according to policy
  const hasRemoveAdminPermission = useMemo(() => 
    userCanDoGroupActions(
      permissionPolicy, 
      "removeAdminPolicy", 
      isCurrentUserSuperAdmin, 
      isCurrentUserAdmin
    ),
    [permissionPolicy, isCurrentUserSuperAdmin, isCurrentUserAdmin]
  )
  
  // Check if the current user can remove members according to policy
  const hasRemoveMemberPermission = useMemo(() => 
    userCanDoGroupActions(
      permissionPolicy, 
      "removeMemberPolicy", 
      isCurrentUserSuperAdmin, 
      isCurrentUserAdmin
    ),
    [permissionPolicy, isCurrentUserSuperAdmin, isCurrentUserAdmin]
  )
  
  // Determine what actions are allowed
  const canPromoteToAdmin = useMemo(() => 
    !!memberInboxId && 
    !isCurrentUser && 
    !isTargetAdmin && 
    !isTargetSuperAdmin && 
    hasAddAdminPermission,
    [memberInboxId, isCurrentUser, isTargetAdmin, isTargetSuperAdmin, hasAddAdminPermission]
  )
  
  const canPromoteToSuperAdmin = useMemo(() => 
    !!memberInboxId && 
    !isCurrentUser && 
    !isTargetSuperAdmin && 
    isCurrentUserSuperAdmin, // Only super admins can promote to super admin
    [memberInboxId, isCurrentUser, isTargetSuperAdmin, isCurrentUserSuperAdmin]
  )
  
  // Add specific rules for removing members
  const canRemoveMember = useMemo(() => {
    if (!memberInboxId || isCurrentUser) return false
    
    // Don't allow regular admins to remove super admins
    if (isTargetSuperAdmin && !isCurrentUserSuperAdmin) return false
    
    return hasRemoveMemberPermission
  }, [memberInboxId, isCurrentUser, hasRemoveMemberPermission, isTargetSuperAdmin, isCurrentUserSuperAdmin])
  
  const canDemoteAdmin = useMemo(() => 
    !!memberInboxId && 
    !isCurrentUser && 
    isTargetAdmin && 
    !isTargetSuperAdmin && 
    hasRemoveAdminPermission,
    [memberInboxId, isCurrentUser, isTargetAdmin, isTargetSuperAdmin, hasRemoveAdminPermission]
  )
  
  const canDemoteSuperAdmin = useMemo(() => 
    !!memberInboxId && 
    !isCurrentUser && 
    isTargetSuperAdmin && 
    isCurrentUserSuperAdmin, // Only super admins can demote super admins
    [memberInboxId, isCurrentUser, isTargetSuperAdmin, isCurrentUserSuperAdmin]
  )
  
  return {
    // Member states
    isCurrentUser,
    isTargetAdmin,
    isTargetSuperAdmin,
    
    // Available actions
    canPromoteToAdmin,
    canPromoteToSuperAdmin,
    canRemoveMember,
    canDemoteAdmin,
    canDemoteSuperAdmin,
    
    // Raw permission checks
    hasAddAdminPermission,
    hasRemoveAdminPermission,
    hasRemoveMemberPermission,
  }
} 