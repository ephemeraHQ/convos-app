import { getRandomBytesAsync } from "expo-crypto"
import { XMTPError } from "@/utils/error"

const XMTP_KEY_LENGTH = 32

export function _formatKey(base64Key: string): Uint8Array {
  const keyArray = new Uint8Array(Buffer.from(base64Key, "base64"))

  if (keyArray.length !== XMTP_KEY_LENGTH) {
    throw new XMTPError({
      error: new Error(`Invalid key length: ${keyArray.length}. Expected ${XMTP_KEY_LENGTH} bytes`),
      additionalMessage: "XMTP encryption key has invalid length",
    })
  }

  return keyArray
}

export async function _generateKey(): Promise<string> {
  return Buffer.from(await getRandomBytesAsync(XMTP_KEY_LENGTH)).toString("base64")
}
