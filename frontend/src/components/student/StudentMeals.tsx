import React, { useEffect, useState } from 'react';
import { Calendar } from 'lucide-react';
import type { Menu, MealType } from '../../types';
import { apiClient } from '../../api/apiClient';
import { formatTimeRange12 } from '../../lib/utils';
import { useNotification } from '../../context/NotificationContext';

export const StudentMeals: React.FC = () => {
  const { showSuccess, showError, confirm } = useNotification();
  const [todayMenu, setTodayMenu] = useState<{ day_name: string; meals: Menu[] } | null>(null);
  const [mealTypes, setMealTypes] = useState<MealType[]>([]);
  const [skippedMealId, setSkippedMealId] = useState<number | null>(null);

  useEffect(() => {
    fetchDiningData();
  }, []);

  const fetchDiningData = async () => {
    try {
      const [menuRes, mealTypesRes] = await Promise.all([
        apiClient.get('/hms/menus/today_menu/'),
        apiClient.get<MealType[]>('/hms/meal-types/'),
      ]);
      setTodayMenu(menuRes.data);
      setMealTypes(mealTypesRes.data);
    } catch (err) {
      console.error('Failed to load meals', err);
    }
  };

  const handleSkipMeal = async (mealTypeId: number) => {
    const isConfirmed = await confirm({
      title: 'Confirm Meal Opt-Out',
      message: 'Opt out of this meal? The applicable rebate will be credited to your monthly billing cycle.',
      confirmText: 'Opt Out'
    });
    if (!isConfirmed) return;

    try {
      const today = new Date().toISOString().split('T')[0];
      await apiClient.post('/mess/skips/', {
        date: today,
        meal_type: mealTypeId,
        skip_type: 'SKIP',
        reason: 'Student opted out from portal',
      });
      setSkippedMealId(mealTypeId);
      showSuccess('Meal skip recorded. Rebate will be credited to your monthly billing.');
    } catch (err: any) {
      setSkippedMealId(mealTypeId);
      showError(err.response?.data?.detail || 'Failed to record meal skip');
    }
  };

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Hostel Mess & Dining</h1>
          <p className="text-sm text-slate-500 mt-0.5">View today's recurring meal menu, dining timetable, and food schedule</p>
        </div>
        <span className="flex items-center gap-2 px-5 py-2.5 rounded-full bg-[#D1F2EA] text-teal-950 font-bold text-xs border border-teal-200">
          <Calendar className="w-4 h-4 text-teal-700" />
          <span>Today: {todayMenu?.day_name || 'Daily Timetable'}</span>
        </span>
      </div>

      <div className="bg-white p-7 rounded-3xl border border-slate-200/80 shadow-sm space-y-6">
        <h3 className="text-lg font-bold text-slate-900">Today's Meals Timetable</h3>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {mealTypes.map((mealType) => {
            const menuForMeal = todayMenu?.meals?.find(
              (m) => Number(m.meal_type_id || m.meal_type?.id || m.meal_type) === Number(mealType.id)
            );
            const itemsList = menuForMeal?.items_detail || menuForMeal?.items || [];
            const isSkipped = skippedMealId === mealType.id;

            return (
              <div key={mealType.id} className="p-6 rounded-3xl bg-slate-50 border border-slate-200/80 flex flex-col justify-between shadow-xs">
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-xs font-bold text-slate-800 tracking-tight">{mealType.name}</span>
                    <span className="text-[10px] font-mono text-slate-400 font-semibold">
                      {formatTimeRange12(mealType.start_time || mealType.time_from, mealType.end_time || mealType.time_to)}
                    </span>
                  </div>

                  <div className="space-y-2 my-4 min-h-[110px]">
                    {itemsList.length === 0 ? (
                      <div className="text-xs text-slate-400 italic py-4">Chef special seasonal menu</div>
                    ) : (
                      itemsList.map((item: any, idx: number) => (
                        <div key={idx} className="flex items-center gap-2 text-xs text-slate-700 font-medium">
                          <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" />
                          <span className="truncate">{item.name || item}</span>
                        </div>
                      ))
                    )}
                  </div>
                </div>

                <div className="pt-4 border-t border-slate-200/60">
                  {isSkipped ? (
                    <div className="py-2.5 text-center text-xs font-bold text-amber-800 bg-amber-50 border border-amber-200 rounded-full">
                      ✓ Meal Skipped
                    </div>
                  ) : (
                    <button
                      onClick={() => handleSkipMeal(mealType.id)}
                      className="w-full py-2.5 rounded-full border border-slate-300 text-slate-700 text-xs font-semibold hover:bg-slate-100 transition-colors cursor-pointer shadow-2xs"
                    >
                      Skip Meal Today
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
