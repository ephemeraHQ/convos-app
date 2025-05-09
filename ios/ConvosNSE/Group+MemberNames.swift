import Foundation
import XMTP

extension Group {
  var memberNames: [String?] {
    get async throws {
      let members = try await members
      let memberInboxIds = members.map { $0.inboxId }
      return await withTaskGroup(of: String?.self) { group in
        for id in memberInboxIds {
          group.addTask {
            await ProfileNameResolver.shared.resolveProfileName(for: id)
          }
        }

        var names: [String?] = []
        for await name in group {
          names.append(name)
        }
        return names
      }
    }
  }

  /// if you set `currentInboxId`, that member's profile name will be replaced with "You"
  func membersString(for currentInboxId: String? = nil, excluding: [String] = []) async throws -> String {
    let members = try await members
    let maxToShow = 5

    // Get all member IDs (excluding specified ones)
    var allMemberIds = members.map { $0.inboxId }
    allMemberIds.removeAll(where: { excluding.contains($0) && $0 != currentInboxId })

    // Calculate how many will be shown vs others
    let totalMembers = allMemberIds.count

    // Order and limit the IDs we'll show names for
    let shownMemberIds: [String]
    if let currentInboxId, let idx = allMemberIds.firstIndex(of: currentInboxId) {
      // If currentInboxId exists, show it first
      allMemberIds.remove(at: idx)
      shownMemberIds = [currentInboxId] + Array(allMemberIds.prefix(maxToShow - 1))
    } else {
      shownMemberIds = Array(allMemberIds.prefix(maxToShow))
    }

    // Calculate actual number of others
    let othersCount = totalMembers - shownMemberIds.count

    // Resolve names for shown members
    var resolvedNames: [String] = []
    await withTaskGroup(of: (String, String?).self) { group in
      for id in shownMemberIds {
        group.addTask {
          let name = await ProfileNameResolver.shared.resolveProfileName(for: id)
          return (id, name)
        }
      }

      for await (id, name) in group {
        if let currentInboxId, id == currentInboxId {
          resolvedNames.append("you")
        } else if let name = name {
          resolvedNames.append(name)
        } else {
          resolvedNames.append(id)
        }
      }
    }

    // Format the final string
    if resolvedNames.isEmpty {
      return "No members"
    }

    if othersCount > 0 {
      resolvedNames.append("\(othersCount) \(othersCount == 1 ? "other" : "others")")
    }

    return resolvedNames.count == 2
    ? resolvedNames.joined(separator: " and ")
    : resolvedNames.joined(separator: ", ")
  }
}
