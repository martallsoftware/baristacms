import { useEffect, useState } from 'react';
import {
  PlusIcon,
  PencilIcon,
  TrashIcon,
  Bars3Icon,
  CheckIcon,
  XMarkIcon,
  ChevronRightIcon,
  ChevronDownIcon,
  ArrowUpIcon,
  ArrowDownIcon,
  HomeIcon,
  CubeIcon,
  UsersIcon,
  Cog6ToothIcon,
  ShieldCheckIcon,
  WrenchScrewdriverIcon,
  ClipboardDocumentListIcon,
  BuildingOffice2Icon,
  ArchiveBoxIcon,
  DocumentTextIcon,
  CalendarIcon,
  ChartBarIcon,
  FolderIcon,
  InboxIcon,
  TagIcon,
  Squares2X2Icon,
} from '@heroicons/react/24/outline';
import {
  menuService,
  type MenuItem,
} from '../../services/api';
import { useToast } from '../../context/ToastContext';

// Map icon names to components
const iconMap: Record<string, React.ComponentType<{ className?: string }>> = {
  HomeIcon,
  CubeIcon,
  UsersIcon,
  Cog6ToothIcon,
  ShieldCheckIcon,
  WrenchScrewdriverIcon,
  ClipboardDocumentListIcon,
  BuildingOffice2Icon,
  ArchiveBoxIcon,
  DocumentTextIcon,
  CalendarIcon,
  ChartBarIcon,
  FolderIcon,
  InboxIcon,
  TagIcon,
  Squares2X2Icon,
};

// Get icon component by name
const getIcon = (iconName?: string): React.ComponentType<{ className?: string }> | null => {
  if (iconName && iconMap[iconName]) {
    return iconMap[iconName];
  }
  return null;
};

const iconOptions = [
  { value: '', label: 'None' },
  { value: 'HomeIcon', label: 'Home' },
  { value: 'CubeIcon', label: 'Cube' },
  { value: 'UsersIcon', label: 'Users' },
  { value: 'Cog6ToothIcon', label: 'Settings' },
  { value: 'ShieldCheckIcon', label: 'Shield' },
  { value: 'WrenchScrewdriverIcon', label: 'Wrench' },
  { value: 'ClipboardDocumentListIcon', label: 'Clipboard' },
  { value: 'BuildingOffice2Icon', label: 'Building' },
  { value: 'ArchiveBoxIcon', label: 'Archive' },
  { value: 'DocumentTextIcon', label: 'Document' },
  { value: 'CalendarIcon', label: 'Calendar' },
  { value: 'ChartBarIcon', label: 'Chart' },
  { value: 'FolderIcon', label: 'Folder' },
  { value: 'InboxIcon', label: 'Inbox' },
  { value: 'TagIcon', label: 'Tag' },
  { value: 'Squares2X2Icon', label: 'Grid' },
];

const roleOptions = [
  { value: '', label: 'None (visible to all)' },
  { value: 'admin', label: 'Admin only' },
  { value: 'manager', label: 'Manager and above' },
];

interface MenuItemRowProps {
  item: MenuItem;
  level: number;
  onEdit: (item: MenuItem) => void;
  onDelete: (id: number) => void;
  onAddChild: (parentId: number) => void;
  onMoveUp: (item: MenuItem) => void;
  onMoveDown: (item: MenuItem) => void;
  canMoveUp: boolean;
  canMoveDown: boolean;
  expandedItems: number[];
  toggleExpand: (id: number) => void;
}

