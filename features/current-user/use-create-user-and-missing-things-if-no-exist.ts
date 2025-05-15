import { useTurnkey } from "@turnkey/sdk-react-native"
import { AxiosError } from "axios"
import { useEffect } from "react"
import { formatRandomUsername } from "@/features/auth-onboarding/utils/format-random-user-name"
import { useAuthenticationStore } from "@/features/authentication/authentication.store"
import { ITurnkeyUserId } from "@/features/authentication/authentication.types"
import { getAllSenders, getSafeCurrentSender } from "@/features/authentication/multi-inbox.store"
import {
  createIdentity,
  linkIdentityToDevice,
} from "@/features/convos-identities/convos-identities.api"
import { ensureUserIdentitiesQueryData } from "@/features/convos-identities/convos-identities.query"
import {
  createUserMutation,
  ICreateUserMutationArgs,
} from "@/features/current-user/create-user.mutation"
import { IConvosUserID } from "@/features/current-user/current-user.types"
import { getStoredDeviceId, storeDeviceId } from "@/features/devices/device.storage"
import { createDevice, fetchUserDevices, IDeviceCreateInput } from "@/features/devices/devices.api"
import { IDeviceId } from "@/features/devices/devices.types"
import { getDeviceName, getDeviceOs } from "@/features/devices/devices.utils"
import {
  ensureUserDeviceQueryData,
  setUserDeviceQueryData,
} from "@/features/devices/user-device.query"
import { getXmtpClientByInboxId } from "@/features/xmtp/xmtp-client/xmtp-client"
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

/**
 * Handles the device registration and identity creation/linking flow
 */
async function makeSureUserDeviceExists(args: { userId: IConvosUserID }) {
  const { userId } = args

  // 1. Check for existing deviceId in SecureStore
  let deviceId = await getStoredDeviceId({ userId })

  if (deviceId) {
    // Now check if the device exists in the backend
    let backendFoundDeviceId: IDeviceId | null = null

    // First try with our stored deviceId
    const { data: device, error: deviceError } = await tryCatch(
      ensureUserDeviceQueryData({ userId }),
    )

    if (device) {
      backendFoundDeviceId = device.id
      authLogger.debug(`Found existing device ${deviceId}`)
    } else {
      captureError(
        new AuthenticationError({
          error: deviceError,
          additionalMessage: "Failed to fetch user device from SecureStore",
        }),
      )

      // Try instead to get all the devices and see if we can find a match
      const { data: devices, error: devicesError } = await tryCatch(fetchUserDevices({ userId }))

      if (devices) {
        const currentDevice = devices.find(
          // TODO: Okay for now, but might want to add more comparison criterias
          (device) => device.name === getDeviceName() && device.os === getDeviceOs(),
        )

        if (currentDevice) {
          backendFoundDeviceId = currentDevice.id
          authLogger.debug(`Found existing device ${deviceId} in list of devices for user`)
        }
      } else {
        throw new AuthenticationError({
          error: devicesError,
          additionalMessage: "Failed to fetch user devices",
        })
      }
    }

    if (!backendFoundDeviceId) {
      authLogger.debug("Can't find device in backend from deviceId in SecureStore")
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
      name: getDeviceName(),
      expoToken,
      pushToken,
    }

    try {
      authLogger.debug("Creating new device...")
      const device = await createDevice({
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

  return deviceId
}

async function makeSureUserIdentitiesExist(args: { userId: IConvosUserID; deviceId: IDeviceId }) {
  const { userId, deviceId } = args

  // 3. Fetch existing identities for this user
  const { data: existingIdentities, error: fetchUserIdentitiesError } = await tryCatch(
    ensureUserIdentitiesQueryData({ userId }),
  )

  if (fetchUserIdentitiesError) {
    throw new AuthenticationError({
      error: fetchUserIdentitiesError,
      additionalMessage: "Failed to fetch user existing identities",
    })
  }

  authLogger.debug(`Found ${existingIdentities.length} existing identities for user ${userId}`)

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
}

async function makeSureIdentitiesAreLinkedToDevice(args: {
  userId: IConvosUserID
  deviceId: IDeviceId
}) {
  const { userId, deviceId } = args

  authLogger.debug(`Linking identities to device ${deviceId} for user ${userId}...`)

  const { data: existingIdentities, error: fetchUserIdentitiesError } = await tryCatch(
    ensureUserIdentitiesQueryData({ userId }),
  )

  if (fetchUserIdentitiesError) {
    throw new AuthenticationError({
      error: fetchUserIdentitiesError,
      additionalMessage: "Failed to fetch user existing identities",
    })
  }

  for (const identity of existingIdentities) {
    await linkIdentityToDevice({ identityId: identity.id, deviceId })
  }

  authLogger.debug(`Identities linked to device ${deviceId} for user ${userId}`)
}

async function startFlow(args: { turnkeyUserId: ITurnkeyUserId; ethAddress: IEthereumAddress }) {
  const { turnkeyUserId, ethAddress } = args

  // First check if user exists
  const { data: currentUser, error: fetchCurrentUserError } = await tryCatch(fetchCurrentUser())

  let userId: IConvosUserID

  const needToCreateUserBecauseOf404 =
    fetchCurrentUserError &&
    fetchCurrentUserError instanceof AxiosError &&
    fetchCurrentUserError?.response?.status === 404

  // Create user if doesn't exist
  if (needToCreateUserBecauseOf404) {
    authLogger.debug("User doesn't exist in the backend, creating new user...")

    const currentSender = getSafeCurrentSender()
    const xmtpClient = await getXmtpClientByInboxId({
      inboxId: currentSender.inboxId,
    })
    const createdUser = await createUserMutation({
      inboxId: currentSender.inboxId,
      turnkeyUserId: turnkeyUserId,
      smartContractWalletAddress: ethAddress,
      profile: getRandomProfile(),
      xmtpInstallationId: xmtpClient.installationId,
    })

    authLogger.debug("New user created!")
    userId = createdUser.id
  } else if (!currentUser) {
    throw new AuthenticationError({
      error: fetchCurrentUserError,
      additionalMessage: "Failed to fetch current user but also it's not a 404 error",
    })
  } else {
    userId = currentUser.id
  }

  const deviceId = await makeSureUserDeviceExists({ userId })

  await makeSureUserIdentitiesExist({ userId, deviceId })

  await makeSureIdentitiesAreLinkedToDevice({ userId, deviceId })
}

/**
 * Ensures user profile exists in backend after Turnkey signup, creating it if missing
 * This handles edge cases like app closure during onboarding
 */
export function useCreateUserIfNoExist() {
  const { user } = useTurnkey()
  const authStatus = useAuthenticationStore((state) => state.status)

  useEffect(() => {
    if (authStatus !== "signedIn" || !user) {
      return
    }

    startFlow({
      turnkeyUserId: user.id as ITurnkeyUserId,
      ethAddress: user.wallets[0].accounts[0].address as IEthereumAddress,
    }).catch(captureError)
  }, [authStatus, user])
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
