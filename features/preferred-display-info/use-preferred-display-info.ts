import { IXmtpInboxId } from "@features/xmtp/xmtp.types"
import { useQuery } from "@tanstack/react-query"
import {
  getSafeCurrentSender,
  useSafeCurrentSender,
} from "@/features/authentication/multi-inbox.store"
import {
  getPreferredAvatarUrl,
  getPreferredDisplayName,
  getPreferredEthAddress,
} from "@/features/preferred-display-info/preferred-display-info.utils"
import {
  ensureProfileQueryData,
  getProfileQueryConfig,
  getProfileQueryData,
} from "@/features/profiles/profiles.query"
import { getSocialProfilesForInboxIdQueryOptions } from "@/features/social-profiles/social-profiles-for-inbox-id.query"
import {
  ensureSocialProfilesForAddressQuery,
  getSocialProfilesForEthAddressQueryData,
  getSocialProfilesForEthAddressQueryOptions,
} from "@/features/social-profiles/social-profiles.query"
import {
  ensureEthAddressesForXmtpInboxIdQueryData,
  getEthAddressesForXmtpInboxIdQueryData,
  useEthAddressesForXmtpInboxIdQuery,
} from "@/features/xmtp/xmtp-inbox-id/eth-addresses-for-xmtp-inbox-id.query"
import {
  ensureXmtpInboxIdFromEthAddressQueryData,
  getXmtpInboxIdFromEthAddressQueryData,
  getXmtpInboxIdFromEthAddressQueryOptions,
} from "@/features/xmtp/xmtp-inbox-id/xmtp-inbox-id-from-eth-address.query"
import { mergeArraysObjects } from "@/utils/array"
import { IEthereumAddress } from "@/utils/evm/address"
import { reactQueryFreshDataQueryOptions } from "@/utils/react-query/react-query.constants"

// At least one of these properties must be defined
type PreferredDisplayInfoArgs = {
  freshData?: boolean
} & (
  | {
      inboxId: IXmtpInboxId | undefined
      ethAddress?: IEthereumAddress
    }
  | {
      inboxId?: IXmtpInboxId
      ethAddress: IEthereumAddress | undefined
    }
)

export function usePreferredDisplayInfo(args: PreferredDisplayInfoArgs & { caller: string }) {
  const { inboxId: inboxIdArg, ethAddress: ethAddressArg, freshData, caller: callerArg } = args

  const currentSender = useSafeCurrentSender()
  const caller = `${callerArg}:usePreferredDisplayInfo`

  const { data: inboxIdFromEthAddress } = useQuery({
    ...getXmtpInboxIdFromEthAddressQueryOptions({
      clientInboxId: currentSender.inboxId,
      targetEthAddress: ethAddressArg!, // ! because we check enabled
      caller,
    }),
    enabled: !!ethAddressArg,
    ...(freshData && { ...reactQueryFreshDataQueryOptions }),
  })

  const inboxId = inboxIdArg ?? inboxIdFromEthAddress

  const { data: ethAddressesForXmtpInboxId } = useEthAddressesForXmtpInboxIdQuery({
    clientInboxId: currentSender.inboxId,
    inboxId,
    caller,
    ...(freshData && { ...reactQueryFreshDataQueryOptions }),
  })

  // Get Convos profile data
  const { data: profile, isLoading: isLoadingProfile } = useQuery({
    ...getProfileQueryConfig({ xmtpId: inboxId, caller }),
    ...(freshData && { ...reactQueryFreshDataQueryOptions }),
  })

  // Get social profiles data
  const { data: socialProfilesForInboxId, isLoading: isLoadingSocialProfilesForInboxId } = useQuery(
    {
      ...getSocialProfilesForInboxIdQueryOptions({
        inboxId,
        clientInboxId: currentSender.inboxId,
        caller,
      }),
      ...(freshData && { ...reactQueryFreshDataQueryOptions }),
    },
  )

  const ethAddress = ethAddressArg || ethAddressesForXmtpInboxId?.[0]

  const { data: socialProfilesForEthAddress, isLoading: isLoadingSocialProfilesForEthAddress } =
    useQuery({
      ...getSocialProfilesForEthAddressQueryOptions({
        ethAddress,
        caller,
      }),
      ...(freshData && { ...reactQueryFreshDataQueryOptions }),
    })

  const socialProfiles = mergeArraysObjects({
    arr1: socialProfilesForInboxId ?? [],
    arr2: socialProfilesForEthAddress ?? [],
    compareObjects: (obj1, obj2) => obj1.type === obj2.type,
  })

  const displayName = getPreferredDisplayName({
    profile,
    socialProfiles,
    ethAddress,
    inboxId,
  })

  const avatarUrl = getPreferredAvatarUrl({
    profile,
    socialProfiles,
  })

  const preferredEthAddress = getPreferredEthAddress({
    profile,
    socialProfiles,
    ethAddress,
  })

  const preferredUsername = profile?.username

  return {
    displayName,
    avatarUrl,
    username: preferredUsername,
    ethAddress: preferredEthAddress,
    isLoading:
      isLoadingProfile || isLoadingSocialProfilesForInboxId || isLoadingSocialProfilesForEthAddress,
  }
}

