#!/usr/bin/env node

const { execSync } = require("child_process")
const { existsSync } = require("fs")

/**
 * Executes a command and returns the output, or null if it fails
 */
function execCommand(command, options = {}) {
  try {
    const result = execSync(command, {
      encoding: "utf8",
      stdio: ["pipe", "pipe", "pipe"],
      ...options,
    })
    return result.trim()
  } catch (error) {
    console.error(`Command failed: ${command}`)
    console.error(`Error: ${error.message}`)
    return null
  }
}

/**
 * Gets the current project's fingerprint using the official Expo CLI
 */
async function getCurrentFingerprint() {
  console.log("🔍 Getting current project fingerprint...")

  // Use the official fingerprint CLI
  const output = execCommand("EXPO_ENV=preview npx @expo/fingerprint fingerprint:generate")

  if (!output) {
    console.error("❌ Failed to generate fingerprint")
    return null
  }

  // The fingerprint output is a JSON object with a final "hash" field
  // Extract the last hash value from the output
  const hashMatch = output.match(/"hash":"([^"]+)"/g)

  if (hashMatch && hashMatch.length > 0) {
    // Get the last hash (which is the final fingerprint)
    const lastHash = hashMatch[hashMatch.length - 1]
    const fingerprint = lastHash.match(/"hash":"([^"]+)"/)[1]

    console.log(`✅ Current fingerprint: ${fingerprint}`)
    return fingerprint
  }

  console.error("❌ Could not extract fingerprint from output")
  return null
}

/**
 * Gets the latest preview build's runtime version from EAS
 */
async function getPreviewBuildRuntimeVersion() {
  console.log("🔍 Getting latest preview build runtime version...")

  const output = execCommand(
    "eas build:list --platform=all --profile=preview --limit=1 --json --non-interactive",
  )

  if (!output) {
    console.error("❌ Failed to get build list")
    return null
  }

  try {
    const builds = JSON.parse(output)
    if (builds.length === 0) {
      console.error("❌ No preview builds found")
      return null
    }

    const latestBuild = builds[0]
    const runtimeVersion = latestBuild.runtimeVersion

    console.log(`✅ Latest preview build runtime version: ${runtimeVersion}`)
    return runtimeVersion
  } catch (error) {
    console.error("❌ Failed to parse build list JSON:", error.message)
    return null
  }
}

/**
 * Main function to check runtime compatibility
 */
async function checkRuntimeCompatibility() {
  console.log("🚀 Checking runtime compatibility for PR preview...\n")

  const currentFingerprint = await getCurrentFingerprint()
  const previewRuntimeVersion = await getPreviewBuildRuntimeVersion()

  if (!currentFingerprint || !previewRuntimeVersion) {
    console.log("\n❌ Cannot determine compatibility - missing data")
    process.exit(1)
  }

  console.log("\n📊 Comparison:")
  console.log(`Current PR fingerprint: ${currentFingerprint}`)
  console.log(`Preview build runtime:  ${previewRuntimeVersion}`)

  // Check if they match exactly
  if (currentFingerprint === previewRuntimeVersion) {
    console.log("\n✅ Runtime versions match - EAS Update is compatible!")
    console.log("can_create_update=true")
    setGitHubOutput("can_create_update", "true")
    setGitHubOutput("current_fingerprint", currentFingerprint)
    setGitHubOutput("preview_fingerprint", previewRuntimeVersion)
    process.exit(0)
  }

  // Check if preview build uses old version format (like "1.0.1")
  // and current app version matches
  if (previewRuntimeVersion.match(/^\d+\.\d+\.\d+$/)) {
    console.log("\n⚠️  Preview build uses old runtime version format")

    // Get current app version
    const configOutput = execCommand("EXPO_ENV=preview npx expo config --json")
    if (configOutput) {
      try {
        const config = JSON.parse(configOutput)
        const appVersion = config.version

        if (appVersion === previewRuntimeVersion) {
          console.log(`✅ App version (${appVersion}) matches build runtime version`)
          console.log("can_create_update=true")
          console.log(
            "\n💡 Consider creating a new preview build with fingerprint policy for better compatibility detection",
          )
          setGitHubOutput("can_create_update", "true")
          setGitHubOutput("current_fingerprint", currentFingerprint)
          setGitHubOutput("preview_fingerprint", previewRuntimeVersion)
          process.exit(0)
        }
      } catch (error) {
        console.error("Failed to parse expo config:", error.message)
      }
    }
  }

  console.log("\n❌ Runtime versions do not match - EAS Update would be incompatible!")
  console.log("can_create_update=false")
  console.log("\n💡 This PR likely contains native changes that require a new build")
  setGitHubOutput("can_create_update", "false")
  setGitHubOutput("current_fingerprint", currentFingerprint)
  setGitHubOutput("preview_fingerprint", previewRuntimeVersion)
  process.exit(1)
}

// Set GitHub Actions outputs if running in CI
function setGitHubOutput(key, value) {
  if (process.env.GITHUB_OUTPUT) {
    const fs = require("fs")
    fs.appendFileSync(process.env.GITHUB_OUTPUT, `${key}=${value}\n`)
  }
}

// Run the check
checkRuntimeCompatibility().catch((error) => {
  console.error("❌ Script failed:", error.message)
  setGitHubOutput("can_create_update", "false")
  process.exit(1)
})

module.exports = { checkRuntimeCompatibility }
