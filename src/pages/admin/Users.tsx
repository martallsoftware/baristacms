import { useEffect, useState } from 'react';
import { useUser } from '../../context/UserContext';
import { userService, groupService, type User, type UserRole, type UserPermission, type PermissionLevel, type UserGroup } from '../../services/api';
import {
  PencilIcon,
  TrashIcon,
  XMarkIcon,
  ShieldCheckIcon,
  KeyIcon,
  EyeIcon,
  PencilSquareIcon,
  TrashIcon as TrashIconOutline,
  UserGroupIcon,
  UserPlusIcon,
  LockClosedIcon,
  ComputerDesktopIcon,
} from '@heroicons/react/24/outline';

const modules = [
  { id: 'instruments', label: 'Instruments', description: 'Access to instrument management' },
];

const permissionLevels: { value: PermissionLevel; label: string; description: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { value: 'none', label: 'No Access', description: 'Cannot access this module', icon: XMarkIcon },
  { value: 'viewer', label: 'Viewer', description: 'Can view only', icon: EyeIcon },
  { value: 'editor', label: 'Editor', description: 'Can create and edit', icon: PencilSquareIcon },
  { value: 'admin', label: 'Full Access', description: 'Can create, edit, and delete', icon: TrashIconOutline },
];

interface EditModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: { role: UserRole; is_active: number; name: string }, groupIds: number[]) => void;
  user: User | null;
}

