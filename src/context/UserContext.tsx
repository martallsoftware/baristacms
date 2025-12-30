import { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from 'react';
import { useMsal } from '@azure/msal-react';
import { userService, setTokenGetter, localAuthService, type User, type UserRole, type PermissionLevel } from '../services/api';
import { loginRequest, apiRequest, graphConfig } from '../config/authConfig';

interface UserContextType {
  user: User | null;
  loading: boolean;
  error: string | null;
  isAdmin: boolean;
  isManager: boolean;
  photoUrl: string | null;
  authType: 'm365' | 'local' | null;
  hasRole: (roles: UserRole[]) => boolean;
  refreshUser: () => Promise<void>;
  checkPermission: (module: string) => Promise<PermissionLevel>;
  canView: (module: string) => Promise<boolean>;
  canEdit: (module: string) => Promise<boolean>;
  canDelete: (module: string) => Promise<boolean>;
  logout: () => void;
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
  const [authType, setAuthType] = useState<'m365' | 'local' | null>(null);

  const account = accounts[0];
  const localToken = localAuthService.getToken();

  // Determine auth type
  useEffect(() => {
    if (account) {
      setAuthType('m365');
    } else if (localToken) {
      setAuthType('local');
    } else {
      setAuthType(null);
    }
  }, [account, localToken]);

  // Set up token getter for API calls
  useEffect(() => {
    if (account) {
      // M365 auth - use MSAL to get tokens
      setTokenGetter(async () => {
        const response = await instance.acquireTokenSilent({
          ...apiRequest,
          account: account,
        });
        return response.accessToken;
      });
    } else if (localToken) {
      // Local auth - use stored token
      setTokenGetter(async () => {
        return localAuthService.getToken() || '';
      });
    }
  }, [instance, account, localToken]);

  const loadUser = async () => {
    // Need either M365 account or local token
    const currentLocalToken = localAuthService.getToken();
    if (!account?.username && !currentLocalToken) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      if (account?.username) {
        // M365 user
        const userData = await userService.getCurrentUser(account.username, account.name);
        setUser(userData);
      } else if (currentLocalToken) {
        // Local user - verify token and get user data
        // Set up token getter immediately before making API calls
        setTokenGetter(async () => currentLocalToken);

        const verifyResult = await localAuthService.verifyToken(currentLocalToken);
        if (verifyResult.valid && verifyResult.user) {
          // Get full user data from API
          const userData = await userService.getCurrentUser(verifyResult.user.email, verifyResult.user.name);
          setUser(userData);
        } else {
          // Invalid token
          localAuthService.removeToken();
          setError('Session expired. Please log in again.');
        }
      }

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
    // Only load photo for M365 users
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

    // Only load photo for M365 users
    if (account) {
      loadUserPhoto();
    }

    return () => {
      // Cleanup blob URL on unmount
      if (photoUrl) {
        URL.revokeObjectURL(photoUrl);
      }
    };
  }, [account?.username, localToken]);

  const logout = useCallback(() => {
    if (authType === 'local') {
      localAuthService.removeToken();
      setUser(null);
      setAuthType(null);
      // Redirect to root to show login page (cleaner than reload)
      window.location.href = '/';
    } else if (authType === 'm365') {
      instance.logoutRedirect();
    }
  }, [authType, instance]);

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
        authType,
        hasRole,
        refreshUser: loadUser,
        checkPermission,
        canView,
        canEdit,
        canDelete,
        logout,
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
