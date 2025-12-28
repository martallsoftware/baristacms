import { useEffect, useState, useMemo, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { AgGridReact } from 'ag-grid-react';
import type { ColDef, ICellRendererParams, GridApi } from 'ag-grid-community';
import {
  PlusIcon,
  PencilIcon,
  TrashIcon,
  DocumentTextIcon,
  ArrowPathIcon,
  MagnifyingGlassIcon,
  EyeIcon,
  GlobeAltIcon,
  ChevronDownIcon,
} from '@heroicons/react/24/outline';
import {
  basicPageService,
  type BasicPage,
} from '../../services/api';
import { useUser } from '../../context/UserContext';
import { useToast } from '../../context/ToastContext';

const PAGE_TYPE_LABELS: Record<string, string> = {
  content: 'Content',
  markdown: 'Markdown',
  start: 'Start',
  documentation: 'Documentation',
  tips: 'Tips',
  faq: 'FAQ',
};

export default function BasicPagesAdmin() {
  const navigate = useNavigate();
  const { isAdmin } = useUser();
  const { showToast } = useToast();
  const [pages, setPages] = useState<BasicPage[]>([]);
  const [loading, setLoading] = useState(true);
  const [showDropdown, setShowDropdown] = useState(false);

  // Grid state
  const gridRef = useRef<AgGridReact>(null);
  const [gridApi, setGridApi] = useState<GridApi | null>(null);
  const [searchText, setSearchText] = useState('');

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const pagesData = await basicPageService.getAll();
      setPages(pagesData);
    } catch (error) {
      console.error('Failed to load data:', error);
      showToast('Failed to load pages', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (page: BasicPage) => {
    if (!confirm(`Are you sure you want to delete "${page.title}"?`)) {
      return;
    }

    try {
      await basicPageService.delete(page.id);
      showToast('Page deleted successfully', 'success');
      setPages(prev => prev.filter(p => p.id !== page.id));
    } catch (error) {
      console.error('Failed to delete page:', error);
      showToast('Failed to delete page', 'error');
    }
  };

  // Grid ready handler
  const onGridReady = useCallback((params: { api: GridApi }) => {
    setGridApi(params.api);
  }, []);

  // Filter text change handler
  const onFilterTextChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchText(e.target.value);
    gridApi?.setGridOption('quickFilterText', e.target.value);
  }, [gridApi]);

  // Column definitions
  const columnDefs = useMemo<ColDef[]>(() => [
    {
      headerName: 'ID',
      field: 'id',
      width: 70,
      maxWidth: 80,
      sortable: true,
    },
    {
      headerName: 'Title',
      field: 'title',
      minWidth: 200,
      flex: 2,
      sortable: true,
      filter: true,
      cellRenderer: (params: ICellRendererParams) => (
        <div className="flex items-center gap-2">
          <DocumentTextIcon className="h-4 w-4 text-gray-400" />
          <span className="font-medium">{params.value}</span>
        </div>
      ),
    },
    {
      headerName: 'Slug',
      field: 'slug',
      minWidth: 150,
      flex: 1,
      sortable: true,
      filter: true,
      cellRenderer: (params: ICellRendererParams) => (
        <span className="text-gray-500">/page/{params.value}</span>
      ),
    },
    {
      headerName: 'Type',
      field: 'page_type',
      width: 120,
      sortable: true,
      filter: true,
      cellRenderer: (params: ICellRendererParams) => (
        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800">
          {PAGE_TYPE_LABELS[params.value] || params.value}
        </span>
      ),
    },
    {
      headerName: 'Menu',
      field: 'menu_display_name',
      minWidth: 120,
      flex: 1,
      sortable: true,
      filter: true,
      cellRenderer: (params: ICellRendererParams) => (
        params.value ? (
          <span className="text-gray-700">{params.value}</span>
        ) : (
          <span className="text-gray-400">-</span>
        )
      ),
    },
    {
      headerName: 'Status',
      field: 'is_published',
      width: 110,
      sortable: true,
      cellRenderer: (params: ICellRendererParams) => (
        params.value ? (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800">
            <GlobeAltIcon className="h-3 w-3" />
            Published
          </span>
        ) : (
          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-600">
            Draft
          </span>
        )
      ),
    },
    {
      headerName: 'Updated',
      field: 'updated_at',
      width: 140,
      sortable: true,
      cellRenderer: (params: ICellRendererParams) => {
        if (!params.value) return <span className="text-gray-400">-</span>;
        const date = new Date(params.value);
        return (
          <span className="text-sm text-gray-600">
            {date.toLocaleDateString()}
          </span>
        );
      },
    },
    {
      headerName: 'Actions',
      width: 120,
      sortable: false,
      filter: false,
      cellRenderer: (params: ICellRendererParams<BasicPage>) => (
        <div className="flex items-center gap-1">
          {params.data?.is_published === 1 && (
            <a
              href={`/page/${params.data.slug}`}
              target="_blank"
              rel="noopener noreferrer"
              className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded"
              title="View Page"
            >
              <EyeIcon className="h-4 w-4" />
            </a>
          )}
          <button
            onClick={() => navigate(`/admin/basic-pages/${params.data?.id}`)}
            className="p-1.5 text-blue-600 hover:bg-blue-50 rounded"
            title="Edit"
          >
            <PencilIcon className="h-4 w-4" />
          </button>
          <button
            onClick={() => params.data && handleDelete(params.data)}
            className="p-1.5 text-red-600 hover:bg-red-50 rounded"
            title="Delete"
          >
            <TrashIcon className="h-4 w-4" />
          </button>
        </div>
      ),
    },
  ], [navigate]);

  if (!isAdmin) {
    return (
      <div className="p-8">
        <div className="bg-red-50 border border-red-200 rounded-lg p-6 text-center">
          <DocumentTextIcon className="h-12 w-12 mx-auto text-red-400 mb-3" />
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
    <div className="p-4 md:p-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-gray-900">Basic Pages</h1>
          <p className="text-gray-500 mt-1 text-sm md:text-base">
            Manage static content pages like Start, Documentation, Tips, FAQ.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={loadData}
            className="flex items-center gap-2 px-3 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
          >
            <ArrowPathIcon className="h-4 w-4" />
            <span className="hidden sm:inline">Refresh</span>
          </button>

          {/* Dropdown for New Page options */}
          <div className="relative">
            <button
              onClick={() => setShowDropdown(!showDropdown)}
              className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg transition-colors"
            >
              <PlusIcon className="h-5 w-5" />
              <span>New Page</span>
              <ChevronDownIcon className="h-4 w-4" />
            </button>

            {showDropdown && (
              <>
                <div
                  className="fixed inset-0 z-10"
                  onClick={() => setShowDropdown(false)}
                />
                <div className="absolute right-0 mt-2 w-56 bg-white rounded-lg shadow-lg border border-gray-200 z-20">
                  <button
                    onClick={() => {
                      setShowDropdown(false);
                      navigate('/admin/basic-pages/new?type=markdown');
                    }}
                    className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-gray-50 rounded-t-lg"
                  >
                    <DocumentTextIcon className="h-5 w-5 text-blue-600" />
                    <div>
                      <div className="font-medium text-gray-900">Markdown Page</div>
                      <div className="text-xs text-gray-500">Simple content with markdown</div>
                    </div>
                  </button>
                  <button
                    onClick={() => {
                      setShowDropdown(false);
                      navigate('/admin/basic-pages/new?type=content');
                    }}
                    className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-gray-50 rounded-b-lg border-t border-gray-100"
                  >
                    <DocumentTextIcon className="h-5 w-5 text-green-600" />
                    <div>
                      <div className="font-medium text-gray-900">Basic Page</div>
                      <div className="text-xs text-gray-500">Page with fields like records</div>
                    </div>
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Toolbar */}
      <div className="flex items-center gap-4 mb-4">
        <div className="relative flex-1 max-w-md">
          <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
          <input
            type="text"
            placeholder="Search pages..."
            value={searchText}
            onChange={onFilterTextChange}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>
      </div>

      {/* Grid */}
      {pages.length === 0 ? (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-12 text-center">
          <DocumentTextIcon className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <h2 className="text-lg font-semibold text-gray-900 mb-2">No Pages Yet</h2>
          <p className="text-gray-500 mb-4">Create your first basic page to get started.</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="ag-theme-alpine" style={{ height: 'calc(100vh - 320px)', minHeight: 400, width: '100%' }}>
            <AgGridReact
              ref={gridRef}
              rowData={pages}
              columnDefs={columnDefs}
              defaultColDef={{
                resizable: true,
                sortable: true,
                filter: true,
                minWidth: 80,
              }}
              onGridReady={onGridReady}
              animateRows={true}
              pagination={true}
              paginationPageSize={20}
              paginationPageSizeSelector={[10, 20, 50, 100]}
              rowHeight={50}
            />
          </div>
        </div>
      )}
    </div>
  );
}
