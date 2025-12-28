import { useEffect, useState } from 'react';
import {
  PlusIcon,
  PencilIcon,
  TrashIcon,
  DocumentPlusIcon,
  CheckIcon,
  XMarkIcon,
  LinkIcon,
  EyeIcon,
} from '@heroicons/react/24/outline';
import {
  pageTemplateService,
  moduleService,
  type PageTemplate,
  type Module,
  type ModuleField,
} from '../../services/api';
import { useUser } from '../../context/UserContext';
import { useToast } from '../../context/ToastContext';

export default function PagesAdmin() {
  const { isAdmin } = useUser();
  const { showToast } = useToast();
  const [templates, setTemplates] = useState<PageTemplate[]>([]);
  const [modules, setModules] = useState<Module[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<PageTemplate | null>(null);
  const [saving, setSaving] = useState(false);

  // Form state
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [moduleId, setModuleId] = useState<number | null>(null);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [selectedFields, setSelectedFields] = useState<string[]>([]);
  const [successMessage, setSuccessMessage] = useState('');
  const [isActive, setIsActive] = useState(true);
  const [requireAuth, setRequireAuth] = useState(false);

  // Module fields for the selected module
  const [moduleFields, setModuleFields] = useState<ModuleField[]>([]);

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    if (moduleId) {
      loadModuleFields(moduleId);
    } else {
      setModuleFields([]);
      setSelectedFields([]);
    }
  }, [moduleId]);

  const loadData = async () => {
    try {
      const [templatesData, modulesData] = await Promise.all([
        pageTemplateService.getAll(),
        moduleService.getAll(),
      ]);
      setTemplates(templatesData);
      setModules(modulesData);
    } catch (error) {
      console.error('Failed to load data:', error);
      showToast('Failed to load data', 'error');
    } finally {
      setLoading(false);
    }
  };

  const loadModuleFields = async (modId: number) => {
    try {
      const module = await moduleService.getByName(
        modules.find(m => m.id === modId)?.name || ''
      );
      setModuleFields(module.fields || []);
    } catch (error) {
      console.error('Failed to load module fields:', error);
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
    if (!selectedTemplate) {
      setSlug(generateSlug(value));
    }
  };

  const openCreateModal = () => {
    setSelectedTemplate(null);
    setName('');
    setSlug('');
    setModuleId(null);
    setTitle('');
    setDescription('');
    setSelectedFields([]);
    setSuccessMessage('Your submission has been received. Thank you!');
    setIsActive(true);
    setRequireAuth(false);
    setModuleFields([]);
    setShowModal(true);
  };

  const openEditModal = async (template: PageTemplate) => {
    try {
      const fullTemplate = await pageTemplateService.getById(template.id);
      setSelectedTemplate(fullTemplate);
      setName(fullTemplate.name);
      setSlug(fullTemplate.slug);
      setTitle(fullTemplate.title);
      setDescription(fullTemplate.description || '');
      setSelectedFields(fullTemplate.fields || []);
      setSuccessMessage(fullTemplate.success_message || 'Your submission has been received. Thank you!');
      setIsActive(fullTemplate.is_active === 1);
      setRequireAuth(fullTemplate.require_auth === 1);

      // Load fresh module fields (don't use cached moduleFields)
      setModuleId(fullTemplate.module_id);
      if (fullTemplate.module_id) {
        const module = modules.find(m => m.id === fullTemplate.module_id);
        if (module) {
          const fullModule = await moduleService.getByName(module.name);
          setModuleFields(fullModule.fields || []);
        }
      }

      setShowModal(true);
    } catch (error) {
      console.error('Failed to load template:', error);
      showToast('Failed to load template', 'error');
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

      const data = {
        name,
        slug,
        moduleId,
        title,
        description: description || undefined,
        fields: selectedFields.length > 0 ? selectedFields : undefined,
        successMessage,
        isActive,
        requireAuth,
      };

      if (selectedTemplate) {
        await pageTemplateService.update(selectedTemplate.id, data);
        showToast('Page updated successfully', 'success');
      } else {
        await pageTemplateService.create(data);
        showToast('Page created successfully', 'success');
      }

      setShowModal(false);
      loadData();
    } catch (error) {
      console.error('Failed to save template:', error);
      showToast('Failed to save page', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (template: PageTemplate) => {
    if (!confirm(`Are you sure you want to delete "${template.name}"?`)) {
      return;
    }

    try {
      await pageTemplateService.delete(template.id);
      showToast('Page deleted successfully', 'success');
      loadData();
    } catch (error) {
      console.error('Failed to delete template:', error);
      showToast('Failed to delete page', 'error');
    }
  };

  const toggleField = (fieldName: string) => {
    setSelectedFields(prev =>
      prev.includes(fieldName)
        ? prev.filter(f => f !== fieldName)
        : [...prev, fieldName]
    );
  };

  const copyLink = (slug: string) => {
    const url = `${window.location.origin}/form/${slug}`;
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
          <h1 className="text-3xl font-bold text-gray-900">Quick Add Pages</h1>
          <p className="text-gray-500 mt-1">Create simple form pages for quick record creation.</p>
        </div>
        <button
          onClick={openCreateModal}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
        >
          <PlusIcon className="h-5 w-5" />
          Create Page
        </button>
      </div>

      {/* Templates Grid */}
      {templates.length === 0 ? (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-12 text-center">
          <DocumentPlusIcon className="h-12 w-12 mx-auto text-gray-400 mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">No pages yet</h3>
          <p className="text-gray-500 mb-4">Create your first quick add page to get started.</p>
          <button
            onClick={openCreateModal}
            className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
          >
            <PlusIcon className="h-5 w-5" />
            Create Page
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {templates.map((template) => (
            <div
              key={template.id}
              className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 hover:shadow-md transition-shadow"
            >
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
                    <DocumentPlusIcon className="h-6 w-6 text-green-600" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-900">{template.name}</h3>
                    <p className="text-sm text-gray-500">/{template.slug}</p>
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <a
                    href={`/form/${template.slug}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                    title="Preview"
                  >
                    <EyeIcon className="h-4 w-4 text-gray-500" />
                  </a>
                  <button
                    onClick={() => copyLink(template.slug)}
                    className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                    title="Copy Link"
                  >
                    <LinkIcon className="h-4 w-4 text-gray-500" />
                  </button>
                  <button
                    onClick={() => openEditModal(template)}
                    className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                    title="Edit"
                  >
                    <PencilIcon className="h-4 w-4 text-gray-500" />
                  </button>
                  <button
                    onClick={() => handleDelete(template)}
                    className="p-2 hover:bg-red-100 rounded-lg transition-colors"
                    title="Delete"
                  >
                    <TrashIcon className="h-4 w-4 text-red-500" />
                  </button>
                </div>
              </div>

              {template.description && (
                <p className="text-sm text-gray-600 mb-4">{template.description}</p>
              )}

              <div className="flex flex-wrap gap-2">
                <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-50 text-blue-700">
                  {template.module_display_name || template.module_name}
                </span>
                {template.is_active ? (
                  <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-50 text-green-700">
                    Active
                  </span>
                ) : (
                  <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-600">
                    Inactive
                  </span>
                )}
                {template.require_auth === 1 && (
                  <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-amber-50 text-amber-700">
                    Auth Required
                  </span>
                )}
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
                  {selectedTemplate ? 'Edit Page' : 'Create New Page'}
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
                      Page Name <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={name}
                      onChange={(e) => handleNameChange(e.target.value)}
                      placeholder="New Support Ticket"
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      URL Slug <span className="text-red-500">*</span>
                    </label>
                    <div className="flex items-center">
                      <span className="text-gray-500 text-sm mr-1">/form/</span>
                      <input
                        type="text"
                        value={slug}
                        onChange={(e) => setSlug(generateSlug(e.target.value))}
                        placeholder="new-support-ticket"
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
                    Records created from this page will be added to this module.
                  </p>
                </div>

                {/* Title & Description */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Form Title <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="Submit a Support Ticket"
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
                    placeholder="Fill out the form below to submit a new support ticket..."
                    rows={2}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>

                {/* Field Selection */}
                {moduleFields.length > 0 && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Fields to Show
                    </label>
                    <p className="text-sm text-gray-500 mb-3">
                      Select which fields to include in the form. Leave empty to show all fields.
                    </p>
                    <div className="border border-gray-200 rounded-lg p-4 max-h-48 overflow-y-auto">
                      <div className="space-y-2">
                        {moduleFields.map((field) => (
                          <label
                            key={field.id}
                            className="flex items-center gap-3 cursor-pointer hover:bg-gray-50 p-2 rounded"
                          >
                            <input
                              type="checkbox"
                              checked={selectedFields.includes(field.name)}
                              onChange={() => toggleField(field.name)}
                              className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                            />
                            <span className="text-sm text-gray-700">{field.display_name}</span>
                            <span className="text-xs text-gray-400">({field.field_type})</span>
                            {field.is_required === 1 && (
                              <span className="text-xs text-red-500">Required</span>
                            )}
                          </label>
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                {/* Success Message */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Success Message
                  </label>
                  <textarea
                    value={successMessage}
                    onChange={(e) => setSuccessMessage(e.target.value)}
                    placeholder="Your submission has been received. Thank you!"
                    rows={2}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
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
                  {selectedTemplate ? 'Save Changes' : 'Create Page'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
