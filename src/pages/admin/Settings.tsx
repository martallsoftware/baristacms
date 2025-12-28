import { useEffect, useState } from 'react';
import { useUser } from '../../context/UserContext';
import { useTheme, themeOptions, type ThemeColor } from '../../context/ThemeContext';
import { settingsService, type SiteSettings } from '../../services/api';
import {
  ShieldCheckIcon,
  Cog6ToothIcon,
  CheckIcon,
  ArrowPathIcon,
  SwatchIcon,
  EnvelopeIcon,
  BugAntIcon,
  CircleStackIcon,
  ArrowDownTrayIcon,
} from '@heroicons/react/24/outline';

export default function SettingsPage() {
  const { isAdmin } = useUser();
  const { theme, setTheme } = useTheme();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [settings, setSettings] = useState<SiteSettings>({});
  const [siteName, setSiteName] = useState('');
  const [selectedTheme, setSelectedTheme] = useState<ThemeColor>(theme);
  const [emailCheckInterval, setEmailCheckInterval] = useState('0');
  const [enableDebugLogging, setEnableDebugLogging] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dbInfo, setDbInfo] = useState<{ type: string; database: string } | null>(null);
  const [dbInfoError, setDbInfoError] = useState<string | null>(null);
  const [backupLoading, setBackupLoading] = useState(false);

  useEffect(() => {
    loadSettings();
    loadDatabaseInfo();
  }, []);

  const loadSettings = async () => {
    try {
      setLoading(true);
      const data = await settingsService.getAll();
      setSettings(data);
      setSiteName(data.site_name?.value || '');
      if (data.theme_color?.value) {
        setSelectedTheme(data.theme_color.value as ThemeColor);
      }
      setEmailCheckInterval(data.email_check_interval_minutes?.value || '0');
      setEnableDebugLogging(data.enable_debug_logging?.value === 'true');
    } catch (err) {
      console.error('Failed to load settings:', err);
      setError('Failed to load settings');
    } finally {
      setLoading(false);
    }
  };

  const loadDatabaseInfo = async () => {
    try {
      setDbInfoError(null);
      const data = await settingsService.getDatabaseInfo();
      setDbInfo(data);
    } catch (err) {
      console.error('Failed to load database info:', err);
      setDbInfoError(err instanceof Error ? err.message : 'Failed to load database info');
    }
  };

  const handleBackup = async () => {
    try {
      setBackupLoading(true);
      const { blob, filename } = await settingsService.downloadBackup();

      // Download the file
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err) {
      console.error('Failed to create backup:', err);
      setError(err instanceof Error ? err.message : 'Failed to create backup');
    } finally {
      setBackupLoading(false);
    }
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      setError(null);
      setSaveSuccess(false);

      await settingsService.update('site_name', siteName, 'string', 'The name of the site displayed in the header');
      await settingsService.update('theme_color', selectedTheme, 'string', 'The theme color for the application');
      await settingsService.update('email_check_interval_minutes', emailCheckInterval, 'number', 'Interval in minutes to check for new emails (0 = disabled)');
      await settingsService.update('enable_debug_logging', enableDebugLogging.toString(), 'boolean', 'Enable verbose debug logging in server console');

      // Apply theme immediately
      setTheme(selectedTheme);

      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);

      // Reload settings
      await loadSettings();
    } catch (err) {
      console.error('Failed to save settings:', err);
      setError('Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  if (!isAdmin) {
    return (
      <div className="p-8">
        <div className="bg-red-50 border border-red-200 rounded-lg p-6 text-center">
          <ShieldCheckIcon className="h-12 w-12 mx-auto text-red-400 mb-3" />
          <h2 className="text-lg font-semibold text-red-800">Access Denied</h2>
          <p className="text-red-600 mt-1">You need administrator privileges to view this page.</p>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="p-8 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  return (
    <div className="p-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Settings</h1>
        <p className="text-gray-500 mt-1">Configure system settings and preferences.</p>
      </div>

      {/* Success Message */}
      {saveSuccess && (
        <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg flex items-center gap-2 text-green-700">
          <CheckIcon className="h-5 w-5" />
          Settings saved successfully!
        </div>
      )}

      {/* Error Message */}
      {error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
          {error}
        </div>
      )}

      {/* General Settings */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200 bg-gray-50">
          <div className="flex items-center gap-2">
            <Cog6ToothIcon className="h-5 w-5 text-gray-600" />
            <h2 className="text-lg font-semibold text-gray-900">General Settings</h2>
          </div>
        </div>

        <div className="p-6 space-y-6">
          {/* Site Name */}
          <div>
            <label htmlFor="siteName" className="block text-sm font-medium text-gray-700 mb-1">
              Site Name
            </label>
            <input
              type="text"
              id="siteName"
              value={siteName}
              onChange={(e) => setSiteName(e.target.value)}
              placeholder="Enter site name..."
              className="w-full max-w-md px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
            <p className="mt-1 text-sm text-gray-500">
              The name displayed in the application header and browser title.
            </p>
          </div>

          {/* Last Updated Info */}
          {settings.site_name?.updated_at && (
            <div className="text-sm text-gray-500">
              Last updated: {new Date(settings.site_name.updated_at).toLocaleString()}
              {settings.site_name.updated_by && ` by ${settings.site_name.updated_by}`}
            </div>
          )}
        </div>

        {/* Save Button */}
        <div className="px-6 py-4 border-t border-gray-200 bg-gray-50 flex justify-end">
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {saving ? (
              <>
                <ArrowPathIcon className="h-4 w-4 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <CheckIcon className="h-4 w-4" />
                Save Settings
              </>
            )}
          </button>
        </div>
      </div>

      {/* Theme Settings */}
      <div className="mt-6 bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200 bg-gray-50">
          <div className="flex items-center gap-2">
            <SwatchIcon className="h-5 w-5 text-gray-600" />
            <h2 className="text-lg font-semibold text-gray-900">Theme Settings</h2>
          </div>
        </div>

        <div className="p-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-3">
              Theme Color
            </label>
            <div className="flex flex-wrap gap-3">
              {themeOptions.map((option) => (
                <button
                  key={option.value}
                  onClick={() => setSelectedTheme(option.value)}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg border-2 transition-all ${
                    selectedTheme === option.value
                      ? 'border-gray-900 shadow-md'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <span
                    className="w-5 h-5 rounded-full"
                    style={{ backgroundColor: option.color }}
                  />
                  <span className="text-sm font-medium text-gray-700">{option.label}</span>
                  {selectedTheme === option.value && (
                    <CheckIcon className="h-4 w-4 text-gray-700" />
                  )}
                </button>
              ))}
            </div>
            <p className="mt-3 text-sm text-gray-500">
              Choose a theme color for the sidebar and accent elements.
            </p>
          </div>

          {/* Theme Last Updated Info */}
          {settings.theme_color?.updated_at && (
            <div className="mt-4 text-sm text-gray-500">
              Last updated: {new Date(settings.theme_color.updated_at).toLocaleString()}
              {settings.theme_color.updated_by && ` by ${settings.theme_color.updated_by}`}
            </div>
          )}
        </div>

        {/* Save Button */}
        <div className="px-6 py-4 border-t border-gray-200 bg-gray-50 flex justify-end">
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {saving ? (
              <>
                <ArrowPathIcon className="h-4 w-4 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <CheckIcon className="h-4 w-4" />
                Save Settings
              </>
            )}
          </button>
        </div>
      </div>

      {/* Email Settings */}
      <div className="mt-6 bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200 bg-gray-50">
          <div className="flex items-center gap-2">
            <EnvelopeIcon className="h-5 w-5 text-gray-600" />
            <h2 className="text-lg font-semibold text-gray-900">Email Settings</h2>
          </div>
        </div>

        <div className="p-6 space-y-6">
          {/* Email Check Interval */}
          <div>
            <label htmlFor="emailCheckInterval" className="block text-sm font-medium text-gray-700 mb-1">
              Email Check Interval (minutes)
            </label>
            <input
              type="number"
              id="emailCheckInterval"
              value={emailCheckInterval}
              onChange={(e) => setEmailCheckInterval(e.target.value)}
              min="0"
              max="60"
              className="w-32 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
            <p className="mt-1 text-sm text-gray-500">
              How often to check for new emails and automatically create records. Set to 0 to disable.
            </p>
            <p className="mt-1 text-sm text-gray-500">
              Note: Modules must have "Auto-process emails" enabled to automatically create records.
            </p>
            {parseInt(emailCheckInterval) > 0 && (
              <p className="mt-2 text-sm text-green-600">
                Email processor will check every {emailCheckInterval} minute(s).
              </p>
            )}
          </div>

          {/* Email Interval Last Updated Info */}
          {settings.email_check_interval_minutes?.updated_at && (
            <div className="text-sm text-gray-500">
              Last updated: {new Date(settings.email_check_interval_minutes.updated_at).toLocaleString()}
              {settings.email_check_interval_minutes.updated_by && ` by ${settings.email_check_interval_minutes.updated_by}`}
            </div>
          )}
        </div>

        {/* Save Button */}
        <div className="px-6 py-4 border-t border-gray-200 bg-gray-50 flex justify-end">
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {saving ? (
              <>
                <ArrowPathIcon className="h-4 w-4 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <CheckIcon className="h-4 w-4" />
                Save Settings
              </>
            )}
          </button>
        </div>
      </div>

      {/* Debug Settings */}
      <div className="mt-6 bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200 bg-gray-50">
          <div className="flex items-center gap-2">
            <BugAntIcon className="h-5 w-5 text-gray-600" />
            <h2 className="text-lg font-semibold text-gray-900">Debug Settings</h2>
          </div>
        </div>

        <div className="p-6 space-y-6">
          {/* Enable Debug Logging */}
          <div>
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={enableDebugLogging}
                onChange={(e) => setEnableDebugLogging(e.target.checked)}
                className="rounded border-gray-300 text-blue-600 focus:ring-blue-500 h-5 w-5"
              />
              <div>
                <span className="text-sm font-medium text-gray-700">Enable Debug Logging</span>
                <p className="text-sm text-gray-500">
                  Show verbose debug messages in server console (e.g., email processor logs).
                </p>
              </div>
            </label>
          </div>

          {/* Debug Setting Last Updated Info */}
          {settings.enable_debug_logging?.updated_at && (
            <div className="text-sm text-gray-500">
              Last updated: {new Date(settings.enable_debug_logging.updated_at).toLocaleString()}
              {settings.enable_debug_logging.updated_by && ` by ${settings.enable_debug_logging.updated_by}`}
            </div>
          )}
        </div>

        {/* Save Button */}
        <div className="px-6 py-4 border-t border-gray-200 bg-gray-50 flex justify-end">
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {saving ? (
              <>
                <ArrowPathIcon className="h-4 w-4 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <CheckIcon className="h-4 w-4" />
                Save Settings
              </>
            )}
          </button>
        </div>
      </div>

      {/* Database Settings */}
      <div className="mt-6 bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200 bg-gray-50">
          <div className="flex items-center gap-2">
            <CircleStackIcon className="h-5 w-5 text-gray-600" />
            <h2 className="text-lg font-semibold text-gray-900">Database Settings</h2>
          </div>
        </div>

        <div className="p-6 space-y-6">
          {/* Database Info */}
          {dbInfoError ? (
            <div className="text-sm text-red-600">Error: {dbInfoError}</div>
          ) : dbInfo ? (
            <div className="grid grid-cols-2 gap-4 max-w-md">
              <div>
                <span className="block text-sm font-medium text-gray-700">Database Type</span>
                <span className="text-sm text-gray-900 font-medium">
                  {dbInfo.type === 'mysql' ? 'MySQL' : 'SQLite'}
                </span>
              </div>
              <div>
                <span className="block text-sm font-medium text-gray-700">Database Name</span>
                <span className="text-sm text-gray-900">{dbInfo.database}</span>
              </div>
            </div>
          ) : (
            <div className="text-sm text-gray-500">Loading database info...</div>
          )}

          {/* Backup Section */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Database Backup
            </label>
            {dbInfo?.type === 'mysql' ? (
              <p className="text-sm text-gray-500 mb-3">
                Creates a MySQL dump file (.sql) using mysqldump. Make sure mysqldump is installed on the server.
              </p>
            ) : (
              <p className="text-sm text-gray-500 mb-3">
                Downloads the SQLite database file (.db).
              </p>
            )}
            <button
              onClick={handleBackup}
              disabled={backupLoading || !dbInfo}
              className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {backupLoading ? (
                <>
                  <ArrowPathIcon className="h-4 w-4 animate-spin" />
                  Creating Backup...
                </>
              ) : (
                <>
                  <ArrowDownTrayIcon className="h-4 w-4" />
                  Download Backup ({dbInfo?.type === 'mysql' ? '.sql' : '.db'})
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
