import { useEffect, useState, useMemo, useRef } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import {
  ArrowLeftIcon,
  PhotoIcon,
  DocumentIcon,
  ClockIcon,
  LinkIcon,
  TrashIcon,
  PlusIcon,
  CloudArrowUpIcon,
  StarIcon,
  ArrowDownTrayIcon,
  ArrowTopRightOnSquareIcon,
  CheckIcon,
} from '@heroicons/react/24/outline';
import { StarIcon as StarIconSolid } from '@heroicons/react/24/solid';
import { useUser } from '../../context/UserContext';
import { useToast } from '../../context/ToastContext';
import UserAvatar from '../../components/UserAvatar';
import ImageViewer from '../../components/ImageViewer';
import RichTextEditor from '../../components/RichTextEditor';
import SubModuleGrid from '../../components/SubModuleGrid';
import {
  moduleService,
  createRecordService,
  userService,
  type Module,
  type ModuleRecord,
  type ModuleField,
  type RecordImage,
  type RecordDocument,
  type RecordHistory,
  type RecordLink,
  type User,
} from '../../services/api';

// API base URL for serving static files (images, documents)
const API_BASE = import.meta.env.VITE_API_URL?.replace('/api', '') || 'http://localhost:3001';

// Cache for related module records
interface RelatedRecordsCache {
  [moduleName: string]: { id: number; name: string }[];
}

type TabType = 'details' | 'images' | 'documents' | 'history' | 'links';

