import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowPathIcon, ChartBarIcon } from '@heroicons/react/24/outline';
import {
  dashboardService,
  type Dashboard,
  type DashboardLayout,
  type DashboardStats,
  type WidgetType,
} from '../services/api';
import { useToast } from '../context/ToastContext';
import {
  StatCard,
  BarChartWidget,
  PieChartWidget,
  UserStatsWidget,
  TodaysItemsWidget,
} from '../components/dashboard/DashboardWidgets';

const DATE_RANGE_OPTIONS = [
  { value: '7', label: '7d' },
  { value: '30', label: '30d' },
  { value: '90', label: '90d' },
  { value: '365', label: '1y' },
  { value: 'all', label: 'All' },
];

export default function DashboardView() {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const { showToast } = useToast();
  const [dashboard, setDashboard] = useState<Dashboard | null>(null);
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [statsLoading, setStatsLoading] = useState(false);
  const [dateRange, setDateRange] = useState<string>('30');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (slug) {
      loadDashboard();
    }
  }, [slug]);

  useEffect(() => {
    if (dashboard) {
      loadStats();
    }
  }, [dashboard, dateRange]);

  const loadDashboard = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await dashboardService.getBySlug(slug!);
      setDashboard(data);
      setDateRange(data.date_range_default || '30');
    } catch (err) {
      console.error('Failed to load dashboard:', err);
      const errorMessage = err instanceof Error ? err.message : 'Failed to load dashboard';
      setError(errorMessage);
      if (errorMessage.includes('Authentication required')) {
        showToast('Please log in to view this dashboard', 'error');
      }
    } finally {
      setLoading(false);
    }
  };

  const loadStats = async () => {
    if (!dashboard) return;

    try {
      setStatsLoading(true);
      const data = await dashboardService.getStats(dashboard.id, dateRange);
      setStats(data);
    } catch (err) {
      console.error('Failed to load stats:', err);
      showToast('Failed to load statistics', 'error');
    } finally {
      setStatsLoading(false);
    }
  };

  const handleRefresh = () => {
    loadStats();
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-8 max-w-md text-center">
          <ChartBarIcon className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Dashboard Not Found</h2>
          <p className="text-gray-600 mb-6">{error}</p>
          <button
            onClick={() => navigate('/')}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            Go Home
          </button>
        </div>
      </div>
    );
  }

  if (!dashboard) {
    return null;
  }

  // Get layout - use layout if available, otherwise convert widgets array to single row
  const layout: DashboardLayout = dashboard.layout || {
    top: [],
    middle: dashboard.widgets || [],
    bottom: [],
  };

  // Render a single widget
  const renderWidget = (widget: WidgetType, colSpan: number = 1) => {
    if (!stats) return null;

    switch (widget) {
      case 'total_count':
        if (!stats.widgets.total_count) return null;
        return (
          <div key={widget} className={colSpan === 2 ? 'md:col-span-2' : ''}>
            <StatCard
              count={stats.widgets.total_count.data.count}
              title="Total Records"
            />
          </div>
        );
      case 'items_by_month':
        if (!stats.widgets.items_by_month) return null;
        return (
          <div key={widget} className={colSpan === 2 ? 'md:col-span-2' : ''}>
            <BarChartWidget
              data={stats.widgets.items_by_month.data}
              title="Items by Month"
            />
          </div>
        );
      case 'items_by_user':
        if (!stats.widgets.items_by_user) return null;
        return (
          <div key={widget} className={colSpan === 2 ? 'md:col-span-2' : ''}>
            <UserStatsWidget
              data={stats.widgets.items_by_user.data}
              title="Items by User"
            />
          </div>
        );
      case 'items_by_status':
        if (!stats.widgets.items_by_status) return null;
        return (
          <div key={widget} className={colSpan === 2 ? 'md:col-span-2' : ''}>
            <PieChartWidget
              data={stats.widgets.items_by_status.data}
              title="Items by Status"
            />
          </div>
        );
      case 'todays_items':
        if (!stats.widgets.todays_items) return null;
        return (
          <div key={widget} className={colSpan === 2 ? 'md:col-span-2' : ''}>
            <TodaysItemsWidget
              items={stats.widgets.todays_items.data.items}
              count={stats.widgets.todays_items.data.count}
              title="Today's"
              moduleName={stats.moduleName}
            />
          </div>
        );
      default:
        return null;
    }
  };

  // Render a row of widgets
  const renderRow = (widgets: WidgetType[]) => {
    if (!widgets || widgets.length === 0) return null;

    // Determine column spans based on widget count
    // 1 widget = full width, 2 widgets = half each, 3+ = third each
    const colSpan = widgets.length === 1 ? 2 : 1;

    return (
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
        {widgets.map((widget) => renderWidget(widget, colSpan))}
      </div>
    );
  };

  return (
    <div className="bg-gray-50 min-h-full">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">{dashboard.title}</h1>
            {dashboard.description && (
              <p className="text-gray-500 mt-1">{dashboard.description}</p>
            )}
          </div>

          <div className="flex items-center gap-3">
            {/* Date Range Selector */}
            <div className="flex rounded-lg border border-gray-200 bg-white overflow-hidden">
              {DATE_RANGE_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  onClick={() => setDateRange(option.value)}
                  className={`px-3 py-1.5 text-sm font-medium transition-colors ${
                    dateRange === option.value
                      ? 'bg-blue-600 text-white'
                      : 'text-gray-600 hover:bg-gray-50'
                  }`}
                >
                  {option.label}
                </button>
              ))}
            </div>

            {/* Refresh Button */}
            <button
              onClick={handleRefresh}
              disabled={statsLoading}
              className="p-2 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
              title="Refresh"
            >
              <ArrowPathIcon className={`h-5 w-5 text-gray-600 ${statsLoading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        {/* Loading overlay for stats */}
        {statsLoading && (
          <div className="fixed inset-0 bg-white/50 z-10 flex items-center justify-center pointer-events-none">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
          </div>
        )}

        {/* Widgets by Row */}
        {stats ? (
          <div>
            {renderRow(layout.top)}
            {renderRow(layout.middle)}
            {renderRow(layout.bottom)}
            {/* Show message if no widgets are configured */}
            {layout.top.length === 0 && layout.middle.length === 0 && layout.bottom.length === 0 && (
              <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-12 text-center">
                <ChartBarIcon className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-500">No widgets configured for this dashboard</p>
              </div>
            )}
          </div>
        ) : (
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-12 text-center">
            <ChartBarIcon className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-500">No statistics available</p>
          </div>
        )}
      </div>
    </div>
  );
}
