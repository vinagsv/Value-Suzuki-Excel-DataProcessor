import React, { useState, useEffect } from 'react';
import { UserCog, Save, Lock, Mail, AlertCircle, CheckCircle } from 'lucide-react';

const API_URL = import.meta.env.VITE_API_URL;

const UserProfile = ({ theme }) => {
  const isDark = theme === 'dark';
  
  // State
  const [formData, setFormData] = useState({
    email: '',
    currentPassword: '',
    newPassword: ''
  });
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState({ type: '', msg: '' });

  useEffect(() => {
      const savedEmail = localStorage.getItem('userEmail'); 
      if(savedEmail) setFormData(prev => ({ ...prev, email: savedEmail }));
  }, []);

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setStatus({ type: '', msg: '' });

    try {
      const token = localStorage.getItem('token'); 
      // Note: Credentials 'include' handles the cookie automatically
      const res = await fetch(`${API_URL}/auth/update-profile`, {
        method: 'PUT',
        headers: { 
            'Content-Type': 'application/json',
        },
        credentials: 'include', 
        body: JSON.stringify({
            newEmail: formData.email,
            newPassword: formData.newPassword || undefined, // Only send if changed
            currentPassword: formData.currentPassword
        })
      });

      const data = await res.json();

      if (res.ok) {
        setStatus({ type: 'success', msg: 'Profile updated successfully!' });
        // Update local storage if email changed
        localStorage.setItem('userEmail', formData.email);
        setFormData(prev => ({ ...prev, currentPassword: '', newPassword: '' }));
      } else {
        setStatus({ type: 'error', msg: data.error || 'Update failed' });
      }
    } catch (err) {
      setStatus({ type: 'error', msg: 'Server connection error' });
    } finally {
      setLoading(false);
    }
  };

  const inputClass = `w-full p-3 rounded-xl border ${isDark ? "bg-gray-700 border-gray-600 text-white" : "bg-white border-gray-300 text-gray-900"} focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all`;
  const labelClass = `block text-sm font-bold mb-2 ${isDark ? "text-gray-300" : "text-gray-700"}`;

  return (
    <div className="container mx-auto p-4 md:p-8 max-w-2xl">
      <div className={`rounded-2xl shadow-xl p-8 ${isDark ? "bg-gray-800 border border-gray-700" : "bg-white border border-gray-100"}`}>
        
        <div className="flex items-center gap-4 mb-8 border-b pb-6 border-gray-200 dark:border-gray-700">
          <div className="p-4 bg-blue-100 dark:bg-blue-900/30 rounded-2xl text-blue-600">
            <UserCog size={32} />
          </div>
          <div>
            <h1 className={`text-2xl font-bold ${isDark ? "text-white" : "text-gray-800"}`}>Account Settings</h1>
            <p className={`text-sm ${isDark ? "text-gray-400" : "text-gray-500"}`}>Update your login credentials</p>
          </div>
        </div>

        {status.msg && (
          <div className={`mb-6 p-4 rounded-xl flex items-center gap-3 ${
            status.type === 'success' 
              ? "bg-green-100 text-green-700 border border-green-200" 
              : "bg-red-100 text-red-700 border border-red-200"
          }`}>
            {status.type === 'success' ? <CheckCircle size={20} /> : <AlertCircle size={20} />}
            <span className="font-medium">{status.msg}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          
          {/* Email Section */}
          <div>
            <label className={labelClass}>Email Address</label>
            <div className="relative">
                <Mail className="absolute left-3 top-3.5 text-gray-400" size={20} />
                <input 
                    name="email"
                    type="email" 
                    value={formData.email}
                    onChange={handleChange}
                    className={`${inputClass} pl-10`}
                    placeholder="Enter new email"
                    required
                />
            </div>
          </div>

          <div className="grid md:grid-cols-2 gap-6">
              {/* New Password */}
              <div>
                <label className={labelClass}>New Password <span className="text-xs font-normal text-gray-500">(Optional)</span></label>
                <div className="relative">
                    <Lock className="absolute left-3 top-3.5 text-gray-400" size={20} />
                    <input 
                        name="newPassword"
                        type="password" 
                        value={formData.newPassword}
                        onChange={handleChange}
                        className={`${inputClass} pl-10`}
                        placeholder="Leave empty to keep current"
                    />
                </div>
              </div>

              {/* Current Password (Required) */}
              <div>
                <label className={labelClass}>Current Password <span className="text-red-500">*</span></label>
                <div className="relative">
                    <Lock className="absolute left-3 top-3.5 text-gray-400" size={20} />
                    <input 
                        name="currentPassword"
                        type="password" 
                        value={formData.currentPassword}
                        onChange={handleChange}
                        className={`${inputClass} pl-10 border-blue-300 focus:border-blue-500 bg-blue-50/50 dark:bg-gray-700`}
                        placeholder="Required to save changes"
                        required
                    />
                </div>
              </div>
          </div>

          <div className="pt-4">
            <button 
                type="submit" 
                disabled={loading}
                className={`w-full py-4 rounded-xl font-bold text-white flex items-center justify-center gap-2 transition-all transform active:scale-[0.98] ${
                    loading 
                    ? "bg-gray-400 cursor-not-allowed" 
                    : "bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 shadow-lg hover:shadow-xl"
                }`}
            >
                {loading ? "Saving..." : <><Save size={20} /> Update Profile</>}
            </button>
          </div>

        </form>
      </div>
    </div>
  );
};

export default UserProfile;