import Foundation

class ProfileNameResolver {
    static let shared = ProfileNameResolver()
    
    private let cache = NSCache<NSString, NSString>()
    private let cacheQueue = DispatchQueue(label: "ProfileNameResolver.cache", attributes: .concurrent)
    
    private init() {
        cache.countLimit = 100 // Limit cache to 100 entries
        cache.totalCostLimit = 1024 * 1024 // 1MB limit
    }
    
    func resolveProfileName(for inboxId: String) async -> String? {
        SentryManager.shared.addBreadcrumb("Resolving profile name for inboxId: \(inboxId)")
        
        // 1. First check MMKV
        if let mmkvName = MMKVHelper.shared.getString(forKey: "display_name_\(inboxId)") {
            return mmkvName.isEmpty ? nil : mmkvName
        }
        
        // 2. Then check cache
        if let cachedName = getCachedProfileName(for: inboxId) {
            return cachedName.isEmpty ? nil : cachedName
        }
        
        // 3. Finally fetch from API
        do {
            let profile = try await ConvosAPIService.shared.fetchProfile(for: inboxId)
            let profileName = profile?.name ?? profile?.username
            
            // Cache the result in both cache and MMKV
            setCachedProfileName(profileName, for: inboxId)
            MMKVHelper.shared.setString(profileName ?? "", forKey: "display_name_\(inboxId)")

            SentryManager.shared.addBreadcrumb("Successfully resolved profile name for inboxId: \(inboxId)")
            
            return profileName
        } catch {
            SentryManager.shared.trackError(error, extras: ["info": "Failed to fetch username for inboxId \(inboxId)"])
            
            // Cache nil result to prevent repeated failed requests
            setCachedProfileName(nil, for: inboxId)
            MMKVHelper.shared.setString("", forKey: "display_name_\(inboxId)")
            
            return nil
        }
    }
    
    private func getCachedProfileName(for inboxId: String) -> String? {
        return cacheQueue.sync {
            return cache.object(forKey: NSString(string: inboxId)) as String?
        }
    }
    
    private func setCachedProfileName(_ profileName: String?, for inboxId: String) {
        cacheQueue.async(flags: .barrier) {
            if let profileName = profileName {
                self.cache.setObject(NSString(string: profileName), forKey: NSString(string: inboxId))
            } else {
                // Cache a special marker for nil results to avoid repeated API calls
                self.cache.setObject(NSString(string: ""), forKey: NSString(string: inboxId))
            }
        }
    }
    
    func clearCache() {
        cacheQueue.async(flags: .barrier) {
            self.cache.removeAllObjects()
        }
    }
} 
