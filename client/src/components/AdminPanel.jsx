import React, { useState, useEffect } from 'react';
import { Users, Settings, Database, Save, UserPlus, Edit3, Hash, ToggleLeft, ToggleRight } from 'lucide-react';

const API_URL = import.meta.env.VITE_API_URL;

const AdminPanel = ({ theme }) => {
  const isDark = theme === 'dark';
  const [activeTab, setActiveTab] = useState('users');

  // Users State
  const [users, setUsers] = useState([]);
  const [newUser, setNewUser] = useState({ username: '', email: '', password: '', role: 'user' });

  // Settings State
  const [isEditingSettings, setIsEditingSettings] = useState(false);
  const [settings, setSettings] = useState({
    file_prefix: '',
    portal_email: '',
    portal_password: '',
    qr_enabled: 'true'
  });
  const [fetchedSettings, setFetchedSettings] = useState(null);

  // Sequence Controls State
  const [currentSeqs, setCurrentSeqs] = useState({ general: '', dp: '', gatepass: '' });
  const [seqValues, setSeqValues] = useState({ general: '', dp: '', gatepass: '' });

  useEffect(() => {
    if (activeTab === 'users') fetchUsers();
    else if (activeTab === 'settings') fetchSettings();
    else if (activeTab === 'sequences') fetchSequences();
  }, [activeTab]);

  const showToast = (msg, type = 'success') => {
    if (window.toast) window.toast(msg, type);
  };

  // ── USERS ─────────────────────────────────────────────────────────────────

  const fetchUsers = async () => {
    try {
      const res = await fetch(`${API_URL}/admin/users`, { credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data)) setUsers(data);
      } else {
        const data = await res.json();
        showToast(data.error || 'Failed to fetch users', 'error');
      }
    } catch (e) { showToast('Network error fetching users', 'error'); }
  };

  const handleCreateUser = async (e) => {
    e.preventDefault();
    try {
      const res = await fetch(`${API_URL}/admin/users`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newUser),
        credentials: 'include'
      });
      if (res.ok) {
        showToast('User created');
        setNewUser({ username: '', email: '', password: '', role: 'user' });
        fetchUsers();
      } else {
        const data = await res.json();
        showToast(data.error || 'Failed to create user', 'error');
      }
    } catch (e) { showToast('Network connection error', 'error'); }
  };

  const handleDeleteUser = async (id) => {
    if (!confirm("Delete user?")) return;
    try {
      const res = await fetch(`${API_URL}/admin/users/${id}`, {
        method: 'DELETE',
        credentials: 'include'
      });
      if (res.ok) {
        showToast('User deleted');
        fetchUsers();
      } else {
        const data = await res.json();
        showToast(data.error || 'Failed to delete user', 'error');
      }
    } catch (e) { showToast('Network connection error', 'error'); }
  };

  // ── SETTINGS ──────────────────────────────────────────────────────────────

  const fetchSettings = async () => {
    try {
      const res = await fetch(`${API_URL}/admin/settings`, { credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        const merged = {
          file_prefix: '',
          portal_email: '',
          portal_password: '',
          qr_enabled: 'true',
          ...data
        };
        setSettings(merged);
        setFetchedSettings(merged);
      } else {
        const data = await res.json();
        showToast(data.error || 'Failed to load settings', 'error');
      }
    } catch (e) { showToast('Network error loading settings', 'error'); }
  };

  const saveSettings = async () => {
    let liveSettings = fetchedSettings;
    try {
      const liveRes = await fetch(`${API_URL}/admin/settings`, { credentials: 'include' });
      if (liveRes.ok) liveSettings = await liveRes.json();
    } catch (e) {}

    if (liveSettings && liveSettings.file_prefix !== settings.file_prefix) {
      const oldVal = liveSettings.file_prefix || '(empty)';
      const newVal = settings.file_prefix || '(empty)';
      const confirmed = window.confirm(
        `⚠️ You are changing the file number prefix.\n\nFrom: "${oldVal}"\nTo:   "${newVal}"\n\nThis will affect all new receipts immediately. Are you sure?`
      );
      if (!confirmed) return;
    }

    if (liveSettings && liveSettings.qr_enabled !== settings.qr_enabled) {
      const enabling = settings.qr_enabled === 'true';
      const confirmed = window.confirm(
        `You are ${enabling ? 'enabling' : 'disabling'} QR codes on receipts. Continue?`
      );
      if (!confirmed) return;
    }

    try {
      const res = await fetch(`${API_URL}/admin/settings`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings),
        credentials: 'include'
      });
      const data = await res.json();
      if (res.ok) {
        showToast('Settings saved successfully');
        setIsEditingSettings(false);
        fetchSettings();
      } else {
        showToast(data.error || 'Failed to save settings', 'error');
      }
    } catch (err) {
      showToast('Network Error saving settings', 'error');
    }
  };

  const cancelEditSettings = () => {
    if (fetchedSettings) setSettings(fetchedSettings);
    setIsEditingSettings(false);
  };

  // ── SEQUENCES ─────────────────────────────────────────────────────────────

  const fetchSequences = async () => {
    try {
      const res = await fetch(`${API_URL}/admin/sequences`, { credentials: 'include' });
      if (res.ok) setCurrentSeqs(await res.json());
    } catch (e) { console.error("Failed to fetch sequences", e); }
  };

  const handleResetDbSequence = async (type) => {
    const val = seqValues[type];
    if (!val || isNaN(val) || val < 1) {
      return showToast(`Please enter a valid starting number for ${type}.`, 'error');
    }

    if (!confirm(`WARNING: Resetting ${type.toUpperCase()} sequence to start from ${val}. Are you sure?`)) return;

    try {
      const res = await fetch(`${API_URL}/admin/reset-sequence`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type, value: val }),
        credentials: 'include'
      });
      const data = await res.json();
      if (res.ok) {
        showToast(data.message, 'success');
        setSeqValues(prev => ({ ...prev, [type]: '' }));
        fetchSequences();
      } else {
        showToast(data.error, 'error');
      }
    } catch (e) { showToast('Server connection error', 'error'); }
  };

  // ── STYLES ────────────────────────────────────────────────────────────────

  const tabClass = (id) => `px-6 py-3 font-bold rounded-t-lg transition-colors ${activeTab === id
    ? (isDark ? 'bg-gray-800 text-blue-400 border-t-2 border-blue-400' : 'bg-white text-blue-600 border-t-2 border-blue-600')
    : (isDark ? 'bg-gray-900 text-gray-500 hover:text-gray-300' : 'bg-gray-100 text-gray-500 hover:text-gray-700')}`;

  const inputClass = `w-full p-2 rounded border ${isDark ? 'bg-gray-700 border-gray-600 text-white' : 'bg-white border-gray-300'} focus:ring-2 focus:ring-blue-500 outline-none`;

  const readonlyBox = `p-3 rounded border font-mono ${isDark ? 'bg-gray-700 border-gray-600 text-white' : 'bg-gray-50 border-gray-300 text-gray-900'}`;

  // ── RENDER ────────────────────────────────────────────────────────────────

  return (
    <div className="container mx-auto p-6 max-w-6xl">
      <h1 className={`text-3xl font-bold mb-6 ${isDark ? 'text-white' : 'text-gray-800'}`}>Admin Panel</h1>

      <div className="flex border-b border-gray-200 dark:border-gray-700 mb-6 flex-wrap">
        <button onClick={() => setActiveTab('users')} className={tabClass('users')}><Users className="inline mr-2" size={18} /> Users</button>
        <button onClick={() => setActiveTab('settings')} className={tabClass('settings')}><Settings className="inline mr-2" size={18} /> Settings & Formats</button>
        <button onClick={() => setActiveTab('sequences')} className={tabClass('sequences')}><Hash className="inline mr-2" size={18} /> Sequence Numbers</button>
      </div>

      <div className={`p-6 rounded-b-xl rounded-tr-xl shadow-xl ${isDark ? 'bg-gray-800' : 'bg-white'}`}>

        {/* ── USERS TAB ── */}
        {activeTab === 'users' && (
          <div className="grid lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2">
              <h3 className={`text-xl font-bold mb-4 ${isDark ? 'text-white' : 'text-gray-800'}`}>Existing Users</h3>
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead className={`border-b ${isDark ? 'border-gray-700' : 'border-gray-200'}`}>
                    <tr>
                      <th className="p-3">ID</th>
                      <th className="p-3">Username</th>
                      <th className="p-3">Email</th>
                      <th className="p-3">Role</th>
                      <th className="p-3">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                    {users.map(u => (
                      <tr key={u.id} className={isDark ? 'text-gray-300' : 'text-gray-700'}>
                        <td className="p-3">{u.id}</td>
                        <td className="p-3 font-medium">{u.username}</td>
                        <td className="p-3">{u.email}</td>
                        <td className="p-3">
                          <span className={`px-2 py-1 rounded text-xs uppercase font-bold ${u.role === 'admin' ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700'}`}>{u.role}</span>
                        </td>
                        <td className="p-3">
                          <button onClick={() => handleDeleteUser(u.id)} className="text-red-500 hover:text-red-700 p-1 text-xs font-bold">Delete</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
            <div className={`p-6 rounded-xl h-fit ${isDark ? 'bg-gray-700/50' : 'bg-gray-50'}`}>
              <h3 className="font-bold text-lg mb-4 flex items-center gap-2"><UserPlus size={20} /> Create User</h3>
              <form onSubmit={handleCreateUser} className="space-y-3">
                <input placeholder="Username" value={newUser.username} onChange={e => setNewUser({ ...newUser, username: e.target.value })} className={inputClass} required />
                <input placeholder="Email" type="email" value={newUser.email} onChange={e => setNewUser({ ...newUser, email: e.target.value })} className={inputClass} required />
                <input placeholder="Password" type="password" value={newUser.password} onChange={e => setNewUser({ ...newUser, password: e.target.value })} className={inputClass} required />
                <select value={newUser.role} onChange={e => setNewUser({ ...newUser, role: e.target.value })} className={inputClass}>
                  <option value="user">User</option>
                  <option value="admin">Admin</option>
                </select>
                <button className="w-full bg-blue-600 hover:bg-blue-700 text-white py-2 rounded-lg font-bold mt-2">Create Account</button>
              </form>
            </div>
          </div>
        )}

        {/* ── SETTINGS TAB ── */}
        {activeTab === 'settings' && (
          <div className="max-w-3xl">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-bold">System Configuration</h3>
              {!isEditingSettings && (
                <button
                  onClick={() => { fetchSettings(); setIsEditingSettings(true); }}
                  className="bg-blue-100 hover:bg-blue-200 text-blue-700 px-4 py-2 rounded-lg font-bold flex items-center gap-2 transition"
                >
                  <Edit3 size={16} /> Edit Settings
                </button>
              )}
            </div>

            {/* File Prefix */}
            <div className="mb-8">
              <label className="block font-bold mb-1 text-sm uppercase text-gray-500">Receipt File Number Prefix</label>
              <p className="text-xs mb-2 text-gray-400">
                Prepended to file numbers on new receipts. Change this at the start of each financial year (e.g. VMA2026/ → VMA2027/).
                When entering a receipt for a previous year file, you can edit the prefix field directly on the receipt form.
              </p>
              {isEditingSettings ? (
                <div>
                  <input
                    value={settings.file_prefix}
                    onChange={e => setSettings({ ...settings, file_prefix: e.target.value })}
                    className={inputClass}
                    placeholder="e.g. VMA2026/"
                  />
                  {!settings.file_prefix.trim() && (
                    <p className="text-xs text-red-500 mt-1 font-semibold">⚠ Prefix cannot be empty — this will break receipt file numbers.</p>
                  )}
                </div>
              ) : (
                <div className={`${readonlyBox} max-w-sm`}>
                  {settings.file_prefix || <span className="text-gray-400 italic">Not Set</span>}
                </div>
              )}
            </div>

            {/* Portal Credentials */}
            <div className="mb-8 border-t pt-6 border-gray-200 dark:border-gray-700">
              <h4 className="font-bold mb-1">Portal Credentials</h4>
              <p className="text-xs text-gray-400 mb-4">Used by the Verify module to connect to the RMS portal.</p>
              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold uppercase mb-1">Portal Email</label>
                  {isEditingSettings ? (
                    <input value={settings.portal_email} onChange={e => setSettings({ ...settings, portal_email: e.target.value })} className={inputClass} />
                  ) : (
                    <div className={readonlyBox}>{settings.portal_email || <span className="text-gray-400 italic">Not Set</span>}</div>
                  )}
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase mb-1">Portal Password</label>
                  {isEditingSettings ? (
                    <input type="password" value={settings.portal_password} onChange={e => setSettings({ ...settings, portal_password: e.target.value })} className={inputClass} />
                  ) : (
                    <div className={`${readonlyBox} ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                      {settings.portal_password ? '••••••••' : <span className="italic">Not Set</span>}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* QR Code Toggle */}
            <div className="mb-8 border-t pt-6 border-gray-200 dark:border-gray-700">
              <h4 className="font-bold mb-1">QR Code on Receipts</h4>
              <p className="text-xs text-gray-400 mb-4">Controls whether a QR code is printed on receipts.</p>
              {isEditingSettings ? (
                <label className="flex items-center gap-3 cursor-pointer select-none w-fit">
                  <div
                    onClick={() => setSettings({ ...settings, qr_enabled: settings.qr_enabled === 'true' ? 'false' : 'true' })}
                    className={`relative w-12 h-6 rounded-full transition-colors duration-200 ${settings.qr_enabled === 'true' ? 'bg-blue-600' : (isDark ? 'bg-gray-600' : 'bg-gray-300')}`}
                  >
                    <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform duration-200 ${settings.qr_enabled === 'true' ? 'translate-x-6' : 'translate-x-0'}`} />
                  </div>
                  <span className={`text-sm font-medium ${isDark ? 'text-gray-200' : 'text-gray-700'}`}>
                    {settings.qr_enabled === 'true' ? 'Enabled' : 'Disabled'}
                  </span>
                </label>
              ) : (
                <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-bold ${settings.qr_enabled === 'true' ? 'bg-green-100 text-green-700' : (isDark ? 'bg-gray-700 text-gray-400' : 'bg-gray-100 text-gray-500')}`}>
                  {settings.qr_enabled === 'true'
                    ? <><ToggleRight size={16} /> QR Enabled</>
                    : <><ToggleLeft size={16} /> QR Disabled</>
                  }
                </div>
              )}
            </div>

            {isEditingSettings && (
              <div className="flex gap-4">
                <button
                  onClick={saveSettings}
                  disabled={!settings.file_prefix.trim()}
                  className="bg-green-600 hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed text-white px-6 py-3 rounded-lg font-bold flex items-center gap-2 transition"
                >
                  <Save size={18} /> Save All Settings
                </button>
                <button
                  onClick={cancelEditSettings}
                  className="bg-gray-300 hover:bg-gray-400 text-gray-800 px-6 py-3 rounded-lg font-bold flex items-center gap-2 transition"
                >
                  Cancel
                </button>
              </div>
            )}
          </div>
        )}

        {/* ── SEQUENCES TAB ── */}
        {activeTab === 'sequences' && (
          <div className="grid md:grid-cols-3 gap-6">
            {/* General Receipts */}
            <div className={`p-6 rounded-xl border flex flex-col justify-between ${isDark ? 'bg-gray-700/30 border-gray-600' : 'bg-gray-50 border-gray-200'}`}>
              <div>
                <h3 className="font-bold text-blue-600 mb-2">General Receipts</h3>
                <p className="text-sm text-gray-500 mb-2">Overrides the counter for the YYXXXX format. Cannot be set below the current max receipt number.</p>
                <p className="text-sm font-bold text-gray-400 mb-4">Current Next: <span className="text-blue-500 text-lg">{currentSeqs.general || '---'}</span></p>
                <input
                  type="number"
                  placeholder="Enter starting number"
                  value={seqValues.general}
                  onChange={e => setSeqValues({ ...seqValues, general: e.target.value })}
                  className={`${inputClass} mb-4`}
                />
              </div>
              <button onClick={() => handleResetDbSequence('general')} className="w-full bg-blue-600 hover:bg-blue-700 text-white py-2 rounded font-bold">Force Set Next</button>
            </div>

            {/* DP Receipts */}
            <div className={`p-6 rounded-xl border flex flex-col justify-between ${isDark ? 'bg-gray-700/30 border-gray-600' : 'bg-gray-50 border-gray-200'}`}>
              <div>
                <h3 className="font-bold text-blue-600 mb-2">DP Receipts</h3>
                <p className="text-sm text-gray-500 mb-2">Resets the PostgreSQL serial sequence. Duplicate numbers are handled gracefully.</p>
                <p className="text-sm font-bold text-gray-400 mb-4">Current Next: <span className="text-blue-500 text-lg">{currentSeqs.dp || '---'}</span></p>
                <input
                  type="number"
                  placeholder="Enter starting number"
                  value={seqValues.dp}
                  onChange={e => setSeqValues({ ...seqValues, dp: e.target.value })}
                  className={`${inputClass} mb-4`}
                />
              </div>
              <button onClick={() => handleResetDbSequence('dp')} className="w-full bg-blue-600 hover:bg-blue-700 text-white py-2 rounded font-bold">Restart Sequence</button>
            </div>

            {/* Gate Passes */}
            <div className={`p-6 rounded-xl border flex flex-col justify-between ${isDark ? 'bg-gray-700/30 border-gray-600' : 'bg-gray-50 border-gray-200'}`}>
              <div>
                <h3 className="font-bold text-blue-600 mb-2">Gate Passes</h3>
                <p className="text-sm text-gray-500 mb-2">Resets the PostgreSQL serial sequence. Duplicate numbers are handled gracefully.</p>
                <p className="text-sm font-bold text-gray-400 mb-4">Current Next: <span className="text-blue-500 text-lg">{currentSeqs.gatepass || '---'}</span></p>
                <input
                  type="number"
                  placeholder="Enter starting number"
                  value={seqValues.gatepass}
                  onChange={e => setSeqValues({ ...seqValues, gatepass: e.target.value })}
                  className={`${inputClass} mb-4`}
                />
              </div>
              <button onClick={() => handleResetDbSequence('gatepass')} className="w-full bg-blue-600 hover:bg-blue-700 text-white py-2 rounded font-bold">Restart Sequence</button>
            </div>
          </div>
        )}

      </div>
    </div>
  );
};

export default AdminPanel;