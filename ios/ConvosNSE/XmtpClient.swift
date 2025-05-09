import Foundation
import XMTP

func getXmtpClient(ethAddress: String) async -> XMTP.Client? {
    do {
        let encryptionKeys = getDbEncryptionKey(ethAddress: ethAddress)
        guard !encryptionKeys.isEmpty else {
            log.error("Db Encryption Key is undefined")
            return nil
        }

        let xmtpEnv = getXmtpEnv()
        let groupId = getInfoPlistValue(key: "AppGroupIdentifier")
        let groupUrl = FileManager.default.containerURL(
            forSecurityApplicationGroupIdentifier: groupId)
        guard let groupUrl else {
            return nil
        }
        let groupDir = groupUrl.path

        let optionses = encryptionKeys.map { encryptionKey in
            ClientOptions(
                api: .init(env: xmtpEnv),
                dbEncryptionKey: encryptionKey,
                dbDirectory: groupDir
            )
        }

        let identity = PublicIdentity(kind: .ethereum, identifier: ethAddress)

        for (ix, options) in optionses.enumerated() {
            // if we've made it to the last one and haven't had success yet, don't try? just try
            if optionses.count >= 1, ix == optionses.count - 1 {
                let client = try await Client.build(publicIdentity: identity, options: options)
                return client
            } else {
                let client = try? await Client.build(publicIdentity: identity, options: options)
                return client
            }
        }
        return nil
    } catch {
        fatalError(
            "TODO: Handle error in getXmtpClient. Failed to get client. Error: \(String(describing: error))"
        )
    }

}

func getXmtpEnv() -> XMTP.XMTPEnvironment {
    let env = getInfoPlistValue(key: "XmtpEnvironment")

    if env == "production" {
        return .production
    }

    if env == "dev" {
        return .dev
    }

    return .local
}
