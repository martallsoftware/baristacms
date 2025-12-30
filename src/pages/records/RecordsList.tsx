import { useEffect, useState, useMemo, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { AgGridReact } from 'ag-grid-react';
import type { ColDef, ICellRendererParams, GridApi } from 'ag-grid-community';
import * as XLSX from 'xlsx';
import {
  PlusIcon,
  PencilIcon,
  TrashIcon,
  ArrowPathIcon,
  PhotoIcon,
  MagnifyingGlassIcon,
  ArrowDownTrayIcon,
  EnvelopeIcon,
  XMarkIcon,
  QrCodeIcon,
  InboxArrowDownIcon,
} from '@heroicons/react/24/outline';
import {
  moduleService,
  createRecordService,
  userService,
  emailService,
  printQueueService,
  type Module,
  type ModuleRecord,
  type ModuleField,
  type User,
  type DateWarningMode,
} from '../../services/api';
import ImageViewer from '../../components/ImageViewer';
import EmailInbox from '../../components/EmailInbox';
import { useUser } from '../../context/UserContext';

// API base URL for serving static files (images, documents)
const API_BASE = import.meta.env.VITE_API_URL?.replace('/api', '') || 'http://localhost:3001';

// Thumbnail cell renderer component
interface ThumbnailCellRendererProps {
  value: string | null;
  data: ModuleRecord;
  onImageClick: (record: ModuleRecord) => void;
}

function ThumbnailCellRenderer({ value, data, onImageClick }: ThumbnailCellRendererProps) {
  const hasImages = data.images && data.images.length > 0;

  if (!value) {
    return (
      <div className="w-10 h-10 bg-gray-100 rounded flex items-center justify-center">
        <PhotoIcon className="w-5 h-5 text-gray-400" />
      </div>
    );
  }
  return (
    <button
      onClick={() => hasImages && onImageClick(data)}
      className={`w-10 h-10 rounded overflow-hidden ${hasImages ? 'cursor-pointer hover:ring-2 hover:ring-blue-500 transition-all' : 'cursor-default'}`}
      title={hasImages ? 'Click to view images' : 'No images available'}
    >
      <img
        src={`${API_BASE}${value}`}
        alt="Thumbnail"
        className="w-full h-full object-cover"
      />
    </button>
  );
}

// Name cell renderer with unread indicator
function NameCellRenderer({ value, data }: { value: string; data: ModuleRecord }) {
  const isUnread = data.is_viewed === false;

  return (
    <div className="flex items-center gap-2">
      {isUnread && (
        <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800">
          NEW
        </span>
      )}
      <span className={isUnread ? 'font-semibold' : ''}>{value}</span>
    </div>
  );
}

// Helper function to calculate days until a date
function getDaysUntil(dateStr: string): number {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const targetDate = new Date(dateStr);
  targetDate.setHours(0, 0, 0, 0);
  const diffTime = targetDate.getTime() - today.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  return diffDays;
}

// Get warning status for a date field
function getDateWarningStatus(
  dateStr: string | null | undefined,
  yellowDays: number | undefined,
  redDays: number | undefined,
  mode: DateWarningMode = 'overdue'
): 'red' | 'yellow' | 'green' | 'none' {
  if (!dateStr) return 'none';
  const daysUntil = getDaysUntil(dateStr);

  if (mode === 'predate') {
    // Pre-date mode: yellow approaching, red when imminent, stays red after date passes
    // Date has passed - always red
    if (daysUntil < 0) {
      return 'red';
    }
    // Within red threshold
    if (redDays !== undefined && daysUntil <= redDays) {
      return 'red';
    }
    // Within yellow threshold
    if (yellowDays !== undefined && daysUntil <= yellowDays) {
      return 'yellow';
    }
    return 'none';
  } else {
    // Overdue mode (deadline): green when OK (including today), yellow approaching, red when overdue
    // Today - always green
    if (daysUntil === 0) {
      return 'green';
    }
    // Overdue (past due date) - red
    if (daysUntil < 0) {
      return 'red';
    }
    // Within red threshold
    if (redDays !== undefined && daysUntil <= redDays) {
      return 'red';
    }
    // Within yellow threshold
    if (yellowDays !== undefined && daysUntil <= yellowDays) {
      return 'yellow';
    }
    // Outside warning thresholds - show green for overdue mode if warnings are configured
    if (yellowDays !== undefined || redDays !== undefined) {
      return 'green';
    }
    return 'none';
  }
}

// Date cell renderer with warning colors
interface DateCellRendererProps {
  value: string | null;
  field: ModuleField;
}

function DateCellRenderer({ value, field }: DateCellRendererProps) {
  if (!value) return <span className="text-gray-400">-</span>;

  const warningStatus = getDateWarningStatus(
    value,
    field.warning_yellow_days,
    field.warning_red_days,
    field.warning_mode
  );

  const formatDate = (dateStr: string) => {
    try {
      const date = new Date(dateStr);
      // Format as YYYY-MM-DD (ISO format)
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    } catch {
      return dateStr;
    }
  };

  const daysUntil = getDaysUntil(value);
  const isPredate = field.warning_mode === 'predate';

  let daysText: string;
  if (daysUntil === 0) {
    daysText = 'Today';
  } else if (daysUntil < 0) {
    daysText = isPredate ? `${Math.abs(daysUntil)} days ago` : `${Math.abs(daysUntil)} days overdue`;
  } else {
    daysText = `${daysUntil} days`;
  }

  if (warningStatus === 'red') {
    return (
      <div className="flex items-center gap-2">
        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-red-100 text-red-800">
          {formatDate(value)}
        </span>
        <span className="text-xs text-red-600">{daysText}</span>
      </div>
    );
  }

  if (warningStatus === 'yellow') {
    return (
      <div className="flex items-center gap-2">
        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-yellow-100 text-yellow-800">
          {formatDate(value)}
        </span>
        <span className="text-xs text-yellow-600">{daysText}</span>
      </div>
    );
  }

  if (warningStatus === 'green') {
    return (
      <div className="flex items-center gap-2">
        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800">
          {formatDate(value)}
        </span>
        <span className="text-xs text-green-600">{daysText}</span>
      </div>
    );
  }

  return <span>{formatDate(value)}</span>;
}

// Cache for related records: { moduleName: { recordId: recordName } }
interface RelatedRecordsLookup {
  [moduleName: string]: { [id: number]: string };
}

export default function RecordsList() {
  const { moduleName } = useParams<{ moduleName: string }>();
  const navigate = useNavigate();
  const { isAdmin } = useUser();
  const [module, setModule] = useState<Module | null>(null);
  const [records, setRecords] = useState<ModuleRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [relatedRecordsLookup, setRelatedRecordsLookup] = useState<RelatedRecordsLookup>({});
  const [usersLookup, setUsersLookup] = useState<{ [email: string]: string }>({});

  // Image viewer state
  const [viewerOpen, setViewerOpen] = useState(false);
  const [viewerImages, setViewerImages] = useState<string[]>([]);
  const [viewerIndex, setViewerIndex] = useState(0);

  // Grid state
  const gridRef = useRef<AgGridReact>(null);
  const [gridApi, setGridApi] = useState<GridApi | null>(null);
  const [searchText, setSearchText] = useState('');

  // Email popup state
  const [emailPopupOpen, setEmailPopupOpen] = useState(false);
  const [emailTo, setEmailTo] = useState('');
  const [emailSubject, setEmailSubject] = useState('');
  const [emailMessage, setEmailMessage] = useState('');
  const [emailSending, setEmailSending] = useState(false);
  const [emailError, setEmailError] = useState<string | null>(null);
  const [emailSuccess, setEmailSuccess] = useState(false);
  const [emailConfigStatus, setEmailConfigStatus] = useState<{configured: boolean; verified: boolean; error?: string; provider?: string} | null>(null);
  const [checkingEmailConfig, setCheckingEmailConfig] = useState(false);

  // Print label popup state
  const [printPopupOpen, setPrintPopupOpen] = useState(false);
  const [printRecord, setPrintRecord] = useState<ModuleRecord | null>(null);
  const [printSending, setPrintSending] = useState(false);
  const [printError, setPrintError] = useState<string | null>(null);
  const [printSuccess, setPrintSuccess] = useState(false);

  // Delete confirmation popup state
  const [deletePopupOpen, setDeletePopupOpen] = useState(false);
  const [deleteRecord, setDeleteRecord] = useState<ModuleRecord | null>(null);
  const [deleteChildrenCount, setDeleteChildrenCount] = useState<{
    totalCount: number;
    breakdown: Array<{ moduleName: string; displayName: string; count: number }>;
  } | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  // Email inbox state
  const [emailInboxOpen, setEmailInboxOpen] = useState(false);

  const recordService = useMemo(
    () => (moduleName ? createRecordService(moduleName) : null),
    [moduleName]
  );

  useEffect(() => {
    if (moduleName && recordService) {
      loadData();
    }
  }, [moduleName, recordService]);

  const loadData = async () => {
    if (!moduleName || !recordService) return;

    setLoading(true);
    setError(null);
    try {
      const [moduleData, recordsData] = await Promise.all([
        moduleService.getByName(moduleName),
        recordService.getAll(),
      ]);
      setModule(moduleData);
      setRecords(recordsData);

      // Load related records for relation fields and users for user fields
      if (moduleData?.fields) {
        const relationFields = moduleData.fields.filter(
          (f) => f.field_type === 'relation' && f.relation_module
        );
        const userFields = moduleData.fields.filter(
          (f) => f.field_type === 'user'
        );

        if (relationFields.length > 0) {
          const lookup: RelatedRecordsLookup = {};

          await Promise.all(
            relationFields.map(async (field) => {
              if (!field.relation_module) return;
              try {
                const relatedService = createRecordService(field.relation_module);
                const relatedRecords = await relatedService.getAll();
                lookup[field.relation_module] = {};
                relatedRecords.forEach((rec) => {
                  lookup[field.relation_module!][rec.id] = rec.name;
                });
              } catch (err) {
                console.error(`Failed to load related records for ${field.relation_module}:`, err);
              }
            })
          );

          setRelatedRecordsLookup(lookup);
        }

        // Load users if there are user fields
        if (userFields.length > 0) {
          try {
            const users = await userService.getAll();
            const userLookup: { [email: string]: string } = {};
            users.forEach((u: User) => {
              userLookup[u.email] = u.name || u.email;
            });
            setUsersLookup(userLookup);
          } catch (err) {
            console.error('Failed to load users:', err);
          }
        }
      }
    } catch (err) {
      console.error('Failed to load data:', err);
      setError('Failed to load module data. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // Open delete confirmation popup and check for children
  const handleDeleteClick = useCallback(async (record: ModuleRecord) => {
    if (!recordService) return;

    setDeleteRecord(record);
    setDeleteError(null);
    setDeleteChildrenCount(null);
    setDeletePopupOpen(true);
    setDeleteLoading(true);

    try {
      // Check for child records
      const childrenCount = await recordService.getChildrenCount(record.id);
      setDeleteChildrenCount(childrenCount);
    } catch (err) {
      // If the endpoint doesn't exist or fails, just proceed without warning
      console.error('Failed to check children count:', err);
      setDeleteChildrenCount({ totalCount: 0, breakdown: [] });
    } finally {
      setDeleteLoading(false);
    }
  }, [recordService]);

  // Confirm and execute delete
  const handleConfirmDelete = useCallback(async () => {
    if (!recordService || !deleteRecord) return;

    setDeleteLoading(true);
    setDeleteError(null);

    try {
      await recordService.delete(deleteRecord.id);
      setRecords(prev => prev.filter((r) => r.id !== deleteRecord.id));
      setDeletePopupOpen(false);
      setDeleteRecord(null);
      setDeleteChildrenCount(null);
    } catch (err) {
      console.error('Failed to delete record:', err);
      setDeleteError('Failed to delete record. Please try again.');
    } finally {
      setDeleteLoading(false);
    }
  }, [recordService, deleteRecord]);

  // Handle image click to open viewer
  const handleImageClick = useCallback((record: ModuleRecord) => {
    if (record.images && record.images.length > 0) {
      setViewerImages(record.images.map(img => `${API_BASE}${img.image_path}`));
      setViewerIndex(0);
      setViewerOpen(true);
    }
  }, []);

  // Handle email click to open email popup
  const handleEmailClick = useCallback((record: ModuleRecord) => {
    // Build subject: "Visitor - [Name]"
    const subject = `Visitor - ${record.name}`;

    // Build message with all record data
    const messageParts: string[] = [];
    messageParts.push(`Record: ${record.name}`);
    if (record.status) {
      messageParts.push(`Status: ${record.status}`);
    }

    // Add all custom fields
    if (module?.fields && record.data) {
      module.fields.forEach((field) => {
        let value = record.data?.[field.name];
        if (value !== undefined && value !== null && value !== '') {
          // For relation fields, resolve the ID to a name
          if (field.field_type === 'relation' && field.relation_module) {
            const lookup = relatedRecordsLookup[field.relation_module];
            if (lookup && lookup[Number(value)]) {
              value = lookup[Number(value)];
            }
          }
          // For user fields, resolve email to name
          if (field.field_type === 'user') {
            value = usersLookup[String(value)] || value;
          }
          messageParts.push(`${field.display_name}: ${value}`);
        }
      });
    }

    setEmailSubject(subject);
    setEmailMessage(messageParts.join('\n'));
    setEmailTo('');
    setEmailError(null);
    setEmailSuccess(false);
    setEmailPopupOpen(true);

    // Check email configuration status
    setCheckingEmailConfig(true);
    emailService.getStatus()
      .then(status => setEmailConfigStatus(status))
      .catch(() => setEmailConfigStatus({ configured: false, verified: false, error: 'Failed to check email status' }))
      .finally(() => setCheckingEmailConfig(false));
  }, [module, relatedRecordsLookup, usersLookup]);

  // Send email via server
  const handleSendEmail = useCallback(async () => {
    if (!emailTo || !emailSubject || !emailMessage) {
      setEmailError('Please fill in all required fields');
      return;
    }

    setEmailSending(true);
    setEmailError(null);
    setEmailSuccess(false);

    try {
      const result = await emailService.send({
        to: emailTo,
        subject: emailSubject,
        message: emailMessage,
      });

      if (result.success) {
        setEmailSuccess(true);
        // Close popup after a short delay to show success message
        setTimeout(() => {
          setEmailPopupOpen(false);
          setEmailSuccess(false);
        }, 1500);
      } else {
        setEmailError(result.error || 'Failed to send email');
      }
    } catch (error) {
      setEmailError(error instanceof Error ? error.message : 'Failed to send email');
    } finally {
      setEmailSending(false);
    }
  }, [emailTo, emailSubject, emailMessage]);

  // Handle print label click to open print popup
  const handlePrintClick = useCallback((record: ModuleRecord) => {
    setPrintRecord(record);
    setPrintError(null);
    setPrintSuccess(false);
    setPrintPopupOpen(true);
  }, []);

  // Add to print queue
  const handleAddToPrintQueue = useCallback(async () => {
    if (!printRecord || !module) return;

    setPrintSending(true);
    setPrintError(null);
    setPrintSuccess(false);

    try {
      await printQueueService.add({
        recordId: printRecord.id,
        moduleId: module.id,
        moduleName: module.name,
        recordName: printRecord.name,
      });

      setPrintSuccess(true);
      // Close popup after a short delay to show success message
      setTimeout(() => {
        setPrintPopupOpen(false);
        setPrintSuccess(false);
        setPrintRecord(null);
      }, 1500);
    } catch (error) {
      setPrintError(error instanceof Error ? error.message : 'Failed to add to print queue');
    } finally {
      setPrintSending(false);
    }
  }, [printRecord, module]);

  // Thumbnail renderer callback
  const ThumbnailRenderer = useCallback((params: { value: string | null; data: ModuleRecord }) => {
    return (
      <ThumbnailCellRenderer
        value={params.value}
        data={params.data}
        onImageClick={handleImageClick}
      />
    );
  }, [handleImageClick]);

  // Check if module has images feature enabled
  const hasImagesFeature = module?.config?.features?.includes('images');

  // Check if module has email feature enabled
  const hasEmailFeature = module?.config?.enableEmail === true;

  // Check if module has label print feature enabled
  const hasLabelPrintFeature = module?.config?.enableLabelPrint === true;

  // Check if module has email inbox feature enabled
  const hasEmailInboxFeature = module?.config?.enableEmailInbox === true;

  // Grid ready handler
  const onGridReady = useCallback((params: { api: GridApi }) => {
    setGridApi(params.api);
  }, []);

  // Filter text change handler
  const onFilterTextChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchText(e.target.value);
    gridApi?.setGridOption('quickFilterText', e.target.value);
  }, [gridApi]);

  // Export to Excel
  const exportToExcel = useCallback(() => {
    if (!gridApi || !module) return;

    const rowData: ModuleRecord[] = [];
    gridApi.forEachNodeAfterFilterAndSort((node) => {
      if (node.data) {
        rowData.push(node.data);
      }
    });

    // Build export data dynamically based on module fields
    const exportData = rowData.map((item) => {
      const row: Record<string, unknown> = {
        ID: item.id,
        Name: item.name,
        Status: item.status || '',
      };

      // Add module fields
      if (module.fields && item.data) {
        module.fields.forEach((field) => {
          let value: unknown = item.data?.[field.name] ?? '';

          // For relation fields, try to resolve name from lookup
          if (field.field_type === 'relation' && field.relation_module && value) {
            const lookup = relatedRecordsLookup[field.relation_module];
            if (lookup) {
              value = lookup[Number(value)] || value;
            }
          }

          // For user fields, try to resolve email to name
          if (field.field_type === 'user' && value) {
            value = usersLookup[String(value)] || value;
          }

          row[field.display_name] = value;
        });
      }

      return row;
    });

    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, module.display_name);
    XLSX.writeFile(wb, `${moduleName}_${new Date().toISOString().split('T')[0]}.xlsx`);
  }, [gridApi, module, moduleName, relatedRecordsLookup, usersLookup]);

  // Generate columns based on module fields
  const columnDefs = useMemo<ColDef[]>(() => {
    const cols: ColDef[] = [];

    // Add thumbnail column if module has images feature
    if (hasImagesFeature) {
      cols.push({
        headerName: '',
        field: 'thumbnail',
        width: 60,
        sortable: false,
        filter: false,
        cellRenderer: ThumbnailRenderer,
      });
    }

    cols.push(
      {
        headerName: 'ID',
        field: 'id',
        width: 70,
        maxWidth: 100,
        sortable: true,
      },
      {
        headerName: 'Name',
        field: 'name',
        minWidth: 150,
        flex: 2,
        sortable: true,
        filter: true,
        cellRenderer: (params: ICellRendererParams) => (
          <NameCellRenderer value={params.value} data={params.data} />
        ),
      }
    );

    // Add columns for each module field (only those with show_in_list enabled)
    if (module?.fields) {
      module.fields.filter(f => f.show_in_list !== 0).forEach((field) => {
        const colDef: ColDef = {
          headerName: field.display_name,
          valueGetter: (params) => {
            const data = params.data?.data;
            const rawValue = data ? data[field.name] : '';

            // For relation fields, resolve the ID to a name
            if (field.field_type === 'relation' && field.relation_module && rawValue) {
              const lookup = relatedRecordsLookup[field.relation_module];
              if (lookup) {
                return lookup[Number(rawValue)] || rawValue;
              }
            }

            // For user fields, resolve email to name
            if (field.field_type === 'user' && rawValue) {
              return usersLookup[String(rawValue)] || rawValue;
            }

            return rawValue;
          },
          flex: 1,
          sortable: true,
          filter: true,
        };

        // Add cell renderer for all date fields (with optional warning colors)
        if (field.field_type === 'date') {
          colDef.cellRenderer = (params: ICellRendererParams) => {
            const data = params.data?.data;
            const rawValue = data ? data[field.name] : null;
            return <DateCellRenderer value={rawValue} field={field} />;
          };
        }

        cols.push(colDef);
      });
    }

    // Add status column
    cols.push({
      headerName: 'Status',
      field: 'status',
      minWidth: 90,
      maxWidth: 120,
      sortable: true,
      cellRenderer: (params: ICellRendererParams) => {
        const status = params.value as string;
        const colors: Record<string, string> = {
          active: 'bg-green-100 text-green-800',
          inactive: 'bg-gray-100 text-gray-800',
          pending: 'bg-yellow-100 text-yellow-800',
          archived: 'bg-red-100 text-red-800',
        };
        return (
          <span
            className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
              colors[status] || 'bg-gray-100 text-gray-800'
            }`}
          >
            {status}
          </span>
        );
      },
    });

    // Add assigned_to column
    cols.push({
      headerName: 'Assigned To',
      field: 'assigned_to',
      minWidth: 120,
      flex: 1,
      sortable: true,
      filter: true,
      valueGetter: (params) => {
        const email = params.data?.assigned_to;
        if (!email) return '';
        // Try to resolve email to user name
        return usersLookup[email] || email;
      },
      cellRenderer: (params: ICellRendererParams) => {
        const email = params.data?.assigned_to;
        if (!email) return <span className="text-gray-400">-</span>;
        const displayName = usersLookup[email] || email;
        return (
          <span className="inline-flex items-center gap-1">
            <span className="w-6 h-6 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center text-xs font-medium">
              {displayName.charAt(0).toUpperCase()}
            </span>
            <span className="truncate">{displayName}</span>
          </span>
        );
      },
    });

    // Add updated_by column
    cols.push({
      headerName: 'Updated By',
      field: 'updated_by',
      minWidth: 120,
      flex: 1,
      sortable: true,
      filter: true,
      valueGetter: (params) => {
        const email = params.data?.updated_by;
        if (!email) return '-';
        // Try to resolve email to user name
        return usersLookup[email] || email;
      },
    });

    // Add updated_at column
    cols.push({
      headerName: 'Updated At',
      field: 'updated_at',
      minWidth: 140,
      maxWidth: 180,
      sortable: true,
      cellRenderer: (params: ICellRendererParams) => {
        const value = params.value;
        if (!value) return <span className="text-gray-400">-</span>;
        try {
          const date = new Date(value);
          // ISO/European format: YYYY-MM-DD HH:mm
          const dateStr = date.toISOString().split('T')[0];
          const timeStr = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
          return (
            <span className="text-sm text-gray-600">
              {dateStr} {timeStr}
            </span>
          );
        } catch {
          return <span>{value}</span>;
        }
      },
    });

    // Add actions column
    const extraButtons = (hasEmailFeature ? 1 : 0) + (hasLabelPrintFeature ? 1 : 0);
    cols.push({
      headerName: 'Actions',
      width: 100 + (extraButtons * 30),
      sortable: false,
      filter: false,
      cellRenderer: (params: ICellRendererParams<ModuleRecord>) => {
        return (
          <div className="flex items-center gap-1">
            {hasEmailFeature && (
              <button
                onClick={() => params.data && handleEmailClick(params.data)}
                className="p-1.5 text-green-600 hover:bg-green-50 rounded"
                title="Send Email"
              >
                <EnvelopeIcon className="h-4 w-4" />
              </button>
            )}
            {hasLabelPrintFeature && (
              <button
                onClick={() => params.data && handlePrintClick(params.data)}
                className="p-1.5 text-purple-600 hover:bg-purple-50 rounded"
                title="Print Label"
              >
                <QrCodeIcon className="h-4 w-4" />
              </button>
            )}
            <button
              onClick={() =>
                navigate(`/records/${moduleName}/${params.data?.id}`)
              }
              className="p-1.5 text-blue-600 hover:bg-blue-50 rounded"
              title="Edit"
            >
              <PencilIcon className="h-4 w-4" />
            </button>
            {isAdmin && (
              <button
                onClick={() => params.data && handleDeleteClick(params.data)}
                className="p-1.5 text-red-600 hover:bg-red-50 rounded"
                title="Delete"
              >
                <TrashIcon className="h-4 w-4" />
              </button>
            )}
          </div>
        );
      },
    });

    return cols;
  }, [module, moduleName, navigate, relatedRecordsLookup, usersLookup, hasImagesFeature, hasEmailFeature, hasLabelPrintFeature, ThumbnailRenderer, handleEmailClick, handlePrintClick, handleDeleteClick, isAdmin]);

  if (loading) {
    return (
      <div className="p-8 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  if (error || !module) {
    return (
      <div className="p-8">
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700">
          {error || 'Module not found'}
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-gray-900">
            {module.display_name}
          </h1>
          {module.description && (
            <p className="text-gray-500 mt-1 text-sm md:text-base">{module.description}</p>
          )}
        </div>
        <div className="flex items-center gap-2">
          {hasEmailInboxFeature && (
            <button
              onClick={() => setEmailInboxOpen(true)}
              className="flex items-center gap-2 px-3 py-2 text-blue-700 bg-blue-100 rounded-lg hover:bg-blue-200 transition-colors"
              title="Email Inbox"
            >
              <InboxArrowDownIcon className="h-4 w-4" />
              <span className="hidden sm:inline">Inbox</span>
            </button>
          )}
          <button
            onClick={loadData}
            className="flex items-center gap-2 px-3 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
          >
            <ArrowPathIcon className="h-4 w-4" />
            <span className="hidden sm:inline">Refresh</span>
          </button>
          <button
            onClick={() => navigate(`/records/${moduleName}/new`)}
            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg transition-colors"
          >
            <PlusIcon className="h-5 w-5" />
            <span className="hidden sm:inline">New {module.display_name.replace(/s$/, '')}</span>
            <span className="sm:hidden">New</span>
          </button>
        </div>
      </div>

      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 sm:gap-4 mb-4">
        <div className="relative flex-1">
          <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
          <input
            type="text"
            placeholder={`Search ${module.display_name.toLowerCase()}...`}
            value={searchText}
            onChange={onFilterTextChange}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>
        <button
          onClick={exportToExcel}
          className="flex items-center justify-center gap-2 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors whitespace-nowrap"
        >
          <ArrowDownTrayIcon className="h-5 w-5 text-gray-500" />
          <span className="hidden sm:inline">Export to Excel</span>
          <span className="sm:hidden">Export</span>
        </button>
      </div>

      {/* Grid */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden overflow-x-auto">
        <div className="ag-theme-alpine" style={{ height: 'calc(100vh - 280px)', minHeight: 400, width: '100%' }}>
          <AgGridReact
            ref={gridRef}
            rowData={records}
            columnDefs={columnDefs}
            defaultColDef={{
              resizable: true,
              sortable: true,
              filter: true,
              minWidth: 80,
            }}
            onGridReady={onGridReady}
            onFirstDataRendered={(params) => {
              params.api.autoSizeAllColumns();
            }}
            animateRows={true}
            pagination={true}
            paginationPageSize={20}
            paginationPageSizeSelector={[10, 20, 50, 100]}
            rowHeight={50}
            suppressColumnVirtualisation={true}
          />
        </div>
      </div>

      {/* Image Viewer */}
      {viewerOpen && viewerImages.length > 0 && (
        <ImageViewer
          images={viewerImages}
          currentIndex={viewerIndex}
          onClose={() => setViewerOpen(false)}
          onIndexChange={setViewerIndex}
        />
      )}

      {/* Email Popup */}
      {emailPopupOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl mx-4 overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 bg-gray-50">
              <div className="flex items-center gap-3">
                <EnvelopeIcon className="h-6 w-6 text-blue-600" />
                <h2 className="text-lg font-semibold text-gray-900">New Email</h2>
              </div>
              <button
                onClick={() => setEmailPopupOpen(false)}
                className="p-1 hover:bg-gray-200 rounded-full transition-colors"
              >
                <XMarkIcon className="h-5 w-5 text-gray-500" />
              </button>
            </div>

            {/* Email Configuration Status */}
            {checkingEmailConfig && (
              <div className="mx-6 mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg text-blue-700 text-sm flex items-center gap-2">
                <div className="animate-spin rounded-full h-4 w-4 border-2 border-blue-600 border-t-transparent" />
                Checking email configuration...
              </div>
            )}
            {!checkingEmailConfig && emailConfigStatus && !emailConfigStatus.configured && (
              <div className="mx-6 mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg text-yellow-800 text-sm">
                <strong>Email not configured:</strong> SMTP settings are missing. Please contact your administrator to configure email settings (SMTP_USER, SMTP_PASSWORD).
              </div>
            )}
            {!checkingEmailConfig && emailConfigStatus && emailConfigStatus.configured && !emailConfigStatus.verified && (
              <div className="mx-6 mt-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
                <strong>Email configuration error:</strong> {emailConfigStatus.error || 'Unable to connect to email server. Please check SMTP credentials.'}
              </div>
            )}
            {!checkingEmailConfig && emailConfigStatus?.configured && emailConfigStatus?.verified && (
              <div className="mx-6 mt-4 p-3 bg-green-50 border border-green-200 rounded-lg text-green-700 text-sm">
                Email server connected and ready{emailConfigStatus.provider ? ` (${emailConfigStatus.provider})` : ''}.
              </div>
            )}

            {/* Email Form */}
            <div className="p-6 space-y-4">
              {/* To Field */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">To:</label>
                <input
                  type="email"
                  value={emailTo}
                  onChange={(e) => setEmailTo(e.target.value)}
                  placeholder="recipient@example.com"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              {/* Subject Field */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Subject:</label>
                <input
                  type="text"
                  value={emailSubject}
                  onChange={(e) => setEmailSubject(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              {/* Message Field */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Message:</label>
                <textarea
                  value={emailMessage}
                  onChange={(e) => setEmailMessage(e.target.value)}
                  rows={10}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none font-mono text-sm"
                />
              </div>
            </div>

            {/* Status Messages */}
            {emailError && (
              <div className="mx-6 mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
                {emailError}
              </div>
            )}
            {emailSuccess && (
              <div className="mx-6 mb-4 p-3 bg-green-50 border border-green-200 rounded-lg text-green-700 text-sm">
                Email sent successfully!
              </div>
            )}

            {/* Footer */}
            <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-200 bg-gray-50">
              <button
                onClick={() => {
                  setEmailPopupOpen(false);
                  setEmailError(null);
                  setEmailSuccess(false);
                }}
                disabled={emailSending}
                className="px-4 py-2 text-gray-700 bg-gray-200 hover:bg-gray-300 rounded-lg transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleSendEmail}
                disabled={emailSending || emailSuccess || checkingEmailConfig || !!(emailConfigStatus && !emailConfigStatus.verified)}
                title={emailConfigStatus && !emailConfigStatus.verified ? 'Email server not configured or not connected' : undefined}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {emailSending ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent" />
                    Sending...
                  </>
                ) : (
                  <>
                    <EnvelopeIcon className="h-4 w-4" />
                    Send Email
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Email Inbox Modal */}
      {emailInboxOpen && module && (
        <EmailInbox
          module={module}
          onClose={() => setEmailInboxOpen(false)}
        />
      )}

      {/* Print Label Popup */}
      {printPopupOpen && printRecord && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md mx-4 overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 bg-gray-50">
              <div className="flex items-center gap-3">
                <QrCodeIcon className="h-6 w-6 text-purple-600" />
                <h2 className="text-lg font-semibold text-gray-900">Print Label</h2>
              </div>
              <button
                onClick={() => {
                  setPrintPopupOpen(false);
                  setPrintRecord(null);
                }}
                className="p-1 hover:bg-gray-200 rounded-full transition-colors"
              >
                <XMarkIcon className="h-5 w-5 text-gray-500" />
              </button>
            </div>

            {/* Content */}
            <div className="p-6">
              <div className="bg-gray-50 rounded-lg p-4 mb-4">
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-gray-500">ID:</span>
                    <span className="text-lg font-bold text-gray-900">{printRecord.id}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-gray-500">Name:</span>
                    <span className="text-lg font-semibold text-gray-900">{printRecord.name}</span>
                  </div>
                </div>
              </div>

              <p className="text-sm text-gray-500 text-center">
                This will add the record to the print queue for label printing.
              </p>
            </div>

            {/* Status Messages */}
            {printError && (
              <div className="mx-6 mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
                {printError}
              </div>
            )}
            {printSuccess && (
              <div className="mx-6 mb-4 p-3 bg-green-50 border border-green-200 rounded-lg text-green-700 text-sm">
                Added to print queue successfully!
              </div>
            )}

            {/* Footer */}
            <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-200 bg-gray-50">
              <button
                onClick={() => {
                  setPrintPopupOpen(false);
                  setPrintRecord(null);
                  setPrintError(null);
                  setPrintSuccess(false);
                }}
                disabled={printSending}
                className="px-4 py-2 text-gray-700 bg-gray-200 hover:bg-gray-300 rounded-lg transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleAddToPrintQueue}
                disabled={printSending || printSuccess}
                className="flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {printSending ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent" />
                    Adding...
                  </>
                ) : (
                  <>
                    <QrCodeIcon className="h-4 w-4" />
                    Print
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Popup */}
      {deletePopupOpen && deleteRecord && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md mx-4 overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 bg-red-50">
              <div className="flex items-center gap-3">
                <TrashIcon className="h-6 w-6 text-red-600" />
                <h2 className="text-lg font-semibold text-gray-900">Delete Record</h2>
              </div>
              <button
                onClick={() => {
                  setDeletePopupOpen(false);
                  setDeleteRecord(null);
                  setDeleteChildrenCount(null);
                  setDeleteError(null);
                }}
                className="p-1 hover:bg-red-100 rounded-full transition-colors"
              >
                <XMarkIcon className="h-5 w-5 text-gray-500" />
              </button>
            </div>

            {/* Content */}
            <div className="p-6">
              {deleteLoading && !deleteChildrenCount ? (
                <div className="flex items-center justify-center py-4">
                  <div className="animate-spin rounded-full h-6 w-6 border-2 border-red-600 border-t-transparent" />
                  <span className="ml-2 text-gray-600">Checking for related items...</span>
                </div>
              ) : (
                <>
                  <p className="text-gray-700 mb-4">
                    Are you sure you want to delete <strong>"{deleteRecord.name}"</strong>?
                  </p>

                  {/* Warning for child records */}
                  {deleteChildrenCount && deleteChildrenCount.totalCount > 0 && (
                    <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-4">
                      <div className="flex items-start gap-3">
                        <div className="flex-shrink-0">
                          <svg className="h-5 w-5 text-red-600" viewBox="0 0 20 20" fill="currentColor">
                            <path fillRule="evenodd" d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.17 2.625-1.516 2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625L8.485 2.495zM10 5a.75.75 0 01.75.75v3.5a.75.75 0 01-1.5 0v-3.5A.75.75 0 0110 5zm0 9a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
                          </svg>
                        </div>
                        <div>
                          <h3 className="text-sm font-semibold text-red-800">
                            Warning: This will also delete {deleteChildrenCount.totalCount} related item{deleteChildrenCount.totalCount !== 1 ? 's' : ''}
                          </h3>
                          <div className="mt-2 text-sm text-red-700">
                            <ul className="list-disc pl-5 space-y-1">
                              {deleteChildrenCount.breakdown.map((item) => (
                                <li key={item.moduleName}>
                                  {item.count} {item.displayName}
                                </li>
                              ))}
                            </ul>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  <p className="text-sm text-gray-500">
                    This action cannot be undone.
                  </p>
                </>
              )}
            </div>

            {/* Error Message */}
            {deleteError && (
              <div className="mx-6 mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
                {deleteError}
              </div>
            )}

            {/* Footer */}
            <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-200 bg-gray-50">
              <button
                onClick={() => {
                  setDeletePopupOpen(false);
                  setDeleteRecord(null);
                  setDeleteChildrenCount(null);
                  setDeleteError(null);
                }}
                disabled={deleteLoading}
                className="px-4 py-2 text-gray-700 bg-gray-200 hover:bg-gray-300 rounded-lg transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmDelete}
                disabled={deleteLoading || !deleteChildrenCount}
                className="flex items-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {deleteLoading ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent" />
                    Deleting...
                  </>
                ) : (
                  <>
                    <TrashIcon className="h-4 w-4" />
                    Delete{deleteChildrenCount && deleteChildrenCount.totalCount > 0 ? ' All' : ''}
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
