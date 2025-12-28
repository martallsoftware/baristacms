import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
} from 'recharts';
import { DocumentIcon, UsersIcon, ClockIcon, ChartPieIcon, CalendarDaysIcon } from '@heroicons/react/24/outline';
import type { ChartData, TodaysItem } from '../../services/api';

interface StatCardProps {
  count: number;
  title?: string;
}

export function StatCard({ count, title = 'Total Records' }: StatCardProps) {
  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
      <div className="flex items-center gap-4">
        <div className="w-14 h-14 bg-blue-100 rounded-xl flex items-center justify-center">
          <DocumentIcon className="h-7 w-7 text-blue-600" />
        </div>
        <div>
          <p className="text-sm font-medium text-gray-500">{title}</p>
          <p className="text-3xl font-bold text-gray-900">{count.toLocaleString()}</p>
        </div>
      </div>
    </div>
  );
}

interface BarChartWidgetProps {
  data: ChartData;
  title?: string;
}

export function BarChartWidget({ data, title = 'Items by Month' }: BarChartWidgetProps) {
  const chartData = data.labels.map((label, index) => ({
    name: label,
    value: data.values[index],
  }));

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
      <div className="flex items-center gap-2 mb-4">
        <ClockIcon className="h-5 w-5 text-gray-500" />
        <h3 className="font-semibold text-gray-900">{title}</h3>
      </div>
      {chartData.length === 0 ? (
        <div className="h-64 flex items-center justify-center text-gray-400">
          No data available
        </div>
      ) : (
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis
                dataKey="name"
                tick={{ fontSize: 12, fill: '#6b7280' }}
                tickLine={false}
                axisLine={{ stroke: '#e5e7eb' }}
              />
              <YAxis
                tick={{ fontSize: 12, fill: '#6b7280' }}
                tickLine={false}
                axisLine={{ stroke: '#e5e7eb' }}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#fff',
                  border: '1px solid #e5e7eb',
                  borderRadius: '8px',
                  boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
                }}
              />
              <Bar dataKey="value" fill="#3b82f6" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}

interface PieChartWidgetProps {
  data: ChartData;
  title?: string;
}

const DEFAULT_COLORS = ['#3b82f6', '#22c55e', '#eab308', '#f97316', '#ef4444', '#8b5cf6', '#06b6d4', '#ec4899'];

export function PieChartWidget({ data, title = 'Items by Status' }: PieChartWidgetProps) {
  const chartData = data.labels.map((label, index) => ({
    name: label,
    value: data.values[index],
    color: data.colors?.[index] || DEFAULT_COLORS[index % DEFAULT_COLORS.length],
  }));

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
      <div className="flex items-center gap-2 mb-4">
        <ChartPieIcon className="h-5 w-5 text-gray-500" />
        <h3 className="font-semibold text-gray-900">{title}</h3>
      </div>
      {chartData.length === 0 ? (
        <div className="h-64 flex items-center justify-center text-gray-400">
          No data available
        </div>
      ) : (
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={chartData}
                cx="50%"
                cy="50%"
                innerRadius={50}
                outerRadius={80}
                paddingAngle={2}
                dataKey="value"
                label={({ name, percent }) => `${name} (${((percent || 0) * 100).toFixed(0)}%)`}
                labelLine={false}
              >
                {chartData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip
                contentStyle={{
                  backgroundColor: '#fff',
                  border: '1px solid #e5e7eb',
                  borderRadius: '8px',
                  boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
                }}
              />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}

interface UserStatsWidgetProps {
  data: ChartData;
  title?: string;
}

export function UserStatsWidget({ data, title = 'Items by User' }: UserStatsWidgetProps) {
  const chartData = data.labels.map((label, index) => ({
    name: label.length > 20 ? label.substring(0, 20) + '...' : label,
    fullName: label,
    value: data.values[index],
  }));

  // Sort by value descending and take top 10
  chartData.sort((a, b) => b.value - a.value);
  const topData = chartData.slice(0, 10);

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
      <div className="flex items-center gap-2 mb-4">
        <UsersIcon className="h-5 w-5 text-gray-500" />
        <h3 className="font-semibold text-gray-900">{title}</h3>
      </div>
      {topData.length === 0 ? (
        <div className="h-64 flex items-center justify-center text-gray-400">
          No data available
        </div>
      ) : (
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={topData}
              layout="vertical"
              margin={{ top: 10, right: 30, left: 10, bottom: 0 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" horizontal={false} />
              <XAxis
                type="number"
                tick={{ fontSize: 12, fill: '#6b7280' }}
                tickLine={false}
                axisLine={{ stroke: '#e5e7eb' }}
              />
              <YAxis
                type="category"
                dataKey="name"
                tick={{ fontSize: 11, fill: '#6b7280' }}
                tickLine={false}
                axisLine={{ stroke: '#e5e7eb' }}
                width={120}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#fff',
                  border: '1px solid #e5e7eb',
                  borderRadius: '8px',
                  boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
                }}
              />
              <Bar dataKey="value" fill="#8b5cf6" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}

interface TodaysItemsWidgetProps {
  items: TodaysItem[];
  count: number;
  title?: string;
  moduleName?: string;
}

export function TodaysItemsWidget({ items, count, title = "Today's Items", moduleName }: TodaysItemsWidgetProps) {
  // Get display value from item data - try common field names
  const getDisplayValue = (item: TodaysItem): string => {
    const data = item.data;
    // Try common field names for a display value
    const possibleFields = ['title', 'name', 'subject', 'description', 'reference', 'ref', 'id'];
    for (const field of possibleFields) {
      if (data[field] && typeof data[field] === 'string') {
        const value = data[field] as string;
        return value.length > 50 ? value.substring(0, 50) + '...' : value;
      }
    }
    // Fallback to first string value
    for (const value of Object.values(data)) {
      if (typeof value === 'string' && value.length > 0) {
        return value.length > 50 ? value.substring(0, 50) + '...' : value;
      }
    }
    return `Record #${item.id}`;
  };

  const formatTime = (dateStr: string): string => {
    const date = new Date(dateStr);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <CalendarDaysIcon className="h-5 w-5 text-gray-500" />
          <h3 className="font-semibold text-gray-900">{title}</h3>
        </div>
        <span className="text-sm text-gray-500">{count} item{count !== 1 ? 's' : ''}</span>
      </div>
      {items.length === 0 ? (
        <div className="py-8 text-center text-gray-400">
          No items created today
        </div>
      ) : (
        <div className="overflow-x-auto max-h-80 overflow-y-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 sticky top-0">
              <tr>
                <th className="text-left py-2 px-3 font-medium text-gray-600">Item</th>
                <th className="text-left py-2 px-3 font-medium text-gray-600">Status</th>
                <th className="text-left py-2 px-3 font-medium text-gray-600">Created By</th>
                <th className="text-left py-2 px-3 font-medium text-gray-600">Time</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {items.map((item) => (
                <tr key={item.id} className="hover:bg-gray-50">
                  <td className="py-2 px-3">
                    <a
                      href={moduleName ? `/records/${moduleName}/${item.id}` : '#'}
                      className="text-blue-600 hover:text-blue-800 hover:underline"
                    >
                      {getDisplayValue(item)}
                    </a>
                  </td>
                  <td className="py-2 px-3">
                    {item.status ? (
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-800">
                        {item.status}
                      </span>
                    ) : (
                      <span className="text-gray-400">-</span>
                    )}
                  </td>
                  <td className="py-2 px-3 text-gray-600">
                    {item.created_by || '-'}
                  </td>
                  <td className="py-2 px-3 text-gray-500">
                    {formatTime(item.created_at)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
