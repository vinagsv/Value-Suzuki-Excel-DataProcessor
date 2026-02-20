import React, { useState, useEffect } from 'react';
import { Users, Settings, Database, Trash2, Upload, Save, UserPlus, X, Check, RefreshCw, Edit3, Hash } from 'lucide-react';

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
        portal_password: ''
    });

    // Bulk Delete State
    const [delRange, setDelRange] = useState({ from: '', to: '' });

    // PDF Upload State
    const [pdfFile, setPdfFile] = useState(null);

    // Sequence Controls State
    const [seqValues, setSeqValues] = useState({
        general: '',
        dp: '',
        gatepass: ''
    });

    useEffect(() => {
        if(activeTab === 'users') fetchUsers();
        if(activeTab === 'settings') fetchSettings();
    }, [activeTab]);

    const showToast = (msg, type = 'success') => {
        if(window.toast) window.toast(msg, type);
    };

    // --- USERS ---
    const fetchUsers = async () => {
        const res = await fetch(`${API_URL}/admin/users`, { credentials: 'include' });
        if(res.ok) setUsers(await res.json());
    };

    const handleCreateUser = async (e) => {
        e.preventDefault();
        const res = await fetch(`${API_URL}/admin/users`, {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify(newUser),
            credentials: 'include'
        });
        if(res.ok) {
            showToast('User created');
            setNewUser({ username: '', email: '', password: '', role: 'user' });
            fetchUsers();
        } else {
            showToast('Failed to create user', 'error');
        }
    };

    const handleDeleteUser = async (id) => {
        if(!confirm("Delete user?")) return;
        const res = await fetch(`${API_URL}/admin/users/${id}`, { 
            method: 'DELETE',
            credentials: 'include'
        });
        if(res.ok) {
            showToast('User deleted');
            fetchUsers();
        } else {
            showToast('Failed to delete', 'error');
        }
    };

    // --- SETTINGS ---
    const fetchSettings = async () => {
        const res = await fetch(`${API_URL}/admin/settings`, { credentials: 'include' });
        if(res.ok) {
            const data = await res.json();
            setSettings(prev => ({ ...prev, ...data }));
        }
    };

    const saveSettings = async () => {
        const res = await fetch(`${API_URL}/admin/settings`, {
            method: 'PUT',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify(settings),
            credentials: 'include'
        });
        if(res.ok) {
            showToast('Settings saved successfully');
            setIsEditingSettings(false);
        } else {
            showToast('Failed to save settings', 'error');
        }
    };

    // --- DB SEQUENCE MANAGEMENT ---
    const handleResetDbSequence = async (type) => {
        const val = seqValues[type];
        if (!val || isNaN(val) || val < 1) {
            return showToast(`Please enter a valid starting number for ${type}.`, 'error');
        }

        if(!confirm(`WARNING: Resetting ${type.toUpperCase()} to start from ${val}. Are you sure?`)) return;

        try {
            const res = await fetch(`${API_URL}/admin/reset-sequence`, {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({ type, value: val }),
                credentials: 'include'
            });
            const data = await res.json();
            if(res.ok) {
                showToast(data.message, 'success');
                setSeqValues(prev => ({...prev, [type]: ''}));
            } else {
                showToast(data.error, 'error');
            }
        } catch(e) {
            showToast('Server connection error', 'error');
        }
    };

    // --- DATA ACTIONS ---
    const handleBulkDelete = async () => {
        if(!confirm(`Are you sure you want to delete ALL receipts from ${delRange.from} to ${delRange.to}? This cannot be undone.`)) return;
        const res = await fetch(`${API_URL}/admin/receipts/bulk`, {
            method: 'DELETE',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({ fromDate: delRange.from, toDate: delRange.to }),
            credentials: 'include'
        });
        const data = await res.json();
        if(res.ok) showToast(data.message);
        else showToast(data.error, 'error');
    };

    const handlePdfUpload = async () => {
        if(!pdfFile) return;
        const formData = new FormData();
        formData.append('file', pdfFile);
        
        const res = await fetch(`${API_URL}/admin/pricelist/upload`, {
            method: 'POST',
            body: formData,
            credentials: 'include'
        });
        const data = await res.json();
        if(res.ok) {
            showToast(data.message);
            setPdfFile(null); // Clear file input after successful upload
            // Optionally clear the input field visually
            document.getElementById('pdf-upload-input').value = "";
        } else {
            showToast(data.error, 'error');
        }
    };

    const tabClass = (id) => `px-6 py-3 font-bold rounded-t-lg transition-colors ${activeTab === id 
        ? (isDark ? 'bg-gray-800 text-blue-400 border-t-2 border-blue-400' : 'bg-white text-blue-600 border-t-2 border-blue-600') 
        : (isDark ? 'bg-gray-900 text-gray-500 hover:text-gray-300' : 'bg-gray-100 text-gray-500 hover:text-gray-700')}`;

    const inputClass = `w-full p-2 rounded border ${isDark ? 'bg-gray-700 border-gray-600 text-white' : 'bg-white border-gray-300'} focus:ring-2 focus:ring-blue-500 outline-none`;

    return (
        <div className="container mx-auto p-6 max-w-6xl">
            <h1 className={`text-3xl font-bold mb-6 ${isDark ? 'text-white' : 'text-gray-800'}`}>Admin Panel</h1>
            
            <div className="flex border-b border-gray-200 dark:border-gray-700 mb-6 flex-wrap">
                <button onClick={() => setActiveTab('users')} className={tabClass('users')}><Users className="inline mr-2" size={18}/> Users</button>
                <button onClick={() => setActiveTab('settings')} className={tabClass('settings')}><Settings className="inline mr-2" size={18}/> Settings & Formats</button>
                <button onClick={() => setActiveTab('sequences')} className={tabClass('sequences')}><Hash className="inline mr-2" size={18}/> Sequence Numbers</button>
                <button onClick={() => setActiveTab('data')} className={tabClass('data')}><Database className="inline mr-2" size={18}/> Data Tools</button>
            </div>

            <div className={`p-6 rounded-b-xl rounded-tr-xl shadow-xl ${isDark ? 'bg-gray-800' : 'bg-white'}`}>
                
                {/* USERS TAB */}
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
                                                <td className="p-3"><span className={`px-2 py-1 rounded text-xs uppercase font-bold ${u.role === 'admin' ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700'}`}>{u.role}</span></td>
                                                <td className="p-3">
                                                    <button onClick={() => handleDeleteUser(u.id)} className="text-red-500 hover:text-red-700 p-1"><Trash2 size={16}/></button>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                        <div className={`p-6 rounded-xl h-fit ${isDark ? 'bg-gray-700/50' : 'bg-gray-50'}`}>
                            <h3 className="font-bold text-lg mb-4 flex items-center gap-2"><UserPlus size={20}/> Create User</h3>
                            <form onSubmit={handleCreateUser} className="space-y-3">
                                <input placeholder="Username" value={newUser.username} onChange={e => setNewUser({...newUser, username: e.target.value})} className={inputClass} required/>
                                <input placeholder="Email" type="email" value={newUser.email} onChange={e => setNewUser({...newUser, email: e.target.value})} className={inputClass} required/>
                                <input placeholder="Password" type="password" value={newUser.password} onChange={e => setNewUser({...newUser, password: e.target.value})} className={inputClass} required/>
                                <select value={newUser.role} onChange={e => setNewUser({...newUser, role: e.target.value})} className={inputClass}>
                                    <option value="user">User</option>
                                    <option value="admin">Admin</option>
                                </select>
                                <button className="w-full bg-blue-600 hover:bg-blue-700 text-white py-2 rounded-lg font-bold mt-2">Create Account</button>
                            </form>
                        </div>
                    </div>
                )}

                {/* SETTINGS TAB */}
                {activeTab === 'settings' && (
                    <div className="max-w-3xl">
                        <div className="flex justify-between items-center mb-6">
                            <h3 className="text-xl font-bold">System Configuration</h3>
                            {!isEditingSettings && (
                                <button onClick={() => setIsEditingSettings(true)} className="bg-blue-100 hover:bg-blue-200 text-blue-700 px-4 py-2 rounded-lg font-bold flex items-center gap-2 transition">
                                    <Edit3 size={16}/> Edit Settings
                                </button>
                            )}
                        </div>
                        
                        <div className="mb-8">
                            <label className="block font-bold mb-2 text-sm uppercase text-gray-500">Receipt File Number Prefix</label>
                            <p className="text-xs mb-2 text-gray-400">Current Prefix for NEW files. Will be prepended to any file numbers entered in the receipt form.</p>
                            {isEditingSettings ? (
                                <input value={settings.file_prefix} onChange={e => setSettings({...settings, file_prefix: e.target.value})} className={inputClass} placeholder="e.g. VMA2025/"/>
                            ) : (
                                <div className={`p-3 rounded border font-mono max-w-sm ${isDark ? 'bg-gray-700 border-gray-600 text-white' : 'bg-gray-50 border-gray-300 text-gray-900'}`}>
                                    {settings.file_prefix || <span className="text-gray-400 italic">Not Set</span>}
                                </div>
                            )}
                        </div>

                        <div className="mb-8 border-t pt-6 border-gray-200 dark:border-gray-700">
                            <h4 className="font-bold mb-4">Portal Credentials (for Verify Module)</h4>
                            <div className="grid md:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-bold uppercase mb-1">Portal Email</label>
                                    {isEditingSettings ? (
                                        <input value={settings.portal_email} onChange={e => setSettings({...settings, portal_email: e.target.value})} className={inputClass} />
                                    ) : (
                                        <div className={`p-3 rounded border ${isDark ? 'bg-gray-700 border-gray-600 text-white' : 'bg-gray-50 border-gray-300 text-gray-900'}`}>
                                            {settings.portal_email || <span className="text-gray-400 italic">Not Set</span>}
                                        </div>
                                    )}
                                </div>
                                <div>
                                    <label className="block text-xs font-bold uppercase mb-1">Portal Password</label>
                                    {isEditingSettings ? (
                                        <input type="password" value={settings.portal_password} onChange={e => setSettings({...settings, portal_password: e.target.value})} className={inputClass} />
                                    ) : (
                                        <div className={`p-3 rounded border ${isDark ? 'bg-gray-700 border-gray-600 text-gray-400' : 'bg-gray-50 border-gray-300 text-gray-500'}`}>
                                            {settings.portal_password ? '••••••••' : <span className="italic">Not Set</span>}
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>

                        {isEditingSettings && (
                            <div className="flex gap-4">
                                <button onClick={saveSettings} className="bg-green-600 hover:bg-green-700 text-white px-6 py-3 rounded-lg font-bold flex items-center gap-2 transition">
                                    <Save size={18}/> Save All Settings
                                </button>
                                <button onClick={() => setIsEditingSettings(false)} className="bg-gray-300 hover:bg-gray-400 text-gray-800 px-6 py-3 rounded-lg font-bold flex items-center gap-2 transition">
                                    Cancel
                                </button>
                            </div>
                        )}
                    </div>
                )}

                {/* SEQUENCES TAB */}
                {activeTab === 'sequences' && (
                    <div className="grid md:grid-cols-3 gap-6">
                        <div className={`p-6 rounded-xl border ${isDark ? 'bg-gray-700/30 border-gray-600' : 'bg-gray-50 border-gray-200'}`}>
                            <h3 className="font-bold text-blue-600 mb-2">General Receipts</h3>
                            <p className="text-sm text-gray-500 mb-4">Overrides the counter for the YYXXXX format. Ex: enter 50 to make the next receipt 250050.</p>
                            <input type="number" placeholder="Enter starting number" value={seqValues.general} onChange={e => setSeqValues({...seqValues, general: e.target.value})} className={`${inputClass} mb-4`} />
                            <button onClick={() => handleResetDbSequence('general')} className="w-full bg-blue-600 hover:bg-blue-700 text-white py-2 rounded font-bold">Force Set Next</button>
                        </div>

                        <div className={`p-6 rounded-xl border ${isDark ? 'bg-gray-700/30 border-gray-600' : 'bg-gray-50 border-gray-200'}`}>
                            <h3 className="font-bold text-blue-600 mb-2">DP Receipts</h3>
                            <p className="text-sm text-gray-500 mb-4">Resets the PostgreSQL serial sequence. Only do this if starting fresh or fixing a gap.</p>
                            <input type="number" placeholder="Enter starting number" value={seqValues.dp} onChange={e => setSeqValues({...seqValues, dp: e.target.value})} className={`${inputClass} mb-4`} />
                            <button onClick={() => handleResetDbSequence('dp')} className="w-full bg-blue-600 hover:bg-blue-700 text-white py-2 rounded font-bold">Restart Sequence</button>
                        </div>

                        <div className={`p-6 rounded-xl border ${isDark ? 'bg-gray-700/30 border-gray-600' : 'bg-gray-50 border-gray-200'}`}>
                            <h3 className="font-bold text-blue-600 mb-2">Gate Passes</h3>
                            <p className="text-sm text-gray-500 mb-4">Resets the PostgreSQL serial sequence. Only do this if starting fresh or fixing a gap.</p>
                            <input type="number" placeholder="Enter starting number" value={seqValues.gatepass} onChange={e => setSeqValues({...seqValues, gatepass: e.target.value})} className={`${inputClass} mb-4`} />
                            <button onClick={() => handleResetDbSequence('gatepass')} className="w-full bg-blue-600 hover:bg-blue-700 text-white py-2 rounded font-bold">Restart Sequence</button>
                        </div>
                    </div>
                )}

                {/* DATA TAB */}
                {activeTab === 'data' && (
                    <div className="grid md:grid-cols-2 gap-8">
                        <div className={`p-6 rounded-xl border-l-4 border-red-500 ${isDark ? 'bg-red-900/10' : 'bg-red-50'}`}>
                            <h3 className="font-bold text-red-600 flex items-center gap-2 mb-4"><Trash2/> Bulk Delete Receipts</h3>
                            <p className="text-sm mb-4">Permanently delete receipts within a date range.</p>
                            <div className="flex gap-2 mb-4">
                                <input type="date" value={delRange.from} onChange={e => setDelRange({...delRange, from: e.target.value})} className={inputClass}/>
                                <input type="date" value={delRange.to} onChange={e => setDelRange({...delRange, to: e.target.value})} className={inputClass}/>
                            </div>
                            <button onClick={handleBulkDelete} className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded font-bold w-full">Delete Permanently</button>
                        </div>

                        {/* Price List PDF Upload */}
                        <div className={`p-6 rounded-xl border-l-4 border-blue-500 ${isDark ? 'bg-blue-900/10' : 'bg-blue-50'}`}>
                            <h3 className="font-bold text-blue-600 flex items-center gap-2 mb-4"><Upload/> Price List PDF Upload</h3>
                            <p className="text-sm mb-4 text-gray-500">Save your Excel file as a PDF and upload it here for a perfect visual snapshot.</p>
                            <input 
                                id="pdf-upload-input"
                                type="file" 
                                accept=".pdf" 
                                onChange={e => setPdfFile(e.target.files[0])} 
                                className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-100 file:text-blue-700 hover:file:bg-blue-200 mb-4"
                            />
                            <button 
                                onClick={handlePdfUpload} 
                                disabled={!pdfFile} 
                                className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white px-4 py-2 rounded font-bold w-full transition-colors"
                            >
                                Upload PDF Snapshot
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default AdminPanel;