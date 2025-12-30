import { useEffect, useState } from 'react';
import {
  PlusIcon,
  PencilIcon,
  TrashIcon,
  XMarkIcon,
  UserGroupIcon,
  UsersIcon,
  Squares2X2Icon,
  Bars3Icon,
  CheckIcon,
} from '@heroicons/react/24/outline';
import {
  groupService,
  userService,
  moduleService,
  menuService,
  type UserGroup,
  type User,
  type Module,
  type MenuItem,
} from '../../services/api';

const colorOptions = [
  { value: '#3B82F6', label: 'Blue' },
  { value: '#10B981', label: 'Green' },
  { value: '#F59E0B', label: 'Amber' },
  { value: '#EF4444', label: 'Red' },
  { value: '#8B5CF6', label: 'Purple' },
  { value: '#EC4899', label: 'Pink' },
  { value: '#6B7280', label: 'Gray' },
  { value: '#b97738', label: 'Brown' },
];

interface EditModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: () => void;
  group: UserGroup | null;
  isNew: boolean;
}

function EditGroupModal({ isOpen, onClose, onSave, group, isNew }: EditModalProps) {
  const [activeTab, setActiveTab] = useState<'details' | 'members' | 'modules' | 'menuItems'>('details');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form state
  const [name, setName] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [description, setDescription] = useState('');
  const [color, setColor] = useState('#3B82F6');

  // Members, modules, and menu items state
  const [allUsers, setAllUsers] = useState<User[]>([]);
  const [allModules, setAllModules] = useState<Module[]>([]);
  const [allMenuItems, setAllMenuItems] = useState<MenuItem[]>([]);
  const [selectedMembers, setSelectedMembers] = useState<number[]>([]);
  const [selectedModules, setSelectedModules] = useState<number[]>([]);
  const [selectedMenuItems, setSelectedMenuItems] = useState<number[]>([]);

  useEffect(() => {
    if (isOpen) {
      loadData();
    }
  }, [isOpen, group]);

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      // Load all users, modules, and menu items
      const [users, modules, menuItems] = await Promise.all([
        userService.getAll(),
        moduleService.getAll(),
        menuService.getAll(),
      ]);
      setAllUsers(users.filter(u => u.is_active === 1));
      setAllModules(modules);
      // Filter to only show parent menu items (id > 0, not virtual items from modules)
      setAllMenuItems(menuItems.filter((m: MenuItem) => m.id > 0 && m.is_active === 1));

      if (group && !isNew) {
        // Load group details with members, modules, and menu items
        const fullGroup = await groupService.getById(group.id);
        setName(fullGroup.name);
        setDisplayName(fullGroup.display_name);
        setDescription(fullGroup.description || '');
        setColor(fullGroup.color || '#3B82F6');
        setSelectedMembers(fullGroup.members?.map(m => m.id) || []);
        setSelectedModules(fullGroup.modules?.map(m => m.id) || []);
        setSelectedMenuItems(fullGroup.menuItems?.map(m => m.id) || []);
      } else {
        // Reset form for new group
        setName('');
        setDisplayName('');
        setDescription('');
        setColor('#3B82F6');
        setSelectedMembers([]);
        setSelectedModules([]);
        setSelectedMenuItems([]);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!displayName.trim()) {
      setError('Display name is required');
      return;
    }

    setSaving(true);
    setError(null);
    try {
      let groupId: number;

      if (isNew) {
        // Create new group
        const newGroup = await groupService.create({
          name: name || displayName,
          displayName,
          description: description || undefined,
          color,
        });
        groupId = newGroup.id;
      } else if (group) {
        // Update existing group
        await groupService.update(group.id, {
          displayName,
          description: description || undefined,
          color,
        });
        groupId = group.id;
      } else {
        throw new Error('No group to update');
      }

      // Update members, modules, and menu items
      await Promise.all([
        groupService.updateMembers(groupId, selectedMembers),
        groupService.updateModules(groupId, selectedModules),
        groupService.updateMenuItems(groupId, selectedMenuItems),
      ]);

      onSave();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save group');
    } finally {
      setSaving(false);
    }
  };

  const toggleMember = (userId: number) => {
    setSelectedMembers(prev =>
      prev.includes(userId) ? prev.filter(id => id !== userId) : [...prev, userId]
    );
  };

  const toggleModule = (moduleId: number) => {
    setSelectedModules(prev =>
      prev.includes(moduleId) ? prev.filter(id => id !== moduleId) : [...prev, moduleId]
    );
  };

  const toggleMenuItem = (menuItemId: number) => {
    setSelectedMenuItems(prev =>
      prev.includes(menuItemId) ? prev.filter(id => id !== menuItemId) : [...prev, menuItemId]
    );
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl mx-4 max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-100">
          <div className="flex items-center gap-3">
            <div
              className="w-10 h-10 rounded-lg flex items-center justify-center"
              style={{ backgroundColor: color + '20' }}
            >
              <UserGroupIcon className="h-5 w-5" style={{ color }} />
            </div>
            <h2 className="text-lg font-semibold text-gray-900">
              {isNew ? 'New Group' : 'Edit Group'}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <XMarkIcon className="h-5 w-5 text-gray-500" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-gray-200">
          <button
            onClick={() => setActiveTab('details')}
            className={`flex-1 px-4 py-3 text-sm font-medium transition-colors ${
              activeTab === 'details'
                ? 'text-blue-600 border-b-2 border-blue-600'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            Details
          </button>
          <button
            onClick={() => setActiveTab('members')}
            className={`flex-1 px-4 py-3 text-sm font-medium transition-colors ${
              activeTab === 'members'
                ? 'text-blue-600 border-b-2 border-blue-600'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            Members ({selectedMembers.length})
          </button>
          <button
            onClick={() => setActiveTab('modules')}
            className={`flex-1 px-4 py-3 text-sm font-medium transition-colors ${
              activeTab === 'modules'
                ? 'text-blue-600 border-b-2 border-blue-600'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            Modules ({selectedModules.length})
          </button>
          <button
            onClick={() => setActiveTab('menuItems')}
            className={`flex-1 px-4 py-3 text-sm font-medium transition-colors ${
              activeTab === 'menuItems'
                ? 'text-blue-600 border-b-2 border-blue-600'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            Menu ({selectedMenuItems.length})
          </button>
        </div>

        {/* Content */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-hidden flex flex-col">
          <div className="flex-1 overflow-y-auto p-6">
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
              </div>
            ) : (
              <>
                {/* Details Tab */}
                {activeTab === 'details' && (
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Display Name *
                      </label>
                      <input
                        type="text"
                        required
                        value={displayName}
                        onChange={(e) => setDisplayName(e.target.value)}
                        placeholder="e.g., Production Team"
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Slug (optional)
                      </label>
                      <input
                        type="text"
                        value={name}
                        onChange={(e) => setName(e.target.value.toLowerCase().replace(/\s+/g, '_'))}
                        placeholder="production_team"
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                      <p className="text-xs text-gray-500 mt-1">
                        Leave empty to auto-generate from display name
                      </p>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Description
                      </label>
                      <textarea
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                        placeholder="Optional description..."
                        rows={3}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Color
                      </label>
                      <div className="flex flex-wrap gap-2">
                        {colorOptions.map((opt) => (
                          <button
                            key={opt.value}
                            type="button"
                            onClick={() => setColor(opt.value)}
                            className={`w-8 h-8 rounded-full border-2 transition-all ${
                              color === opt.value
                                ? 'border-gray-900 scale-110'
                                : 'border-transparent hover:scale-105'
                            }`}
                            style={{ backgroundColor: opt.value }}
                            title={opt.label}
                          />
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                {/* Members Tab */}
                {activeTab === 'members' && (
                  <div className="space-y-2">
                    <p className="text-sm text-gray-500 mb-4">
                      Select users to add to this group. Users can be in multiple groups.
                    </p>
                    {allUsers.length === 0 ? (
                      <p className="text-center text-gray-500 py-8">No users found</p>
                    ) : (
                      allUsers.map((user) => (
                        <label
                          key={user.id}
                          className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                            selectedMembers.includes(user.id)
                              ? 'border-blue-500 bg-blue-50'
                              : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={selectedMembers.includes(user.id)}
                            onChange={() => toggleMember(user.id)}
                            className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                          />
                          <div className="flex-1">
                            <div className="font-medium text-gray-900">{user.name || user.email}</div>
                            <div className="text-sm text-gray-500">{user.email}</div>
                          </div>
                          <span className={`text-xs px-2 py-1 rounded-full ${
                            user.role === 'admin' ? 'bg-purple-100 text-purple-700' :
                            user.role === 'manager' ? 'bg-blue-100 text-blue-700' :
                            'bg-gray-100 text-gray-600'
                          }`}>
                            {user.role}
                          </span>
                        </label>
                      ))
                    )}
                  </div>
                )}

                {/* Modules Tab */}
                {activeTab === 'modules' && (
                  <div className="space-y-2">
                    <p className="text-sm text-gray-500 mb-4">
                      Select which modules this group can access. Admin users always have access to all modules.
                    </p>
                    {allModules.length === 0 ? (
                      <p className="text-center text-gray-500 py-8">No modules found</p>
                    ) : (
                      allModules.map((module) => (
                        <label
                          key={module.id}
                          className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                            selectedModules.includes(module.id)
                              ? 'border-blue-500 bg-blue-50'
                              : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={selectedModules.includes(module.id)}
                            onChange={() => toggleModule(module.id)}
                            className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                          />
                          <div className="flex-1">
                            <div className="font-medium text-gray-900">{module.display_name}</div>
                            {module.description && (
                              <div className="text-sm text-gray-500">{module.description}</div>
                            )}
                          </div>
                        </label>
                      ))
                    )}
                  </div>
                )}

                {/* Menu Items Tab */}
                {activeTab === 'menuItems' && (
                  <div className="space-y-2">
                    <p className="text-sm text-gray-500 mb-4">
                      Select which menu items this group can access. Menu items without any group assignment are visible to all users.
                    </p>
                    {allMenuItems.length === 0 ? (
                      <p className="text-center text-gray-500 py-8">No menu items found</p>
                    ) : (
                      allMenuItems.map((menuItem) => (
                        <label
                          key={menuItem.id}
                          className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                            selectedMenuItems.includes(menuItem.id)
                              ? 'border-blue-500 bg-blue-50'
                              : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={selectedMenuItems.includes(menuItem.id)}
                            onChange={() => toggleMenuItem(menuItem.id)}
                            className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                          />
                          <div className="flex-1">
                            <div className="font-medium text-gray-900">{menuItem.display_name}</div>
                            {menuItem.path && (
                              <div className="text-sm text-gray-500">{menuItem.path}</div>
                            )}
                          </div>
                        </label>
                      ))
                    )}
                  </div>
                )}
              </>
            )}

            {error && (
              <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
                {error}
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="flex gap-3 p-6 border-t border-gray-100">
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving || loading}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
            >
              {saving ? (
                <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent" />
              ) : (
                <CheckIcon className="h-4 w-4" />
              )}
              {isNew ? 'Create Group' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function Groups() {
  const [groups, setGroups] = useState<UserGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedGroup, setSelectedGroup] = useState<UserGroup | null>(null);
  const [isNewGroup, setIsNewGroup] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<UserGroup | null>(null);

  useEffect(() => {
    loadGroups();
  }, []);

  const loadGroups = async () => {
    try {
      setLoading(true);
      const data = await groupService.getAll();
      setGroups(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load groups');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateNew = () => {
    setSelectedGroup(null);
    setIsNewGroup(true);
    setModalOpen(true);
  };

  const handleEdit = (group: UserGroup) => {
    setSelectedGroup(group);
    setIsNewGroup(false);
    setModalOpen(true);
  };

  const handleModalClose = () => {
    setModalOpen(false);
    setSelectedGroup(null);
    setIsNewGroup(false);
  };

  const handleModalSave = () => {
    handleModalClose();
    loadGroups();
  };

  const handleDelete = async (group: UserGroup) => {
    try {
      await groupService.delete(group.id);
      setDeleteConfirm(null);
      loadGroups();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete group');
    }
  };

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
          <h1 className="text-2xl md:text-3xl font-bold text-gray-900">User Groups</h1>
          <p className="text-gray-500 mt-1">Manage user groups and module access</p>
        </div>
        <button
          onClick={handleCreateNew}
          className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg transition-colors"
        >
          <PlusIcon className="h-5 w-5" />
          New Group
        </button>
      </div>

      {error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
          {error}
          <button onClick={() => setError(null)} className="ml-4 underline">
            Dismiss
          </button>
        </div>
      )}

      {/* Groups List */}
      {groups.length === 0 ? (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-12 text-center">
          <UserGroupIcon className="h-12 w-12 text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">No groups yet</h3>
          <p className="text-gray-500 mb-6">
            Create your first group to manage module access for users.
          </p>
          <button
            onClick={handleCreateNew}
            className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg transition-colors"
          >
            <PlusIcon className="h-5 w-5" />
            Create Group
          </button>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {groups.map((group) => (
            <div
              key={group.id}
              className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 hover:shadow-md transition-shadow"
            >
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div
                    className="w-10 h-10 rounded-lg flex items-center justify-center"
                    style={{ backgroundColor: (group.color || '#3B82F6') + '20' }}
                  >
                    <UserGroupIcon
                      className="h-5 w-5"
                      style={{ color: group.color || '#3B82F6' }}
                    />
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-900">{group.display_name}</h3>
                    <p className="text-sm text-gray-500">{group.name}</p>
                  </div>
                </div>
                <div className="flex gap-1">
                  <button
                    onClick={() => handleEdit(group)}
                    className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                    title="Edit"
                  >
                    <PencilIcon className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => setDeleteConfirm(group)}
                    className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                    title="Delete"
                  >
                    <TrashIcon className="h-4 w-4" />
                  </button>
                </div>
              </div>

              {group.description && (
                <p className="text-sm text-gray-600 mb-4 line-clamp-2">{group.description}</p>
              )}

              <div className="flex flex-wrap gap-4 text-sm">
                <div className="flex items-center gap-1.5 text-gray-500">
                  <UsersIcon className="h-4 w-4" />
                  <span>{group.member_count || 0} members</span>
                </div>
                <div className="flex items-center gap-1.5 text-gray-500">
                  <Squares2X2Icon className="h-4 w-4" />
                  <span>{group.module_count || 0} modules</span>
                </div>
                <div className="flex items-center gap-1.5 text-gray-500">
                  <Bars3Icon className="h-4 w-4" />
                  <span>{group.menu_item_count || 0} menu</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Edit Modal */}
      <EditGroupModal
        isOpen={modalOpen}
        onClose={handleModalClose}
        onSave={handleModalSave}
        group={selectedGroup}
        isNew={isNewGroup}
      />

      {/* Delete Confirmation */}
      {deleteConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md mx-4 p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Delete Group</h3>
            <p className="text-gray-600 mb-6">
              Are you sure you want to delete <strong>{deleteConfirm.display_name}</strong>?
              This will remove all members from this group.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setDeleteConfirm(null)}
                className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => handleDelete(deleteConfirm)}
                className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
