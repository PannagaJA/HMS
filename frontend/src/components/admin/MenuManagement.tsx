import React, { useEffect, useState } from 'react';
import { Utensils, Plus, Trash2, Edit2, Download } from 'lucide-react';
import type { MealType, MenuItem, Menu } from '../../types';
import { apiClient } from '../../api/apiClient';

const DAYS = [
  { id: 1, name: 'Monday' },
  { id: 2, name: 'Tuesday' },
  { id: 3, name: 'Wednesday' },
  { id: 4, name: 'Thursday' },
  { id: 5, name: 'Friday' },
  { id: 6, name: 'Saturday' },
  { id: 7, name: 'Sunday' },
];

export const MenuManagement: React.FC = () => {
  const [mealTypes, setMealTypes] = useState<MealType[]>([]);
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [menus, setMenus] = useState<Menu[]>([]);
  const [activeDay, setActiveDay] = useState<number>(1);
  const [activeTab, setActiveTab] = useState<'timetable' | 'catalog'>('timetable');

  // Modal State for Food Item
  const [showItemModal, setShowItemModal] = useState(false);
  const [editingItem, setEditingItem] = useState<MenuItem | null>(null);
  const [itemName, setItemName] = useState('');
  const [itemCategory, setItemCategory] = useState('Main Course');
  const [itemDesc, setItemDesc] = useState('');
  const [isVeg, setIsVeg] = useState(true);

  // Modal State for Meal Slot Configuration
  const [showConfigureModal, setShowConfigureModal] = useState(false);
  const [targetMealType, setTargetMealType] = useState<MealType | null>(null);
  const [selectedItemIds, setSelectedItemIds] = useState<number[]>([]);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [mealTypesRes, menuItemsRes, menusRes] = await Promise.all([
        apiClient.get<MealType[]>('/hms/meal-types/'),
        apiClient.get<MenuItem[]>('/hms/menu-items/'),
        apiClient.get<Menu[]>('/hms/menus/'),
      ]);
      setMealTypes(mealTypesRes.data);
      setMenuItems(menuItemsRes.data);
      setMenus(menusRes.data);
    } catch (err) {
      console.error('Failed to load menu data', err);
    }
  };

  const handleOpenAddItem = () => {
    setEditingItem(null);
    setItemName('');
    setItemCategory('Main Course');
    setItemDesc('');
    setIsVeg(true);
    setShowItemModal(true);
  };

  const handleOpenEditItem = (item: MenuItem) => {
    setEditingItem(item);
    setItemName(item.name);
    setItemCategory(item.category || 'Main Course');
    setItemDesc(item.description || '');
    setIsVeg(Boolean(item.is_veg ?? item.vegetarian ?? true));
    setShowItemModal(true);
  };

  const handleSaveItem = async (e: React.FormEvent) => {
    e.preventDefault();
    const payload = {
      name: itemName,
      category: itemCategory,
      description: itemDesc,
      is_veg: isVeg,
      vegetarian: isVeg,
    };

    try {
      if (editingItem) {
        await apiClient.put(`/hms/menu-items/${editingItem.id}/`, payload);
      } else {
        await apiClient.post('/hms/menu-items/', payload);
      }
      setShowItemModal(false);
      fetchData();
    } catch (err) {
      alert('Failed to save food item');
    }
  };

  const handleDeleteItem = async (id: number) => {
    if (!confirm('Are you sure you want to delete this food item?')) return;
    try {
      await apiClient.delete(`/hms/menu-items/${id}/`);
      fetchData();
    } catch (err) {
      alert('Failed to delete food item');
    }
  };

  const handleOpenConfigureSlot = (mealType: MealType) => {
    setTargetMealType(mealType);
    const existing = menus.find(
      (m) => Number(m.day_of_week) === Number(activeDay) && Number(m.meal_type) === Number(mealType.id)
    );
    const existingIds = (existing?.items || []).map((i: any) => (typeof i === 'number' ? i : i.id));
    setSelectedItemIds(existingIds);
    setShowConfigureModal(true);
  };

  const handleSaveSlotMenu = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!targetMealType) return;

    try {
      const existing = menus.find(
        (m) => Number(m.day_of_week) === Number(activeDay) && Number(m.meal_type) === Number(targetMealType.id)
      );

      const payload = {
        day_of_week: activeDay,
        meal_type: targetMealType.id,
        items: selectedItemIds,
      };

      if (existing) {
        await apiClient.put(`/hms/menus/${existing.id}/`, payload);
      } else {
        await apiClient.post('/hms/menus/', payload);
      }
      setShowConfigureModal(false);
      fetchData();
    } catch (err) {
      alert('Failed to update dining menu slot');
    }
  };

  const handleToggleItemSelection = (id: number) => {
    setSelectedItemIds((prev) =>
      prev.includes(id) ? prev.filter((itemId) => itemId !== id) : [...prev, id]
    );
  };

  const handleExportPDF = () => {
    window.print();
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Hostel Dining & Menu Planner</h1>
          <p className="text-sm text-slate-500 mt-0.5">Configure 7-day recurring meal timetables, food catalog, and nutritional slots</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleExportPDF}
            className="px-4 py-2.5 rounded-full bg-white border border-slate-200 text-slate-700 text-xs font-semibold hover:bg-slate-50 transition-all shadow-sm flex items-center gap-2 cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Print Menu</span>
          </button>
          <button
            onClick={handleOpenAddItem}
            className="px-5 py-2.5 rounded-full bg-[#0D3833] text-white text-xs font-semibold hover:bg-[#064E3B] transition-all shadow-sm flex items-center gap-2 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Add Food Item</span>
          </button>
        </div>
      </div>

      <div className="flex items-center gap-2 border-b border-slate-200 pb-3">
        <button
          onClick={() => setActiveTab('timetable')}
          className={`px-4 py-2 rounded-full text-xs font-semibold transition-all cursor-pointer ${
            activeTab === 'timetable'
              ? 'bg-[#0D3833] text-white shadow-sm'
              : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
          }`}
        >
          Weekly Timetable
        </button>
        <button
          onClick={() => setActiveTab('catalog')}
          className={`px-4 py-2 rounded-full text-xs font-semibold transition-all cursor-pointer ${
            activeTab === 'catalog'
              ? 'bg-[#0D3833] text-white shadow-sm'
              : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
          }`}
        >
          Food Items Catalog ({menuItems.length})
        </button>
      </div>

      {activeTab === 'timetable' && (
        <div className="space-y-5">
          <div className="flex items-center gap-2 overflow-x-auto pb-2">
            {DAYS.map((day) => (
              <button
                key={day.id}
                onClick={() => setActiveDay(day.id)}
                className={`px-5 py-2.5 rounded-2xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
                  activeDay === day.id
                    ? 'bg-[#D1F2EA] text-teal-950 border border-teal-300 shadow-sm'
                    : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
                }`}
              >
                {day.name}
              </button>
            ))}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
            {mealTypes.map((mealType) => {
              const menuForSlot = menus.find(
                (m) => Number(m.day_of_week) === Number(activeDay) && Number(m.meal_type) === Number(mealType.id)
              );
              const itemsList = menuForSlot?.items || [];

              return (
                <div
                  key={mealType.id}
                  className="bg-white p-5 rounded-3xl border border-slate-200/80 shadow-sm flex flex-col justify-between hover:border-slate-300 transition-all"
                >
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-xs font-bold text-slate-800 tracking-tight">{mealType.name}</span>
                      <span className="text-[10px] font-mono text-slate-400 font-semibold">
                        {mealType.start_time || mealType.time_from || '08:00'} - {mealType.end_time || mealType.time_to || '10:00'}
                      </span>
                    </div>

                    <div className="min-h-[140px] space-y-1.5 py-2">
                      {itemsList.length === 0 ? (
                        <div className="h-full flex items-center justify-center text-xs text-slate-400 italic">
                          No items configured
                        </div>
                      ) : (
                        itemsList.map((item: any, idx: number) => {
                          const itemObj = typeof item === 'object' ? item : menuItems.find((mi) => mi.id === item);
                          const isVegetarian = itemObj?.is_veg ?? itemObj?.vegetarian ?? true;
                          return (
                            <div
                              key={idx}
                              className="flex items-center gap-2 p-2 rounded-xl bg-slate-50 text-xs text-slate-700 font-medium"
                            >
                              <span className={`w-2 h-2 rounded-full ${isVegetarian ? 'bg-emerald-500' : 'bg-rose-500'}`} />
                              <span className="truncate">{itemObj?.name || `Item #${item}`}</span>
                            </div>
                          );
                        })
                      )}
                    </div>
                  </div>

                  <div className="pt-3 border-t border-slate-100 flex justify-end">
                    <button
                      onClick={() => handleOpenConfigureSlot(mealType)}
                      className="px-4 py-2 rounded-full bg-[#0D3833] text-white text-xs font-semibold hover:bg-[#064E3B] shadow-sm cursor-pointer"
                    >
                      Configure Slot
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {activeTab === 'catalog' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {menuItems.map((item) => {
            const isVegetarian = item.is_veg ?? item.vegetarian ?? true;
            return (
              <div
                key={item.id}
                className="bg-white p-5 rounded-3xl border border-slate-200/80 shadow-sm flex items-center justify-between"
              >
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-2xl flex items-center justify-center font-bold ${
                    isVegetarian ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'
                  }`}>
                    <Utensils className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-slate-900">{item.name}</h4>
                    <span className="text-[11px] text-slate-400">{item.category || 'General'}</span>
                  </div>
                </div>

                <div className="flex items-center gap-1">
                  <button
                    onClick={() => handleOpenEditItem(item)}
                    className="p-1.5 rounded-full hover:bg-slate-100 text-slate-600 cursor-pointer"
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => handleDeleteItem(item.id)}
                    className="p-1.5 rounded-full hover:bg-rose-50 text-rose-600 cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Item Modal */}
      {showItemModal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-md rounded-3xl p-6 border border-slate-200 shadow-xl animate-in fade-in zoom-in duration-150">
            <h3 className="text-lg font-bold text-slate-900 mb-1">
              {editingItem ? 'Edit Food Item' : 'Add Food Item'}
            </h3>
            <p className="text-xs text-slate-500 mb-5">Manage item name, nutritional category, and dietary flags.</p>

            <form onSubmit={handleSaveItem} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Item Name</label>
                <input
                  type="text"
                  required
                  value={itemName}
                  onChange={(e) => setItemName(e.target.value)}
                  placeholder="e.g. Masala Dosa with Sambar"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 text-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Category</label>
                <input
                  type="text"
                  required
                  value={itemCategory}
                  onChange={(e) => setItemCategory(e.target.value)}
                  placeholder="e.g. Breakfast / Beverages"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 text-sm"
                />
              </div>

              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="vegCheck"
                  checked={isVeg}
                  onChange={(e) => setIsVeg(e.target.checked)}
                  className="w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500"
                />
                <label htmlFor="vegCheck" className="text-xs font-semibold text-slate-700 cursor-pointer">
                  Vegetarian Dish
                </label>
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowItemModal(false)}
                  className="px-4 py-2 rounded-full border border-slate-200 text-xs font-semibold text-slate-600 hover:bg-slate-50 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-full bg-[#0D3833] text-white text-xs font-semibold hover:bg-[#064E3B] shadow-sm cursor-pointer"
                >
                  Save Item
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Configure Slot Modal */}
      {showConfigureModal && targetMealType && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-lg rounded-3xl p-6 border border-slate-200 shadow-xl animate-in fade-in zoom-in duration-150">
            <h3 className="text-lg font-bold text-slate-900 mb-1">
              Configure {targetMealType.name} Menu
            </h3>
            <p className="text-xs text-slate-500 mb-4">
              Select dishes served on <strong className="text-slate-800">{DAYS.find((d) => d.id === activeDay)?.name}</strong>.
            </p>

            <form onSubmit={handleSaveSlotMenu} className="space-y-4">
              <div className="max-h-64 overflow-y-auto space-y-2 p-2 border border-slate-100 rounded-2xl bg-slate-50">
                {menuItems.map((item) => {
                  const isSelected = selectedItemIds.includes(item.id);
                  const isVegetarian = item.is_veg ?? item.vegetarian ?? true;
                  return (
                    <div
                      key={item.id}
                      onClick={() => handleToggleItemSelection(item.id)}
                      className={`p-3 rounded-xl border flex items-center justify-between text-xs cursor-pointer transition-all ${
                        isSelected
                          ? 'bg-[#D1F2EA] border-teal-300 text-teal-950 font-semibold'
                          : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-100'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <span className={`w-2.5 h-2.5 rounded-full ${isVegetarian ? 'bg-emerald-500' : 'bg-rose-500'}`} />
                        <span>{item.name}</span>
                      </div>
                      <span className="text-[10px] uppercase font-bold text-slate-400">{item.category}</span>
                    </div>
                  );
                })}
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowConfigureModal(false)}
                  className="px-4 py-2 rounded-full border border-slate-200 text-xs font-semibold text-slate-600 hover:bg-slate-50 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-full bg-[#0D3833] text-white text-xs font-semibold hover:bg-[#064E3B] shadow-sm cursor-pointer"
                >
                  Save Timetable Slot
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