function EditUserModal({ isOpen, onClose, onSubmit, user }: EditModalProps) {
  const [formData, setFormData] = useState({
    name: '',
    role: 'user' as UserRole,
    is_active: 1,
  });
  const [allGroups, setAllGroups] = useState<UserGroup[]>([]);
  const [selectedGroupIds, setSelectedGroupIds] = useState<number[]>([]);
  const [loadingGroups, setLoadingGroups] = useState(false);

  useEffect(() => {
    if (user && isOpen) {
      setFormData({
        name: user.name,
        role: user.role,
        is_active: user.is_active,
      });
      loadGroups();
    }
  }, [user, isOpen]);

  const loadGroups = async () => {
    if (!user) return;
    setLoadingGroups(true);
    try {
      const [groups, userGroups] = await Promise.all([
        groupService.getAll(),
        groupService.getUserGroups(user.id),
      ]);
      setAllGroups(groups.filter(g => g.is_active));
      setSelectedGroupIds(userGroups.map(g => g.id));
    } catch (error) {
      console.error('Failed to load groups:', error);
    } finally {
      setLoadingGroups(false);
    }
  };

  const toggleGroup = (groupId: number) => {
    setSelectedGroupIds(prev =>
      prev.includes(groupId)
        ? prev.filter(id => id !== groupId)
        : [...prev, groupId]
    );
  };

  if (!isOpen || !user) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(formData, selectedGroupIds);
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md mx-4 max-h-[90vh] overflow-hidden flex flex-col">
        <div className="flex items-center justify-between p-6 border-b border-gray-100">
          <h2 className="text-lg font-semibold text-gray-900">Edit User</h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <XMarkIcon className="h-5 w-5 text-gray-500" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4 overflow-y-auto flex-1">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
            <input
              type="text"
              disabled
              value={user.email}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg bg-gray-50 text-gray-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
            <input
              type="text"
              required
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Role</label>
            <select
              value={formData.role}
              onChange={(e) => setFormData({ ...formData, role: e.target.value as UserRole })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="user">User</option>
              <option value="manager">Manager</option>
              <option value="admin">Admin</option>
            </select>
            {formData.role === 'admin' && (
              <p className="text-xs text-amber-600 mt-1">Admin users have full access to all modules regardless of groups</p>
            )}
          </div>
          <div>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={formData.is_active === 1}
                onChange={(e) => setFormData({ ...formData, is_active: e.target.checked ? 1 : 0 })}
                className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
              />
              <span className="text-sm font-medium text-gray-700">Active</span>
            </label>
          </div>

          {/* Groups Section */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              <span className="flex items-center gap-2">
                <UserGroupIcon className="h-4 w-4" />
                Groups
              </span>
            </label>
            {loadingGroups ? (
              <div className="flex items-center justify-center py-4">
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-500"></div>
              </div>
            ) : allGroups.length === 0 ? (
              <p className="text-sm text-gray-500 py-2">No groups available. Create groups in the Groups admin page.</p>
            ) : (
              <div className="border border-gray-200 rounded-lg p-3 space-y-2 max-h-40 overflow-y-auto">
                {allGroups.map((group) => (
                  <label
                    key={group.id}
                    className="flex items-center gap-3 p-2 hover:bg-gray-50 rounded-lg cursor-pointer"
                  >
                    <input
                      type="checkbox"
                      checked={selectedGroupIds.includes(group.id)}
                      onChange={() => toggleGroup(group.id)}
                      className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                    />
                    <div className="flex items-center gap-2">
                      {group.color && (
                        <span
                          className="w-3 h-3 rounded-full"
                          style={{ backgroundColor: group.color }}
                        />
                      )}
                      <span className="text-sm font-medium text-gray-700">{group.display_name}</span>
                    </div>
                  </label>
                ))}
              </div>
            )}
            <p className="text-xs text-gray-500 mt-1">Groups determine which modules this user can access.</p>
          </div>

          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              Save Changes
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// Create Local User Modal
interface CreateLocalUserModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: { email: string; name: string; role: UserRole; password: string }) => void;
}

function CreateLocalUserModal({ isOpen, onClose, onSubmit }: CreateLocalUserModalProps) {
  const [formData, setFormData] = useState({
    email: '',
    name: '',
    role: 'user' as UserRole,
    password: '',
  });
  const [error, setError] = useState('');

  useEffect(() => {
    if (isOpen) {
      setFormData({ email: '', name: '', role: 'user', password: '' });
      setError('');
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (formData.password.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }

    onSubmit(formData);
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md mx-4">
        <div className="flex items-center justify-between p-6 border-b border-gray-100">
          <h2 className="text-lg font-semibold text-gray-900">Create Local User</h2>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
            <XMarkIcon className="h-5 w-5 text-gray-500" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg p-3">
              {error}
            </div>
          )}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
            <input
              type="email"
              required
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="user@example.com"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
            <input
              type="text"
              required
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="Full Name"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Role</label>
            <select
              value={formData.role}
              onChange={(e) => setFormData({ ...formData, role: e.target.value as UserRole })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="user">User</option>
              <option value="manager">Manager</option>
              <option value="admin">Admin</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Initial Password</label>
            <input
              type="password"
              required
              value={formData.password}
              onChange={(e) => setFormData({ ...formData, password: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="Min. 6 characters"
              minLength={6}
            />
            <p className="text-xs text-gray-500 mt-1">User will be required to change password on first login</p>
          </div>
          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              Create User
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// Reset Password Modal
interface ResetPasswordModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (password: string) => void;
  user: User | null;
}

function ResetPasswordModal({ isOpen, onClose, onSubmit, user }: ResetPasswordModalProps) {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (isOpen) {
      setPassword('');
      setError('');
    }
  }, [isOpen]);

  if (!isOpen || !user) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (password.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }

    onSubmit(password);
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md mx-4">
        <div className="flex items-center justify-between p-6 border-b border-gray-100">
          <h2 className="text-lg font-semibold text-gray-900">Reset Password</h2>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
            <XMarkIcon className="h-5 w-5 text-gray-500" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg p-3">
              {error}
            </div>
          )}
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
            <p className="text-sm text-amber-800">
              Reset password for <strong>{user.name}</strong> ({user.email})
            </p>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">New Password</label>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="Min. 6 characters"
              minLength={6}
            />
            <p className="text-xs text-gray-500 mt-1">User will be required to change password on next login</p>
          </div>
          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex-1 px-4 py-2 bg-amber-600 text-white rounded-lg hover:bg-amber-700 transition-colors"
            >
              Reset Password
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

interface PermissionsModalProps {
  isOpen: boolean;
  onClose: () => void;
  user: User | null;
}

function PermissionsModal({ isOpen, onClose, user }: PermissionsModalProps) {
  const [permissions, setPermissions] = useState<UserPermission[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState<string | null>(null);

  useEffect(() => {
    if (user && isOpen) {
      loadPermissions();
    }
  }, [user, isOpen]);

  const loadPermissions = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const data = await userService.getPermissions(user.id);
      setPermissions(data);
    } catch (error) {
      console.error('Failed to load permissions:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSetPermission = async (module: string, permission: PermissionLevel) => {
    if (!user) return;
    setSaving(module);
    try {
      const updated = await userService.setPermission(user.id, module, permission);
      setPermissions(updated);
    } catch (error) {
      console.error('Failed to set permission:', error);
    } finally {
      setSaving(null);
    }
  };

  const getPermissionForModule = (module: string): PermissionLevel => {
    const perm = permissions.find(p => p.module === module);
    return perm ? perm.permission : 'none';
  };

  if (!isOpen || !user) return null;

  const isUserAdmin = user.role === 'admin';

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl mx-4 max-h-[90vh] overflow-hidden flex flex-col">
        <div className="flex items-center justify-between p-6 border-b border-gray-100">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">User Permissions</h2>
            <p className="text-sm text-gray-500 mt-1">{user.name} ({user.email})</p>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <XMarkIcon className="h-5 w-5 text-gray-500" />
          </button>
        </div>

        <div className="p-6 overflow-y-auto flex-1">
          {isUserAdmin ? (
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mb-4">
              <div className="flex items-center gap-2">
                <ShieldCheckIcon className="h-5 w-5 text-amber-600" />
                <p className="text-sm text-amber-800">
                  <strong>Admin users have full access to all modules.</strong> Change the user role to customize permissions.
                </p>
              </div>
            </div>
          ) : null}

          {loading ? (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
            </div>
          ) : (
            <div className="space-y-6">
              {modules.map((module) => (
                <div key={module.id} className="border border-gray-200 rounded-lg p-4">
                  <div className="mb-4">
                    <h3 className="font-medium text-gray-900">{module.label}</h3>
                    <p className="text-sm text-gray-500">{module.description}</p>
                  </div>

                  <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                    {permissionLevels.map((level) => {
                      const Icon = level.icon;
                      const isSelected = isUserAdmin ? level.value === 'admin' : getPermissionForModule(module.id) === level.value;
                      const isDisabled = isUserAdmin || saving === module.id;

                      return (
                        <button
                          key={level.value}
                          onClick={() => handleSetPermission(module.id, level.value)}
                          disabled={isDisabled}
                          className={`p-3 rounded-lg border-2 transition-all text-left ${
                            isSelected
                              ? 'border-blue-500 bg-blue-50'
                              : 'border-gray-200 hover:border-gray-300'
                          } ${isDisabled ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer'}`}
                        >
                          <div className="flex items-center gap-2 mb-1">
                            <Icon className={`h-4 w-4 ${isSelected ? 'text-blue-600' : 'text-gray-400'}`} />
                            <span className={`text-sm font-medium ${isSelected ? 'text-blue-900' : 'text-gray-700'}`}>
                              {level.label}
                            </span>
                          </div>
                          <p className={`text-xs ${isSelected ? 'text-blue-700' : 'text-gray-500'}`}>
                            {level.description}
                          </p>
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="p-6 border-t border-gray-100">
          <button
            onClick={onClose}
            className="w-full px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

export default function UsersPage() {
  const { user: currentUser, isAdmin } = useUser();
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [permissionsUser, setPermissionsUser] = useState<User | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<number | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [resetPasswordUser, setResetPasswordUser] = useState<User | null>(null);

  useEffect(() => {
    loadUsers();
  }, []);

  const loadUsers = async () => {
    try {
      const data = await userService.getAll();
      setUsers(data);
    } catch (error) {
      console.error('Failed to load users:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleUpdate = async (data: { role: UserRole; is_active: number; name: string }, groupIds: number[]) => {
    if (!editingUser) return;
    try {
      // Update user details
      await userService.update(editingUser.id, data);

      // Update user's group memberships
      // We need to update each group's membership - add user to selected groups, remove from unselected
      const currentUserGroups = await groupService.getUserGroups(editingUser.id);
      const currentGroupIds = currentUserGroups.map(g => g.id);

      // Find groups to add and remove
      const groupsToAdd = groupIds.filter(id => !currentGroupIds.includes(id));
      const groupsToRemove = currentGroupIds.filter(id => !groupIds.includes(id));

      // Update group memberships
      for (const groupId of groupsToAdd) {
        const group = await groupService.getById(groupId);
        const currentMemberIds = group.members?.map(m => m.id) || [];
        await groupService.updateMembers(groupId, [...currentMemberIds, editingUser.id]);
      }

      for (const groupId of groupsToRemove) {
        const group = await groupService.getById(groupId);
        const currentMemberIds = group.members?.map(m => m.id) || [];
        await groupService.updateMembers(groupId, currentMemberIds.filter(id => id !== editingUser.id));
      }

      await loadUsers();
      setEditingUser(null);
    } catch (error) {
      console.error('Failed to update user:', error);
    }
  };

  const handleDelete = async (id: number) => {
    try {
      await userService.delete(id);
      await loadUsers();
      setDeleteConfirm(null);
    } catch (error) {
      console.error('Failed to delete user:', error);
    }
  };

  const handleCreateLocalUser = async (data: { email: string; name: string; role: UserRole; password: string }) => {
    try {
      await userService.create(data);
      await loadUsers();
      setShowCreateModal(false);
    } catch (error) {
      console.error('Failed to create user:', error);
      throw error; // Re-throw to show error in modal
    }
  };

  const handleResetPassword = async (password: string) => {
    if (!resetPasswordUser) return;
    try {
      await userService.resetPassword(resetPasswordUser.id, password);
      setResetPasswordUser(null);
    } catch (error) {
      console.error('Failed to reset password:', error);
      throw error;
    }
  };

  const getRoleBadgeColor = (role: UserRole) => {
    switch (role) {
      case 'admin':
        return 'bg-red-100 text-red-800';
      case 'manager':
        return 'bg-amber-100 text-amber-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  if (!isAdmin) {
    return (
      <div className="p-8">
        <div className="bg-red-50 border border-red-200 rounded-lg p-6 text-center">
          <ShieldCheckIcon className="h-12 w-12 mx-auto text-red-400 mb-3" />
          <h2 className="text-lg font-semibold text-red-800">Access Denied</h2>
          <p className="text-red-600 mt-1">You need administrator privileges to view this page.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-8">
      {/* Header */}
      <div className="flex items-start justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">User Management</h1>
          <p className="text-gray-500 mt-1">Manage user roles and module permissions.</p>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          <UserPlusIcon className="h-5 w-5" />
          Create Local User
        </button>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
          </div>
        ) : users.length === 0 ? (
          <div className="text-center py-12 text-gray-500">
            <p>No users found.</p>
          </div>
        ) : (
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr className="text-left text-sm text-gray-500">
                <th className="px-6 py-4 font-medium">Name</th>
                <th className="px-6 py-4 font-medium">Email</th>
                <th className="px-6 py-4 font-medium">Auth</th>
                <th className="px-6 py-4 font-medium">Role</th>
                <th className="px-6 py-4 font-medium">Status</th>
                <th className="px-6 py-4 font-medium">Joined</th>
                <th className="px-6 py-4 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.map((user) => (
                <tr key={user.id} className="border-t border-gray-100 hover:bg-gray-50">
                  <td className="px-6 py-4 font-medium text-gray-900">{user.name}</td>
                  <td className="px-6 py-4 text-gray-600">{user.email}</td>
                  <td className="px-6 py-4">
                    <span
                      className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        user.auth_type === 'local'
                          ? 'bg-purple-100 text-purple-800'
                          : 'bg-blue-100 text-blue-800'
                      }`}
                    >
                      {user.auth_type === 'local' ? (
                        <ComputerDesktopIcon className="h-3 w-3" />
                      ) : (
                        <svg className="w-3 h-3" viewBox="0 0 21 21" fill="none">
                          <rect x="1" y="1" width="9" height="9" fill="#F25022" />
                          <rect x="11" y="1" width="9" height="9" fill="#7FBA00" />
                          <rect x="1" y="11" width="9" height="9" fill="#00A4EF" />
                          <rect x="11" y="11" width="9" height="9" fill="#FFB900" />
                        </svg>
                      )}
                      {user.auth_type === 'local' ? 'Local' : 'M365'}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <span
                      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getRoleBadgeColor(
                        user.role
                      )}`}
                    >
                      {user.role}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <span
                      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        user.is_active ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
                      }`}
                    >
                      {user.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-gray-500">
                    {new Date(user.created_at).toLocaleDateString()}
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        onClick={() => setPermissionsUser(user)}
                        className="p-2 hover:bg-blue-50 rounded-lg transition-colors"
                        title="Permissions"
                      >
                        <KeyIcon className="h-4 w-4 text-blue-500" />
                      </button>
                      {user.auth_type === 'local' && (
                        <button
                          onClick={() => setResetPasswordUser(user)}
                          className="p-2 hover:bg-amber-50 rounded-lg transition-colors"
                          title="Reset Password"
                        >
                          <LockClosedIcon className="h-4 w-4 text-amber-500" />
                        </button>
                      )}
                      <button
                        onClick={() => setEditingUser(user)}
                        className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                        title="Edit"
                      >
                        <PencilIcon className="h-4 w-4 text-gray-500" />
                      </button>
                      {user.id !== currentUser?.id && (
                        <>
                          {deleteConfirm === user.id ? (
                            <div className="flex items-center gap-1">
                              <button
                                onClick={() => handleDelete(user.id)}
                                className="px-2 py-1 text-xs bg-red-600 text-white rounded hover:bg-red-700"
                              >
                                Confirm
                              </button>
                              <button
                                onClick={() => setDeleteConfirm(null)}
                                className="px-2 py-1 text-xs bg-gray-200 text-gray-700 rounded hover:bg-gray-300"
                              >
                                Cancel
                              </button>
                            </div>
                          ) : (
                            <button
                              onClick={() => setDeleteConfirm(user.id)}
                              className="p-2 hover:bg-red-50 rounded-lg transition-colors"
                              title="Delete"
                            >
                              <TrashIcon className="h-4 w-4 text-red-500" />
                            </button>
                          )}
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Edit Modal */}
      <EditUserModal
        isOpen={!!editingUser}
        onClose={() => setEditingUser(null)}
        onSubmit={handleUpdate}
        user={editingUser}
      />

      {/* Permissions Modal */}
      <PermissionsModal
        isOpen={!!permissionsUser}
        onClose={() => setPermissionsUser(null)}
        user={permissionsUser}
      />

      {/* Create Local User Modal */}
      <CreateLocalUserModal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onSubmit={handleCreateLocalUser}
      />

      {/* Reset Password Modal */}
      <ResetPasswordModal
        isOpen={!!resetPasswordUser}
        onClose={() => setResetPasswordUser(null)}
        onSubmit={handleResetPassword}
        user={resetPasswordUser}
      />
    </div>
  );
}
