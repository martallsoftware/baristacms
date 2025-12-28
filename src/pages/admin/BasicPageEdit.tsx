import { useEffect, useState } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import {
  ArrowLeftIcon,
  CheckIcon,
  DocumentTextIcon,
  GlobeAltIcon,
  EyeIcon,
} from '@heroicons/react/24/outline';
import {
  basicPageService,
  menuService,
  type BasicPage,
  type MenuItem,
} from '../../services/api';
import { useUser } from '../../context/UserContext';
import { useToast } from '../../context/ToastContext';
import RichTextEditor from '../../components/RichTextEditor';

const PAGE_TYPE_OPTIONS = [
  { value: 'content', label: 'Content Page' },
  { value: 'markdown', label: 'Markdown Page' },
  { value: 'start', label: 'Start Page' },
  { value: 'documentation', label: 'Documentation' },
  { value: 'tips', label: 'Tips' },
  { value: 'faq', label: 'FAQ' },
];

export default function BasicPageEdit() {
  const { id } = useParams<{ id: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { isAdmin } = useUser();
  const { showToast } = useToast();

  const isNew = id === 'new';
  const initialType = searchParams.get('type') || 'content';

  const [loading, setLoading] = useState(!isNew);
  const [saving, setSaving] = useState(false);
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [page, setPage] = useState<BasicPage | null>(null);

  // Form state
  const [title, setTitle] = useState('');
  const [slug, setSlug] = useState('');
  const [content, setContent] = useState('');
  const [menuId, setMenuId] = useState<number | null>(null);
  const [pageType, setPageType] = useState(initialType);
  const [isPublished, setIsPublished] = useState(false);
  const [showInMenu, setShowInMenu] = useState(true);
  const [sortOrder, setSortOrder] = useState(0);

  useEffect(() => {
    loadMenuItems();
    if (!isNew && id) {
      loadPage(parseInt(id));
    }
  }, [id, isNew]);

  const loadMenuItems = async () => {
    try {
      const data = await menuService.getAll();
      setMenuItems(data);
    } catch (error) {
      console.error('Failed to load menu items:', error);
    }
  };

  const loadPage = async (pageId: number) => {
    try {
      setLoading(true);
      const data = await basicPageService.getById(pageId);
      setPage(data);
      setTitle(data.title);
      setSlug(data.slug);
      setContent(data.content || '');
      setMenuId(data.menu_id);
      setPageType(data.page_type || 'content');
      setIsPublished(data.is_published === 1);
      setShowInMenu(data.show_in_menu === 1);
      setSortOrder(data.sort_order || 0);
    } catch (error) {
      console.error('Failed to load page:', error);
      showToast('Failed to load page', 'error');
      navigate('/admin/basic-pages');
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

  const handleTitleChange = (value: string) => {
    setTitle(value);
    if (isNew) {
      setSlug(generateSlug(value));
    }
  };

  const handleSave = async () => {
    if (!title.trim()) {
      showToast('Title is required', 'error');
      return;
    }
    if (!slug.trim()) {
      showToast('Slug is required', 'error');
      return;
    }

    try {
      setSaving(true);

      const pageData = {
        title: title.trim(),
        slug: slug.trim(),
        content,
        menuId,
        pageType,
        isPublished,
        showInMenu,
        sortOrder,
      };

      if (isNew) {
        const created = await basicPageService.create(pageData);
        showToast('Page created successfully', 'success');
        navigate(`/admin/basic-pages/${created.id}`);
      } else if (id) {
        await basicPageService.update(parseInt(id), pageData);
        showToast('Page saved successfully', 'success');
      }
    } catch (error) {
      console.error('Failed to save page:', error);
      showToast(error instanceof Error ? error.message : 'Failed to save page', 'error');
    } finally {
      setSaving(false);
    }
  };

  // Flatten menu items for dropdown
  const flattenMenuItems = (items: MenuItem[], prefix = ''): { id: number; name: string }[] => {
    const result: { id: number; name: string }[] = [];
    for (const item of items) {
      result.push({ id: item.id, name: prefix + item.display_name });
      if (item.children && item.children.length > 0) {
        result.push(...flattenMenuItems(item.children, prefix + '  '));
      }
    }
    return result;
  };

  const flatMenuItems = flattenMenuItems(menuItems);

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
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate('/admin/basic-pages')}
            className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <ArrowLeftIcon className="h-5 w-5" />
          </button>
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-gray-900">
              {isNew ? 'New Page' : 'Edit Page'}
            </h1>
            {!isNew && page && (
              <p className="text-gray-500 mt-1">/page/{page.slug}</p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2">
          {!isNew && isPublished && (
            <a
              href={`/page/${slug}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 px-3 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
            >
              <EyeIcon className="h-4 w-4" />
              <span className="hidden sm:inline">Preview</span>
            </a>
          )}
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg transition-colors disabled:opacity-50"
          >
            {saving ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent" />
                Saving...
              </>
            ) : (
              <>
                <CheckIcon className="h-5 w-5" />
                {isNew ? 'Create Page' : 'Save Changes'}
              </>
            )}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Title & Slug */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Page Details</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Title <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => handleTitleChange(e.target.value)}
                  placeholder="Page title"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Slug <span className="text-red-500">*</span>
                </label>
                <div className="flex">
                  <span className="inline-flex items-center px-3 rounded-l-lg border border-r-0 border-gray-300 bg-gray-50 text-gray-500 text-sm">
                    /page/
                  </span>
                  <input
                    type="text"
                    value={slug}
                    onChange={(e) => setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '-'))}
                    placeholder="page-slug"
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-r-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Content */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Content</h2>
            <div>
              {pageType === 'markdown' ? (
                <>
                  <textarea
                    value={content}
                    onChange={(e) => setContent(e.target.value)}
                    rows={20}
                    placeholder="Write your content in Markdown..."
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent font-mono text-sm"
                  />
                  <p className="mt-2 text-xs text-gray-500">
                    Supports Markdown formatting: **bold**, *italic*, # headings, - lists, [links](url), etc.
                  </p>
                </>
              ) : (
                <RichTextEditor
                  value={content}
                  onChange={setContent}
                  placeholder="Write your content here..."
                  className="min-h-[400px]"
                  onImageUpload={basicPageService.uploadImage}
                />
              )}
            </div>
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Publish Settings */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Publish</h2>
            <div className="space-y-4">
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={isPublished}
                  onChange={(e) => setIsPublished(e.target.checked)}
                  className="rounded border-gray-300 text-blue-600 focus:ring-blue-500 h-5 w-5"
                />
                <div className="flex items-center gap-2">
                  <GlobeAltIcon className="h-5 w-5 text-gray-400" />
                  <span className="text-sm font-medium text-gray-700">Published</span>
                </div>
              </label>
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={showInMenu}
                  onChange={(e) => setShowInMenu(e.target.checked)}
                  className="rounded border-gray-300 text-blue-600 focus:ring-blue-500 h-5 w-5"
                />
                <span className="text-sm font-medium text-gray-700">Show in Menu</span>
              </label>
            </div>
          </div>

          {/* Page Settings */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Settings</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Page Type
                </label>
                <select
                  value={pageType}
                  onChange={(e) => setPageType(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  {PAGE_TYPE_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Publish to Menu
                </label>
                <select
                  value={menuId ?? ''}
                  onChange={(e) => setMenuId(e.target.value ? Number(e.target.value) : null)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="">-- No Menu --</option>
                  {flatMenuItems.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.name}
                    </option>
                  ))}
                </select>
                <p className="mt-1 text-xs text-gray-500">
                  Select a menu item to show this page under
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Sort Order
                </label>
                <input
                  type="number"
                  value={sortOrder}
                  onChange={(e) => setSortOrder(parseInt(e.target.value) || 0)}
                  min="0"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
            </div>
          </div>

          {/* Info */}
          {!isNew && page && (
            <div className="bg-gray-50 rounded-xl p-6 text-sm text-gray-600">
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span>Created:</span>
                  <span>{new Date(page.created_at).toLocaleDateString()}</span>
                </div>
                {page.created_by && (
                  <div className="flex justify-between">
                    <span>Created by:</span>
                    <span>{page.created_by}</span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span>Updated:</span>
                  <span>{new Date(page.updated_at).toLocaleDateString()}</span>
                </div>
                {page.updated_by && (
                  <div className="flex justify-between">
                    <span>Updated by:</span>
                    <span>{page.updated_by}</span>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