function MenuItemRow({ item, level, onEdit, onDelete, onAddChild, onMoveUp, onMoveDown, canMoveUp, canMoveDown, expandedItems, toggleExpand }: MenuItemRowProps) {
  const hasChildren = item.children && item.children.length > 0;
  const isExpanded = expandedItems.includes(item.id);
  const isModule = item.is_module || item.id < 0;

  return (
    <>
      <tr className="hover:bg-gray-50">
        <td className="px-4 py-3">
          <div className="flex items-center" style={{ paddingLeft: `${level * 24}px` }}>
            {hasChildren ? (
              <button
                onClick={() => toggleExpand(item.id)}
                className="p-1 mr-2 hover:bg-gray-200 rounded"
              >
                {isExpanded ? (
                  <ChevronDownIcon className="h-4 w-4 text-gray-500" />
                ) : (
                  <ChevronRightIcon className="h-4 w-4 text-gray-500" />
                )}
              </button>
            ) : (
              <span className="w-8" />
            )}
            <Bars3Icon className="h-4 w-4 text-gray-400 mr-2" />
            <span className="font-medium text-gray-900">{item.display_name}</span>
            {isModule && (
              <span className="ml-2 inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-700">
                Module
              </span>
            )}
          </div>
        </td>
        <td className="px-4 py-3 text-sm text-gray-500">{item.name}</td>
        <td className="px-4 py-3 text-sm text-gray-500">{item.path || '-'}</td>
        <td className="px-4 py-3 text-sm text-gray-500">
          {(() => {
            const IconComponent = getIcon(item.icon);
            return IconComponent ? (
              <IconComponent className="h-5 w-5 text-gray-600" />
            ) : (
              <span className="text-gray-400">-</span>
            );
          })()}
        </td>
        <td className="px-4 py-3 text-sm text-gray-500 text-center">
          {item.weight ?? 50}
        </td>
        <td className="px-4 py-3">
          <span
            className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
              item.is_active == 1 ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
            }`}
          >
            {item.is_active == 1 ? 'Active' : 'Inactive'}
          </span>
        </td>
        <td className="px-4 py-3">
          <div className="flex items-center gap-1">
            <button
              onClick={() => onMoveUp(item)}
              disabled={!canMoveUp}
              className="p-1.5 text-gray-600 hover:bg-gray-100 rounded disabled:opacity-30 disabled:cursor-not-allowed"
              title="Move up"
            >
              <ArrowUpIcon className="h-4 w-4" />
            </button>
            <button
              onClick={() => onMoveDown(item)}
              disabled={!canMoveDown}
              className="p-1.5 text-gray-600 hover:bg-gray-100 rounded disabled:opacity-30 disabled:cursor-not-allowed"
              title="Move down"
            >
              <ArrowDownIcon className="h-4 w-4" />
            </button>
            {!isModule && (
              <button
                onClick={() => onAddChild(item.id)}
                className="p-1.5 text-green-600 hover:bg-green-50 rounded"
                title="Add sub-item"
              >
                <PlusIcon className="h-4 w-4" />
              </button>
            )}
            <button
              onClick={() => onEdit(item)}
              className="p-1.5 text-blue-600 hover:bg-blue-50 rounded"
              title={isModule ? "Edit weight" : "Edit"}
            >
              <PencilIcon className="h-4 w-4" />
            </button>
            {!isModule && (
              <button
                onClick={() => onDelete(item.id)}
                className="p-1.5 text-red-600 hover:bg-red-50 rounded"
                title="Delete"
              >
                <TrashIcon className="h-4 w-4" />
              </button>
            )}
          </div>
        </td>
      </tr>
      {hasChildren && isExpanded && item.children?.map((child, index) => (
        <MenuItemRow
          key={child.id}
          item={child}
          level={level + 1}
          onEdit={onEdit}
          onDelete={onDelete}
          onAddChild={onAddChild}
          onMoveUp={onMoveUp}
          onMoveDown={onMoveDown}
          canMoveUp={index > 0}
          canMoveDown={index < (item.children?.length || 0) - 1}
          expandedItems={expandedItems}
          toggleExpand={toggleExpand}
        />
      ))}
    </>
  );
}

export default function MenuPage() {
  const { showToast } = useToast();
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [allItems, setAllItems] = useState<MenuItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingItem, setEditingItem] = useState<MenuItem | null>(null);
  const [expandedItems, setExpandedItems] = useState<number[]>([]);

  // Form state
  const [name, setName] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [icon, setIcon] = useState('');
  const [path, setPath] = useState('');
  const [parentId, setParentId] = useState<number | null>(null);
  const [weight, setWeight] = useState(50);
  const [isActive, setIsActive] = useState(true);
  const [requiredRole, setRequiredRole] = useState('');
  const [saving, setSaving] = useState(false);
  const [editingModuleItem, setEditingModuleItem] = useState(false);

  useEffect(() => {
    loadMenuItems();
  }, []);

  const loadMenuItems = async () => {
    try {
      // Use getAll() for admin page to show ALL items (including inactive and modules)
      const allTree = await menuService.getAll();
      setMenuItems(allTree);
      // Flatten tree to get all items for move up/down logic
      const flatten = (items: MenuItem[]): MenuItem[] => {
        return items.flatMap(item => [item, ...flatten(item.children || [])]);
      };
      setAllItems(flatten(allTree));
      // Expand all top-level items by default
      setExpandedItems(allTree.map(item => item.id));
    } catch (error) {
      console.error('Failed to load menu items:', error);
    } finally {
      setLoading(false);
    }
  };

  const toggleExpand = (id: number) => {
    setExpandedItems((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
    );
  };

  const openCreateModal = (parentItemId?: number) => {
    setEditingItem(null);
    setEditingModuleItem(false);
    setName('');
    setDisplayName('');
    setIcon('');
    setPath('');
    setParentId(parentItemId || null);
    setWeight(50);
    setIsActive(true);
    setRequiredRole('');
    setShowModal(true);
  };

  const openEditModal = (item: MenuItem) => {
    const isModule = item.id < 0 || item.is_module === true;
    setEditingModuleItem(isModule);
    setEditingItem(item);
    setName(item.name);
    setDisplayName(item.display_name);
    setIcon(item.icon || '');
    setPath(item.path || '');
    setParentId(item.parent_id || null);
    setWeight(item.weight ?? 50);
    setIsActive(item.is_active == 1);
    setRequiredRole(item.required_role || '');
    setShowModal(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);

    try {
      if (editingItem) {
        if (editingModuleItem) {
          // For module items, only update weight
          await menuService.update(editingItem.id, { weight });
        } else {
          await menuService.update(editingItem.id, {
            name,
            displayName,
            icon: icon || null,
            path: path || null,
            parentId,
            weight,
            isActive,
            requiredRole: requiredRole || null,
          });
        }
      } else {
        await menuService.create({
          name,
          displayName,
          icon: icon || undefined,
          path: path || undefined,
          parentId,
          weight,
          isActive,
          requiredRole: requiredRole || undefined,
        });
      }
      await loadMenuItems();
      setShowModal(false);
      showToast(
        editingModuleItem
          ? 'Module weight updated successfully'
          : (editingItem ? 'Menu item updated successfully' : 'Menu item created successfully'),
        'success'
      );
    } catch (error) {
      console.error('Failed to save menu item:', error);
      showToast('Failed to save menu item', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: number) => {
    // Prevent deleting module items (virtual items with negative IDs)
    if (id < 0) {
      showToast('Module items must be deleted from the Modules page', 'info');
      return;
    }

    if (!confirm('Are you sure you want to delete this menu item? Child items will also be deleted.')) {
      return;
    }

    try {
      await menuService.delete(id);
      await loadMenuItems();
      showToast('Menu item deleted', 'success');
    } catch (error) {
      console.error('Failed to delete menu item:', error);
      showToast(error instanceof Error ? error.message : 'Failed to delete menu item', 'error');
    }
  };

  const handleMoveUp = async (item: MenuItem) => {
    console.log('handleMoveUp called with item:', item);
    console.log('allItems:', allItems);

    // Skip module items (virtual items with negative IDs)
    if (item.is_module || item.id < 0) {
      showToast('Module items cannot be reordered from here', 'info');
      return;
    }

    // Find the item in allItems to get the correct parent_id
    const fullItem = allItems.find(i => i.id === item.id);
    console.log('fullItem found:', fullItem);
    if (!fullItem) {
      console.error('Item not found in allItems:', item.id);
      showToast('Item not found', 'error');
      return;
    }

    // Find siblings (items with the same parent_id, treating null and undefined as equal)
    const parentId = fullItem.parent_id ?? null;
    const siblings = allItems
      .filter(i => (i.parent_id ?? null) === parentId)
      .sort((a, b) => a.sort_order - b.sort_order);
    console.log('siblings:', siblings);

    const currentIndex = siblings.findIndex(s => s.id === item.id);
    console.log('currentIndex:', currentIndex);
    if (currentIndex <= 0) {
      console.log('Already at top, cannot move up');
      return;
    }

    // Swap sort_order with the previous item
    const prevItem = siblings[currentIndex - 1];
    console.log('prevItem:', prevItem);
    const updates = [
      { id: fullItem.id, sortOrder: prevItem.sort_order, parentId: parentId },
      { id: prevItem.id, sortOrder: fullItem.sort_order, parentId: parentId },
    ];
    console.log('updates:', updates);

    try {
      console.log('Calling menuService.reorder...');
      await menuService.reorder(updates);
      console.log('Reorder successful, reloading...');
      await loadMenuItems();
      showToast('Menu item moved', 'success');
    } catch (error) {
      console.error('Failed to move menu item:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      showToast(`Failed to move: ${errorMessage}`, 'error');
    }
  };

  const handleMoveDown = async (item: MenuItem) => {
    // Skip module items (virtual items with negative IDs)
    if (item.is_module || item.id < 0) {
      showToast('Module items cannot be reordered from here', 'info');
      return;
    }

    // Find the item in allItems to get the correct parent_id
    const fullItem = allItems.find(i => i.id === item.id);
    if (!fullItem) {
      console.error('Item not found in allItems:', item.id);
      return;
    }

    // Find siblings (items with the same parent_id, treating null and undefined as equal)
    const parentId = fullItem.parent_id ?? null;
    const siblings = allItems
      .filter(i => (i.parent_id ?? null) === parentId)
      .sort((a, b) => a.sort_order - b.sort_order);

    const currentIndex = siblings.findIndex(s => s.id === item.id);
    if (currentIndex < 0 || currentIndex >= siblings.length - 1) return;

    // Swap sort_order with the next item
    const nextItem = siblings[currentIndex + 1];
    const updates = [
      { id: fullItem.id, sortOrder: nextItem.sort_order, parentId: parentId },
      { id: nextItem.id, sortOrder: fullItem.sort_order, parentId: parentId },
    ];

    try {
      await menuService.reorder(updates);
      await loadMenuItems();
      showToast('Menu item moved', 'success');
    } catch (error) {
      console.error('Failed to move menu item:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      showToast(`Failed to move: ${errorMessage}`, 'error');
    }
  };

  // Helper to check if item can move up/down
  const canMoveUp = (item: MenuItem) => {
    const fullItem = allItems.find(i => i.id === item.id);
    if (!fullItem) return false;
    const parentId = fullItem.parent_id ?? null;
    const siblings = allItems
      .filter(i => (i.parent_id ?? null) === parentId)
      .sort((a, b) => a.sort_order - b.sort_order);
    const index = siblings.findIndex(s => s.id === item.id);
    return index > 0;
  };

  const canMoveDown = (item: MenuItem) => {
    const fullItem = allItems.find(i => i.id === item.id);
    if (!fullItem) return false;
    const parentId = fullItem.parent_id ?? null;
    const siblings = allItems
      .filter(i => (i.parent_id ?? null) === parentId)
      .sort((a, b) => a.sort_order - b.sort_order);
    const index = siblings.findIndex(s => s.id === item.id);
    return index >= 0 && index < siblings.length - 1;
  };

  // Get potential parent items (exclude self and children for editing)
  const getParentOptions = () => {
    let options = allItems.filter(item => !item.parent_id);
    if (editingItem) {
      // Exclude self and any descendants
      const getDescendantIds = (parentId: number): number[] => {
        const children = allItems.filter(i => i.parent_id === parentId);
        return [parentId, ...children.flatMap(c => getDescendantIds(c.id))];
      };
      const excludeIds = getDescendantIds(editingItem.id);
      options = allItems.filter(item => !excludeIds.includes(item.id));
    }
    return options;
  };

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
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Menu Management</h1>
          <p className="text-gray-500 mt-1">Configure navigation menu items and their hierarchy.</p>
        </div>
        <button
          onClick={() => openCreateModal()}
          className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg transition-colors"
        >
          <PlusIcon className="h-5 w-5" />
          Add Menu Item
        </button>
      </div>

      {/* Menu Items Table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Display Name
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Name
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Path
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Icon
              </th>
              <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                Weight
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Status
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {menuItems.map((item) => (
              <MenuItemRow
                key={item.id}
                item={item}
                level={0}
                onEdit={openEditModal}
                onDelete={handleDelete}
                onAddChild={openCreateModal}
                onMoveUp={handleMoveUp}
                onMoveDown={handleMoveDown}
                canMoveUp={canMoveUp(item)}
                canMoveDown={canMoveDown(item)}
                expandedItems={expandedItems}
                toggleExpand={toggleExpand}
              />
            ))}
            {menuItems.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-12 text-center text-gray-500">
                  <Bars3Icon className="h-12 w-12 mx-auto text-gray-300 mb-3" />
                  <p>No menu items yet</p>
                  <p className="text-sm text-gray-400">Create your first menu item to get started</p>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Create/Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg">
            <div className="flex items-center justify-between p-6 border-b border-gray-200">
              <h2 className="text-xl font-semibold">
                {editingModuleItem
                  ? 'Edit Module Weight'
                  : (editingItem ? 'Edit Menu Item' : 'Create Menu Item')}
              </h2>
              <button
                onClick={() => setShowModal(false)}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <XMarkIcon className="h-5 w-5 text-gray-500" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              {editingModuleItem ? (
                <>
                  {/* Simplified form for module items - only weight */}
                  <div className="bg-blue-50 border border-blue-100 rounded-lg p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <CubeIcon className="h-5 w-5 text-blue-600" />
                      <span className="font-medium text-blue-900">{displayName}</span>
                    </div>
                    <p className="text-sm text-blue-700">
                      This is a module item. You can only adjust its weight here.
                      Other settings must be changed from the Modules page.
                    </p>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Weight (1-99)
                    </label>
                    <input
                      type="number"
                      min={1}
                      max={99}
                      value={weight}
                      onChange={(e) => setWeight(Math.min(99, Math.max(1, parseInt(e.target.value) || 50)))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      Lower weight = higher priority in menu. Items with the same weight are sorted by their order.
                    </p>
                  </div>
                </>
              ) : (
                <>
                  {/* Full form for regular menu items */}
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Name (slug) *
                      </label>
                      <input
                        type="text"
                        value={name}
                        onChange={(e) => setName(e.target.value.toLowerCase().replace(/\s+/g, '_'))}
                        placeholder="e.g., production"
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Display Name *
                      </label>
                      <input
                        type="text"
                        value={displayName}
                        onChange={(e) => setDisplayName(e.target.value)}
                        placeholder="e.g., Production"
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                        required
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Path
                    </label>
                    <input
                      type="text"
                      value={path}
                      onChange={(e) => setPath(e.target.value)}
                      placeholder="e.g., /production"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      Leave empty for menu groups (parent items with children)
                    </p>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Icon
                      </label>
                      <select
                        value={icon}
                        onChange={(e) => setIcon(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                      >
                        {iconOptions.map((opt) => (
                          <option key={opt.value} value={opt.value}>
                            {opt.label}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Parent Menu
                      </label>
                      <select
                        value={parentId || ''}
                        onChange={(e) => setParentId(e.target.value ? parseInt(e.target.value) : null)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="">None (top level)</option>
                        {getParentOptions().map((item) => (
                          <option key={item.id} value={item.id}>
                            {item.display_name}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Required Role
                      </label>
                      <select
                        value={requiredRole}
                        onChange={(e) => setRequiredRole(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                      >
                        {roleOptions.map((opt) => (
                          <option key={opt.value} value={opt.value}>
                            {opt.label}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Weight (1-99)
                      </label>
                      <input
                        type="number"
                        min={1}
                        max={99}
                        value={weight}
                        onChange={(e) => setWeight(Math.min(99, Math.max(1, parseInt(e.target.value) || 50)))}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                      />
                      <p className="text-xs text-gray-500 mt-1">Lower = higher priority</p>
                    </div>
                    <div className="flex items-center pt-6">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={isActive}
                          onChange={(e) => setIsActive(e.target.checked)}
                          className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                        />
                        <span className="text-sm text-gray-700">Active</span>
                      </label>
                    </div>
                  </div>
                </>
              )}

              <div className="flex justify-end gap-3 pt-4 border-t border-gray-200">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving || (!editingModuleItem && (!name || !displayName))}
                  className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {saving ? (
                    <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent" />
                  ) : (
                    <CheckIcon className="h-4 w-4" />
                  )}
                  {editingModuleItem ? 'Update Weight' : (editingItem ? 'Save Changes' : 'Create Menu Item')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
