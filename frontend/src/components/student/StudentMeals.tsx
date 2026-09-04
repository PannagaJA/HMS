import React, { useEffect, useState } from 'react';
import { Calendar, CheckCircle2, RotateCcw, Utensils } from 'lucide-react';
import type { Menu, MealType } from '../../types';
import { apiClient } from '../../api/apiClient';
import { formatTimeRange12 } from '../../lib/utils';
import { useNotification } from '../../context/NotificationContext';

export const StudentMeals: React.FC = () => {
  const { showSuccess, showError, confirm } = useNotification();
  const [todayMenu, setTodayMenu] = useState<{ day_name: string; meals: Menu[] } | null>(null);
  const [mealTypes, setMealTypes] = useState<MealType[]>([]);
  const [skippedMealIds, setSkippedMealIds] = useState<number[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchDiningData();
  }, []);

  const fetchDiningData = async () => {
    try {
      setIsLoading(true);
      const [menuRes, mealTypesRes, skipsRes] = await Promise.all([
        apiClient.get('/hms/menus/today_menu/'),
        apiClient.get<MealType[]>('/hms/meal-types/'),
        apiClient.get<number[]>('/mess/skips/'),
      ]);
      setTodayMenu(menuRes.data);
      setMealTypes(mealTypesRes.data || []);
      if (Array.isArray(skipsRes.data)) {
        setSkippedMealIds(skipsRes.data);
      }
    } catch (err) {
      console.error('Failed to load meals', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleToggleSkipMeal = async (mealTypeId: number, mealName: string) => {
    const isSkipped = skippedMealIds.includes(mealTypeId);

    if (!isSkipped) {
      const isConfirmed = await confirm({
        title: `Skip ${mealName} Today?`,
        message: `Opt out of ${mealName}? The applicable daily rebate will be calculated on your monthly mess bill.`,
        confirmText: 'Opt Out / Skip Meal'
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
        setSkippedMealIds((prev) => [...prev, mealTypeId]);
        showSuccess(`${mealName} opt-out recorded. Rebate noted for monthly billing.`);
      } catch (err: any) {
        showError(err.response?.data?.detail || 'Failed to record meal skip');
      }
    } else {
      const isConfirmed = await confirm({
        title: `Rejoin ${mealName}?`,
        message: `Cancel your opt-out and participate in ${mealName} today?`,
        confirmText: 'Rejoin Meal'
      });
      if (!isConfirmed) return;

      try {
        await apiClient.delete(`/mess/skips/${mealTypeId}/`);
        setSkippedMealIds((prev) => prev.filter((id) => id !== mealTypeId));
        showSuccess(`Rejoined ${mealName}. You are registered for dining today.`);
      } catch (err: any) {
        showError(err.response?.data?.detail || 'Failed to cancel meal skip');
      }
    }
  };

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">Hostel Mess & Dining</h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-0.5">View today's recurring meal menu, dining timetable, and food schedule</p>
        </div>
        <span className="w-fit self-start sm:self-auto flex items-center gap-2 px-4 py-2 rounded-full bg-blue-100 text-teal-950 font-bold text-xs border border-teal-200 shadow-2xs">
          <Calendar className="w-4 h-4 text-teal-700 shrink-0" />
          <span>Today: {todayMenu?.day_name || 'Daily Timetable'}</span>
        </span>
      </div>

      <div className="bg-white p-7 rounded-3xl border border-slate-200/80 shadow-sm space-y-6">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
            <Utensils className="w-5 h-5 text-teal-800" />
            <span>Today's Meals Timetable</span>
          </h3>
          <span className="text-xs font-semibold text-slate-400">
            {mealTypes.length} Dining Slots Active
          </span>
        </div>

        {isLoading ? (
          <div className="py-12 text-center text-slate-400 text-xs">
            Loading dining timetable...
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {mealTypes.map((mealType) => {
              const menuForMeal = todayMenu?.meals?.find(
                (m) => Number(m.meal_type_id || m.meal_type?.id || m.meal_type) === Number(mealType.id)
              );
              const itemsList = menuForMeal?.items_detail || menuForMeal?.items || [];
              const isSkipped = skippedMealIds.includes(Number(mealType.id));

              return (
                <div
                  key={mealType.id}
                  className={`p-6 rounded-3xl border flex flex-col justify-between transition-all ${
                    isSkipped
                      ? 'bg-amber-50/50 border-amber-200/80 shadow-2xs'
                      : 'bg-slate-50 border-slate-200/80 shadow-xs hover:border-slate-300'
                  }`}
                >
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-xs font-bold text-slate-900 tracking-tight">
                        {mealType.description || mealType.name}
                      </span>
                      <span className="text-[10px] font-mono text-slate-500 font-semibold bg-white/80 px-2 py-0.5 rounded-md border border-slate-200/60">
                        {formatTimeRange12(mealType.start_time || mealType.time_from, mealType.end_time || mealType.time_to)}
                      </span>
                    </div>

                    <div className="space-y-2 my-4 min-h-[110px]">
                      {itemsList.length === 0 ? (
                        <div className="text-xs text-slate-400 italic py-6 text-center bg-white/60 rounded-2xl border border-dashed border-slate-200">
                          Chef special seasonal dishes
                        </div>
                      ) : (
                        itemsList.map((item: any, idx: number) => (
                          <div
                            key={idx}
                            className="flex items-center gap-2 text-xs text-slate-700 font-medium bg-white/80 p-2 rounded-xl border border-slate-100"
                          >
                            <span
                              className={`w-2 h-2 rounded-full shrink-0 ${
                                item.is_veg !== false ? 'bg-emerald-500' : 'bg-rose-500'
                              }`}
                            />
                            <span className="truncate">{item.name || item}</span>
                          </div>
                        ))
                      )}
                    </div>
                  </div>

                  <div className="pt-4 border-t border-slate-200/60">
                    {isSkipped ? (
                      <div className="space-y-2">
                        <div className="py-2 text-center text-xs font-bold text-amber-900 bg-amber-100/80 border border-amber-300 rounded-full flex items-center justify-center gap-1.5 shadow-2xs">
                          <CheckCircle2 className="w-3.5 h-3.5 text-amber-800" />
                          <span>Meal Skipped Today</span>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleToggleSkipMeal(Number(mealType.id), mealType.description || mealType.name)}
                          className="w-full py-1.5 rounded-full text-slate-500 hover:text-slate-800 text-[11px] font-semibold hover:bg-amber-100/50 transition-colors cursor-pointer flex items-center justify-center gap-1"
                        >
                          <RotateCcw className="w-3 h-3" />
                          <span>Cancel Opt-Out</span>
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => handleToggleSkipMeal(Number(mealType.id), mealType.description || mealType.name)}
                        className="w-full py-2.5 rounded-full bg-white border border-slate-300 text-slate-700 text-xs font-semibold hover:bg-slate-100 hover:text-slate-900 transition-all cursor-pointer shadow-2xs"
                      >
                        Skip Meal Today
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
