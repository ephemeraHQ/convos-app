import Foundation
import XMTP

func getXmtpClient(ethAddress: String) async -> XMTP.Client? {
  do {
    guard let encryptionKey = try? getDbEncryptionKey(ethAddress: ethAddress) else {
      log("Db Encryption Key is undefined", type: .error)
      return nil
    }
    
    let xmtpEnv = getXmtpEnv()
    let groupId = getInfoPlistValue(key: "AppGroupIdentifier")

    if(groupId == nil) {
      log("AppGroupIdentifier is undefined", type: .error, category: "xmtpClient")
      return nil
    }

    let groupUrl = FileManager.default.containerURL(forSecurityApplicationGroupIdentifier: groupId ?? "")!
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

  if(env == nil) {
    log("XmtpEnvironment is undefined setting to local", type: .error, category: "xmtpClient")
    return .local
  }

  if(env == "production") {
    return .production
  }

  if(env == "dev") {
    return .dev
  }

  return .local
}
