import crypto from "react-native-quick-crypto"

export function hash(input: string): string {
  return crypto.createHash("sha256").update(input).digest("hex")
}
