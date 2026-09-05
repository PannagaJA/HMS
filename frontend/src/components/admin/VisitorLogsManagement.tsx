import React, { useEffect, useState } from 'react';
import { Search, LogOut, Download, Building2, ChevronLeft, ChevronRight } from 'lucide-react';
import type { VisitorLog, Hostel } from '../../types';
import { apiClient } from '../../api/apiClient';
import { useNotification } from '../../context/NotificationContext';
import { useDebounce } from '../../hooks/useDebounce';
import { supabase } from '../../lib/supabase';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../ui/select';
import { formatFloorRoom } from '../../utils/formatters';

export const VisitorLogsManagement: React.FC = () => {
  const { showSuccess, showError, confirm } = useNotification();
  const [logs, setLogs] = useState<VisitorLog[]>([]);
  const [hostels, setHostels] = useState<Hostel[]>([]);
  const [selectedHostelId, setSelectedHostelId] = useState<string>('');
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState<'ALL' | 'CHECKED_IN' | 'CHECKED_OUT'>('ALL');
  const [showAddModal, setShowAddModal] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  // Form State
  const [visitorName, setVisitorName] = useState('');
  const [visitorPhone, setVisitorPhone] = useState('');
  const [studentName, setStudentName] = useState('');
  const [studentRoom, setStudentRoom] = useState('');
  const [enrollmentNo, setEnrollmentNo] = useState('');
  const [relation, setRelation] = useState('Parent');
  const [purpose, setPurpose] = useState('');
  const [modalHostelId, setModalHostelId] = useState('');

  useEffect(() => {
    fetchLogsAndHostels();

    const channel = supabase
      .channel('admin_visitor_logs_realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'visitor_logs' }, () => {
        fetchLogsAndHostels();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const fetchLogsAndHostels = async () => {
    try {
      const [logsRes, hostelsRes] = await Promise.all([
        apiClient.get<VisitorLog[]>('/hms/visitor-logs/'),
        apiClient.get<Hostel[]>('/hms/hostels/'),
      ]);
      setLogs(logsRes.data || []);
      setHostels(hostelsRes.data || []);
      if (hostelsRes.data?.length > 0 && !modalHostelId) {
        setModalHostelId(String(hostelsRes.data[0].id));
      }
    } catch (err) {
      console.error('Failed to load visitor logs:', err);
    }
  };

  const handleCheckIn = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await apiClient.post('/hms/visitor-logs/', {
        hostel: Number(modalHostelId),
        visitor_name: visitorName,
        visitor_phone: visitorPhone,
        student_name: studentName,
        student_room: studentRoom,
        enrollment_no: enrollmentNo,
        relation,
        purpose,
        status: 'CHECKED_IN',
      });
      showSuccess(`Visitor ${visitorName} checked in successfully.`);
      setShowAddModal(false);
      setVisitorName('');
      setVisitorPhone('');
      setStudentName('');
      setStudentRoom('');
      setEnrollmentNo('');
      setPurpose('');
      fetchLogsAndHostels();
    } catch (err) {
      showError('Failed to register visitor check-in');
    }
  };

  const handleCheckOut = async (id: number) => {
    const isConfirmed = await confirm({
      title: 'Checkout Visitor',
      message: 'Are you sure you want to mark this visitor as checked out?',
      confirmText: 'Check Out'
    });
    if (!isConfirmed) return;

    try {
      await apiClient.post(`/hms/visitor-logs/${id}/checkout/`);
      showSuccess('Visitor checked out successfully.');
      fetchLogsAndHostels();
    } catch (err) {
      showError('Failed to check out visitor');
    }
  };

  const handleExportPDF = () => {
    window.print();
  };

  // 1. Filter by Hostel first
  const hostelFilteredLogs = logs.filter((l) => {
    if (!selectedHostelId) return false;
    if (selectedHostelId === 'ALL') return true;

    const selectedHostelObj = hostels.find((h) => String(h.id) === selectedHostelId);
    return (
      String(l.hostel) === selectedHostelId ||
      String(l.hostel_id) === selectedHostelId ||
      (Boolean(selectedHostelObj) && Boolean(l.hostel_name) && l.hostel_name!.toLowerCase().includes(selectedHostelObj!.name.toLowerCase()))
    );
  });

  // 2. Filter by Search & Status
  const debouncedSearchTerm = useDebounce(searchTerm, 300);

  const filteredLogs = hostelFilteredLogs.filter((l) => {
    const matchesSearch =
      l.visitor_name.toLowerCase().includes(debouncedSearchTerm.toLowerCase()) ||
      l.student_name.toLowerCase().includes(debouncedSearchTerm.toLowerCase()) ||
      (l.enrollment_no ? l.enrollment_no.toLowerCase().includes(debouncedSearchTerm.toLowerCase()) : false) ||
      (l.purpose ? l.purpose.toLowerCase().includes(debouncedSearchTerm.toLowerCase()) : false);

    if (filterStatus === 'ALL') return matchesSearch;
    return matchesSearch && l.status === filterStatus;
  });

  const totalItems = filteredLogs.length;
  const totalPages = Math.ceil(totalItems / pageSize) || 1;
  const startIndex = (currentPage - 1) * pageSize;
  const endIndex = Math.min(startIndex + pageSize, totalItems);
  const paginatedLogs = filteredLogs.slice(startIndex, startIndex + pageSize);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Campus Visitor & Guest Register</h1>
          <p className="text-sm text-slate-500 mt-0.5">Track external guests, family members, and guardian visits to hostel blocks</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleExportPDF}
            className="px-4 py-2.5 rounded-full bg-white border border-slate-200 text-slate-700 text-xs font-semibold hover:bg-slate-50 transition-all shadow-sm flex items-center gap-2 cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export Log</span>
          </button>
          <button
            onClick={() => setShowAddModal(true)}
            className="px-5 py-2.5 rounded-full bg-[#0B1437] text-white text-xs font-semibold hover:bg-[#111f54] transition-all shadow-sm flex items-center gap-2 cursor-pointer"
          >
            <span>+ Check In Visitor</span>
          </button>
        </div>
      </div>

      {/* Filter Toolbar with Hostel Block Selector & Status Tabs */}
      <div className="bg-white p-4 rounded-3xl border border-slate-200/80 shadow-sm flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4">
        {/* Hostel Selector Dropdown */}
        <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3 flex-1 max-w-md">
          <span className="text-xs font-semibold text-slate-500 whitespace-nowrap flex items-center gap-1.5">
            <Building2 className="w-3.5 h-3.5 text-slate-400" />
            <span>Select Hostel:</span>
          </span>
          <div className="flex-1 min-w-[200px]">
            <Select
              value={selectedHostelId}
              onValueChange={(val) => {
                setSelectedHostelId(val);
                setCurrentPage(1);
              }}
            >
              <SelectTrigger className="w-full bg-slate-50 border-slate-200 font-semibold text-slate-800">
                <SelectValue placeholder="-- Select Hostel Block --" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All Hostel Blocks</SelectItem>
                {hostels.map((h) => (
                  <SelectItem key={h.id} value={String(h.id)}>
                    {h.name} ({h.gender === 'M' ? 'Boys' : h.gender === 'F' ? 'Girls' : 'Co-ed'})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Search Input */}
        <div className="relative flex-1 max-w-xs">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => {
              setSearchTerm(e.target.value);
              setCurrentPage(1);
            }}
            disabled={!selectedHostelId}
            placeholder="Search visitor, student, or purpose..."
            className="w-full bg-slate-50 pl-10 pr-4 py-2 rounded-xl text-xs border border-slate-200 focus:outline-none focus:ring-2 focus:ring-[#0B1437]/20 disabled:opacity-50"
          />
        </div>

        {/* Status Filter Pill Tabs */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 md:pb-0">
          {(['ALL', 'CHECKED_IN', 'CHECKED_OUT'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => {
                setFilterStatus(tab);
                setCurrentPage(1);
              }}
              disabled={!selectedHostelId}
              className={`px-3.5 py-2 rounded-full text-xs font-semibold transition-all cursor-pointer whitespace-nowrap disabled:opacity-50 disabled:cursor-not-allowed ${
                filterStatus === tab && selectedHostelId
                  ? 'bg-[#0B1437] text-white shadow-sm'
                  : 'bg-slate-50 text-slate-600 hover:bg-slate-100'
              }`}
            >
              {tab === 'ALL' ? 'All Visitors' : tab === 'CHECKED_IN' ? 'Currently Inside' : 'Departed'}
            </button>
          ))}
        </div>
      </div>

      {!selectedHostelId ? (
        <div className="bg-white p-12 rounded-3xl border border-dashed border-slate-200 text-center space-y-3">
          <div className="w-12 h-12 rounded-2xl bg-teal-50 text-teal-900 flex items-center justify-center mx-auto border border-teal-200">
            <Building2 className="w-6 h-6" />
          </div>
          <h3 className="text-base font-bold text-slate-800">Select a Hostel Block</h3>
          <p className="text-xs text-slate-500 max-w-sm mx-auto">
            Choose a hostel block from the dropdown above to view and track external campus visitor logs.
          </p>
        </div>
      ) : (
        <>
          {/* Mobile Card View (< 768px) */}
          <div className="grid grid-cols-1 gap-4 md:hidden">
            {paginatedLogs.length === 0 ? (
              <div className="bg-white p-10 rounded-3xl border border-slate-200 text-center text-slate-400 text-sm">
                No visitor records found for this hostel block.
              </div>
            ) : (
              paginatedLogs.map((log) => (
                <div key={log.id} className="bg-white p-5 rounded-3xl border border-slate-200/80 shadow-sm space-y-4">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <h4 className="font-bold text-slate-900 text-base">{log.visitor_name}</h4>
                      <p className="text-xs text-slate-400">{log.visitor_phone || log.mobile_number || 'N/A'}</p>
                    </div>
                    <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold border ${
                      log.status === 'CHECKED_IN'
                        ? 'bg-amber-50 text-amber-700 border-amber-200'
                        : 'bg-slate-100 text-slate-600 border-slate-200'
                    }`}>
                      {log.status === 'CHECKED_IN' ? 'INSIDE' : 'DEPARTED'}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div className="p-3 rounded-2xl bg-slate-50 border border-slate-100">
                      <span className="block text-[10px] font-semibold text-slate-400 uppercase">Visiting Student</span>
                      <strong className="text-slate-800 block truncate mt-0.5">{log.student_name}</strong>
                      <span className="text-[10px] text-slate-500 block truncate">
                        {log.student_room || log.room_no ? formatFloorRoom(log.floor, log.student_room || log.room_no) : log.enrollment_no || ''}
                      </span>
                    </div>
                    <div className="p-3 rounded-2xl bg-slate-50 border border-slate-100">
                      <span className="block text-[10px] font-semibold text-slate-400 uppercase">Relation & Time</span>
                      <strong className="text-slate-800 block truncate mt-0.5">{log.relation || 'Guest'}</strong>
                      <span className="text-[10px] font-mono text-slate-500 block truncate">
                        {log.entry_time || log.check_in_time ? new Date(log.entry_time || log.check_in_time || '').toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'N/A'}
                      </span>
                    </div>
                  </div>

                  <div className="text-xs text-slate-600 italic bg-slate-50 p-3 rounded-2xl border border-slate-100">
                    "{log.purpose}"
                  </div>

                  <div className="pt-2 border-t border-slate-100 flex items-center justify-end">
                    {log.status === 'CHECKED_IN' ? (
                      <button
                        onClick={() => handleCheckOut(log.id)}
                        className="w-full py-2 rounded-full bg-rose-50 text-rose-700 border border-rose-200 text-xs font-semibold hover:bg-rose-100 transition-colors flex items-center justify-center gap-1.5"
                      >
                        <LogOut className="w-3.5 h-3.5" />
                        <span>Mark Exit</span>
                      </button>
                    ) : (
                      <span className="text-xs text-slate-400">
                        Out at {log.exit_time || log.check_out_time ? new Date(log.exit_time || log.check_out_time || '').toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Logged'}
                      </span>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Desktop Table View (>= 768px) */}
          <div className="hidden md:block bg-white rounded-3xl border border-slate-200/80 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50/80 border-b border-slate-100 text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                    <th className="py-3.5 pl-6">Visitor</th>
                    <th className="py-3.5 px-4">Relation</th>
                    <th className="py-3.5 px-4">Visiting Student</th>
                    <th className="py-3.5 px-4">Purpose</th>
                    <th className="py-3.5 px-4">Check-In Time</th>
                    <th className="py-3.5 px-4">Status</th>
                    <th className="py-3.5 pr-6 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-sm">
                  {paginatedLogs.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-10 text-center text-slate-400">
                        No visitor records found for this hostel block.
                      </td>
                    </tr>
                  ) : (
                    paginatedLogs.map((log) => (
                      <tr key={log.id} className="hover:bg-slate-50/70 transition-colors">
                        <td className="py-4 pl-6 font-semibold text-slate-800">
                          <div>{log.visitor_name}</div>
                          <div className="text-[11px] font-mono text-slate-400">{log.visitor_phone || log.mobile_number || 'N/A'}</div>
                        </td>
                        <td className="py-4 px-4 text-xs font-semibold text-slate-600">
                          {log.relation}
                        </td>
                        <td className="py-4 px-4 text-xs">
                          <span className="font-bold text-slate-800">{log.student_name}</span>
                          <div className="text-slate-400">{log.student_room || log.room_no ? formatFloorRoom(log.floor, log.student_room || log.room_no) : log.enrollment_no || ''}</div>
                        </td>
                        <td className="py-4 px-4 text-xs text-slate-600">
                          {log.purpose}
                        </td>
                        <td className="py-4 px-4 text-xs font-mono text-slate-500">
                          {log.entry_time || log.check_in_time ? new Date(log.entry_time || log.check_in_time || '').toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'N/A'}
                        </td>
                        <td className="py-4 px-4">
                          <span className={`px-2.5 py-1 rounded-full text-[11px] font-bold border ${
                            log.status === 'CHECKED_IN'
                              ? 'bg-amber-50 text-amber-700 border-amber-200'
                              : 'bg-slate-100 text-slate-600 border-slate-200'
                          }`}>
                            {log.status === 'CHECKED_IN' ? 'CURRENTLY INSIDE' : 'CHECKED OUT'}
                          </span>
                        </td>
                        <td className="py-4 pr-6 text-right">
                          {log.status === 'CHECKED_IN' ? (
                            <button
                              onClick={() => handleCheckOut(log.id)}
                              className="px-3.5 py-1.5 rounded-full bg-rose-50 text-rose-700 border border-rose-200 text-xs font-semibold hover:bg-rose-100 transition-colors cursor-pointer inline-flex items-center gap-1.5"
                            >
                              <LogOut className="w-3.5 h-3.5" />
                              <span>Mark Exit</span>
                            </button>
                          ) : (
                            <span className="text-xs text-slate-400">
                              Out at {log.exit_time || log.check_out_time ? new Date(log.exit_time || log.check_out_time || '').toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Logged'}
                            </span>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Pagination Controls */}
          {filteredLogs.length > 0 && (
            <div className="bg-white px-6 py-4 rounded-3xl border border-slate-200/80 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="flex flex-wrap items-center gap-4 text-xs text-slate-500 font-medium">
                <span>
                  Showing <strong className="text-slate-800 font-bold">{startIndex + 1}</strong> to{' '}
                  <strong className="text-slate-800 font-bold">{endIndex}</strong> of{' '}
                  <strong className="text-slate-800 font-bold">{totalItems}</strong> visitor logs
                </span>
                <div className="flex items-center gap-1.5">
                  <span className="text-slate-400">Per page:</span>
                  <select
                    value={pageSize}
                    onChange={(e) => {
                      setPageSize(Number(e.target.value));
                      setCurrentPage(1);
                    }}
                    className="bg-white border border-slate-200 rounded-lg px-2 py-1 text-xs font-semibold text-slate-700 focus:outline-none focus:ring-1 focus:ring-[#0B1437] cursor-pointer"
                  >
                    <option value={10}>10</option>
                    <option value={25}>25</option>
                    <option value={50}>50</option>
                  </select>
                </div>
              </div>

              {totalPages > 1 && (
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                    disabled={currentPage === 1}
                    className="p-1.5 rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer shadow-2xs"
                    title="Previous Page"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>

                  <div className="flex items-center gap-1">
                    {Array.from({ length: totalPages }, (_, i) => i + 1)
                      .filter((p) => p === 1 || p === totalPages || Math.abs(p - currentPage) <= 1)
                      .map((pageNum, idx, arr) => {
                        const prev = arr[idx - 1];
                        return (
                          <React.Fragment key={pageNum}>
                            {prev && pageNum - prev > 1 && (
                              <span className="px-1 text-slate-400 font-bold">...</span>
                            )}
                            <button
                              onClick={() => setCurrentPage(pageNum)}
                              className={`w-7 h-7 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                                currentPage === pageNum
                                  ? 'bg-[#0B1437] text-white shadow-2xs'
                                  : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-100'
                              }`}
                            >
                              {pageNum}
                            </button>
                          </React.Fragment>
                        );
                      })}
                  </div>

                  <button
                    onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                    disabled={currentPage === totalPages}
                    className="p-1.5 rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer shadow-2xs"
                    title="Next Page"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              )}
            </div>
          )}
        </>
      )}

      {showAddModal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-md rounded-3xl p-6 border border-slate-200 shadow-xl animate-in fade-in zoom-in duration-150">
            <h3 className="text-lg font-bold text-slate-900 mb-1">Check In Visitor</h3>
            <p className="text-xs text-slate-500 mb-5">Record visitor details and destination student.</p>

            <form onSubmit={handleCheckIn} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Visitor Name</label>
                  <input
                    type="text"
                    required
                    value={visitorName}
                    onChange={(e) => setVisitorName(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Contact Phone</label>
                  <input
                    type="text"
                    required
                    value={visitorPhone}
                    onChange={(e) => setVisitorPhone(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 text-sm"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Student Name</label>
                  <input
                    type="text"
                    required
                    value={studentName}
                    onChange={(e) => setStudentName(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Room No</label>
                  <input
                    type="text"
                    value={studentRoom}
                    onChange={(e) => setStudentRoom(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 text-sm"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Relation</label>
                  <input
                    type="text"
                    value={relation}
                    onChange={(e) => setRelation(e.target.value)}
                    placeholder="e.g. Father / Guardian"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Purpose of Visit</label>
                  <input
                    type="text"
                    value={purpose}
                    onChange={(e) => setPurpose(e.target.value)}
                    placeholder="e.g. Document delivery"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 text-sm"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 rounded-full border border-slate-200 text-xs font-semibold text-slate-600 hover:bg-slate-50 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-full bg-[#0B1437] text-white text-xs font-semibold hover:bg-[#111f54] shadow-sm cursor-pointer"
                >
                  Register Check-In
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
