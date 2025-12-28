import { useNavigate } from 'react-router-dom';
import { useMsal } from '@azure/msal-react';
import {
  Squares2X2Icon,
  Cog6ToothIcon,
  UsersIcon,
} from '@heroicons/react/24/outline';
import { useUser } from '../context/UserContext';

export default function Home() {
  const { accounts } = useMsal();
  const { isAdmin } = useUser();
  const navigate = useNavigate();
  const account = accounts[0];

  return (
    <div className="p-4 md:p-8">
      {/* Header */}
      <div className="mb-6 md:mb-8">
        <h1 className="text-2xl md:text-3xl font-bold text-gray-900">
          Welcome back, {account?.name?.split(' ')[0] || 'User'}
        </h1>
        <p className="text-gray-500 mt-1 text-sm md:text-base">Here's your dashboard overview.</p>
      </div>

      {/* Quick Actions - Admin Only */}
      {isAdmin && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100">
          <div className="p-4 md:p-6 border-b border-gray-100">
            <h2 className="text-lg font-semibold text-gray-900">Quick Actions</h2>
          </div>
          <div className="p-4 md:p-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 md:gap-4">
              <button
                onClick={() => navigate('/admin/modules')}
                className="flex items-center gap-3 p-4 rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors text-left"
              >
                <div className="p-2 bg-blue-100 rounded-lg">
                  <Squares2X2Icon className="h-5 w-5 text-blue-600" />
                </div>
                <div>
                  <p className="font-medium text-gray-900">Manage Modules</p>
                  <p className="text-sm text-gray-500">Create and configure modules</p>
                </div>
              </button>
              <button
                onClick={() => navigate('/admin/users')}
                className="flex items-center gap-3 p-4 rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors text-left"
              >
                <div className="p-2 bg-green-100 rounded-lg">
                  <UsersIcon className="h-5 w-5 text-green-600" />
                </div>
                <div>
                  <p className="font-medium text-gray-900">Manage Users</p>
                  <p className="text-sm text-gray-500">User roles and permissions</p>
                </div>
              </button>
              <button
                onClick={() => navigate('/admin/settings')}
                className="flex items-center gap-3 p-4 rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors text-left"
              >
                <div className="p-2 bg-purple-100 rounded-lg">
                  <Cog6ToothIcon className="h-5 w-5 text-purple-600" />
                </div>
                <div>
                  <p className="font-medium text-gray-900">Settings</p>
                  <p className="text-sm text-gray-500">Configure system settings</p>
                </div>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
