'use client'

import React, { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { apiClient } from '@/api/client'
import { useAuth } from '@/contexts/AuthContext'

type AdminUser = {
  id: string
  email: string
  role: 'admin' | 'user'
  is_active: boolean
  created_at: string
}

const fetchUsers = async (): Promise<AdminUser[]> => {
  const res = await apiClient.get<AdminUser[]>('/admin/users')
  return res.data
}

export const AdminPage: React.FC = () => {
  const { user: currentUser } = useAuth()
  const qc = useQueryClient()
  const { data: users = [], isLoading } = useQuery({ queryKey: ['admin-users'], queryFn: fetchUsers })

  const [showAddForm, setShowAddForm] = useState(false)
  const [newEmail, setNewEmail] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [newRole, setNewRole] = useState<'user' | 'admin'>('user')
  const [addError, setAddError] = useState<string | null>(null)

  const [resetPasswordFor, setResetPasswordFor] = useState<string | null>(null)
  const [newResetPassword, setNewResetPassword] = useState('')

  const [deleteConfirmFor, setDeleteConfirmFor] = useState<string | null>(null)

  const invalidate = () => qc.invalidateQueries({ queryKey: ['admin-users'] })

  const addUser = useMutation({
    mutationFn: (body: { email: string; password: string; role: string }) =>
      apiClient.post('/admin/users', body),
    onSuccess: () => {
      invalidate()
      setShowAddForm(false)
      setNewEmail('')
      setNewPassword('')
      setNewRole('user')
      setAddError(null)
    },
    onError: () => setAddError('Failed to create user'),
  })

  const patchUser = useMutation({
    mutationFn: ({ id, body }: { id: string; body: { password?: string; is_active?: boolean; role?: string } }) =>
      apiClient.patch(`/admin/users/${id}`, body),
    onSuccess: () => {
      invalidate()
      setResetPasswordFor(null)
      setNewResetPassword('')
    },
  })

  const deleteUser = useMutation({
    mutationFn: (id: string) => apiClient.delete(`/admin/users/${id}`),
    onSuccess: () => {
      invalidate()
      setDeleteConfirmFor(null)
    },
  })

  const handleAddSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setAddError(null)
    addUser.mutate({ email: newEmail, password: newPassword, role: newRole })
  }

  const handleResetPassword = (id: string) => {
    if (!newResetPassword.trim()) return
    patchUser.mutate({ id, body: { password: newResetPassword } })
  }

  const handleToggleActive = (u: AdminUser) => {
    patchUser.mutate({ id: u.id, body: { is_active: !u.is_active } })
  }

  const handleDelete = (id: string) => {
    deleteUser.mutate(id)
  }

  return (
    <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">User Management</h1>
        <button
          onClick={() => { setShowAddForm((v) => !v); setAddError(null) }}
          className="bg-gray-900 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-gray-700 transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-900"
        >
          {showAddForm ? 'Cancel' : 'Add User'}
        </button>
      </div>

      {showAddForm && (
        <div className="bg-white border border-gray-200 rounded-2xl p-6 mb-6">
          <h2 className="text-base font-semibold text-gray-900 mb-4">New User</h2>
          <form onSubmit={handleAddSubmit} className="flex flex-wrap gap-3 items-end">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Email</label>
              <input
                type="email"
                required
                value={newEmail}
                onChange={(e) => setNewEmail(e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-gray-900 w-56"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Password</label>
              <input
                type="password"
                required
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-gray-900 w-44"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Role</label>
              <select
                value={newRole}
                onChange={(e) => setNewRole(e.target.value as 'user' | 'admin')}
                className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
              >
                <option value="user">User</option>
                <option value="admin">Admin</option>
              </select>
            </div>
            <button
              type="submit"
              disabled={addUser.isPending}
              className="bg-gray-900 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-gray-700 transition-colors disabled:opacity-60"
            >
              {addUser.isPending ? 'Adding…' : 'Add'}
            </button>
          </form>
          {addError && <p className="text-sm text-red-600 mt-2">{addError}</p>}
        </div>
      )}

      <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
        {isLoading ? (
          <div className="flex items-center justify-center py-16">
            <div className="w-6 h-6 border-2 border-gray-900 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Email</th>
                <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Role</th>
                <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Status</th>
                <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Created</th>
                <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {users.map((u) => (
                <React.Fragment key={u.id}>
                  <tr className="hover:bg-gray-50">
                    <td className="px-6 py-4 text-gray-900 font-medium">{u.email}</td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                        u.role === 'admin' ? 'bg-purple-100 text-purple-700' : 'bg-gray-100 text-gray-600'
                      }`}>
                        {u.role}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                        u.is_active ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-600'
                      }`}>
                        {u.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-gray-500">
                      {new Date(u.created_at).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2 flex-wrap">
                        <button
                          onClick={() => {
                            setResetPasswordFor(resetPasswordFor === u.id ? null : u.id)
                            setNewResetPassword('')
                          }}
                          className="text-xs px-2 py-1 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                        >
                          Reset Password
                        </button>
                        <button
                          onClick={() => handleToggleActive(u)}
                          disabled={patchUser.isPending}
                          className="text-xs px-2 py-1 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
                        >
                          {u.is_active ? 'Deactivate' : 'Activate'}
                        </button>
                        {currentUser?.id !== u.id && (
                          deleteConfirmFor === u.id ? (
                            <>
                              <button
                                onClick={() => handleDelete(u.id)}
                                disabled={deleteUser.isPending}
                                className="text-xs px-2 py-1 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50"
                              >
                                Confirm
                              </button>
                              <button
                                onClick={() => setDeleteConfirmFor(null)}
                                className="text-xs px-2 py-1 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                              >
                                Cancel
                              </button>
                            </>
                          ) : (
                            <button
                              onClick={() => setDeleteConfirmFor(u.id)}
                              className="text-xs px-2 py-1 border border-red-300 text-red-600 rounded-lg hover:bg-red-50 transition-colors"
                            >
                              Delete
                            </button>
                          )
                        )}
                      </div>
                    </td>
                  </tr>
                  {resetPasswordFor === u.id && (
                    <tr className="bg-gray-50">
                      <td colSpan={5} className="px-6 py-3">
                        <div className="flex items-center gap-2">
                          <input
                            type="password"
                            placeholder="New password"
                            value={newResetPassword}
                            onChange={(e) => setNewResetPassword(e.target.value)}
                            className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-gray-900 w-56"
                          />
                          <button
                            onClick={() => handleResetPassword(u.id)}
                            disabled={patchUser.isPending || !newResetPassword.trim()}
                            className="text-xs px-3 py-1.5 bg-gray-900 text-white rounded-lg hover:bg-gray-700 transition-colors disabled:opacity-50"
                          >
                            {patchUser.isPending ? 'Saving…' : 'Save'}
                          </button>
                          <button
                            onClick={() => { setResetPasswordFor(null); setNewResetPassword('') }}
                            className="text-xs px-3 py-1.5 border border-gray-300 rounded-lg hover:bg-gray-100 transition-colors"
                          >
                            Cancel
                          </button>
                        </div>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              ))}
              {users.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-6 py-10 text-center text-gray-400 text-sm">
                    No users found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        )}
      </div>
    </main>
  )
}
