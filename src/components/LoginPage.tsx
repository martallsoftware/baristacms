import { useState, useEffect } from 'react';
import { useMsal } from '@azure/msal-react';
import { loginRequest } from '../config/authConfig';
import { BuildingOffice2Icon, UserIcon, KeyIcon } from '@heroicons/react/24/outline';
import { localAuthService } from '../services/api';

type AuthMethod = 'm365' | 'local';

interface LoginPageProps {
  onLocalLogin?: (token: string, mustChangePassword: boolean) => void;
}

export default function LoginPage({ onLocalLogin }: LoginPageProps) {
  const { instance } = useMsal();
  const [siteName, setSiteName] = useState('BaristaCMS');
  const [authMethod, setAuthMethod] = useState<AuthMethod>('m365');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // Try to load site name from public settings
    fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:3001/api'}/settings/public/site_name`)
      .then(res => res.ok ? res.json() : null)
      .then(data => {
        if (data?.value) setSiteName(data.value);
      })
      .catch(() => {/* Ignore - use default */});
  }, []);

  const handleM365Login = () => {
    instance.loginRedirect(loginRequest);
  };

  const handleLocalLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const response = await localAuthService.login(email, password);
      localAuthService.saveToken(response.token);

      if (onLocalLogin) {
        onLocalLogin(response.token, response.mustChangePassword);
      } else {
        // Force reload to trigger auth check in App.tsx
        window.location.reload();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl p-8 w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-blue-100 rounded-full mb-4">
            <BuildingOffice2Icon className="h-8 w-8 text-blue-600" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900">{siteName}</h1>
          <p className="text-gray-500 mt-2">Content Management System</p>
        </div>

        {/* Auth method toggle */}
        <div className="flex rounded-lg bg-gray-100 p-1 mb-6">
          <button
            type="button"
            onClick={() => setAuthMethod('m365')}
            className={`flex-1 flex items-center justify-center gap-2 py-2 px-4 rounded-md text-sm font-medium transition-colors ${
              authMethod === 'm365'
                ? 'bg-white text-gray-900 shadow-sm'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            <svg className="w-4 h-4" viewBox="0 0 21 21" fill="none">
              <rect x="1" y="1" width="9" height="9" fill="#F25022" />
              <rect x="11" y="1" width="9" height="9" fill="#7FBA00" />
              <rect x="1" y="11" width="9" height="9" fill="#00A4EF" />
              <rect x="11" y="11" width="9" height="9" fill="#FFB900" />
            </svg>
            Microsoft 365
          </button>
          <button
            type="button"
            onClick={() => setAuthMethod('local')}
            className={`flex-1 flex items-center justify-center gap-2 py-2 px-4 rounded-md text-sm font-medium transition-colors ${
              authMethod === 'local'
                ? 'bg-white text-gray-900 shadow-sm'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            <UserIcon className="w-4 h-4" />
            Local Account
          </button>
        </div>

        {authMethod === 'm365' ? (
          <>
            <button
              onClick={handleM365Login}
              className="w-full flex items-center justify-center gap-3 bg-slate-800 hover:bg-slate-700 text-white font-medium py-3 px-4 rounded-lg transition-colors"
            >
              <svg className="w-5 h-5" viewBox="0 0 21 21" fill="none">
                <rect x="1" y="1" width="9" height="9" fill="#F25022" />
                <rect x="11" y="1" width="9" height="9" fill="#7FBA00" />
                <rect x="1" y="11" width="9" height="9" fill="#00A4EF" />
                <rect x="11" y="11" width="9" height="9" fill="#FFB900" />
              </svg>
              Sign in with Microsoft
            </button>
            <p className="text-center text-sm text-gray-400 mt-6">
              Secure authentication powered by Microsoft Entra
            </p>
          </>
        ) : (
          <form onSubmit={handleLocalLogin} className="space-y-4">
            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg p-3">
                {error}
              </div>
            )}

            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
                Email
              </label>
              <div className="relative">
                <UserIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
                <input
                  type="email"
                  id="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="you@example.com"
                />
              </div>
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1">
                Password
              </label>
              <div className="relative">
                <KeyIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
                <input
                  type="password"
                  id="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Enter your password"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-medium py-3 px-4 rounded-lg transition-colors flex items-center justify-center gap-2"
            >
              {loading ? (
                <div className="animate-spin rounded-full h-5 w-5 border-2 border-white border-t-transparent" />
              ) : (
                'Sign In'
              )}
            </button>

            <p className="text-center text-sm text-gray-400 mt-4">
              Contact your administrator if you need an account
            </p>
          </form>
        )}
      </div>
    </div>
  );
}
