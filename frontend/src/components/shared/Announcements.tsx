import React, { useState, useEffect } from 'react';
import { 
  Bell, 
  Calendar, 
  Clock, 
  User, 
  FileDown, 
  Eye,
  Search, 
  Plus,
  Loader2,
  Trash2,
  X,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useDebounce } from '../../hooks/useDebounce';
import { announcementService } from '../../services/announcementService';
import { supabase } from '../../lib/supabase';
import type { Announcement } from '../../types';
import { useNotification } from '../../context/NotificationContext';

export const Announcements: React.FC = () => {
  const { user } = useAuth();
  const { confirm, showSuccess, showError } = useNotification();
  
  const canCreate = ['ADMIN', 'WARDEN', 'SECURITY', 'CARETAKER'].includes(user?.role || '');
  const [activeTab, setActiveTab] = useState<'received' | 'sent'>('received');
  
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Pagination & Search
  const [searchQuery, setSearchQuery] = useState('');
  const debouncedSearchQuery = useDebounce(searchQuery, 300);
  const [page, setPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const limit = 9;

  const [selectedAnnouncement, setSelectedAnnouncement] = useState<Announcement | null>(null);

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [newAnnouncement, setNewAnnouncement] = useState({
    title: '',
    message: '',
    priority: 'low' as 'low' | 'medium' | 'high',
    target_roles: [] as string[],
    expires_at: '',
    target_hostel_id: '' as string
  });
  const [hostels, setHostels] = useState<{ id: number; name: string }[]>([]);

  const fetchAnnouncements = async () => {
    if (!user) return;
    setLoading(true);
    try {
      if (activeTab === 'received') {
        const { data, count } = await announcementService.getAnnouncements(user.role, user.id, page, limit);
        setAnnouncements(data);
        setTotalCount(count);
      } else {
        const { data, count } = await announcementService.getSentAnnouncements(user.role, page, limit);
        setAnnouncements(data);
        setTotalCount(count);
      }
    } catch (error) {
      console.error('Failed to fetch announcements', error);
      showError('Failed to fetch announcements');
    } finally {
      setLoading(false);
    }
  };

  const fetchHostels = async () => {
    try {
      const { data } = await supabase.from('hostels').select('id, name').eq('is_active', true);
      if (data) setHostels(data);
    } catch (err) {
      console.warn('Failed to load hostels', err);
    }
  };

  useEffect(() => {
    fetchAnnouncements();
    if (canCreate && hostels.length === 0) {
      fetchHostels();
    }
  }, [user, activeTab, page]); // Re-fetch on tab or page change

  useEffect(() => {
    if (!user) return;

    // Realtime Websocket Updates
    const channel = supabase
      .channel('public:announcements:page')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'announcements' }, (payload) => {
        console.log('Realtime event received in Announcements:', payload.eventType, payload);
        
        if (payload.eventType === 'INSERT') {
          const newAnnouncement = payload.new as Announcement;
          
          if (activeTab === 'received' && newAnnouncement.target_roles?.includes(user.role)) {
            // Check if it's not expired
            if (!newAnnouncement.expires_at || new Date(newAnnouncement.expires_at) > new Date()) {
              console.log('Prepending new announcement to received feed.');
              setAnnouncements(prev => {
                if (prev.some(a => a.id === newAnnouncement.id)) return prev;
                return [newAnnouncement, ...prev].slice(0, limit);
              });
              setTotalCount(prev => prev + 1);
            }
          } else if (activeTab === 'sent' && newAnnouncement.created_by_role === user.role) {
            console.log('Prepending new announcement to sent feed.');
            setAnnouncements(prev => {
              if (prev.some(a => a.id === newAnnouncement.id)) return prev;
              return [newAnnouncement, ...prev].slice(0, limit);
            });
            setTotalCount(prev => prev + 1);
          }
        } else if (payload.eventType === 'DELETE') {
          const deletedId = payload.old.id;
          console.log('Removing deleted announcement:', deletedId);
          setAnnouncements(prev => prev.filter(a => a.id !== deletedId));
          setTotalCount(prev => Math.max(0, prev - 1));
        }
      })
      .subscribe((status) => {
        console.log('Announcements WebSocket status:', status);
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, activeTab]);

  const handleMarkRead = async (id: string) => {
    if (!user) return;
    await announcementService.markAsRead(id, user.id);
    setAnnouncements(prev => 
      prev.map(a => a.id === id ? { ...a, is_read: true } : a)
    );
    // Dispatch custom event to notify ProtectedRoute to decrease bell count instantly
    window.dispatchEvent(new Event('announcementRead'));
  };

  const handleDelete = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const isConfirmed = await confirm({
      title: 'Delete Announcement',
      message: 'Are you sure you want to delete this announcement? This action cannot be undone.',
      confirmText: 'Delete',
      isDestructive: true
    });
    
    if (isConfirmed) {
      try {
        await announcementService.deleteAnnouncement(id);
        showSuccess('Announcement deleted successfully.');
        // fetchAnnouncements will not be explicitly called; websocket DELETE event handles UI sync.
      } catch (err) {
        showError('Failed to delete announcement.');
      }
    }
  };

  const handleCreateAnnouncement = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newAnnouncement.title || !newAnnouncement.message || newAnnouncement.target_roles.length === 0) return;
    
    setIsSubmitting(true);
    try {
      const payload: Partial<Announcement> = {
        title: newAnnouncement.title,
        message: newAnnouncement.message,
        priority: newAnnouncement.priority,
        target_roles: newAnnouncement.target_roles,
        created_by_role: user?.role,
        created_by_name: user?.first_name ? `${user.first_name} ${user.last_name || ''}`.trim() : 'Staff Member',
        is_circular: false,
        target_hostel_id: newAnnouncement.target_hostel_id ? parseInt(newAnnouncement.target_hostel_id) : null,
      };

      if (newAnnouncement.expires_at) {
        payload.expires_at = new Date(newAnnouncement.expires_at).toISOString();
      }

      await announcementService.createAnnouncement(payload);
      
      showSuccess('Announcement published successfully.');
      setShowCreateModal(false);
      setNewAnnouncement({ title: '', message: '', priority: 'low', target_roles: [], expires_at: '', target_hostel_id: '' });
      if (activeTab === 'sent') {
        setPage(1);
        fetchAnnouncements();
      }
    } catch (error) {
      console.error('Error creating announcement:', error);
      showError('Failed to publish announcement.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRoleToggle = (role: string) => {
    setNewAnnouncement(prev => ({
      ...prev,
      target_roles: prev.target_roles.includes(role)
        ? prev.target_roles.filter(r => r !== role)
        : [...prev.target_roles, role]
    }));
  };

  const getPriorityColor = (priority: string) => {
    switch (priority.toLowerCase()) {
      case 'high': return 'bg-rose-100 text-rose-700 border-rose-200';
      case 'medium': return 'bg-amber-100 text-amber-700 border-amber-200';
      case 'low': return 'bg-emerald-100 text-emerald-700 border-emerald-200';
      default: return 'bg-slate-100 text-slate-700 border-slate-200';
    }
  };

  const filteredAnnouncements = announcements.filter(a => 
    a.title.toLowerCase().includes(debouncedSearchQuery.toLowerCase()) || 
    a.message.toLowerCase().includes(debouncedSearchQuery.toLowerCase())
  );

  const totalPages = Math.ceil(totalCount / limit) || 1;

  return (
    <div className="max-w-6xl mx-auto space-y-6 pb-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <Bell className="w-6 h-6 text-[#0D3833]" />
            Announcements & Circulars
          </h1>
          <p className="text-sm text-slate-500 mt-1">Stay updated with official campus notifications</p>
        </div>
        
        <div className="flex items-center gap-3">
          <div className="relative flex-1 sm:w-64">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search announcements..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#0D3833]/20 focus:border-[#0D3833] transition-all"
            />
          </div>
          
          {canCreate && (
            <button 
              onClick={() => setShowCreateModal(true)}
              className="flex items-center gap-2 px-4 py-2 bg-[#0D3833] hover:bg-[#064E3B] text-white rounded-xl text-sm font-bold shadow-sm transition-colors shrink-0"
            >
              <Plus className="w-4 h-4" />
              <span className="hidden sm:inline">New Announcement</span>
            </button>
          )}
        </div>
      </div>

      {canCreate && (
        <div className="flex items-center gap-2 border-b border-slate-200 mb-6">
          <button
            onClick={() => { setActiveTab('received'); setPage(1); }}
            className={`px-4 py-3 text-sm font-bold border-b-2 transition-colors ${activeTab === 'received' ? 'border-[#0D3833] text-[#0D3833]' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
          >
            Received
          </button>
          <button
            onClick={() => { setActiveTab('sent'); setPage(1); }}
            className={`px-4 py-3 text-sm font-bold border-b-2 transition-colors ${activeTab === 'sent' ? 'border-[#0D3833] text-[#0D3833]' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
          >
            Sent
          </button>
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center h-64 bg-white rounded-2xl border border-slate-200 shadow-sm">
          <div className="flex flex-col items-center gap-3 text-slate-400">
            <Loader2 className="w-8 h-8 animate-spin text-[#0D3833]" />
            <span className="text-sm font-medium">Loading announcements...</span>
          </div>
        </div>
      ) : filteredAnnouncements.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-64 bg-white rounded-2xl border border-slate-200 shadow-sm text-center px-6">
          <div className="w-16 h-16 rounded-full bg-slate-50 flex items-center justify-center mb-4">
            <Bell className="w-8 h-8 text-slate-300" />
          </div>
          <h3 className="text-lg font-bold text-slate-900">
            {activeTab === 'sent' ? 'No Sent Announcements' : 'No Announcements Found'}
          </h3>
          <p className="text-sm text-slate-500 max-w-sm mt-1">
            {searchQuery 
              ? "We couldn't find any announcements matching your search." 
              : activeTab === 'sent' 
                ? "You haven't sent any announcements yet."
                : "You're all caught up! There are no new announcements."}
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {filteredAnnouncements.map((announcement) => (
              <div 
                key={announcement.id}
                onClick={() => {
                  setSelectedAnnouncement(announcement);
                  if (activeTab === 'received' && !announcement.is_read) handleMarkRead(announcement.id);
                }}
                className={`cursor-pointer bg-white rounded-2xl border ${announcement.is_read || activeTab === 'sent' ? 'border-slate-200 shadow-sm' : 'border-[#0D3833]/30 shadow-md ring-1 ring-[#0D3833]/5'} p-5 flex flex-col transition-all hover:shadow-lg hover:-translate-y-0.5`}
              >
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div className="flex flex-wrap gap-2">
                    <span className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded-md border ${getPriorityColor(announcement.priority)}`}>
                      {announcement.priority}
                    </span>
                    {announcement.is_circular && (
                      <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded-md bg-purple-100 text-purple-700 border border-purple-200">
                        Circular
                      </span>
                    )}
                  </div>
                  {activeTab === 'received' && !announcement.is_read && (
                    <span className="flex w-2.5 h-2.5 rounded-full bg-[#0D3833] shrink-0" />
                  )}
                </div>

                <h3 className="font-bold text-slate-900 leading-tight mb-2 line-clamp-2">
                  {announcement.title}
                </h3>
                
                <p className="text-sm text-slate-600 line-clamp-3 mb-4 flex-1 break-words">
                  {announcement.message}
                </p>

                <div className="pt-4 mt-auto border-t border-slate-100 flex items-center justify-between">
                  <div className="flex items-center gap-1.5 text-xs text-slate-500 font-medium">
                    <Clock className="w-3.5 h-3.5" />
                    {new Date(announcement.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                  </div>
                  
                  {activeTab === 'sent' ? (
                    <button
                      onClick={(e) => handleDelete(announcement.id, e)}
                      className="flex items-center gap-1 text-xs font-bold text-rose-600 hover:text-rose-700 transition-colors p-1.5 rounded-md hover:bg-rose-50"
                    >
                      <Trash2 className="w-4 h-4" /> Delete
                    </button>
                  ) : (
                    <span className="flex items-center gap-1.5 text-xs font-bold text-[#0D3833] transition-colors">
                      <Eye className="w-3.5 h-3.5" /> View Details
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* Pagination Controls */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between pt-4 border-t border-slate-200">
              <span className="text-sm text-slate-500 font-medium">
                Showing page {page} of {totalPages}
              </span>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="p-2 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  <ChevronLeft className="w-5 h-5" />
                </button>
                <button
                  onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                  className="p-2 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  <ChevronRight className="w-5 h-5" />
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Announcement Details Modal */}
      {selectedAnnouncement && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl max-w-lg w-full shadow-2xl flex flex-col max-h-[85vh] overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="p-6 border-b border-slate-100 flex items-start justify-between gap-4 shrink-0">
              <div>
                <div className="flex gap-2 mb-3">
                  <span className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded-md border ${getPriorityColor(selectedAnnouncement.priority)}`}>
                    {selectedAnnouncement.priority} Priority
                  </span>
                  {selectedAnnouncement.is_circular && (
                    <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded-md bg-purple-100 text-purple-700 border border-purple-200">
                      Official Circular
                    </span>
                  )}
                </div>
                <h2 className="text-xl font-bold text-slate-900 leading-snug">
                  {selectedAnnouncement.title}
                </h2>
              </div>
              <button 
                onClick={() => setSelectedAnnouncement(null)}
                className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer shrink-0"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto">
              <div className="flex flex-wrap gap-x-6 gap-y-3 mb-6 p-4 bg-slate-50 rounded-2xl border border-slate-100">
                <div className="flex items-center gap-2 text-xs font-medium text-slate-600">
                  <User className="w-4 h-4 text-slate-400" />
                  <span>From: <strong className="text-slate-900">{selectedAnnouncement.created_by_name || 'Admin'}</strong></span>
                </div>
                <div className="flex items-center gap-2 text-xs font-medium text-slate-600">
                  <Calendar className="w-4 h-4 text-slate-400" />
                  <span>Date: <strong className="text-slate-900">{new Date(selectedAnnouncement.created_at).toLocaleDateString()}</strong></span>
                </div>
              </div>

              {selectedAnnouncement.is_circular && selectedAnnouncement.file_url && (
                <div className="flex items-center justify-between p-4 mb-6 bg-purple-50 rounded-2xl border border-purple-100">
                  <div>
                    <p className="text-xs font-bold text-purple-900">Attached Document</p>
                    <p className="text-[10px] text-purple-700 mt-0.5 truncate max-w-[200px]">
                      {selectedAnnouncement.file_name || 'Document.pdf'}
                    </p>
                  </div>
                  <a 
                    href={selectedAnnouncement.file_url} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 px-3 py-1.5 bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold rounded-lg shadow-sm transition-colors"
                  >
                    <FileDown className="w-3.5 h-3.5" /> Download
                  </a>
                </div>
              )}

              <div className="prose prose-sm max-w-none text-slate-700 leading-relaxed whitespace-pre-wrap break-words">
                {selectedAnnouncement.message}
              </div>
            </div>
            
            <div className="p-4 border-t border-slate-100 bg-slate-50/50 flex justify-end shrink-0">
              <button
                onClick={() => setSelectedAnnouncement(null)}
                className="px-5 py-2 bg-white border border-slate-200 text-slate-700 text-sm font-bold rounded-xl hover:bg-slate-50 transition-colors shadow-sm"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Compose Announcement Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl max-w-xl w-full shadow-2xl flex flex-col max-h-[90vh] overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="p-6 border-b border-slate-100 flex items-center justify-between shrink-0">
              <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
                <Plus className="w-5 h-5 text-[#0D3833]" />
                New Announcement
              </h2>
              <button 
                onClick={() => setShowCreateModal(false)}
                className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateAnnouncement} className="flex-1 overflow-y-auto p-6 space-y-5">
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-1.5">
                  Title <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={newAnnouncement.title}
                  onChange={e => setNewAnnouncement(prev => ({ ...prev, title: e.target.value }))}
                  placeholder="Enter a descriptive title..."
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#0D3833]/20 focus:border-[#0D3833] focus:bg-white transition-all"
                />
              </div>

              <div>
                <label className="block text-sm font-bold text-slate-700 mb-1.5">
                  Message <span className="text-rose-500">*</span>
                </label>
                <textarea
                  required
                  rows={4}
                  value={newAnnouncement.message}
                  onChange={e => setNewAnnouncement(prev => ({ ...prev, message: e.target.value }))}
                  placeholder="Type the full announcement details here..."
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#0D3833]/20 focus:border-[#0D3833] focus:bg-white transition-all resize-none"
                />
              </div>

              <div className="grid sm:grid-cols-2 gap-5">
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-1.5">Priority Level</label>
                  <select
                    value={newAnnouncement.priority}
                    onChange={e => setNewAnnouncement(prev => ({ ...prev, priority: e.target.value as any }))}
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#0D3833]/20 focus:border-[#0D3833] focus:bg-white transition-all"
                  >
                    <option value="low">🟢 Low Priority</option>
                    <option value="medium">🟡 Medium Priority</option>
                    <option value="high">🔴 High Priority</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-1.5">Target Hostel</label>
                  <select
                    value={newAnnouncement.target_hostel_id}
                    onChange={e => setNewAnnouncement(prev => ({ ...prev, target_hostel_id: e.target.value }))}
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#0D3833]/20 focus:border-[#0D3833] focus:bg-white transition-all"
                  >
                    <option value="">🏫 All Hostels</option>
                    {hostels.map(h => (
                      <option key={h.id} value={h.id.toString()}>
                        {h.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-1.5">
                    Target Audience <span className="text-rose-500">*</span>
                  </label>
                  <div className="grid grid-cols-2 gap-2 mt-1">
                    {['STUDENT', 'WARDEN', 'SECURITY', 'CARETAKER'].map(role => (
                      <label key={role} className="flex items-center gap-2 text-xs font-medium text-slate-700 cursor-pointer p-1.5 rounded-lg hover:bg-slate-50 border border-transparent hover:border-slate-100 transition-colors">
                        <input
                          type="checkbox"
                          checked={newAnnouncement.target_roles.includes(role)}
                          onChange={() => handleRoleToggle(role)}
                          className="w-3.5 h-3.5 rounded border-slate-300 text-[#0D3833] focus:ring-[#0D3833]"
                        />
                        {role.charAt(0) + role.slice(1).toLowerCase()}
                      </label>
                    ))}
                  </div>
                  {newAnnouncement.target_roles.length === 0 && (
                    <p className="text-[10px] text-rose-500 mt-1 font-medium">Select at least one role.</p>
                  )}
                </div>
              </div>

              <div>
                <label className="block text-sm font-bold text-slate-700 mb-1.5">
                  Expire Date (Optional)
                  <span className="font-normal text-slate-500 ml-2 block sm:inline mt-1 sm:mt-0">Deletes after this date.</span>
                </label>
                <input
                  type="date"
                  min={new Date().toISOString().split('T')[0]}
                  value={newAnnouncement.expires_at}
                  onChange={e => setNewAnnouncement(prev => ({ ...prev, expires_at: e.target.value }))}
                  className="w-full sm:w-1/2 px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#0D3833]/20 focus:border-[#0D3833] focus:bg-white transition-all"
                />
              </div>

            </form>

            <div className="p-4 border-t border-slate-100 bg-slate-50 flex justify-end gap-3 shrink-0">
              <button
                type="button"
                onClick={() => setShowCreateModal(false)}
                className="px-5 py-2.5 text-sm font-bold text-slate-600 hover:bg-slate-200 bg-slate-100 rounded-xl transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleCreateAnnouncement}
                disabled={isSubmitting || !newAnnouncement.title || !newAnnouncement.message || newAnnouncement.target_roles.length === 0}
                className="flex items-center gap-2 px-6 py-2.5 bg-[#0D3833] hover:bg-[#064E3B] disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-bold rounded-xl transition-all shadow-sm"
              >
                {isSubmitting ? (
                  <><Loader2 className="w-4 h-4 animate-spin" /> Sending...</>
                ) : (
                  'Publish Announcement'
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