export default function RecordEdit() {
  const { moduleName, id } = useParams<{ moduleName: string; id: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { user } = useUser();

  // Get parent record ID from query params (when creating child record)
  const parentRecordId = searchParams.get('parentRecordId');
  const parentModuleName = searchParams.get('parentModule');
  const { showToast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const docInputRef = useRef<HTMLInputElement>(null);

  const [module, setModule] = useState<Module | null>(null);
  const [record, setRecord] = useState<ModuleRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<TabType>('details');

  // Form state
  const [name, setName] = useState('');
  const [status, setStatus] = useState('active');
  const [assignedTo, setAssignedTo] = useState<string | null>(null);
  const [fieldValues, setFieldValues] = useState<Record<string, string | number | boolean>>({});

  // Related data
  const [images, setImages] = useState<RecordImage[]>([]);
  const [documents, setDocuments] = useState<RecordDocument[]>([]);
  const [history, setHistory] = useState<RecordHistory[]>([]);
  const [links, setLinks] = useState<RecordLink[]>([]);
  const [allUsers, setAllUsers] = useState<User[]>([]);
  const [relatedRecordsCache, setRelatedRecordsCache] = useState<RelatedRecordsCache>({});

  // Quick-add modal for relation fields
  const [quickAddModal, setQuickAddModal] = useState<{
    open: boolean;
    moduleName: string;
    moduleDisplayName: string;
    fieldName: string;
  } | null>(null);
  const [quickAddName, setQuickAddName] = useState('');
  const [quickAddSaving, setQuickAddSaving] = useState(false);

  // Image viewer
  const [viewerOpen, setViewerOpen] = useState(false);
  const [viewerIndex, setViewerIndex] = useState(0);

  // Upload states
  const [uploadingImage, setUploadingImage] = useState(false);
  const [uploadingDoc, setUploadingDoc] = useState(false);

  // Pagination for history
  const [historyPage, setHistoryPage] = useState(1);
  const historyPerPage = 10;

  const isNew = id === 'new';
  const recordService = useMemo(
    () => (moduleName ? createRecordService(moduleName) : null),
    [moduleName]
  );

  useEffect(() => {
    loadData();
  }, [moduleName, id]);

  // Load records from related modules for relation fields and users
  const loadRelatedRecords = async (moduleData: Module) => {
    const relationFields = moduleData.fields?.filter(f => f.field_type === 'relation' && f.relation_module) || [];
    const cache: RelatedRecordsCache = {};

    for (const field of relationFields) {
      if (field.relation_module && !cache[field.relation_module]) {
        try {
          const relatedService = createRecordService(field.relation_module);
          const records = await relatedService.getAll();
          cache[field.relation_module] = records.map((r: ModuleRecord) => ({ id: r.id, name: r.name }));
        } catch (err) {
          console.error(`Failed to load records from ${field.relation_module}:`, err);
          cache[field.relation_module] = [];
        }
      }
    }

    // Always load users for assigned_to dropdown and user fields
    try {
      const users = await userService.getAll();
      setAllUsers(users);
    } catch (err) {
      console.error('Failed to load users:', err);
      setAllUsers([]);
    }

    setRelatedRecordsCache(cache);
  };

  const loadData = async () => {
    if (!moduleName || !recordService) return;

    setLoading(true);
    try {
      const moduleData = await moduleService.getByName(moduleName);
      setModule(moduleData);
      setStatus(moduleData.config?.defaultStatus || 'active');

      // Load related records for any relation fields
      await loadRelatedRecords(moduleData);

      if (!isNew && id) {
        const recordId = parseInt(id);
        const recordData = await recordService.getById(recordId);
        setRecord(recordData);
        setName(recordData.name);
        setStatus(recordData.status);
        setAssignedTo(recordData.assigned_to || null);
        // Convert data to proper types
        const dataValues: Record<string, string | number | boolean> = {};
        if (recordData.data) {
          Object.entries(recordData.data).forEach(([key, value]) => {
            if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
              dataValues[key] = value;
            } else if (value !== null && value !== undefined) {
              dataValues[key] = String(value);
            }
          });
        }
        setFieldValues(dataValues);
        setImages(recordData.images || []);

        // Fetch related data separately (documents, history, links)
        const [docsData, historyData, linksData] = await Promise.all([
          recordService.getDocuments(recordId).catch(() => []),
          recordService.getHistory(recordId).catch(() => []),
          recordService.getLinks(recordId).catch(() => []),
        ]);
        setDocuments(docsData);
        setHistory(historyData);
        setLinks(linksData);
      }
    } catch (err) {
      console.error('Failed to load data:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!recordService || !module) return;

    setSaving(true);
    try {
      const userEmail = user?.email || undefined;

      if (isNew) {
        const data = {
          name,
          status,
          data: fieldValues,
          createdBy: userEmail,
          parentRecordId: parentRecordId ? parseInt(parentRecordId) : undefined,
          assignedTo: assignedTo || undefined,
        };
        const created = await recordService.create(data);
        showToast('Record created successfully', 'success');

        // If this was a child record, navigate back to parent
        if (parentRecordId && parentModuleName) {
          navigate(`/records/${parentModuleName}/${parentRecordId}`, { replace: true });
        } else {
          navigate(`/records/${moduleName}/${created.id}`, { replace: true });
        }
      } else if (id) {
        const data = {
          name,
          status,
          data: fieldValues,
          updatedBy: userEmail,
          assignedTo: assignedTo,
        };
        await recordService.update(parseInt(id), data);
        await loadData();
        showToast('Record saved successfully', 'success');
      }
    } catch (err) {
      console.error('Failed to save record:', err);
      showToast('Failed to save record', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!recordService || !record) {
      showToast('Please save the record first before uploading images', 'error');
      return;
    }
    if (!e.target.files?.length) return;

    const file = e.target.files[0];
    setUploadingImage(true);
    const reader = new FileReader();
    reader.onload = async () => {
      const base64 = reader.result as string;
      try {
        const updated = await recordService.addImage(record.id, base64, user?.email);
        setImages(updated.images || []);
        showToast('Image uploaded successfully', 'success');
        await loadData();
      } catch (err) {
        console.error('Failed to upload image:', err);
        showToast('Failed to upload image', 'error');
      } finally {
        setUploadingImage(false);
      }
    };
    reader.onerror = () => {
      showToast('Failed to read file', 'error');
      setUploadingImage(false);
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const handleDocumentUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!recordService || !record) {
      showToast('Please save the record first before uploading documents', 'error');
      return;
    }
    if (!e.target.files?.length) return;

    const file = e.target.files[0];
    setUploadingDoc(true);
    const reader = new FileReader();
    reader.onload = async () => {
      const base64 = reader.result as string;
      try {
        const updated = await recordService.addDocument(record.id, {
          name: file.name,
          file: base64,
          uploadedBy: user?.email,
        });
        setDocuments((prev) => [...prev, updated]);
        showToast('Document uploaded successfully', 'success');
        await loadData();
      } catch (err) {
        console.error('Failed to upload document:', err);
        showToast('Failed to upload document', 'error');
      } finally {
        setUploadingDoc(false);
      }
    };
    reader.onerror = () => {
      showToast('Failed to read file', 'error');
      setUploadingDoc(false);
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const handleDeleteImage = async (imageId: number) => {
    if (!recordService || !record) return;
    if (!confirm('Delete this image?')) return;

    try {
      await recordService.deleteImage(record.id, imageId);
      setImages(images.filter((img) => img.id !== imageId));
    } catch (err) {
      console.error('Failed to delete image:', err);
    }
  };

  const handleSetPrimary = async (imageId: number) => {
    if (!recordService || !record || images.length === 0) return;

    const newOrder = [
      imageId,
      ...images.filter(img => img.id !== imageId).map(img => img.id)
    ];

    try {
      const updated = await recordService.reorderImages(record.id, newOrder);
      setImages(updated.images || []);
    } catch (err) {
      console.error('Failed to reorder images:', err);
    }
  };

  const handleAddLink = async () => {
    if (!recordService || !record) {
      showToast('Please save the record first before adding links', 'error');
      return;
    }

    const url = prompt('Enter URL:');
    if (!url) return;

    const title = prompt('Enter title (optional):') || url;

    try {
      const newLink = await recordService.addLink(record.id, {
        url,
        title,
        createdBy: user?.email,
      });
      setLinks((prev) => [...prev, newLink]);
      showToast('Link added successfully', 'success');
    } catch (err) {
      console.error('Failed to add link:', err);
      showToast('Failed to add link', 'error');
    }
  };

  const openImageViewer = (index: number) => {
    setViewerIndex(index);
    setViewerOpen(true);
  };

  // Quick-add handlers for relation fields
  const openQuickAddModal = async (relationModule: string, fieldName: string) => {
    try {
      const relatedModuleData = await moduleService.getByName(relationModule);
      setQuickAddModal({
        open: true,
        moduleName: relationModule,
        moduleDisplayName: relatedModuleData.display_name,
        fieldName,
      });
      setQuickAddName('');
    } catch (err) {
      console.error('Failed to load related module:', err);
      showToast('Failed to open quick add', 'error');
    }
  };

  const handleQuickAdd = async () => {
    if (!quickAddModal || !quickAddName.trim()) return;

    setQuickAddSaving(true);
    try {
      const relatedService = createRecordService(quickAddModal.moduleName);
      const newRecord = await relatedService.create({
        name: quickAddName.trim(),
        status: 'active',
        data: {},
      });

      // Update the cache with the new record
      setRelatedRecordsCache((prev) => ({
        ...prev,
        [quickAddModal.moduleName]: [
          ...(prev[quickAddModal.moduleName] || []),
          { id: newRecord.id, name: newRecord.name },
        ],
      }));

      // Set the field value to the new record
      setFieldValues((prev) => ({
        ...prev,
        [quickAddModal.fieldName]: newRecord.id,
      }));

      showToast(`${quickAddModal.moduleDisplayName} created successfully`, 'success');
      setQuickAddModal(null);
    } catch (err) {
      console.error('Failed to create record:', err);
      showToast('Failed to create record', 'error');
    } finally {
      setQuickAddSaving(false);
    }
  };

  const renderFieldInput = (field: ModuleField) => {
    const value = fieldValues[field.name] ?? field.default_value ?? '';

    switch (field.field_type) {
      case 'textarea':
        return (
          <RichTextEditor
            value={String(value)}
            onChange={(newValue) =>
              setFieldValues({ ...fieldValues, [field.name]: newValue })
            }
            placeholder={`Enter ${field.display_name.toLowerCase()}...`}
          />
        );
      case 'select':
        return (
          <select
            value={String(value)}
            onChange={(e) =>
              setFieldValues({ ...fieldValues, [field.name]: e.target.value })
            }
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
          >
            <option value="">Select...</option>
            {field.options?.map((opt: string) => (
              <option key={opt} value={opt}>
                {opt}
              </option>
            ))}
          </select>
        );
      case 'boolean':
        return (
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={Boolean(value)}
              onChange={(e) =>
                setFieldValues({ ...fieldValues, [field.name]: e.target.checked })
              }
              className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            />
            <span className="text-gray-700">Yes</span>
          </label>
        );
      case 'number':
        return (
          <input
            type="number"
            value={String(value)}
            onChange={(e) =>
              setFieldValues({ ...fieldValues, [field.name]: parseFloat(e.target.value) || 0 })
            }
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
          />
        );
      case 'date':
        return (
          <input
            type="date"
            value={String(value)}
            onChange={(e) =>
              setFieldValues({ ...fieldValues, [field.name]: e.target.value })
            }
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
          />
        );
      case 'email':
        return (
          <input
            type="email"
            value={String(value)}
            onChange={(e) =>
              setFieldValues({ ...fieldValues, [field.name]: e.target.value })
            }
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
          />
        );
      case 'url':
        return (
          <input
            type="url"
            value={String(value)}
            onChange={(e) =>
              setFieldValues({ ...fieldValues, [field.name]: e.target.value })
            }
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
          />
        );
      case 'relation':
        const relatedRecords = field.relation_module ? relatedRecordsCache[field.relation_module] || [] : [];
        return (
          <div className="flex gap-2">
            <select
              value={String(value)}
              onChange={(e) =>
                setFieldValues({ ...fieldValues, [field.name]: e.target.value })
              }
              className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Select...</option>
              {relatedRecords.map((rec) => (
                <option key={rec.id} value={rec.id}>
                  {rec.name}
                </option>
              ))}
            </select>
            {field.relation_module && (
              <button
                type="button"
                onClick={() => openQuickAddModal(field.relation_module!, field.name)}
                className="px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
                title="Add new"
              >
                <PlusIcon className="h-5 w-5" />
              </button>
            )}
          </div>
        );
      case 'user':
        return (
          <select
            value={String(value)}
            onChange={(e) =>
              setFieldValues({ ...fieldValues, [field.name]: e.target.value })
            }
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
          >
            <option value="">Select user...</option>
            {allUsers.map((u) => (
              <option key={u.id} value={u.email}>
                {u.name || u.email}
              </option>
            ))}
          </select>
        );
      default:
        return (
          <input
            type="text"
            value={String(value)}
            onChange={(e) =>
              setFieldValues({ ...fieldValues, [field.name]: e.target.value })
            }
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
          />
        );
    }
  };

  const paginatedHistory = history.slice(
    (historyPage - 1) * historyPerPage,
    historyPage * historyPerPage
  );
  const totalHistoryPages = Math.ceil(history.length / historyPerPage);

  if (loading) {
    return (
      <div className="p-8 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  if (!module) {
    return (
      <div className="p-8">
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700">
          Module not found
        </div>
      </div>
    );
  }

  const tabs: { id: TabType; label: string; icon: React.ComponentType<{ className?: string }>; count?: number }[] = [
    { id: 'details', label: 'Details', icon: DocumentIcon },
  ];

  if (!isNew && module.config?.features) {
    if (module.config.features.includes('images')) {
      tabs.push({ id: 'images', label: 'Images', icon: PhotoIcon, count: images.length });
    }
    if (module.config.features.includes('documents')) {
      tabs.push({ id: 'documents', label: 'Documents', icon: DocumentIcon, count: documents.length });
    }
    if (module.config.features.includes('history')) {
      tabs.push({ id: 'history', label: 'History', icon: ClockIcon, count: history.length });
    }
    if (module.config.features.includes('links')) {
      tabs.push({ id: 'links', label: 'Links', icon: LinkIcon, count: links.length });
    }
  }

  return (
    <div className="p-8">
      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <button
          onClick={() => navigate(`/records/${moduleName}`)}
          className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
        >
          <ArrowLeftIcon className="h-5 w-5 text-gray-500" />
        </button>
        <div>
          <h1 className="text-3xl font-bold text-gray-900">
            {isNew ? `New ${module.display_name.replace(/s$/, '')}` : name || 'Untitled'}
          </h1>
          <p className="text-gray-500 mt-1">
            {isNew ? `Create a new ${module.display_name.toLowerCase().replace(/s$/, '')} record.` : module.display_name}
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200 mb-6">
        <nav className="flex gap-4">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-3 border-b-2 transition-colors ${
                activeTab === tab.id
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              <tab.icon className="h-4 w-4" />
              {tab.label}
              {tab.count !== undefined && (
                <span className="ml-1 px-2 py-0.5 bg-gray-100 text-gray-600 text-xs rounded-full">
                  {tab.count}
                </span>
              )}
            </button>
          ))}
        </nav>
      </div>

      {/* Content */}
      {activeTab === 'details' && (
        <div className={`grid grid-cols-1 ${module.config?.features?.includes('images') && !isNew ? 'lg:grid-cols-3' : ''} gap-8`}>
          {/* Left column - Form fields */}
          <div className={module.config?.features?.includes('images') && !isNew ? 'lg:col-span-2' : ''}>
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Basic Information</h2>
              <div className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Name <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Status
                    </label>
                    <select
                      value={status}
                      onChange={(e) => setStatus(e.target.value)}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    >
                      {module.config?.statuses?.map((s) => (
                        <option key={s} value={s}>
                          {s}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Assigned To
                    </label>
                    <select
                      value={assignedTo || ''}
                      onChange={(e) => setAssignedTo(e.target.value || null)}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    >
                      <option value="">Not assigned</option>
                      {allUsers.map((u) => (
                        <option key={u.id} value={u.email}>
                          {u.name || u.email}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {module.fields?.map((field) => (
                  <div key={field.id}>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      {field.display_name}
                      {field.is_required ? <span className="text-red-500"> *</span> : ''}
                    </label>
                    {renderFieldInput(field)}
                  </div>
                ))}
              </div>
            </div>

            {/* Actions */}
            <div className="flex gap-3 mt-6">
              <button
                type="button"
                onClick={() => navigate(`/records/${moduleName}`)}
                className="px-6 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSave}
                disabled={saving || !name}
                className="flex items-center gap-2 px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
              >
                {saving ? (
                  <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent" />
                ) : (
                  <CheckIcon className="h-5 w-5" />
                )}
                {isNew ? 'Create' : 'Save Changes'}
              </button>
            </div>

            {/* Sub-module Grid (child records) - only for existing records */}
            {!isNew && moduleName && record?.id && (
              <div className="mt-6">
                <SubModuleGrid
                  parentModuleName={moduleName}
                  parentRecordId={record.id}
                />
              </div>
            )}
          </div>

          {/* Right column - Images (only if feature enabled and not new) */}
          {module.config?.features?.includes('images') && !isNew && (
            <div className="lg:col-span-1">
              <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
                <h2 className="text-lg font-semibold text-gray-900 mb-4">
                  Images {images.length > 0 && <span className="text-gray-400 font-normal">({images.length})</span>}
                </h2>

                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleImageUpload}
                  accept="image/*"
                  className="hidden"
                />

                {/* Image Grid */}
                {images.length > 0 && (
                  <div className="grid grid-cols-2 gap-3 mb-4">
                    {images.map((img, index) => (
                      <div key={img.id} className="relative group">
                        <img
                          src={`${API_BASE}${img.image_path}`}
                          alt={`Image ${index + 1}`}
                          className="w-full h-24 object-cover rounded-lg cursor-pointer"
                          onClick={() => openImageViewer(index)}
                        />
                        {index === 0 && (
                          <div className="absolute top-1 left-1 bg-amber-500 text-white text-xs px-1.5 py-0.5 rounded flex items-center gap-1">
                            <StarIconSolid className="h-3 w-3" />
                            Primary
                          </div>
                        )}
                        <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity rounded-lg flex items-center justify-center gap-2">
                          {index !== 0 && (
                            <button
                              type="button"
                              onClick={() => handleSetPrimary(img.id)}
                              className="p-1.5 bg-white rounded-full hover:bg-amber-100 transition-colors"
                              title="Set as primary"
                            >
                              <StarIcon className="h-4 w-4 text-amber-500" />
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => handleDeleteImage(img.id)}
                            className="p-1.5 bg-white rounded-full hover:bg-red-100 transition-colors"
                            title="Delete"
                          >
                            <TrashIcon className="h-4 w-4 text-red-500" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Upload Button */}
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploadingImage}
                  className="w-full border-2 border-dashed border-gray-300 rounded-lg p-6 text-center hover:border-blue-400 hover:bg-blue-50/50 transition-colors disabled:opacity-50"
                >
                  {uploadingImage ? (
                    <div className="flex items-center justify-center">
                      <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-500"></div>
                    </div>
                  ) : (
                    <>
                      <CloudArrowUpIcon className="h-8 w-8 mx-auto text-gray-300 mb-2" />
                      <p className="text-sm font-medium text-gray-700">Add Image</p>
                      <p className="text-xs text-gray-500 mt-1">PNG, JPG up to 5MB</p>
                    </>
                  )}
                </button>

                {images.length > 0 && (
                  <p className="text-xs text-gray-400 mt-3 text-center">
                    First image is shown as thumbnail in the list
                  </p>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Images Tab (fallback for separate tab when not in details view) */}
      {activeTab === 'images' && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900">
              Images {images.length > 0 && <span className="text-gray-400 font-normal">({images.length})</span>}
            </h3>
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={uploadingImage}
              className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg transition-colors disabled:opacity-50"
            >
              {uploadingImage ? (
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
              ) : (
                <CloudArrowUpIcon className="h-5 w-5" />
              )}
              Upload Image
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleImageUpload}
              className="hidden"
            />
          </div>
          {images.length === 0 ? (
            <div className="border-2 border-dashed border-gray-300 rounded-lg p-12 text-center">
              <PhotoIcon className="h-12 w-12 mx-auto text-gray-300 mb-3" />
              <p className="text-gray-500">No images uploaded yet</p>
              <p className="text-sm text-gray-400 mt-1">Upload images to display here</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {images.map((img, index) => (
                <div key={img.id} className="relative group">
                  <img
                    src={`${API_BASE}${img.image_path}`}
                    alt={`Image ${index + 1}`}
                    className="w-full h-32 object-cover rounded-lg cursor-pointer"
                    onClick={() => openImageViewer(index)}
                  />
                  {index === 0 && (
                    <div className="absolute top-2 left-2 bg-amber-500 text-white text-xs px-2 py-0.5 rounded flex items-center gap-1">
                      <StarIconSolid className="h-3 w-3" />
                      Primary
                    </div>
                  )}
                  <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity rounded-lg flex items-center justify-center gap-2">
                    {index !== 0 && (
                      <button
                        type="button"
                        onClick={() => handleSetPrimary(img.id)}
                        className="p-2 bg-white rounded-full hover:bg-amber-100 transition-colors"
                        title="Set as primary"
                      >
                        <StarIcon className="h-5 w-5 text-amber-500" />
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => handleDeleteImage(img.id)}
                      className="p-2 bg-white rounded-full hover:bg-red-100 transition-colors"
                      title="Delete"
                    >
                      <TrashIcon className="h-5 w-5 text-red-500" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {activeTab === 'documents' && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900">
              Documents {documents.length > 0 && <span className="text-gray-400 font-normal">({documents.length})</span>}
            </h3>
            <button
              onClick={() => docInputRef.current?.click()}
              disabled={uploadingDoc}
              className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg transition-colors disabled:opacity-50"
            >
              {uploadingDoc ? (
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
              ) : (
                <CloudArrowUpIcon className="h-5 w-5" />
              )}
              Upload Document
            </button>
            <input
              ref={docInputRef}
              type="file"
              onChange={handleDocumentUpload}
              className="hidden"
            />
          </div>
          {documents.length === 0 ? (
            <div className="border-2 border-dashed border-gray-300 rounded-lg p-12 text-center">
              <DocumentIcon className="h-12 w-12 mx-auto text-gray-300 mb-3" />
              <p className="text-gray-500">No documents uploaded yet</p>
              <p className="text-sm text-gray-400 mt-1">Upload documents to display here</p>
            </div>
          ) : (
            <div className="space-y-2">
              {documents.map((doc) => (
                <div
                  key={doc.id}
                  className="flex items-center gap-3 p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
                >
                  <DocumentIcon className="h-6 w-6 text-gray-400" />
                  <div className="flex-1 min-w-0">
                    <a
                      href={`${API_BASE}${doc.file_path}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-600 hover:underline font-medium truncate block"
                    >
                      {doc.name}
                    </a>
                    <span className="text-xs text-gray-400">
                      Uploaded {new Date(doc.created_at).toLocaleDateString()}
                    </span>
                  </div>
                  <a
                    href={`${API_BASE}${doc.file_path}`}
                    download={doc.name}
                    className="p-2 hover:bg-gray-200 rounded-lg transition-colors"
                    title="Download"
                  >
                    <ArrowDownTrayIcon className="h-5 w-5 text-gray-500" />
                  </a>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {activeTab === 'history' && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">
            Activity History {history.length > 0 && <span className="text-gray-400 font-normal">({history.length})</span>}
          </h3>
          {history.length === 0 ? (
            <div className="border-2 border-dashed border-gray-300 rounded-lg p-12 text-center">
              <ClockIcon className="h-12 w-12 mx-auto text-gray-300 mb-3" />
              <p className="text-gray-500">No history yet</p>
              <p className="text-sm text-gray-400 mt-1">Changes to this record will appear here</p>
            </div>
          ) : (
            <>
              <div className="space-y-3">
                {paginatedHistory.map((entry) => (
                  <div
                    key={entry.id}
                    className="flex items-start gap-4 p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
                  >
                    <UserAvatar
                      email={entry.changed_by || ''}
                      name={entry.changed_by || 'Unknown'}
                      size="sm"
                    />
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                          {entry.action}
                        </span>
                        <span className="text-xs text-gray-400">
                          {new Date(entry.created_at).toLocaleString()}
                        </span>
                      </div>
                      {entry.description && (
                        <p className="text-sm text-gray-600">{entry.description}</p>
                      )}
                      {entry.changed_by && (
                        <p className="text-xs text-gray-400 mt-1">By: {entry.changed_by}</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
              {totalHistoryPages > 1 && (
                <div className="flex justify-center gap-2 mt-6 pt-4 border-t border-gray-200">
                  {Array.from({ length: totalHistoryPages }, (_, i) => i + 1).map(
                    (page) => (
                      <button
                        key={page}
                        onClick={() => setHistoryPage(page)}
                        className={`min-w-[36px] h-9 px-3 rounded-lg text-sm font-medium transition-colors ${
                          page === historyPage
                            ? 'bg-blue-600 text-white'
                            : 'border border-gray-300 hover:bg-gray-50 text-gray-700'
                        }`}
                      >
                        {page}
                      </button>
                    )
                  )}
                </div>
              )}
            </>
          )}
        </div>
      )}

      {activeTab === 'links' && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900">
              Links {links.length > 0 && <span className="text-gray-400 font-normal">({links.length})</span>}
            </h3>
            <button
              onClick={handleAddLink}
              className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg transition-colors"
            >
              <PlusIcon className="h-5 w-5" />
              Add Link
            </button>
          </div>
          {links.length === 0 ? (
            <div className="border-2 border-dashed border-gray-300 rounded-lg p-12 text-center">
              <LinkIcon className="h-12 w-12 mx-auto text-gray-300 mb-3" />
              <p className="text-gray-500">No links added yet</p>
              <p className="text-sm text-gray-400 mt-1">Add links to external resources</p>
            </div>
          ) : (
            <div className="space-y-2">
              {links.map((link) => (
                <div
                  key={link.id}
                  className="flex items-center gap-3 p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
                >
                  <LinkIcon className="h-6 w-6 text-gray-400" />
                  <a
                    href={link.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex-1 text-blue-600 hover:underline font-medium flex items-center gap-2"
                  >
                    {link.title || link.url}
                    <ArrowTopRightOnSquareIcon className="h-4 w-4" />
                  </a>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Image Viewer */}
      {viewerOpen && images.length > 0 && (
        <ImageViewer
          images={images.map((img) => `${API_BASE}${img.image_path}`)}
          currentIndex={viewerIndex}
          onClose={() => setViewerOpen(false)}
          onIndexChange={setViewerIndex}
        />
      )}

      {/* Quick Add Modal for Relation Fields */}
      {quickAddModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md">
            <div className="flex items-center justify-between p-4 border-b border-gray-200">
              <h3 className="text-lg font-semibold">
                Add New {quickAddModal.moduleDisplayName}
              </h3>
              <button
                onClick={() => setQuickAddModal(null)}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <svg className="h-5 w-5 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="p-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Name *
              </label>
              <input
                type="text"
                value={quickAddName}
                onChange={(e) => setQuickAddName(e.target.value)}
                placeholder={`Enter ${quickAddModal.moduleDisplayName.toLowerCase()} name`}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && quickAddName.trim()) {
                    handleQuickAdd();
                  }
                }}
              />
            </div>
            <div className="flex justify-end gap-3 p-4 border-t border-gray-200">
              <button
                type="button"
                onClick={() => setQuickAddModal(null)}
                className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleQuickAdd}
                disabled={quickAddSaving || !quickAddName.trim()}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {quickAddSaving ? (
                  <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent" />
                ) : (
                  <CheckIcon className="h-4 w-4" />
                )}
                Create
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
