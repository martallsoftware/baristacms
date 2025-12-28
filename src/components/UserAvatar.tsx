import { useState, useEffect } from 'react';
import { useMsal } from '@azure/msal-react';
import { loginRequest } from '../config/authConfig';

interface UserAvatarProps {
  email: string;
  name?: string;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

const sizeClasses = {
  sm: 'w-6 h-6 text-xs',
  md: 'w-8 h-8 text-sm',
  lg: 'w-10 h-10 text-base',
};

// Cache for user photos to avoid repeated API calls
const photoCache = new Map<string, string | null>();

export default function UserAvatar({ email, name, size = 'md', className = '' }: UserAvatarProps) {
  const { instance, accounts } = useMsal();
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const currentUserEmail = accounts[0]?.username?.toLowerCase();
  const isCurrentUser = email?.toLowerCase() === currentUserEmail;

  useEffect(() => {
    const fetchPhoto = async () => {
      if (!email) {
        setLoading(false);
        return;
      }

      // Check cache first
      const cached = photoCache.get(email.toLowerCase());
      if (cached !== undefined) {
        setPhotoUrl(cached);
        setLoading(false);
        return;
      }

      // Only fetch photo for current user (other users require additional Graph permissions)
      if (!isCurrentUser) {
        photoCache.set(email.toLowerCase(), null);
        setLoading(false);
        return;
      }

      try {
        const response = await instance.acquireTokenSilent({
          ...loginRequest,
          account: accounts[0],
        });

        const photoResponse = await fetch(
          'https://graph.microsoft.com/v1.0/me/photo/$value',
          {
            headers: {
              Authorization: `Bearer ${response.accessToken}`,
            },
          }
        );

        if (photoResponse.ok) {
          const blob = await photoResponse.blob();
          const url = URL.createObjectURL(blob);
          photoCache.set(email.toLowerCase(), url);
          setPhotoUrl(url);
        } else {
          photoCache.set(email.toLowerCase(), null);
        }
      } catch (err) {
        console.error('Failed to fetch user photo:', err);
        photoCache.set(email.toLowerCase(), null);
      } finally {
        setLoading(false);
      }
    };

    fetchPhoto();
  }, [email, isCurrentUser, instance, accounts]);

  // Get initials from email or name
  const getInitials = () => {
    if (name) {
      const parts = name.split(' ');
      if (parts.length >= 2) {
        return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
      }
      return name.substring(0, 2).toUpperCase();
    }
    if (email) {
      const localPart = email.split('@')[0];
      return localPart.substring(0, 2).toUpperCase();
    }
    return '?';
  };

  // Generate consistent color based on email
  const getColor = () => {
    if (!email) return 'bg-gray-400';
    const colors = [
      'bg-blue-500',
      'bg-green-500',
      'bg-amber-500',
      'bg-purple-500',
      'bg-pink-500',
      'bg-indigo-500',
      'bg-teal-500',
      'bg-orange-500',
      'bg-cyan-500',
      'bg-rose-500',
    ];
    let hash = 0;
    for (let i = 0; i < email.length; i++) {
      hash = email.charCodeAt(i) + ((hash << 5) - hash);
    }
    return colors[Math.abs(hash) % colors.length];
  };

  if (loading) {
    return (
      <div className={`${sizeClasses[size]} rounded-full bg-gray-200 animate-pulse ${className}`} />
    );
  }

  if (photoUrl) {
    return (
      <img
        src={photoUrl}
        alt={name || email}
        className={`${sizeClasses[size]} rounded-full object-cover ${className}`}
      />
    );
  }

  return (
    <div
      className={`${sizeClasses[size]} ${getColor()} rounded-full flex items-center justify-center text-white font-medium ${className}`}
      title={name || email}
    >
      {getInitials()}
    </div>
  );
}
