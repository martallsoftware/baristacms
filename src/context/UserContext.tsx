import { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from 'react';
import { useMsal } from '@azure/msal-react';
import { userService, setTokenGetter, type User, type UserRole, type PermissionLevel } from '../services/api';
import { loginRequest, apiRequest, graphConfig } from '../config/authConfig';

interface UserContextType {
  user: User | null;
  loading: boolean;
  error: string | null;
  isAdmin: boolean;
  isManager: boolean;
  photoUrl: string | null;
  hasRole: (roles: UserRole[]) => boolean;
  refreshUser: () => Promise<void>;
  checkPermission: (module: string) => Promise<PermissionLevel>;
  canView: (module: string) => Promise<boolean>;
  canEdit: (module: string) => Promise<boolean>;
  canDelete: (module: string) => Promise<boolean>;
}

const UserContext = createContext<UserContextType | undefined>(undefined);

// Cache for permissions to avoid repeated API calls
const permissionCache: Map<string, { permission: PermissionLevel; timestamp: number }> = new Map();
const CACHE_TTL = 60000; // 1 minute cache

export function UserProvider({ children }: { children: ReactNode }) {
  const { instance, accounts } = useMsal();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);

  const account = accounts[0];

  // Set up token getter for API calls (uses apiRequest scope, not Graph scope)
  useEffect(() => {
    if (account) {
      setTokenGetter(async () => {
        const response = await instance.acquireTokenSilent({
          ...apiRequest,
          account: account,
        });
        return response.accessToken;
      });
    }
  }, [instance, account]);

  const loadUser = async () => {
    if (!account?.username) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);
      const userData = await userService.getCurrentUser(account.username, account.name);
      setUser(userData);
      // Clear permission cache when user changes
      permissionCache.clear();
    } catch (err) {
      console.error('Failed to load user:', err);
      setError(err instanceof Error ? err.message : 'Failed to load user');
    } finally {
      setLoading(false);
    }
  };

  const loadUserPhoto = async () => {
    if (!account) {
      return;
    }

    try {
      // Get access token silently
      const response = await instance.acquireTokenSilent({
        ...loginRequest,
        account: account,
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
        // Revoke old URL if exists
        if (photoUrl) {
          URL.revokeObjectURL(photoUrl);
        }
        setPhotoUrl(url);
      } else if (photoResponse.status === 404) {
        // User has no photo set
        setPhotoUrl(null);
      }
    } catch (err) {
      console.error('Failed to fetch user photo:', err);
      setPhotoUrl(null);
    }
  };

  useEffect(() => {
    loadUser();
    loadUserPhoto();

    return () => {
      // Cleanup blob URL on unmount
      if (photoUrl) {
        URL.revokeObjectURL(photoUrl);
      }
    };
  }, [account?.username]);

  const isAdmin = user?.role === 'admin';
  const isManager = user?.role === 'manager' || user?.role === 'admin';

  const hasRole = (roles: UserRole[]) => {
    if (!user) return false;
    return roles.includes(user.role);
  };

  const checkPermission = useCallback(async (module: string): Promise<PermissionLevel> => {
    if (!user?.email) return 'none';

    // Admin users always have full access
    if (user.role === 'admin') return 'admin';

    const cacheKey = `${user.email}:${module}`;
    const cached = permissionCache.get(cacheKey);

    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
      return cached.permission;
    }

    try {
      const result = await userService.checkPermission(user.email, module);
      permissionCache.set(cacheKey, { permission: result.permission, timestamp: Date.now() });
      return result.permission;
    } catch (err) {
      console.error('Failed to check permission:', err);
      return 'none';
    }
  }, [user?.email, user?.role]);

  const canView = useCallback(async (module: string): Promise<boolean> => {
    const permission = await checkPermission(module);
    return ['viewer', 'editor', 'admin'].includes(permission);
  }, [checkPermission]);

  const canEdit = useCallback(async (module: string): Promise<boolean> => {
    const permission = await checkPermission(module);
    return ['editor', 'admin'].includes(permission);
  }, [checkPermission]);

  const canDelete = useCallback(async (module: string): Promise<boolean> => {
    const permission = await checkPermission(module);
    return permission === 'admin';
  }, [checkPermission]);

  return (
    <UserContext.Provider
      value={{
        user,
        loading,
        error,
        isAdmin,
        isManager,
        photoUrl,
        hasRole,
        refreshUser: loadUser,
        checkPermission,
        canView,
        canEdit,
        canDelete,
      }}
    >
      {children}
    </UserContext.Provider>
  );
}

export function useUser() {
  const context = useContext(UserContext);
  if (context === undefined) {
    throw new Error('useUser must be used within a UserProvider');
  }
  return context;
}
