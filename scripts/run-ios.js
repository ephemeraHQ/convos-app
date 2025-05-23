// scripts/run-ios.js
const { execSync } = require("child_process")
const fs = require("fs")
const path = require("path")
// We will call require('dotenv').config() after env:pull

/**
 * Executes a shell command.
 * @param {string} command The command to execute.
 */
const executeCommand = (command) => {
  // No longer prepends 'dotenv --'
  console.log(`\n🚀 Executing: ${command}`)
  try {
    execSync(command, { stdio: "inherit" })
  } catch (error) {
    // execSync already prints error messages to stderr.
    // console.error(`🚨 Error executing: ${command}`, error.message);
    console.error(`🚨 Command failed: ${command}`)
    process.exit(1)
  }
}

// Parse command-line arguments
// Example: node scripts/run-ios.js --env=dev --clean --use-device
const args = process.argv.slice(2)
const params = {}
args.forEach((arg) => {
  if (arg.startsWith("--")) {
    const [keyWithPrefix, value] = arg.split("=")
    const key = keyWithPrefix.substring(2)
    params[key] = value === undefined ? true : value
  }
})

const environment = params.env // 'dev', 'preview', 'prod'
const shouldClean = !!params.clean // true if --clean is present
const shouldUseDevice = !!params["use-device"] // true if --use-device is present

// Validate environment
if (!environment || !["dev", "preview", "prod"].includes(environment)) {
  console.error("🚨 Error: --env parameter (dev, preview, or prod) is required.")
  console.log("   Example: node scripts/run-ios.js --env=dev")
  process.exit(1)
}

console.log(`🏃‍♂️ Starting iOS run script for environment: ${environment}`)
if (shouldClean) console.log("🧹 Clean flag detected.")
if (shouldUseDevice) console.log("📱 Attempting to run on a device.")

// 1. Pull environment variables. This command updates/creates the .env file.
// We pass `false` to the old `useDotenv` param, meaning it won't be prefixed by `dotenv --`.
// For clarity, I'll call execSync directly for this one-off case.
console.log(`\n🚀 Executing: yarn env:pull:${environment}`)
try {
  execSync(`yarn env:pull:${environment}`, { stdio: "inherit" })
} catch (error) {
  console.error(`🚨 Command failed: yarn env:pull:${environment}`)
  process.exit(1)
}

// 2. Load the .env file (just updated) into this script's process.env
// This makes process.env.DEVICE_ID and other vars available to this script.
require("dotenv").config({ path: path.resolve(process.cwd(), ".env") })

// 3. Clean iOS directory if --clean is specified
if (shouldClean) {
  const iosDir = path.join(process.cwd(), "ios")
  if (fs.existsSync(iosDir)) {
    console.log(`🧹 Removing ios directory: ${iosDir}`)
    executeCommand(`rm -rf "${iosDir}"`) // No dotenv needed for rm
  } else {
    console.log("💻 ios directory does not exist, skipping clean.")
  }
}

// 4. Build plugins. Child processes will inherit process.env from this script.
executeCommand("yarn plugins:build:notification-service-extension")

// 5. Prebuild to sync native project with current environment.
executeCommand("expo prebuild --platform ios --no-install")

// 6. Construct and run the final expo command.
let expoRunCommand = "expo run:ios"

if (shouldUseDevice) {
  const deviceIdFromEnv = process.env.DEVICE_ID // Reads from .env loaded by require('dotenv').config()
  if (deviceIdFromEnv && deviceIdFromEnv.trim() !== "") {
    console.log(`📱 Using specific DEVICE_ID from .env: ${deviceIdFromEnv}`)
    expoRunCommand += ` --device "${deviceIdFromEnv.replace(/"/g, '\\"')}"`
  } else {
    console.log("📱 DEVICE_ID not found or empty in .env, using generic --device.")
    expoRunCommand += " --device"
  }
} else {
  console.log("💻 No --use-device flag. Targeting simulator (default).")
}

executeCommand(expoRunCommand)
console.log("✅ iOS run script completed successfully.")
