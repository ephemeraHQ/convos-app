import React, { memo } from 'react'
import { MediaViewerPortal } from './use-media-viewer'

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
 * MediaViewerHost component
 * 
 * Add this component to your app once at the navigator level or screen where you want to use the media viewer
 * For example, add it to the ConversationScreen component
 */
export const MediaViewerHost = memo(function MediaViewerHost() {
  return <MediaViewerPortal />
})
