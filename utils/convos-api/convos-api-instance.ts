import axios from "axios"
import { apiLogger } from "@/utils/logger/logger"
import { config } from "../../config"

apiLogger.debug(`Creating convosApi instance with baseURL: ${config.app.apiUrl}`)

// Authenticated API instance - requires auth headers
export const convosApi = axios.create({
  baseURL: config.app.apiUrl,
})

// Public API instance - doesn't require auth headers
export const convosPublicApi = axios.create({
  baseURL: config.app.apiUrl,
})
