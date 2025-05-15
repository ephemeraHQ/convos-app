import { useTurnkey } from "@turnkey/sdk-react-native"
import { AxiosError } from "axios"
import { useEffect } from "react"
import { formatRandomUsername } from "@/features/auth-onboarding/utils/format-random-user-name"
import { useAuthenticationStore } from "@/features/authentication/authentication.store"
import { ITurnkeyUserId } from "@/features/authentication/authentication.types"
import { getAllSenders, getSafeCurrentSender } from "@/features/authentication/multi-inbox.store"
import {
  createIdentity,
  fetchUserIdentities,
} from "@/features/convos-identities/convos-identities.api"
import {
  createUserMutation,
  ICreateUserMutationArgs,
} from "@/features/current-user/create-user.mutation"
import { IConvosUserID } from "@/features/current-user/current-user.types"
import { getStoredDeviceId, storeDeviceId } from "@/features/devices/device.storage"
import { createDevice, fetchDevice, IDeviceCreateInput } from "@/features/devices/devices.api"
import { IDevice } from "@/features/devices/devices.types"
import { getDeviceModelId, getDeviceOs } from "@/features/devices/devices.utils"
import { setUserDeviceQueryData } from "@/features/devices/user-device.query"
import { captureError } from "@/utils/capture-error"
import { AuthenticationError } from "@/utils/error"
import { IEthereumAddress } from "@/utils/evm/address"
import { authLogger } from "@/utils/logger/logger"
import { tryCatch } from "@/utils/try-catch"
import {
  getDevicePushNotificationsToken,
  getExpoPushNotificationsToken,
} from "../notifications/notifications-token"
import { fetchCurrentUser } from "./current-user.api"
import { invalidateCurrentUserQuery } from "./current-user.query"

/**
 * Handles the device registration and identity creation/linking flow
 */
async function makeSureDeviceAndIdentitiesAreCreated(args: { userId: IConvosUserID }) {
  const { userId } = args

  // 1. Check for existing deviceId in SecureStore
  let deviceId = await getStoredDeviceId({ userId })
  let device: IDevice | null = null

  if (deviceId) {
    // Try to fetch the device to validate it still exists
    try {
      device = await fetchDevice({ userId, deviceId })
      authLogger.debug("Found existing device", { deviceId })
    } catch (error) {
      captureError(new AuthenticationError({ error, additionalMessage: "Stored device not found" }))
      deviceId = null
    }
  }

  // 2. If no valid deviceId, create new device
  if (!deviceId) {
    const [{ data: expoToken }, { data: pushToken }] = await Promise.all([
      tryCatch(getExpoPushNotificationsToken()),
      tryCatch(getDevicePushNotificationsToken()),
    ])

    const deviceInput: IDeviceCreateInput = {
      os: getDeviceOs(),
      name: getDeviceModelId(),
      expoToken,
      pushToken,
    }

    try {
      authLogger.debug("Creating new device...")
      device = await createDevice({
        userId,
        device: deviceInput,
      })
      authLogger.debug("Created new device")
      setUserDeviceQueryData({ userId, device })
      await storeDeviceId({ userId, deviceId: device.id })
      deviceId = device.id
    } catch (error) {
      throw new AuthenticationError({ error, additionalMessage: "Failed to create device" })
    }
  }

  // 3. Fetch existing identities for this user
  const { data: existingIdentities, error: fetchUserIdentitiesError } = await tryCatch(
    fetchUserIdentities({ userId }),
  )

  if (fetchUserIdentitiesError) {
    throw new AuthenticationError({
      error: fetchUserIdentitiesError,
      additionalMessage: "Failed to fetch user identities",
    })
  }

  const senders = getAllSenders()

  const missingIdentities = senders.filter(
    (sender) => !existingIdentities.some((identity) => identity.xmtpId === sender.inboxId),
  )

  for (const sender of missingIdentities) {
    authLogger.debug(`Creating missing device identities for ${sender.inboxId}...`)
    // 4. If no identities, create one
    await createIdentity({
      deviceId,
      input: {
        turnkeyAddress: sender.ethereumAddress, // What if it's not a Turnkey address and we connected via EOA?
        xmtpId: sender.inboxId,
      },
    })
    authLogger.debug(`Created new identity for sender ${sender.inboxId} for device`)
  }

  // 5. Refresh current user data to include new device/identity
  await invalidateCurrentUserQuery()
}

async function startFlow(args: { turnkeyUserId: ITurnkeyUserId; ethAddress: IEthereumAddress }) {
  const { turnkeyUserId, ethAddress } = args

  const { data: currentUser, error: fetchCurrentUserError } = await tryCatch(fetchCurrentUser())

  // User exists, ensure device setup
  if (currentUser) {
    authLogger.debug("User exists, ensuring device and identities are created")
    return makeSureDeviceAndIdentitiesAreCreated({
      userId: currentUser.id,
    })
  }

  // User doesn't exist, create new user
  if (
    (fetchCurrentUserError &&
      fetchCurrentUserError instanceof AxiosError &&
      fetchCurrentUserError?.response?.status === 404) ||
    !currentUser
  ) {
    authLogger.debug("User doesn't exist in the backend, creating new user...")

    const currentSender = getSafeCurrentSender()
    const createdUser = await createUserMutation({
      inboxId: currentSender.inboxId,
      turnkeyUserId: turnkeyUserId,
      smartContractWalletAddress: ethAddress,
      profile: getRandomProfile(),
    })

    authLogger.debug("User/Profile created in backend")

    await makeSureDeviceAndIdentitiesAreCreated({
      userId: createdUser.id,
    })
    return
  }

  throw new AuthenticationError({
    error: fetchCurrentUserError,
    additionalMessage: "Failed to fetch current user",
  })
}

/**
 * Ensures user profile exists in backend after Turnkey signup, creating it if missing
 * This handles edge cases like app closure during onboarding
 */
export function useCreateUserIfNoExist() {
  const { user } = useTurnkey()

  useEffect(() => {
    const unsubscribe = useAuthenticationStore.subscribe(
      (state) => state.status,
      (status) => {
        if (status !== "signedIn") {
          return
        }

        if (!user) {
          return
        }

        startFlow({
          turnkeyUserId: user.id as ITurnkeyUserId,
          ethAddress: user.wallets[0].accounts[0].address as IEthereumAddress,
        }).catch(captureError)
      },
      {
        fireImmediately: true,
      },
    )

    return () => {
      unsubscribe()
    }
  }, [user])
}

const firstNames = [
  "Alice",
  "Bob",
  "Charlie",
  "David",
  "Emma",
  "Frank",
  "Grace",
  "Henry",
  "Ivy",
  "Jack",
]
const lastNames = [
  "Smith",
  "Johnson",
  "Williams",
  "Brown",
  "Jones",
  "Garcia",
  "Miller",
  "Davis",
  "Rodriguez",
  "Martinez",
]

function getRandomProfile(): ICreateUserMutationArgs["profile"] {
  const randomFirstName = firstNames[Math.floor(Math.random() * firstNames.length)]
  const randomLastName = lastNames[Math.floor(Math.random() * lastNames.length)]
  const name = `${randomFirstName} ${randomLastName}`
  const username = formatRandomUsername({ displayName: name })

  return {
    name,
    username,
    avatar: null,
    description: null,
  }
}
