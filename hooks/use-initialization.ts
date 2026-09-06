import * as Contacts from 'expo-contacts';
import * as MediaLibrary from 'expo-media-library';
import { useEffect, useState } from 'react';

export function useInitialization() {
  const [isInitialized, setIsInitialized] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function initialize() {
      try {
        console.log('Starting app initialization...');
        
        // Initialize permissions (but don't request them yet)
        // Just check if we can access the modules
        await Promise.all([
          // Check contacts module
          Contacts.getPermissionsAsync().catch(e => {
            console.log('Contacts module check:', e.message);
          }),
          
          // Check media library module  
          MediaLibrary.getPermissionsAsync().catch(e => {
            console.log('Media library module check:', e.message);
          }),
        ]);

        console.log('App initialization complete');
        setIsInitialized(true);
      } catch (err) {
        console.error('Initialization error:', err);
        setError(err instanceof Error ? err.message : 'Unknown error');
        // Still set initialized to true to show the app
        // The error boundary will catch any runtime errors
        setIsInitialized(true);
      }
    }

    initialize();
  }, []);

  return { isInitialized, error };
}