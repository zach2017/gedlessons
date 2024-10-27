import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { syncWithServer } from '../utils/api';

// Define the shape of our context value
const initialContextValue = {
  isOnline: true,
  addToSyncQueue: () => {},
  pendingSyncs: 0,
  lastSyncTime: null,
  syncStatus: 'idle', // 'idle' | 'syncing' | 'error'
  retrySync: () => {},
};

const OnlineStatusContext = createContext(initialContextValue);

// Custom hook for using the online status context
export const useOnlineStatus = () => {
  const context = useContext(OnlineStatusContext);
  if (!context) {
    throw new Error('useOnlineStatus must be used within an OnlineStatusProvider');
  }
  return context;
};

// Action types for sync queue
const SYNC_ACTIONS = {
  CREATE_USER: 'CREATE_USER',
  UPDATE_USER: 'UPDATE_USER',
  DELETE_USER: 'DELETE_USER',
};

export function OnlineStatusProvider({ children }) {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [syncQueue, setSyncQueue] = useState([]);
  const [syncStatus, setSyncStatus] = useState('idle');
  const [lastSyncTime, setLastSyncTime] = useState(null);
  const [syncError, setSyncError] = useState(null);

  // Handle online/offline status
  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      setSyncStatus('idle');
      setSyncError(null);
    };
    
    const handleOffline = () => {
      setIsOnline(false);
      setSyncStatus('idle');
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Process sync queue when online
  const processSyncQueue = useCallback(async () => {
    if (!isOnline || syncQueue.length === 0 || syncStatus === 'syncing') {
      return;
    }

    setSyncStatus('syncing');
    
    try {
      // Process items in order
      const item = syncQueue[0];
      await syncWithServer(item);
      
      // Remove synced item and update state
      setSyncQueue(prev => prev.slice(1));
      setLastSyncTime(new Date().toISOString());
      setSyncStatus('idle');
      setSyncError(null);
      
    } catch (error) {
      setSyncError(error.message);
      setSyncStatus('error');
      console.error('Sync failed:', error);
    }
  }, [isOnline, syncQueue, syncStatus]);

  // Watch for online status and queue changes
  useEffect(() => {
    if (isOnline && syncQueue.length > 0) {
      processSyncQueue();
    }
  }, [isOnline, syncQueue.length, processSyncQueue]);

  // Add item to sync queue
  const addToSyncQueue = useCallback((action) => {
    if (!Object.values(SYNC_ACTIONS).includes(action.type)) {
      throw new Error(`Invalid sync action type: ${action.type}`);
    }

    setSyncQueue(prev => [...prev, {
      ...action,
      id: crypto.randomUUID(),
      timestamp: Date.now(),
      retryCount: 0
    }]);
  }, []);

  // Retry failed sync
  const retrySync = useCallback(() => {
    if (syncStatus === 'error') {
      setSyncStatus('idle');
      setSyncError(null);
      processSyncQueue();
    }
  }, [syncStatus, processSyncQueue]);

  // Context value
  const value = {
    isOnline,
    addToSyncQueue,
    pendingSyncs: syncQueue.length,
    lastSyncTime,
    syncStatus,
    syncError,
    retrySync,
  };

  return (
    <OnlineStatusContext.Provider value={value}>
      {children}
    </OnlineStatusContext.Provider>
  );
}

// Export types and constants
export const SyncActionTypes = SYNC_ACTIONS;

// Example usage:
/*
import { useOnlineStatus, SyncActionTypes } from './contexts/OnlineStatusContext';

function MyComponent() {
  const { 
    isOnline, 
    addToSyncQueue, 
    pendingSyncs,
    lastSyncTime,
    syncStatus,
    syncError,
    retrySync 
  } = useOnlineStatus();

  const handleUserUpdate = (userData) => {
    addToSyncQueue({
      type: SyncActionTypes.UPDATE_USER,
      data: userData
    });
  };

  // Show sync status
  if (syncStatus === 'error') {
    return (
      <div>
        Sync failed: {syncError}
        <button onClick={retrySync}>Retry</button>
      </div>
    );
  }

  return (
    <div>
      {!isOnline && <div>Offline Mode</div>}
      {pendingSyncs > 0 && <div>{pendingSyncs} changes pending sync</div>}
      {lastSyncTime && <div>Last synced: {lastSyncTime}</div>}
    </div>
  );
}
*/
