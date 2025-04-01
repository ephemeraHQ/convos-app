import axios from "axios"
import { config } from "../../config"

// Authenticated API instance - requires auth headers
export const convosApi = axios.create({
  baseURL: config.app.apiUrl,
})

// Public API instance - doesn't require auth headers
export const convosPublicApi = axios.create({
  baseURL: config.app.apiUrl,
})
