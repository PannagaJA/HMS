import React, { useEffect, useState } from 'react';
import { Plus, Trash2, Edit2, Download, Check, X, Clock, Coffee, Sun, Sunset, Moon, UtensilsCrossed } from 'lucide-react';
import type { MealType, MenuItem, Menu } from '../../types';
import { apiClient } from '../../api/apiClient';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../ui/select';
import { formatTimeRange12 } from '../../lib/utils';

const DAYS = [
  { id: '0', name: 'Monday' },
  { id: '1', name: 'Tuesday' },
  { id: '2', name: 'Wednesday' },
  { id: '3', name: 'Thursday' },
  { id: '4', name: 'Friday' },
  { id: '5', name: 'Saturday' },
  { id: '6', name: 'Sunday' },
];

export const MenuManagement: React.FC = () => {
  const [mealTypes, setMealTypes] = useState<MealType[]>([]);
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [menus, setMenus] = useState<Menu[]>([]);
  const [activeDay, setActiveDay] = useState<string>('0');
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
  const [slotStartTime, setSlotStartTime] = useState('07:30');
  const [slotEndTime, setSlotEndTime] = useState('09:30');
  const [isSaving, setIsSaving] = useState(false);

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
    const rawStart = mealType.start_time || mealType.time_from || '07:30';
    const rawEnd = mealType.end_time || mealType.time_to || '09:30';
    setSlotStartTime(rawStart.substring(0, 5));
    setSlotEndTime(rawEnd.substring(0, 5));

    const existing = menus.find(
      (m) => String(m.day_of_week) === String(activeDay) && Number(m.meal_type) === Number(mealType.id)
    );
    const existingIds = (existing?.items || []).map((i: any) => (typeof i === 'number' ? i : i.id));
    setSelectedItemIds(existingIds);
    setShowConfigureModal(true);
  };

  const handleSaveSlotMenu = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!targetMealType) return;
    setIsSaving(true);

    try {
      // 1. Update meal slot timing (e.g. 07:30 - 09:30)
      const formattedStart = slotStartTime.length === 5 ? `${slotStartTime}:00` : slotStartTime;
      const formattedEnd = slotEndTime.length === 5 ? `${slotEndTime}:00` : slotEndTime;

      await apiClient.patch(`/hms/meal-types/${targetMealType.id}/`, {
        start_time: formattedStart,
        end_time: formattedEnd,
      });

      // 2. Update menu items for this day and slot
      const existing = menus.find(
        (m) => String(m.day_of_week) === String(activeDay) && Number(m.meal_type) === Number(targetMealType.id)
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
    } catch (err: any) {
      console.error('Failed to update dining slot:', err);
      alert('Failed to update dining menu slot: ' + (err.response?.data?.detail || err.message));
    } finally {
      setIsSaving(false);
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
          {activeTab === 'catalog' && (
            <button
              onClick={handleOpenAddItem}
              className="flex items-center gap-2 px-5 py-2.5 rounded-full bg-[#0D3833] text-white text-xs font-semibold hover:bg-[#064E3B] transition-all shadow-sm cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Add Food Item</span>
            </button>
          )}
          <button
            onClick={handleExportPDF}
            className="flex items-center gap-2 px-5 py-2.5 rounded-full bg-white border border-slate-200 text-slate-700 text-xs font-semibold hover:bg-slate-50 transition-all shadow-sm cursor-pointer"
          >
            <Download className="w-4 h-4 text-slate-400" />
            <span>Print Timetable</span>
          </button>
        </div>
      </div>

      {/* Primary Tab Navigation */}
      <div className="flex items-center gap-2 p-1.5 bg-slate-100 rounded-full w-fit">
        <button
          onClick={() => setActiveTab('timetable')}
          className={`px-4 py-2 rounded-full text-xs font-semibold transition-all cursor-pointer ${
            activeTab === 'timetable'
              ? 'bg-[#0D3833] text-white shadow-sm'
              : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
          }`}
        >
          Weekly Timetable Matrix
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
          {/* Mobile View: Clean Select Dropdown (< 768px) */}
          <div className="block md:hidden bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs">
            <label className="text-xs font-semibold text-slate-500 block mb-1.5">
              Select Day of Week:
            </label>
            <Select value={activeDay} onValueChange={(val) => setActiveDay(val)}>
              <SelectTrigger className="w-full bg-slate-50 border-slate-200 font-bold text-slate-800">
                <SelectValue placeholder="Select day" />
              </SelectTrigger>
              <SelectContent>
                {DAYS.map((day) => (
                  <SelectItem key={day.id} value={day.id}>
                    {day.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Desktop View: Horizontal Day Pills (>= 768px) */}
          <div className="hidden md:flex items-center gap-2 overflow-x-auto pb-2">
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

          {/* Modern Minimalist Dining Schedule Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {mealTypes.map((mealType) => {
              const menuForSlot = menus.find(
                (m) => String(m.day_of_week) === String(activeDay) && Number(m.meal_type) === Number(mealType.id)
              );
              const itemsList = menuForSlot?.items_detail || menuForSlot?.items || [];

              const slotCode = mealType.name.toUpperCase();
              const isBreakfast = slotCode === 'BR' || slotCode.includes('BREAKFAST');
              const isLunch = slotCode === 'LN' || slotCode.includes('LUNCH');
              const isSnacks = slotCode === 'SN' || slotCode.includes('SNACK');
              const isDinner = slotCode === 'DN' || slotCode.includes('DINNER');

              const slotTitle = isBreakfast ? 'Breakfast' : isLunch ? 'Lunch' : isSnacks ? 'Evening Snacks' : isDinner ? 'Dinner' : mealType.name;
              const slotIcon = isBreakfast ? <Coffee className="w-4 h-4" /> : isLunch ? <Sun className="w-4 h-4" /> : isSnacks ? <Sunset className="w-4 h-4" /> : <Moon className="w-4 h-4 text-indigo-400" />;

              return (
                <div
                  key={mealType.id}
                  className="bg-white rounded-3xl border border-slate-200/80 shadow-sm hover:shadow-md hover:border-slate-300 transition-all flex flex-col justify-between overflow-hidden"
                >
                  {/* Card Header Bar */}
                  <div className="p-5 border-b border-slate-100 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-xl bg-slate-900 text-white flex items-center justify-center shadow-xs">
                        {slotIcon}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="font-bold text-slate-900 text-base">{slotTitle}</h3>
                          <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded-md bg-slate-100 text-slate-600">
                            {mealType.name}
                          </span>
                        </div>
                        <div className="flex items-center gap-1.5 text-xs text-slate-400 font-mono mt-0.5">
                          <Clock className="w-3.5 h-3.5" />
                          <span>{formatTimeRange12(mealType.start_time || mealType.time_from, mealType.end_time || mealType.time_to)}</span>
                        </div>
                      </div>
                    </div>

                    <button
                      onClick={() => handleOpenConfigureSlot(mealType)}
                      className="px-3.5 py-1.5 rounded-full bg-slate-50 hover:bg-[#0D3833] text-slate-700 hover:text-white border border-slate-200 hover:border-transparent text-xs font-semibold transition-all shadow-2xs cursor-pointer flex items-center gap-1.5"
                    >
                      <Edit2 className="w-3 h-3" />
                      <span>Configure</span>
                    </button>
                  </div>

                  {/* Card Body: Minimalist Dish List */}
                  <div className="p-5 flex-1 space-y-2">
                    {itemsList.length === 0 ? (
                      <div className="py-8 text-center rounded-2xl bg-slate-50/60 border border-dashed border-slate-200 text-xs text-slate-400">
                        <UtensilsCrossed className="w-4 h-4 mx-auto mb-1.5 text-slate-300" />
                        <span>No dishes configured for {slotTitle.toLowerCase()}</span>
                      </div>
                    ) : (
                      itemsList.map((item: any, idx: number) => {
                        const itemObj = typeof item === 'object' ? item : menuItems.find((mi) => mi.id === item);
                        const isVegetarian = itemObj?.is_veg ?? itemObj?.vegetarian ?? true;
                        return (
                          <div
                            key={idx}
                            className="flex items-center justify-between p-3 rounded-2xl bg-slate-50/70 border border-slate-100 hover:bg-white hover:border-slate-200/90 transition-all"
                          >
                            <div className="flex items-center gap-3">
                              {/* Clean Veg/Non-Veg Square Stamp Indicator */}
                              <div
                                className={`w-4 h-4 rounded-sm border flex items-center justify-center ${
                                  isVegetarian ? 'border-emerald-600' : 'border-rose-600'
                                }`}
                                title={isVegetarian ? 'Vegetarian' : 'Non-Vegetarian'}
                              >
                                <div
                                  className={`w-2 h-2 rounded-full ${
                                    isVegetarian ? 'bg-emerald-600' : 'bg-rose-600'
                                  }`}
                                />
                              </div>

                              <div>
                                <span className="text-xs font-bold text-slate-800 block">
                                  {itemObj?.name || `Item #${item}`}
                                </span>
                                {itemObj?.category && (
                                  <span className="text-[10px] font-medium text-slate-400 block">
                                    {itemObj.category}
                                  </span>
                                )}
                              </div>
                            </div>

                            <span className="text-[10px] font-semibold font-mono text-slate-400 uppercase">
                              #{idx + 1}
                            </span>
                          </div>
                        );
                      })
                    )}
                  </div>

                  {/* Card Bottom Meta */}
                  <div className="px-5 py-3 bg-slate-50/50 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500 font-medium">
                    <span>Menu Slot</span>
                    <span className="font-semibold text-slate-700">
                      {itemsList.length} {itemsList.length === 1 ? 'Dish Active' : 'Dishes Active'}
                    </span>
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
                  <div className={`w-3.5 h-3.5 rounded-full border-2 flex items-center justify-center ${isVegetarian ? 'border-emerald-500' : 'border-rose-500'}`}>
                    <div className={`w-1.5 h-1.5 rounded-full ${isVegetarian ? 'bg-emerald-500' : 'bg-rose-500'}`} />
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-slate-800 leading-tight">{item.name}</h4>
                    <p className="text-xs text-slate-400">{item.category || (isVegetarian ? 'Vegetarian' : 'Non-Vegetarian')}</p>
                  </div>
                </div>

                <div className="flex items-center gap-1">
                  <button
                    onClick={() => handleOpenEditItem(item)}
                    className="p-2 rounded-xl hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors cursor-pointer"
                  >
                    <Edit2 className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleDeleteItem(item.id)}
                    className="p-2 rounded-xl hover:bg-rose-50 text-slate-400 hover:text-rose-600 transition-colors cursor-pointer"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Food Item Add/Edit Modal */}
      {showItemModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-100">
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-lg font-bold text-slate-900">
                {editingItem ? 'Edit Food Item' : 'Add Food Item'}
              </h3>
              <button
                onClick={() => setShowItemModal(false)}
                className="p-2 text-slate-400 hover:text-slate-600 rounded-full hover:bg-slate-100 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveItem} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">Item Name</label>
                <input
                  type="text"
                  required
                  value={itemName}
                  onChange={(e) => setItemName(e.target.value)}
                  placeholder="e.g. Masala Dosa, Paneer Butter Masala"
                  className="w-full bg-slate-50 px-4 py-2.5 rounded-2xl text-sm border border-slate-200 focus:outline-none focus:ring-2 focus:ring-[#0D3833]/20 focus:border-[#0D3833]"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">Category</label>
                <Select value={itemCategory} onValueChange={(val) => setItemCategory(val)}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select Category" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Breakfast">Breakfast</SelectItem>
                    <SelectItem value="Main Course">Main Course</SelectItem>
                    <SelectItem value="Curry / Gravy">Curry / Gravy</SelectItem>
                    <SelectItem value="Rice & Breads">Rice & Breads</SelectItem>
                    <SelectItem value="Snacks & Beverages">Snacks & Beverages</SelectItem>
                    <SelectItem value="Dessert">Dessert</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">Description (Optional)</label>
                <textarea
                  value={itemDesc}
                  onChange={(e) => setItemDesc(e.target.value)}
                  placeholder="Ingredients or allergens notes..."
                  rows={2}
                  className="w-full bg-slate-50 px-4 py-2.5 rounded-2xl text-sm border border-slate-200 focus:outline-none focus:ring-2 focus:ring-[#0D3833]/20 focus:border-[#0D3833]"
                />
              </div>

              <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-2xl border border-slate-200">
                <input
                  type="checkbox"
                  id="isVegCheck"
                  checked={isVeg}
                  onChange={(e) => setIsVeg(e.target.checked)}
                  className="w-4 h-4 text-[#0D3833] rounded focus:ring-0 cursor-pointer"
                />
                <label htmlFor="isVegCheck" className="text-xs font-semibold text-slate-700 cursor-pointer">
                  Vegetarian Option
                </label>
              </div>

              <div className="pt-4 flex justify-end gap-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowItemModal(false)}
                  className="px-5 py-2.5 rounded-full border border-slate-200 text-xs font-semibold text-slate-600 hover:bg-slate-50 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 rounded-full bg-[#0D3833] text-white text-xs font-semibold hover:bg-[#064E3B] shadow-sm cursor-pointer"
                >
                  Save Item
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Meal Slot Configuration Modal */}
      {showConfigureModal && targetMealType && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-slate-100">
            <div className="flex items-center justify-between mb-5">
              <div>
                <h3 className="text-lg font-bold text-slate-900">
                  Configure {targetMealType.name} Slot
                </h3>
                <p className="text-xs text-slate-400">
                  Select menu items served on {DAYS.find((d) => d.id === activeDay)?.name}
                </p>
              </div>
              <button
                onClick={() => setShowConfigureModal(false)}
                className="p-2 text-slate-400 hover:text-slate-600 rounded-full hover:bg-slate-100 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveSlotMenu} className="space-y-4">
              {/* Customizable Slot Timing Fields */}
              <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200/80 space-y-2">
                <label className="text-xs font-bold text-slate-700 block">
                  Slot Operational Timings
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <span className="text-[10px] font-semibold text-slate-400 block mb-1">Start Time</span>
                    <input
                      type="time"
                      value={slotStartTime}
                      onChange={(e) => setSlotStartTime(e.target.value)}
                      required
                      className="w-full bg-white px-3 py-2 rounded-xl text-xs font-mono font-bold border border-slate-200 focus:outline-none focus:ring-2 focus:ring-[#0D3833]/20"
                    />
                  </div>
                  <div>
                    <span className="text-[10px] font-semibold text-slate-400 block mb-1">End Time</span>
                    <input
                      type="time"
                      value={slotEndTime}
                      onChange={(e) => setSlotEndTime(e.target.value)}
                      required
                      className="w-full bg-white px-3 py-2 rounded-xl text-xs font-mono font-bold border border-slate-200 focus:outline-none focus:ring-2 focus:ring-[#0D3833]/20"
                    />
                  </div>
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 block mb-2">
                  Select Menu Items ({selectedItemIds.length} Selected)
                </label>
                <div className="max-h-56 overflow-y-auto space-y-2 pr-1">
                  {menuItems.map((item) => {
                    const isSelected = selectedItemIds.includes(item.id);
                    const isVegetarian = item.is_veg ?? item.vegetarian ?? true;

                    return (
                      <div
                        key={item.id}
                        onClick={() => handleToggleItemSelection(item.id)}
                        className={`flex items-center justify-between p-3 rounded-2xl border transition-all cursor-pointer ${
                          isSelected
                            ? 'bg-emerald-50/60 border-emerald-300'
                            : 'bg-slate-50 border-slate-200/80 hover:border-slate-300'
                        }`}
                      >
                      <div className="flex items-center gap-2.5">
                        <span className={`w-2.5 h-2.5 rounded-full ${isVegetarian ? 'bg-emerald-500' : 'bg-rose-500'}`} />
                        <div>
                          <p className="text-xs font-bold text-slate-800">{item.name}</p>
                          <p className="text-[10px] text-slate-400">{item.category || (isVegetarian ? 'Vegetarian' : 'Non-Vegetarian')}</p>
                        </div>
                      </div>

                      <div className={`w-5 h-5 rounded-lg border flex items-center justify-center transition-all ${
                        isSelected ? 'bg-[#0D3833] border-[#0D3833] text-white' : 'border-slate-300'
                      }`}>
                        {isSelected && <Check className="w-3 h-3" />}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="pt-4 flex justify-end gap-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowConfigureModal(false)}
                  className="px-5 py-2.5 rounded-full border border-slate-200 text-xs font-semibold text-slate-600 hover:bg-slate-50 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="px-5 py-2.5 rounded-full bg-[#0D3833] text-white text-xs font-semibold hover:bg-[#064E3B] shadow-sm cursor-pointer disabled:opacity-60"
                >
                  {isSaving ? 'Saving...' : 'Update Timetable Slot'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
