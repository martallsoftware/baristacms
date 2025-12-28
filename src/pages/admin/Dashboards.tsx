import { useEffect, useState } from 'react';
import {
  PlusIcon,
  PencilIcon,
  TrashIcon,
  ChartBarIcon,
  CheckIcon,
  XMarkIcon,
  LinkIcon,
  EyeIcon,
} from '@heroicons/react/24/outline';
import {
  dashboardService,
  moduleService,
  type Dashboard,
  type DashboardLayout,
  type Module,
  type WidgetType,
} from '../../services/api';
import { useUser } from '../../context/UserContext';
import { useToast } from '../../context/ToastContext';

const WIDGET_OPTIONS: { value: WidgetType; label: string; description: string }[] = [
  { value: 'total_count', label: 'Total Count', description: 'Shows total number of records' },
  { value: 'items_by_month', label: 'Items by Month', description: 'Bar chart showing records per month' },
  { value: 'items_by_user', label: 'Items by User', description: 'Horizontal bar chart by creator' },
  { value: 'items_by_status', label: 'Items by Status', description: 'Pie chart showing status distribution' },
  { value: 'todays_items', label: "Today's Items", description: 'List of items created today' },
];

const DATE_RANGE_OPTIONS = [
  { value: '7', label: 'Last 7 days' },
  { value: '30', label: 'Last 30 days' },
  { value: '90', label: 'Last 90 days' },
  { value: '365', label: 'Last year' },
  { value: 'all', label: 'All time' },
];

const DEFAULT_LAYOUT: DashboardLayout = {
  top: ['total_count', 'items_by_status'],
  middle: ['items_by_month'],
  bottom: ['items_by_user'],
};

type RowName = 'top' | 'middle' | 'bottom';

