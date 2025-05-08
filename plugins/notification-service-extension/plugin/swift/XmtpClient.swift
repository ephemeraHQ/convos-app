import Foundation
import XMTP

func getXmtpClient(ethAddress: String) async -> XMTP.Client? {
    do {
        guard let encryptionKey = getDbEncryptionKey(ethAddress: ethAddress) else {
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

        let options = ClientOptions(
            api: .init(env: xmtpEnv),
            dbEncryptionKey: encryptionKey,
            dbDirectory: groupDir
        )

        let identity = PublicIdentity(kind: .ethereum, identifier: ethAddress)

        let client = try await Client.build(publicIdentity: identity, options: options)

        return client
    } catch {
        return nil;
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
