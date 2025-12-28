import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  PlusIcon,
  PencilIcon,
  TrashIcon,
  ArrowPathIcon,
  CubeIcon,
} from '@heroicons/react/24/outline';
import {
  moduleService,
  createRecordService,
  type Module,
  type ModuleRecord,
  type ModuleField,
} from '../services/api';
import { useUser } from '../context/UserContext';

// Helper to format field value for display
function formatFieldValue(value: unknown, fieldType: string): string {
  if (value === null || value === undefined || value === '') return '-';

  switch (fieldType) {
    case 'boolean':
      return value ? 'Yes' : 'No';
    case 'date':
      try {
        return new Date(String(value)).toLocaleDateString();
      } catch {
        return String(value);
      }
    case 'number':
      return String(value);
    default:
      const strValue = String(value);
      // Truncate long text
      return strValue.length > 50 ? strValue.substring(0, 50) + '...' : strValue;
  }
}

interface SubModuleGridProps {
  parentModuleName: string;
  parentRecordId: number;
}

export default function SubModuleGrid({ parentModuleName, parentRecordId }: SubModuleGridProps) {
  const navigate = useNavigate();
  const { isAdmin } = useUser();
  const [subModules, setSubModules] = useState<Module[]>([]);
  const [subModuleFields, setSubModuleFields] = useState<Record<string, ModuleField[]>>({});
  const [childRecords, setChildRecords] = useState<Record<string, ModuleRecord[]>>({});
  const [loading, setLoading] = useState(true);
  const [expandedModule, setExpandedModule] = useState<string | null>(null);

  const loadSubModules = useCallback(async () => {
    try {
      const modules = await moduleService.getSubModules(parentModuleName);
      setSubModules(modules);

      // Load full module details (with fields) and child records for each sub-module
      const recordService = createRecordService(parentModuleName);
      const records: Record<string, ModuleRecord[]> = {};
      const fields: Record<string, ModuleField[]> = {};

      for (const mod of modules) {
        try {
          // Get full module with fields
          const fullModule = await moduleService.getByName(mod.name);
          fields[mod.name] = fullModule.fields || [];

          // Get child records
          records[mod.name] = await recordService.getChildRecords(parentRecordId, mod.name);
        } catch (err) {
          console.error(`Failed to load data for ${mod.name}:`, err);
          records[mod.name] = [];
          fields[mod.name] = [];
        }
      }

      setChildRecords(records);
      setSubModuleFields(fields);

      // Auto-expand first module if it has records
      if (modules.length > 0) {
        const firstWithRecords = modules.find(m => (records[m.name]?.length || 0) > 0);
        setExpandedModule(firstWithRecords?.name || modules[0].name);
      }
    } catch (err) {
      console.error('Failed to load sub-modules:', err);
    } finally {
      setLoading(false);
    }
  }, [parentModuleName, parentRecordId]);

  useEffect(() => {
    loadSubModules();
  }, [loadSubModules]);

  const handleAddRecord = (subModule: Module) => {
    // Navigate to create new record in sub-module with parent reference
    navigate(`/records/${subModule.name}/new?parentRecordId=${parentRecordId}&parentModule=${parentModuleName}`);
  };

  const handleEditRecord = (subModule: Module, record: ModuleRecord) => {
    navigate(`/records/${subModule.name}/${record.id}`);
  };

  const handleDeleteRecord = async (subModule: Module, record: ModuleRecord) => {
    if (!confirm(`Are you sure you want to delete "${record.name}"?`)) return;

    try {
      const recordService = createRecordService(subModule.name);
      await recordService.delete(record.id);
      await loadSubModules();
    } catch (err) {
      console.error('Failed to delete record:', err);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  if (subModules.length === 0) {
    return null;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-gray-900">Related Items</h3>
        <button
          onClick={loadSubModules}
          className="p-1.5 text-gray-500 hover:bg-gray-100 rounded-lg transition-colors"
          title="Refresh"
        >
          <ArrowPathIcon className="h-4 w-4" />
        </button>
      </div>

      {subModules.map((subModule) => {
        const records = childRecords[subModule.name] || [];
        const isExpanded = expandedModule === subModule.name;

        return (
          <div key={subModule.name} className="border border-gray-200 rounded-lg overflow-hidden">
            {/* Sub-module header */}
            <button
              onClick={() => setExpandedModule(isExpanded ? null : subModule.name)}
              className="w-full flex items-center justify-between px-4 py-3 bg-gray-50 hover:bg-gray-100 transition-colors"
            >
              <div className="flex items-center gap-3">
                <CubeIcon className="h-5 w-5 text-blue-600" />
                <span className="font-medium text-gray-900">{subModule.display_name}</span>
                <span className="text-sm text-gray-500">({records.length})</span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleAddRecord(subModule);
                  }}
                  className="flex items-center gap-1 px-2 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
                >
                  <PlusIcon className="h-3 w-3" />
                  Add
                </button>
                <svg
                  className={`h-5 w-5 text-gray-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </div>
            </button>

            {/* Records grid */}
            {isExpanded && (
              <div className="p-4">
                {records.length === 0 ? (
                  <div className="text-center py-6 text-gray-500">
                    <p className="text-sm">No {subModule.display_name.toLowerCase()} yet</p>
                    <button
                      onClick={() => handleAddRecord(subModule)}
                      className="mt-2 text-sm text-blue-600 hover:text-blue-700"
                    >
                      + Add first {subModule.display_name.toLowerCase().replace(/s$/, '')}
                    </button>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    {(() => {
                      const fields = subModuleFields[subModule.name] || [];
                      // Show first 4 fields (excluding description which is usually long)
                      const displayFields = fields
                        .filter(f => f.field_type !== 'textarea')
                        .slice(0, 4);

                      return (
                        <table className="min-w-full divide-y divide-gray-200">
                          <thead className="bg-gray-50">
                            <tr>
                              <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                Name
                              </th>
                              {displayFields.map((field) => (
                                <th
                                  key={field.name}
                                  className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                                >
                                  {field.display_name}
                                </th>
                              ))}
                              <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                Status
                              </th>
                              <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                                Actions
                              </th>
                            </tr>
                          </thead>
                          <tbody className="bg-white divide-y divide-gray-200">
                            {records.map((record) => (
                              <tr key={record.id} className="hover:bg-gray-50">
                                <td className="px-3 py-2 whitespace-nowrap">
                                  <button
                                    onClick={() => handleEditRecord(subModule, record)}
                                    className="text-sm font-medium text-blue-600 hover:text-blue-700"
                                  >
                                    {record.name}
                                  </button>
                                </td>
                                {displayFields.map((field) => (
                                  <td
                                    key={field.name}
                                    className="px-3 py-2 whitespace-nowrap text-sm text-gray-600"
                                  >
                                    {formatFieldValue(
                                      record.data?.[field.name],
                                      field.field_type
                                    )}
                                  </td>
                                ))}
                                <td className="px-3 py-2 whitespace-nowrap">
                                  <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-800">
                                    {record.status}
                                  </span>
                                </td>
                                <td className="px-3 py-2 whitespace-nowrap text-right">
                                  <div className="flex items-center justify-end gap-1">
                                    <button
                                      onClick={() => handleEditRecord(subModule, record)}
                                      className="p-1 text-gray-500 hover:bg-gray-100 rounded"
                                      title="Edit"
                                    >
                                      <PencilIcon className="h-4 w-4" />
                                    </button>
                                    {isAdmin && (
                                      <button
                                        onClick={() => handleDeleteRecord(subModule, record)}
                                        className="p-1 text-red-500 hover:bg-red-50 rounded"
                                        title="Delete"
                                      >
                                        <TrashIcon className="h-4 w-4" />
                                      </button>
                                    )}
                                  </div>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      );
                    })()}
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