export function getPreferredDisplayInfo(args: PreferredDisplayInfoArgs) {
  let { inboxId: inboxIdArg, ethAddress: ethAddressArg } = args

  const currentSender = getSafeCurrentSender()

  let inboxId = inboxIdArg
  let ethAddress = ethAddressArg

  if (ethAddress && !inboxId) {
    inboxId = getXmtpInboxIdFromEthAddressQueryData({
      clientInboxId: currentSender.inboxId,
      targetEthAddress: ethAddressArg,
    })
  }

  if (!ethAddress && inboxId) {
    ethAddress = getEthAddressesForXmtpInboxIdQueryData({
      clientInboxId: currentSender.inboxId,
      inboxId: inboxId,
    })?.[0]
  }

  const profile =
    inboxId &&
    getProfileQueryData({
      xmtpId: inboxId,
    })

  // Can't for now because it's a promise and we don't want promise in this function
  // const socialProfilesForInboxId =
  //   inboxId &&
  //   getSocialProfilesForInboxId({
  //     inboxId,
  //   })

  const socialProfilesForEthAddress =
    ethAddress &&
    getSocialProfilesForEthAddressQueryData({
      ethAddress,
    })

  const socialProfiles = mergeArraysObjects({
    arr1: [],
    arr2: socialProfilesForEthAddress ?? [],
    compareObjects: (obj1, obj2) => obj1.type === obj2.type,
  })

  const displayName = getPreferredDisplayName({
    profile,
    socialProfiles,
    ethAddress,
    inboxId,
  })

  const avatarUrl = getPreferredAvatarUrl({
    profile,
    socialProfiles,
  })

  const preferredEthAddress = getPreferredEthAddress({
    profile,
    socialProfiles,
    ethAddress,
  })

  const preferredUsername = profile?.username

  return {
    displayName,
    avatarUrl,
    username: preferredUsername,
    ethAddress: preferredEthAddress,
  }
}

export async function ensurePreferredDisplayInfo(args: PreferredDisplayInfoArgs) {
  const { inboxId: inboxIdArg, ethAddress: ethAddressArg } = args

  const currentSender = getSafeCurrentSender()

  let inboxId = inboxIdArg
  let ethAddress = ethAddressArg

  if (ethAddress && !inboxId) {
    inboxId = await ensureXmtpInboxIdFromEthAddressQueryData({
      clientInboxId: currentSender.inboxId,
      targetEthAddress: ethAddressArg,
      caller: "ensurePreferredDisplayInfo",
    })
  }

  if (!ethAddress && inboxId) {
    ethAddress = (
      await ensureEthAddressesForXmtpInboxIdQueryData({
        clientInboxId: currentSender.inboxId,
        inboxId: inboxId,
        caller: "ensurePreferredDisplayInfo",
      })
    )?.[0]
  }

  const profile =
    inboxId &&
    (await ensureProfileQueryData({ xmtpId: inboxId, caller: "ensurePreferredDisplayInfo" }))

  const socialProfiles =
    ethAddress &&
    (await ensureSocialProfilesForAddressQuery({
      ethAddress,
      caller: "ensurePreferredDisplayInfo",
    }))

  const displayName = getPreferredDisplayName({
    profile,
    socialProfiles,
    ethAddress,
    inboxId,
  })

  const avatarUrl = getPreferredAvatarUrl({
    profile,
    socialProfiles,
  })

  const preferredEthAddress = getPreferredEthAddress({
    profile,
    socialProfiles,
    ethAddress,
  })

  const preferredUsername = profile?.username

  return {
    displayName,
    avatarUrl,
    username: preferredUsername,
    ethAddress: preferredEthAddress,
  }
}
