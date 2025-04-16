import React, { memo, useState, useEffect } from 'react'
import { MediaViewer } from './conversation-media-viewer'
import { logger } from "@/utils/logger/logger"

// Global event-based media viewer handler
type MediaViewerParams = {
  uri: string;
  sender?: string;
  timestamp?: number;
}

type MediaViewerCallback = (params: MediaViewerParams) => void;

// Media Viewer Manager Singleton
class MediaViewerManager {
  private callbacks: MediaViewerCallback[] = [];

  // Register a callback for when the media viewer should be opened
  registerCallback(callback: MediaViewerCallback) {
    this.callbacks.push(callback);
    
    // Return unregister function
    return () => {
      this.callbacks = this.callbacks.filter(cb => cb !== callback);
    };
  }

  // Trigger the media viewer to open
  openMediaViewer(params: MediaViewerParams) {
    logger.debug('MediaViewerManager.openMediaViewer called with:', params);
    
    // Ensure there's always a sender value
    const enhancedParams = {
      ...params,
      sender: params.sender || 'Unknown sender',
    };
    
    // Notify all registered callbacks
    this.callbacks.forEach(callback => callback(enhancedParams));
  }
}

// Export singleton instance
export const mediaViewerManager = new MediaViewerManager();

/**
 * Helper function to open the media viewer directly
 */
export function openMediaViewer(params: MediaViewerParams) {
  mediaViewerManager.openMediaViewer(params);
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
      logger.debug('MediaViewerPortal received callback with params:', params);
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
      timestamp={mediaParams.timestamp}
    />
  )
})

/**
 * MediaViewerHost component
 */
export const MediaViewerHost = memo(function MediaViewerHost() {
  return <MediaViewerPortal />
})
