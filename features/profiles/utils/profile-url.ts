import { config } from "@/config"

type IGenerateProfileUrlArgs = {
  username?: string | null
  inboxId?: string
}

/**
 * Generates a profile URL based on the provided username or inboxId
 * If username is provided, returns a vanity URL (e.g. https://username.convos.org)
 * If no username but inboxId is provided, returns a direct message URL (e.g. https://convos.org/dm/inboxId)
 */
export function generateProfileUrl(args: IGenerateProfileUrlArgs) {
  const { username, inboxId } = args

  if (username) {
    return `https://${username}.${config.app.webDomain}`
  }

  if (inboxId) {
    return `https://${config.app.webDomain}/dm/${inboxId}`
  }

  throw new Error("Either username or inboxId must be provided")
}
