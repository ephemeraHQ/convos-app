// File: scripts/update-versions.js
const fs = require("fs")
const path = require("path")

const versionsFilePath = path.join(__dirname, "..", "versions.json")

// Helper to parse arguments like --platform=ios --env=preview
function parseArgs() {
  const args = {}
  process.argv.slice(2).forEach((arg) => {
    if (arg.startsWith("--")) {
      const [key, value] = arg.substring(2).split("=")
      if (key && value) {
        args[key] = value
      } else if (key) {
        args[key] = true // For flags without values
      }
    }
  })
  return args
}

function updateBuildNumber() {
  const args = parseArgs()
  const platform = args.platform // 'ios' or 'android'
  const env = args.env // 'production', 'preview', or 'development'

  if (!platform || !["ios", "android"].includes(platform)) {
    console.error("Error: Missing or invalid --platform argument. Must be 'ios' or 'android'.")
    process.exit(1)
  }

  if (!env || !["production", "preview", "development"].includes(env)) {
    console.error(
      "Error: Missing or invalid --env argument. Must be 'production', 'preview', or 'development'.",
    )
    process.exit(1)
  }

  let versionsData
  try {
    versionsData = JSON.parse(fs.readFileSync(versionsFilePath, "utf-8"))
  } catch (error) {
    console.error(`Error reading versions.json: ${error.message}`)
    process.exit(1)
  }

  const keyToUpdate = platform === "ios" ? "buildNumber" : "buildCode"
  const platformConfig = versionsData[platform] && versionsData[platform][env]

  if (!platformConfig || typeof platformConfig[keyToUpdate] !== "number") {
    console.error(`Error: Could not find a numeric ${keyToUpdate} at versions.${platform}.${env}`)
    process.exit(1)
  }

  const currentBuildNumber = platformConfig[keyToUpdate]
  const newBuildNumber = currentBuildNumber + 1
  platformConfig[keyToUpdate] = newBuildNumber

  try {
    fs.writeFileSync(versionsFilePath, JSON.stringify(versionsData, null, 2))
    console.log(
      `Successfully updated ${platform}.${env}.${keyToUpdate} to ${newBuildNumber} in versions.json`,
    )
    // Output the new build number so it can be captured by GitHub Actions
    console.log(`::set-output name=new_build_number::${newBuildNumber}`)
  } catch (error) {
    console.error(`Error writing versions.json: ${error.message}`)
    process.exit(1)
  }

  return newBuildNumber // Also return for programmatic use if needed
}

if (require.main === module) {
  updateBuildNumber()
}
