import React, { useEffect, useState } from 'react';
import { CreditCard, CheckCircle, Clock } from 'lucide-react';
import type { MessBilling } from '../../types';
import { apiClient } from '../../api/apiClient';

export const MessBillingManagement: React.FC = () => {
  const [bills, setBills] = useState<MessBilling[]>([]);
  const [month, setMonth] = useState('2026-09');
  const [ratePerMeal, setRatePerMeal] = useState(65);
  const [isGenerating, setIsGenerating] = useState(false);

  useEffect(() => {
    fetchBills();
  }, []);

  const fetchBills = async () => {
    try {
      const res = await apiClient.get<MessBilling[]>('/mess/mess-billing/');
      setBills(res.data);
    } catch (err) {
      console.error('Failed to load mess bills', err);
    }
  };

  const handleGenerateMonthly = async () => {
    setIsGenerating(true);
    try {
      await apiClient.post('/mess/mess-billing/generate_monthly_bills/', {
        month,
        rate_per_meal: ratePerMeal,
      });
      fetchBills();
      alert(`Mess bills generated for ${month}!`);
    } catch (err) {
      alert('Failed to generate monthly mess bills');
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Mess Consumption & Billing</h1>
          <p className="text-sm text-slate-500 mt-0.5">Calculate monthly student dining charges accounting for skip deductions</p>
        </div>
      </div>

      <div className="bg-white p-6 rounded-3xl border border-slate-200/80 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-4 w-full sm:w-auto">
          <div>
            <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">Billing Period</label>
            <input
              type="month"
              value={month}
              onChange={(e) => setMonth(e.target.value)}
              className="bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 text-sm font-semibold text-slate-800"
            />
          </div>
          <div>
            <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">Base Rate / Meal (₹)</label>
            <input
              type="number"
              value={ratePerMeal}
              onChange={(e) => setRatePerMeal(Number(e.target.value))}
              className="w-28 bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 text-sm font-semibold text-slate-800"
            />
          </div>
        </div>

        <button
          onClick={handleGenerateMonthly}
          disabled={isGenerating}
          className="w-full sm:w-auto px-6 py-3 rounded-full bg-[#0D3833] text-white text-xs font-semibold hover:bg-[#064E3B] transition-all shadow-sm flex items-center justify-center gap-2"
        >
          <CreditCard className="w-4 h-4" />
          <span>{isGenerating ? 'Computing...' : 'Generate Monthly Invoices'}</span>
        </button>
      </div>

      <div className="bg-white rounded-3xl border border-slate-200/80 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50/80 border-b border-slate-100 text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                <th className="py-3.5 pl-6">Student Resident</th>
                <th className="py-3.5 px-4">Billing Month</th>
                <th className="py-3.5 px-4">Planned Meals</th>
                <th className="py-3.5 px-4">Meals Skipped</th>
                <th className="py-3.5 px-4">Net Consumed</th>
                <th className="py-3.5 px-4">Total Amount</th>
                <th className="py-3.5 pr-6 text-right">Payment Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-sm">
              {bills.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-10 text-center text-slate-400">
                    No mess bills generated yet for this cycle.
                  </td>
                </tr>
              ) : (
                bills.map((b) => (
                  <tr key={b.id} className="hover:bg-slate-50/70 transition-colors">
                    <td className="py-4 pl-6 font-semibold text-slate-800">
                      <div>{b.student_name}</div>
                      <div className="text-[11px] font-normal text-slate-400 font-mono">{b.enrollment_no}</div>
                    </td>
                    <td className="py-4 px-4 text-xs font-bold text-slate-700">
                      {b.month}
                    </td>
                    <td className="py-4 px-4 text-xs text-slate-600">
                      {b.total_meals}
                    </td>
                    <td className="py-4 px-4 text-xs font-semibold text-rose-600">
                      -{b.meals_skipped} skipped
                    </td>
                    <td className="py-4 px-4 text-xs font-bold text-emerald-700">
                      {b.meals_consumed}
                    </td>
                    <td className="py-4 px-4 text-xs font-bold text-slate-900">
                      ₹{b.discounted_cost || b.total_cost}
                    </td>
                    <td className="py-4 pr-6 text-right">
                      <span className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-[11px] font-bold border ${
                        b.paid
                          ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                          : 'bg-amber-50 text-amber-700 border-amber-200'
                      }`}>
                        {b.paid ? <CheckCircle className="w-3 h-3" /> : <Clock className="w-3 h-3" />}
                        {b.paid ? 'PAID' : 'PENDING'}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
