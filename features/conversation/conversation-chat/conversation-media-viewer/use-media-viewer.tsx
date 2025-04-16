import React, { useState, useCallback, useEffect } from "react"
import { MediaViewer } from "./conversation-media-viewer"
import { mediaViewerManager } from "./global-media-viewer"
import { logger } from "@/utils/logger/logger"

// Standalone MediaViewer component with Portal (to be used at screen level)
export function MediaViewerPortal() {
  const [isVisible, setIsVisible] = useState(false)
  const [uri, setUri] = useState("")
  const [sender, setSender] = useState("")
  const [timestamp, setTimestamp] = useState<number | null>(null)
  
  // Register to receive media viewer open events
  useEffect(() => {
    // Handler function
    const handleOpenMediaViewer = (params: {
      uri: string
      sender?: string
      timestamp?: number
    }) => {
      logger.debug("MediaViewerPortal received event with params:", params)
      setUri(params.uri)
      setSender(params.sender || "")
      setTimestamp(params.timestamp || null)
      setIsVisible(true)
    }
    
    // Register with the manager
    const unregister = mediaViewerManager.registerCallback(handleOpenMediaViewer)
    
    // Cleanup on unmount
    return unregister
  }, [])

  const handleClose = useCallback(() => {
    setIsVisible(false)
  }, [])

  return (
    <MediaViewer
      uri={uri}
      visible={isVisible}
      onClose={handleClose}
      sender={sender}
      timestamp={timestamp || undefined}
    />
  )
}
