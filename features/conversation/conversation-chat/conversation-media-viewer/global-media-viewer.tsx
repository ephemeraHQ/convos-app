import React, { memo, useState, useEffect } from 'react'
import { MediaViewer } from './conversation-media-viewer'

// Global event-based media viewer handler
type MediaViewerParams = {
  uri: string;
  sender?: string;
  timestamp?: number;
}

// Simple event-based singleton
let eventCallbacks: Array<(params: MediaViewerParams) => void> = []

export const openMediaViewer = (params: MediaViewerParams): void => {
  // Trigger all registered event callbacks
  eventCallbacks.forEach(callback => callback(params))
}

export const mediaViewerManager = {
  openMediaViewer,
  registerCallback: (callback: (params: MediaViewerParams) => void) => {
    eventCallbacks.push(callback)
    return () => {
      eventCallbacks = eventCallbacks.filter(cb => cb !== callback)
    }
  }
}

/**
 * MediaViewerPortal component
 * 
 * This component listens for global media viewer events and displays the MediaViewer
 */
const MediaViewerPortal = memo(function MediaViewerPortal() {
  const [visible, setVisible] = useState(false)
  const [mediaParams, setMediaParams] = useState<MediaViewerParams | null>(null)
  
  useEffect(() => {
    // Register for media viewer events
    const unregister = mediaViewerManager.registerCallback((params) => {
      setMediaParams(params)
      setVisible(true)
    })
    
    // Clean up event handler on unmount
    return unregister
  }, [])
  
  if (!mediaParams) return null
  
  return (
    <MediaViewer
      visible={visible}
      onClose={() => setVisible(false)}
      uri={mediaParams.uri}
      sender={mediaParams.sender}
      timestamp={mediaParams.timestamp?.toString()}
    />
  )
})

/**
 * MediaViewerHost component
 * 
 * Add this component to your app once at the navigator level or screen where you want to use the media viewer
 */
export const MediaViewerHost = memo(function MediaViewerHost() {
  return <MediaViewerPortal />
})