export default function DashboardsAdmin() {
  const { isAdmin } = useUser();
  const { showToast } = useToast();
  const [dashboards, setDashboards] = useState<Dashboard[]>([]);
  const [modules, setModules] = useState<Module[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [selectedDashboard, setSelectedDashboard] = useState<Dashboard | null>(null);
  const [saving, setSaving] = useState(false);

  // Form state
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [moduleId, setModuleId] = useState<number | null>(null);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [layout, setLayout] = useState<DashboardLayout>(DEFAULT_LAYOUT);
  const [dateRangeDefault, setDateRangeDefault] = useState('30');
  const [isActive, setIsActive] = useState(true);
  const [requireAuth, setRequireAuth] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [dashboardsData, modulesData] = await Promise.all([
        dashboardService.getAll(),
        moduleService.getAll(),
      ]);
      setDashboards(dashboardsData);
      setModules(modulesData);
    } catch (error) {
      console.error('Failed to load data:', error);
      showToast('Failed to load data', 'error');
    } finally {
      setLoading(false);
    }
  };

  const generateSlug = (text: string) => {
    return text
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
  };

  const handleNameChange = (value: string) => {
    setName(value);
    if (!selectedDashboard) {
      setSlug(generateSlug(value));
    }
  };

  const openCreateModal = () => {
    setSelectedDashboard(null);
    setName('');
    setSlug('');
    setModuleId(null);
    setTitle('');
    setDescription('');
    setLayout(DEFAULT_LAYOUT);
    setDateRangeDefault('30');
    setIsActive(true);
    setRequireAuth(true);
    setShowModal(true);
  };

  const openEditModal = async (dashboard: Dashboard) => {
    try {
      const fullDashboard = await dashboardService.getById(dashboard.id);
      setSelectedDashboard(fullDashboard);
      setName(fullDashboard.name);
      setSlug(fullDashboard.slug);
      setModuleId(fullDashboard.module_id);
      setTitle(fullDashboard.title);
      setDescription(fullDashboard.description || '');
      // Load layout, or convert old widgets array to layout for backwards compatibility
      if (fullDashboard.layout) {
        setLayout(fullDashboard.layout);
      } else if (fullDashboard.widgets) {
        // Convert old format to new layout (put all in middle row)
        setLayout({
          top: [],
          middle: fullDashboard.widgets,
          bottom: [],
        });
      } else {
        setLayout(DEFAULT_LAYOUT);
      }
      setDateRangeDefault(fullDashboard.date_range_default || '30');
      setIsActive(fullDashboard.is_active === 1);
      setRequireAuth(fullDashboard.require_auth === 1);
      setShowModal(true);
    } catch (error) {
      console.error('Failed to load dashboard:', error);
      showToast('Failed to load dashboard', 'error');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !slug || !moduleId || !title) {
      showToast('Please fill in all required fields', 'error');
      return;
    }

    try {
      setSaving(true);

      // Combine all widgets from layout for backwards compatibility
      const allWidgets = [...layout.top, ...layout.middle, ...layout.bottom];

      const data = {
        name,
        slug,
        moduleId,
        title,
        description: description || undefined,
        widgets: allWidgets,
        layout,
        dateRangeDefault,
        isActive,
        requireAuth,
      };

      if (selectedDashboard) {
        await dashboardService.update(selectedDashboard.id, data);
        showToast('Dashboard updated successfully', 'success');
      } else {
        await dashboardService.create(data);
        showToast('Dashboard created successfully', 'success');
      }

      setShowModal(false);
      loadData();
    } catch (error) {
      console.error('Failed to save dashboard:', error);
      showToast('Failed to save dashboard', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (dashboard: Dashboard) => {
    if (!confirm(`Are you sure you want to delete "${dashboard.name}"?`)) {
      return;
    }

    try {
      await dashboardService.delete(dashboard.id);
      showToast('Dashboard deleted successfully', 'success');
      loadData();
    } catch (error) {
      console.error('Failed to delete dashboard:', error);
      showToast('Failed to delete dashboard', 'error');
    }
  };

  // Helper to check which row a widget is in
  const getWidgetRow = (widget: WidgetType): RowName | null => {
    if (layout.top.includes(widget)) return 'top';
    if (layout.middle.includes(widget)) return 'middle';
    if (layout.bottom.includes(widget)) return 'bottom';
    return null;
  };

  // Move widget to a specific row (or remove if already in that row)
  const setWidgetRow = (widget: WidgetType, row: RowName | null) => {
    setLayout(prev => {
      // Remove widget from all rows first
      const newLayout = {
        top: prev.top.filter(w => w !== widget),
        middle: prev.middle.filter(w => w !== widget),
        bottom: prev.bottom.filter(w => w !== widget),
      };
      // Add to the selected row if not null
      if (row) {
        newLayout[row] = [...newLayout[row], widget];
      }
      return newLayout;
    });
  };

  const copyLink = (slug: string) => {
    const url = `${window.location.origin}/dashboard/${slug}`;
    navigator.clipboard.writeText(url);
    showToast('Link copied to clipboard', 'success');
  };

  if (!isAdmin) {
    return (
      <div className="p-8">
        <div className="bg-red-50 border border-red-200 rounded-lg p-6 text-center">
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
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Dashboards</h1>
          <p className="text-gray-500 mt-1">Create dashboards to visualize module statistics.</p>
        </div>
        <button
          onClick={openCreateModal}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
        >
          <PlusIcon className="h-5 w-5" />
          Create Dashboard
        </button>
      </div>

      {/* Dashboards Grid */}
      {dashboards.length === 0 ? (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-12 text-center">
          <ChartBarIcon className="h-12 w-12 mx-auto text-gray-400 mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">No dashboards yet</h3>
          <p className="text-gray-500 mb-4">Create your first dashboard to visualize your data.</p>
          <button
            onClick={openCreateModal}
            className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
          >
            <PlusIcon className="h-5 w-5" />
            Create Dashboard
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {dashboards.map((dashboard) => (
            <div
              key={dashboard.id}
              className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 hover:shadow-md transition-shadow"
            >
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center">
                    <ChartBarIcon className="h-6 w-6 text-purple-600" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-900">{dashboard.name}</h3>
                    <p className="text-sm text-gray-500">/{dashboard.slug}</p>
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <a
                    href={`/dashboard/${dashboard.slug}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                    title="View"
                  >
                    <EyeIcon className="h-4 w-4 text-gray-500" />
                  </a>
                  <button
                    onClick={() => copyLink(dashboard.slug)}
                    className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                    title="Copy Link"
                  >
                    <LinkIcon className="h-4 w-4 text-gray-500" />
                  </button>
                  <button
                    onClick={() => openEditModal(dashboard)}
                    className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                    title="Edit"
                  >
                    <PencilIcon className="h-4 w-4 text-gray-500" />
                  </button>
                  <button
                    onClick={() => handleDelete(dashboard)}
                    className="p-2 hover:bg-red-100 rounded-lg transition-colors"
                    title="Delete"
                  >
                    <TrashIcon className="h-4 w-4 text-red-500" />
                  </button>
                </div>
              </div>

              {dashboard.description && (
                <p className="text-sm text-gray-600 mb-4">{dashboard.description}</p>
              )}

              <div className="flex flex-wrap gap-2">
                <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-50 text-blue-700">
                  {dashboard.module_display_name || dashboard.module_name}
                </span>
                {dashboard.is_active ? (
                  <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-50 text-green-700">
                    Active
                  </span>
                ) : (
                  <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-600">
                    Inactive
                  </span>
                )}
                {dashboard.require_auth ? (
                  <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-amber-50 text-amber-700">
                    Login Required
                  </span>
                ) : (
                  <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700">
                    Public
                  </span>
                )}
                <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-600">
                  {dashboard.widgets?.length || 0} widgets
                </span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <form onSubmit={handleSubmit}>
              <div className="flex items-center justify-between p-6 border-b border-gray-200">
                <h2 className="text-xl font-semibold text-gray-900">
                  {selectedDashboard ? 'Edit Dashboard' : 'Create New Dashboard'}
                </h2>
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  <XMarkIcon className="h-5 w-5 text-gray-500" />
                </button>
              </div>

              <div className="p-6 space-y-6">
                {/* Basic Info */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Dashboard Name <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={name}
                      onChange={(e) => handleNameChange(e.target.value)}
                      placeholder="Sales Overview"
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      URL Slug <span className="text-red-500">*</span>
                    </label>
                    <div className="flex items-center">
                      <span className="text-gray-500 text-sm mr-1">/dashboard/</span>
                      <input
                        type="text"
                        value={slug}
                        onChange={(e) => setSlug(generateSlug(e.target.value))}
                        placeholder="sales-overview"
                        className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        required
                      />
                    </div>
                  </div>
                </div>

                {/* Module Selection */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Module <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={moduleId || ''}
                    onChange={(e) => setModuleId(e.target.value ? Number(e.target.value) : null)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    required
                  >
                    <option value="">Select a module...</option>
                    {modules.map((mod) => (
                      <option key={mod.id} value={mod.id}>
                        {mod.display_name}
                      </option>
                    ))}
                  </select>
                  <p className="mt-1 text-sm text-gray-500">
                    Statistics will be generated from this module's records.
                  </p>
                </div>

                {/* Title & Description */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Dashboard Title <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="Sales Performance Dashboard"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Description
                  </label>
                  <textarea
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Overview of sales performance and metrics..."
                    rows={2}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>

                {/* Widget Layout */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Widget Layout
                  </label>
                  <p className="text-sm text-gray-500 mb-3">
                    Select which row each widget should appear in. Leave unselected to hide a widget.
                  </p>
                  <div className="border border-gray-200 rounded-lg overflow-hidden">
                    <table className="w-full text-sm">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-4 py-2 text-left font-medium text-gray-700">Widget</th>
                          <th className="px-3 py-2 text-center font-medium text-gray-700">None</th>
                          <th className="px-3 py-2 text-center font-medium text-gray-700">Top</th>
                          <th className="px-3 py-2 text-center font-medium text-gray-700">Middle</th>
                          <th className="px-3 py-2 text-center font-medium text-gray-700">Bottom</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {WIDGET_OPTIONS.map((widget) => {
                          const currentRow = getWidgetRow(widget.value);
                          return (
                            <tr key={widget.value} className="hover:bg-gray-50">
                              <td className="px-4 py-3">
                                <div>
                                  <span className="font-medium text-gray-900">{widget.label}</span>
                                  <p className="text-xs text-gray-500">{widget.description}</p>
                                </div>
                              </td>
                              <td className="px-3 py-3 text-center">
                                <input
                                  type="radio"
                                  name={`widget-${widget.value}`}
                                  checked={currentRow === null}
                                  onChange={() => setWidgetRow(widget.value, null)}
                                  className="text-gray-400 focus:ring-gray-400"
                                />
                              </td>
                              <td className="px-3 py-3 text-center">
                                <input
                                  type="radio"
                                  name={`widget-${widget.value}`}
                                  checked={currentRow === 'top'}
                                  onChange={() => setWidgetRow(widget.value, 'top')}
                                  className="text-blue-600 focus:ring-blue-500"
                                />
                              </td>
                              <td className="px-3 py-3 text-center">
                                <input
                                  type="radio"
                                  name={`widget-${widget.value}`}
                                  checked={currentRow === 'middle'}
                                  onChange={() => setWidgetRow(widget.value, 'middle')}
                                  className="text-blue-600 focus:ring-blue-500"
                                />
                              </td>
                              <td className="px-3 py-3 text-center">
                                <input
                                  type="radio"
                                  name={`widget-${widget.value}`}
                                  checked={currentRow === 'bottom'}
                                  onChange={() => setWidgetRow(widget.value, 'bottom')}
                                  className="text-blue-600 focus:ring-blue-500"
                                />
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Default Date Range */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Default Date Range
                  </label>
                  <select
                    value={dateRangeDefault}
                    onChange={(e) => setDateRangeDefault(e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    {DATE_RANGE_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Options */}
                <div className="flex flex-wrap gap-6">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={isActive}
                      onChange={(e) => setIsActive(e.target.checked)}
                      className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                    <span className="text-sm text-gray-700">Active</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={requireAuth}
                      onChange={(e) => setRequireAuth(e.target.checked)}
                      className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                    <span className="text-sm text-gray-700">Require Login</span>
                  </label>
                </div>
                {!requireAuth && (
                  <p className="text-sm text-amber-600 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                    This dashboard will be publicly accessible without login.
                  </p>
                )}
              </div>

              {/* Actions */}
              <div className="flex justify-end gap-3 p-6 border-t border-gray-200 bg-gray-50">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving || !name || !slug || !moduleId || !title}
                  className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {saving ? (
                    <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent" />
                  ) : (
                    <CheckIcon className="h-4 w-4" />
                  )}
                  {selectedDashboard ? 'Save Changes' : 'Create Dashboard'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
