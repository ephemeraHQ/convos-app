import { useTurnkey } from "@turnkey/sdk-react-native"
import { AxiosError } from "axios"
import { useEffect } from "react"
import { config } from "@/config"
import { formatRandomUsername } from "@/features/auth-onboarding/utils/format-random-user-name"
import { useAuthenticationStore } from "@/features/authentication/authentication.store"
import { ITurnkeyUserId } from "@/features/authentication/authentication.types"
import {
  getAllSenders,
  getSafeCurrentSender,
  ISender,
} from "@/features/authentication/multi-inbox.store"
import {
  createIdentity,
  IDeviceIdentity,
  linkIdentityToDevice,
} from "@/features/convos-identities/convos-identities.api"
import { ensureUserIdentitiesQueryData } from "@/features/convos-identities/convos-identities.query"
import {
  createUserMutation,
  ICreateUserMutationArgs,
} from "@/features/current-user/create-user.mutation"
import { IConvosUserId } from "@/features/current-user/current-user.types"
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
import { logger } from "@/utils/logger/logger"
import { tryCatch } from "@/utils/try-catch"
import {
  getDevicePushNotificationsToken,
  getExpoPushNotificationsToken,
} from "../notifications/notifications-token"
import { fetchCurrentUser } from "./current-user.api"

/**
 * Ensures user profile exists in backend after Turnkey signup, creating it if missing
 * This handles edge cases like app closure during onboarding
 */
export function useCreateUserAndMissingThingsIfNoExist() {
  const { user } = useTurnkey()
  const authStatus = useAuthenticationStore((state) => state.status)

  useEffect(() => {
    if (authStatus !== "signedIn" || !user) {
      return
    }

    createUserAndMissingThingsIfNoExist({
      turnkeyUserId: user.id as ITurnkeyUserId,
      ethAddress: user.wallets[0].accounts[0].address as IEthereumAddress,
    }).catch(captureError)
  }, [authStatus, user])
}

/**
 * Handles the device registration and identity creation/linking flow
 */
async function makeSureUserDeviceExists(args: { userId: IConvosUserId }) {
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
      logger.debug(`Found existing device ${deviceId}`)
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
          logger.debug(`Found existing device ${deviceId} in list of devices for user`)
        }
      } else {
        throw new AuthenticationError({
          error: devicesError,
          additionalMessage: "Failed to fetch user devices",
        })
      }
    }

    if (!backendFoundDeviceId) {
      logger.debug("Can't find device in backend from deviceId in SecureStore")
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
      appBuildNumber: String(config.app.buildNumber),
      appVersion: config.app.version,
    }

    try {
      logger.debug("Creating new device...")
      const device = await createDevice({
        userId,
        device: deviceInput,
      })
      logger.debug("Created new device")
      setUserDeviceQueryData({ userId, device })
      await storeDeviceId({ userId, deviceId: device.id })
      deviceId = device.id
    } catch (error) {
      throw new AuthenticationError({ error, additionalMessage: "Failed to create device" })
    }
  }

  return deviceId
}

async function makeSureIdentitiesExistAndAreValid(args: {
  userId: IConvosUserId
  deviceId: IDeviceId
}) {
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

  logger.debug(`Found ${existingIdentities.length} existing identities for user ${userId}`)

  const senders = getAllSenders()

  const sendersWithExistingIdentity: {
    sender: ISender
    identity: IDeviceIdentity
  }[] = []
  const sendersWithMissingIdentity: ISender[] = []

  // Categorize each sender based on whether they have an existing identity
  for (const sender of senders) {
    const existingIdentity = existingIdentities.find(
      (identity) => identity.xmtpId === sender.inboxId,
    )

    if (existingIdentity) {
      sendersWithExistingIdentity.push({ sender, identity: existingIdentity })
    } else {
      sendersWithMissingIdentity.push(sender)
    }
  }

  // Create missing identities
  for (const sender of sendersWithMissingIdentity) {
    logger.debug(`Creating missing device identities for ${sender.inboxId}...`)
    await createIdentity({
      deviceId,
      input: {
        turnkeyAddress: sender.ethereumAddress,
        xmtpId: sender.inboxId,
      },
    })
    logger.debug(`Created new identity for sender ${sender.inboxId} for device`)
  }

  // Update existing identities if needed
  for (const { sender, identity } of sendersWithExistingIdentity) {
    if (sender.ethereumAddress !== identity.turnkeyAddress) {
      logger.debug(`Updating identity ${identity.id} with correct turnkey address...`)
      await createIdentity({
        deviceId,
        input: {
          turnkeyAddress: sender.ethereumAddress,
          xmtpId: sender.inboxId,
        },
      })
      logger.debug(`Updated identity ${identity.id} with correct turnkey address`)
    }
  }
}

async function makeSureIdentitiesAreLinkedToDevice(args: {
  userId: IConvosUserId
  deviceId: IDeviceId
}) {
  const { userId, deviceId } = args

  logger.debug(`Linking identities to device ${deviceId} for user ${userId}...`)

  const { data: existingIdentities, error: fetchUserIdentitiesError } = await tryCatch(
    ensureUserIdentitiesQueryData({ userId }),
  )

  if (fetchUserIdentitiesError) {
    throw new AuthenticationError({
      error: fetchUserIdentitiesError,
      additionalMessage: "Failed to fetch user existing identities",
    })
  }

  await Promise.all(
    existingIdentities.map((identity) =>
      linkIdentityToDevice({ identityId: identity.id, deviceId }),
    ),
  )

  logger.debug(`Identities linked to device ${deviceId} for user ${userId}`)
}

async function createUserAndMissingThingsIfNoExist(args: {
  turnkeyUserId: ITurnkeyUserId
  ethAddress: IEthereumAddress
}) {
  const { turnkeyUserId, ethAddress } = args

  logger.debug("Starting to create user and missing things if no exist...")

  // First check if user exists
  const { data: currentUser, error: fetchCurrentUserError } = await tryCatch(fetchCurrentUser())

  let userId: IConvosUserId

  const needToCreateUserBecauseOf404 =
    fetchCurrentUserError &&
    fetchCurrentUserError instanceof AxiosError &&
    fetchCurrentUserError?.response?.status === 404

  // Create user if doesn't exist
  if (needToCreateUserBecauseOf404) {
    logger.debug("User doesn't exist in the backend, creating new user...")

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

    logger.debug("New user created!")
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

  await makeSureIdentitiesExistAndAreValid({ userId, deviceId })

  await makeSureIdentitiesAreLinkedToDevice({ userId, deviceId })
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
