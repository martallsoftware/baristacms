import { useState, useEffect } from 'react';
import { useMsal } from '@azure/msal-react';
import { loginRequest } from '../config/authConfig';
import { BuildingOffice2Icon } from '@heroicons/react/24/outline';

export default function LoginPage() {
  const { instance } = useMsal();
  const [siteName, setSiteName] = useState('BaristaCMS');

  useEffect(() => {
    // Try to load site name from public settings
    fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:3001/api'}/settings/public/site_name`)
      .then(res => res.ok ? res.json() : null)
      .then(data => {
        if (data?.value) setSiteName(data.value);
      })
      .catch(() => {/* Ignore - use default */});
  }, []);

  const handleLogin = () => {
    instance.loginRedirect(loginRequest);
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

        <button
          onClick={handleLogin}
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
      </div>
    </div>
  );
}
