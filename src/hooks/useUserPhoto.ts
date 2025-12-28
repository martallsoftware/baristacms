import { useState, useEffect } from 'react';
import { useMsal } from '@azure/msal-react';
import { loginRequest, graphConfig } from '../config/authConfig';

export function useUserPhoto() {
  const { instance, accounts } = useMsal();
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchPhoto = async () => {
      if (!accounts[0]) {
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        setError(null);

        // Get access token silently
        const response = await instance.acquireTokenSilent({
          ...loginRequest,
          account: accounts[0],
        });

        // Fetch the photo from Microsoft Graph
        const photoResponse = await fetch(graphConfig.graphMePhotoEndpoint, {
          headers: {
            Authorization: `Bearer ${response.accessToken}`,
          },
        });

        if (photoResponse.ok) {
          const blob = await photoResponse.blob();
          const url = URL.createObjectURL(blob);
          setPhotoUrl(url);
        } else if (photoResponse.status === 404) {
          // User has no photo set
          setPhotoUrl(null);
        } else {
          throw new Error('Failed to fetch photo');
        }
      } catch (err) {
        console.error('Failed to fetch user photo:', err);
        setError(err instanceof Error ? err.message : 'Failed to fetch photo');
        setPhotoUrl(null);
      } finally {
        setLoading(false);
      }
    };

    fetchPhoto();

    // Cleanup blob URL on unmount
    return () => {
      if (photoUrl) {
        URL.revokeObjectURL(photoUrl);
      }
    };
  }, [instance, accounts]);

  return { photoUrl, loading, error };
}
