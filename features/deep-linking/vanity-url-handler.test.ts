import { extractUsernameFromVanityUrl, handleVanityUrl } from "./vanity-url-handler"
import { findInboxIdByUsername } from "@/features/profiles/utils/find-inbox-id-by-username"
import { navigateFromHome } from "@/navigation/navigation.utils"
import { IXmtpInboxId } from "@/features/xmtp/xmtp.types"

// Mock the dependencies
jest.mock("@/config", () => ({
  config: {
    app: {
      webDomain: "convos.org",
    },
  },
}))

jest.mock("@/features/profiles/utils/find-inbox-id-by-username")
jest.mock("@/navigation/navigation.utils")
jest.mock("@/utils/logger/logger", () => ({
  deepLinkLogger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}))

describe("Vanity URL Handler", () => {
  describe("extractUsernameFromVanityUrl", () => {
    test("should extract username from subdomain URL", () => {
      expect(extractUsernameFromVanityUrl("username.convos.org")).toBe("username")
      expect(extractUsernameFromVanityUrl("https://username.convos.org")).toBe("username")
      expect(extractUsernameFromVanityUrl("http://username.convos.org")).toBe("username")
      expect(extractUsernameFromVanityUrl("username.convos.org/")).toBe("username")
      expect(extractUsernameFromVanityUrl("username.convos.org/some/path")).toBe("username")
    })

    test("should extract username from path URL", () => {
      expect(extractUsernameFromVanityUrl("convos.org/username")).toBe("username")
      expect(extractUsernameFromVanityUrl("https://convos.org/username")).toBe("username")
      expect(extractUsernameFromVanityUrl("http://convos.org/username")).toBe("username")
      expect(extractUsernameFromVanityUrl("convos.org/username/")).toBe("username")
      expect(extractUsernameFromVanityUrl("convos.org/username?param=value")).toBe("username")
    })

    test("should not extract username from known deep link paths", () => {
      expect(extractUsernameFromVanityUrl("convos.org/dm/inboxId")).toBeNull()
      expect(extractUsernameFromVanityUrl("convos.org/group/groupId")).toBeNull()
      expect(extractUsernameFromVanityUrl("convos.org/group-invite/inviteId")).toBeNull()
      expect(extractUsernameFromVanityUrl("convos.org/coinbase")).toBeNull()
      expect(extractUsernameFromVanityUrl("convos.org/conversation")).toBeNull()
      expect(extractUsernameFromVanityUrl("convos.org/profile")).toBeNull()
    })

    test("should return null for invalid URLs", () => {
      expect(extractUsernameFromVanityUrl("")).toBeNull()
      expect(extractUsernameFromVanityUrl("invalid-url")).toBeNull()
      expect(extractUsernameFromVanityUrl("http://other-domain.com")).toBeNull()
      expect(extractUsernameFromVanityUrl("other-domain.com/username")).toBeNull()
    })
  })

  describe("handleVanityUrl", () => {
    beforeEach(() => {
      jest.clearAllMocks()
    })

    test("should return false if no username can be extracted", async () => {
      const result = await handleVanityUrl("invalid-url")
      expect(result).toBe(false)
      expect(findInboxIdByUsername).not.toHaveBeenCalled()
      expect(navigateFromHome).not.toHaveBeenCalled()
    })

    test("should return false if no inbox ID is found for username", async () => {
      // Mock the findInboxIdByUsername to return null (user not found)
      const mockFindInboxIdByUsername = findInboxIdByUsername as jest.Mock
      mockFindInboxIdByUsername.mockResolvedValue(null)

      const result = await handleVanityUrl("username.convos.org")
      expect(result).toBe(false)
      expect(findInboxIdByUsername).toHaveBeenCalledWith("username")
      expect(navigateFromHome).not.toHaveBeenCalled()
    })

    test("should navigate to conversation and return true when inbox ID is found", async () => {
      // Mock successful inbox ID lookup
      const mockInboxId: IXmtpInboxId = "test-inbox-id" as IXmtpInboxId
      const mockFindInboxIdByUsername = findInboxIdByUsername as jest.Mock
      mockFindInboxIdByUsername.mockResolvedValue(mockInboxId)

      const result = await handleVanityUrl("username.convos.org")
      expect(result).toBe(true)
      expect(findInboxIdByUsername).toHaveBeenCalledWith("username")
      expect(navigateFromHome).toHaveBeenCalledWith("Conversation", {
        searchSelectedUserInboxIds: [mockInboxId],
        isNew: true,
      })
    })

    test("should return false if an error occurs", async () => {
      // Mock an error during inbox ID lookup
      const mockFindInboxIdByUsername = findInboxIdByUsername as jest.Mock
      mockFindInboxIdByUsername.mockRejectedValue(new Error("Test error"))

      const result = await handleVanityUrl("username.convos.org")
      expect(result).toBe(false)
      expect(findInboxIdByUsername).toHaveBeenCalledWith("username")
      expect(navigateFromHome).not.toHaveBeenCalled()
    })
  })
}) 