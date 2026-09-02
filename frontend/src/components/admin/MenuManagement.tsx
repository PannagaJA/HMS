import React, { useEffect, useState } from 'react';
import { 
  Plus, 
  Check, 
  Trash2, 
  Edit, 
  Calendar, 
  UtensilsCrossed, 
  Clock, 
  Search,
  X
} from 'lucide-react';
import type { MealType, MenuItem, Menu, Hostel } from '../../types';
import { apiClient } from '../../api/apiClient';

export const MenuManagement: React.FC = () => {
  const [hostels, setHostels] = useState<Hostel[]>([]);
  const [selectedHostelId, setSelectedHostelId] = useState<number | null>(null);
  const [mealTypes, setMealTypes] = useState<MealType[]>([]);
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [menus, setMenus] = useState<Menu[]>([]);
  const [activeDay, setActiveDay] = useState('0'); // 0=Monday

  // Tab View: Weekly Matrix vs Menu Items Catalog vs Meal Types
  const [activeViewTab, setActiveViewTab] = useState<'weekly' | 'items' | 'meal_types'>('weekly');

  // Add/Edit Food Item Modal
  const [showItemModal, setShowItemModal] = useState(false);
  const [editingItem, setEditingItem] = useState<MenuItem | null>(null);
  const [itemName, setItemName] = useState('');
  const [itemDesc, setItemDesc] = useState('');
  const [isVeg, setIsVeg] = useState(true);
  const [itemSearch, setItemSearch] = useState('');

  // Configure Slot Menu Modal
  const [showConfigureModal, setShowConfigureModal] = useState(false);
  const [targetMealType, setTargetMealType] = useState<MealType | null>(null);
  const [selectedItemIds, setSelectedItemIds] = useState<number[]>([]);

  // Add Meal Type Modal
  const [showMealTypeModal, setShowMealTypeModal] = useState(false);
  const [newMealTypeCode, setNewMealTypeCode] = useState('');
  const [newMealTypeDesc, setNewMealTypeDesc] = useState('');
  const [newTimeFrom, setNewTimeFrom] = useState('08:00');
  const [newTimeTo, setNewTimeTo] = useState('09:30');

  const days = [
    { id: '0', label: 'Monday' },
    { id: '1', label: 'Tuesday' },
    { id: '2', label: 'Wednesday' },
    { id: '3', label: 'Thursday' },
    { id: '4', label: 'Friday' },
    { id: '5', label: 'Saturday' },
    { id: '6', label: 'Sunday' },
  ];

  useEffect(() => {
    fetchInitialData();
  }, []);

  useEffect(() => {
    if (selectedHostelId) {
      fetchMenus(selectedHostelId);
    }
  }, [selectedHostelId]);

  const fetchInitialData = async () => {
    try {
      const [hostelsRes, mealTypesRes, itemsRes] = await Promise.all([
        apiClient.get<Hostel[]>('/hms/hostels/'),
        apiClient.get<MealType[]>('/mess/meal-types/'),
        apiClient.get<MenuItem[]>('/mess/menu-items/'),
      ]);
      setHostels(hostelsRes.data);
      setMealTypes(mealTypesRes.data);
      setMenuItems(itemsRes.data);
      if (hostelsRes.data.length > 0) setSelectedHostelId(hostelsRes.data[0].id);
    } catch (err) {
      console.error('Failed to load menu data', err);
    }
  };

  const fetchMenus = async (hostelId: number) => {
    try {
      const res = await apiClient.get<Menu[]>(`/mess/menus/?hostel=${hostelId}`);
      setMenus(res.data);
    } catch (err) {
      console.error('Failed to fetch menus', err);
    }
  };

  // 1. Food Item Actions
  const handleOpenCreateItem = () => {
    setEditingItem(null);
    setItemName('');
    setItemDesc('');
    setIsVeg(true);
    setShowItemModal(true);
  };

  const handleOpenEditItem = (item: MenuItem) => {
    setEditingItem(item);
    setItemName(item.name);
    setItemDesc(item.description || '');
    setIsVeg(item.vegetarian);
    setShowItemModal(true);
  };

  const handleSaveItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!itemName.trim()) return;

    try {
      if (editingItem) {
        await apiClient.put(`/mess/menu-items/${editingItem.id}/`, {
          name: itemName.trim(),
          description: itemDesc.trim(),
          vegetarian: isVeg,
          is_active: true,
        });
      } else {
        await apiClient.post('/mess/menu-items/', {
          name: itemName.trim(),
          description: itemDesc.trim(),
          vegetarian: isVeg,
          is_active: true,
        });
      }
      setShowItemModal(false);
      const itemsRes = await apiClient.get<MenuItem[]>('/mess/menu-items/');
      setMenuItems(itemsRes.data);
      if (selectedHostelId) fetchMenus(selectedHostelId);
    } catch (err) {
      alert('Failed to save food item');
    }
  };

  const handleDeleteItem = async (id: number) => {
    if (!confirm('Are you sure you want to delete this food item?')) return;
    try {
      await apiClient.delete(`/mess/menu-items/${id}/`);
      const itemsRes = await apiClient.get<MenuItem[]>('/mess/menu-items/');
      setMenuItems(itemsRes.data);
      if (selectedHostelId) fetchMenus(selectedHostelId);
    } catch (err) {
      alert('Failed to delete food item');
    }
  };

  // 2. Meal Slot Menu Configuration
  const handleOpenConfigureSlot = (mealType: MealType) => {
    if (!selectedHostelId) return;
    setTargetMealType(mealType);

    const existing = menus.find(
      (m) => m.day_of_week === activeDay && m.meal_type === mealType.id
    );
    setSelectedItemIds(existing?.items || []);
    setShowConfigureModal(true);
  };

  const handleToggleItemInSlot = (itemId: number) => {
    setSelectedItemIds((prev) =>
      prev.includes(itemId) ? prev.filter((id) => id !== itemId) : [...prev, itemId]
    );
  };

  const handleSaveSlotMenu = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedHostelId || !targetMealType) return;

    try {
      const existing = menus.find(
        (m) => m.day_of_week === activeDay && m.meal_type === targetMealType.id
      );

      if (existing) {
        await apiClient.put(`/mess/menus/${existing.id}/`, {
          hostel: selectedHostelId,
          day_of_week: activeDay,
          meal_type: targetMealType.id,
          items: selectedItemIds,
          is_recurring: true,
        });
      } else {
        await apiClient.post('/mess/menus/', {
          hostel: selectedHostelId,
          day_of_week: activeDay,
          meal_type: targetMealType.id,
          items: selectedItemIds,
          is_recurring: true,
        });
      }

      setShowConfigureModal(false);
      fetchMenus(selectedHostelId);
    } catch (err) {
      alert('Failed to update meal slot menu');
    }
  };

  // 3. Meal Type Creation
  const handleCreateMealType = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await apiClient.post('/mess/meal-types/', {
        name: newMealTypeCode.toUpperCase(),
        description: newMealTypeDesc,
        time_from: newTimeFrom,
        time_to: newTimeTo,
      });
      setShowMealTypeModal(false);
      setNewMealTypeCode('');
      setNewMealTypeDesc('');
      const res = await apiClient.get<MealType[]>('/mess/meal-types/');
      setMealTypes(res.data);
    } catch (err) {
      alert('Failed to create meal type');
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Mess & Dining Management</h1>
          <p className="text-sm text-slate-500 mt-0.5">Configure weekly recurring meal timetables, dishes catalog, and dining hours</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleOpenCreateItem}
            className="px-4 py-2.5 rounded-full bg-[#0D3833] text-white text-xs font-semibold hover:bg-[#064E3B] transition-all shadow-sm flex items-center gap-1.5"
          >
            <Plus className="w-4 h-4" />
            <span>Add Food Item</span>
          </button>
          <button
            onClick={() => setShowMealTypeModal(true)}
            className="px-4 py-2.5 rounded-full bg-white border border-slate-200 text-slate-700 text-xs font-semibold hover:bg-slate-50 transition-all shadow-sm flex items-center gap-1.5"
          >
            <Clock className="w-4 h-4" />
            <span>Add Meal Slot</span>
          </button>
        </div>
      </div>

      {/* Main View Switcher Pills */}
      <div className="flex items-center gap-2 border-b border-slate-200 pb-3">
        <button
          onClick={() => setActiveViewTab('weekly')}
          className={`px-5 py-2 rounded-full text-xs font-bold transition-all flex items-center gap-2 ${
            activeViewTab === 'weekly'
              ? 'bg-[#0D3833] text-white shadow-sm'
              : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
          }`}
        >
          <Calendar className="w-3.5 h-3.5" />
          <span>Weekly Dining Timetable</span>
        </button>
        <button
          onClick={() => setActiveViewTab('items')}
          className={`px-5 py-2 rounded-full text-xs font-bold transition-all flex items-center gap-2 ${
            activeViewTab === 'items'
              ? 'bg-[#0D3833] text-white shadow-sm'
              : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
          }`}
        >
          <UtensilsCrossed className="w-3.5 h-3.5" />
          <span>Food Items Catalog ({menuItems.length})</span>
        </button>
        <button
          onClick={() => setActiveViewTab('meal_types')}
          className={`px-5 py-2 rounded-full text-xs font-bold transition-all flex items-center gap-2 ${
            activeViewTab === 'meal_types'
              ? 'bg-[#0D3833] text-white shadow-sm'
              : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
          }`}
        >
          <Clock className="w-3.5 h-3.5" />
          <span>Meal Timings & Slots ({mealTypes.length})</span>
        </button>
      </div>

      {/* VIEW 1: WEEKLY TIMETABLE */}
      {activeViewTab === 'weekly' && (
        <div className="space-y-6 animate-in fade-in duration-150">
          {/* Hostel Selector Tabs */}
          <div className="flex items-center gap-2.5 overflow-x-auto">
            {hostels.map((h) => (
              <button
                key={h.id}
                onClick={() => setSelectedHostelId(h.id)}
                className={`px-4 py-2 rounded-full text-xs font-bold transition-all ${
                  selectedHostelId === h.id
                    ? 'bg-[#0D3833] text-white shadow-sm'
                    : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
                }`}
              >
                {h.name}
              </button>
            ))}
          </div>

          {/* Days of Week Strip */}
          <div className="bg-white p-2 rounded-2xl border border-slate-200/80 shadow-sm flex items-center gap-2 overflow-x-auto">
            {days.map((day) => (
              <button
                key={day.id}
                onClick={() => setActiveDay(day.id)}
                className={`flex-1 py-2 px-3.5 rounded-xl text-xs font-bold transition-all text-center ${
                  activeDay === day.id
                    ? 'bg-[#D1F2EA] text-teal-950 border border-teal-300 shadow-xs'
                    : 'text-slate-600 hover:bg-slate-50'
                }`}
              >
                {day.label}
              </button>
            ))}
          </div>

          {/* Meals Grid for Active Day */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
            {mealTypes.map((mealType) => {
              const menuForSlot = menus.find(
                (m) => m.day_of_week === activeDay && m.meal_type === mealType.id
              );

              const cardThemes: Record<string, { bg: string; border: string; text: string }> = {
                BR: { bg: 'bg-[#E8F8CE]', border: 'border-emerald-300', text: 'text-emerald-950' },
                LN: { bg: 'bg-[#D1F2EA]', border: 'border-teal-300', text: 'text-teal-950' },
                SN: { bg: 'bg-[#FCE2E1]', border: 'border-rose-300', text: 'text-rose-950' },
                DN: { bg: 'bg-[#E0E7FF]', border: 'border-indigo-300', text: 'text-indigo-950' },
              };

              const theme = cardThemes[mealType.name] || { bg: 'bg-white', border: 'border-slate-200', text: 'text-slate-900' };

              return (
                <div
                  key={mealType.id}
                  className={`p-6 rounded-3xl border shadow-sm flex flex-col justify-between ${theme.bg} ${theme.border} ${theme.text}`}
                >
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <h3 className="font-bold text-base">{mealType.description || mealType.name}</h3>
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-black/10">
                        {mealType.time_from || '07:30'} - {mealType.time_to || '09:30'}
                      </span>
                    </div>
                    <div className="text-[11px] opacity-75 mb-4">Served in Hostel Dining Hall</div>

                    {/* Food Items in this slot */}
                    <div className="space-y-1.5 min-h-[120px]">
                      {menuForSlot?.items_detail && menuForSlot.items_detail.length > 0 ? (
                        menuForSlot.items_detail.map((item) => (
                          <div
                            key={item.id}
                            className="flex items-center gap-2 bg-white/90 px-3 py-2 rounded-xl text-xs font-semibold text-slate-800 border border-black/5 shadow-2xs"
                          >
                            <span className={`w-2 h-2 rounded-full flex-shrink-0 ${item.vegetarian ? 'bg-emerald-500' : 'bg-rose-500'}`} />
                            <span className="truncate">{item.name}</span>
                          </div>
                        ))
                      ) : (
                        <div className="h-full flex items-center justify-center bg-white/40 p-4 rounded-2xl text-xs italic text-center opacity-70 border border-dashed border-black/10">
                          No items mapped. Click configure to add dishes.
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="pt-4 mt-4 border-t border-black/10 flex items-center justify-between">
                    <button
                      onClick={() => handleOpenConfigureSlot(mealType)}
                      className="w-full py-2 rounded-full bg-[#0D3833] text-white text-xs font-semibold hover:bg-[#064E3B] transition-colors shadow-xs flex items-center justify-center gap-1.5"
                    >
                      <Edit className="w-3.5 h-3.5" />
                      <span>Configure Menu</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* VIEW 2: FOOD ITEMS CATALOG */}
      {activeViewTab === 'items' && (
        <div className="space-y-5 animate-in fade-in duration-150">
          <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-sm flex items-center justify-between gap-4">
            <div className="relative w-full sm:w-80">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={itemSearch}
                onChange={(e) => setItemSearch(e.target.value)}
                placeholder="Search food item name..."
                className="w-full bg-slate-50 pl-10 pr-4 py-2 rounded-xl text-sm border border-slate-200 focus:outline-none focus:ring-2 focus:ring-[#0D3833]/20"
              />
            </div>
            <span className="text-xs font-semibold text-slate-400">
              Total {menuItems.length} Culinary Items
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {menuItems
              .filter((i) => i.name.toLowerCase().includes(itemSearch.toLowerCase()))
              .map((item) => (
                <div
                  key={item.id}
                  className="bg-white p-5 rounded-3xl border border-slate-200/80 shadow-sm flex flex-col justify-between hover:border-slate-300 transition-all"
                >
                  <div>
                    <div className="flex items-start justify-between mb-2">
                      <span className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full border ${
                        item.vegetarian
                          ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                          : 'bg-rose-50 text-rose-700 border-rose-200'
                      }`}>
                        {item.vegetarian ? '100% VEG' : 'NON-VEG'}
                      </span>
                    </div>
                    <h4 className="font-bold text-slate-900 text-sm">{item.name}</h4>
                    {item.description && (
                      <p className="text-xs text-slate-400 mt-1 line-clamp-2">{item.description}</p>
                    )}
                  </div>

                  <div className="flex items-center justify-end gap-1.5 pt-3 mt-3 border-t border-slate-100">
                    <button
                      onClick={() => handleOpenEditItem(item)}
                      className="p-1.5 rounded-full hover:bg-slate-100 text-slate-600 transition-colors"
                      title="Edit Item"
                    >
                      <Edit className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => item.id && handleDeleteItem(item.id)}
                      className="p-1.5 rounded-full hover:bg-rose-50 text-rose-600 transition-colors"
                      title="Delete Item"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
          </div>
        </div>
      )}

      {/* VIEW 3: MEAL SLOTS / TIMINGS */}
      {activeViewTab === 'meal_types' && (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-5 animate-in fade-in duration-150">
          {mealTypes.map((mt) => (
            <div
              key={mt.id}
              className="bg-white p-6 rounded-3xl border border-slate-200/80 shadow-sm flex flex-col justify-between"
            >
              <div>
                <div className="w-10 h-10 rounded-2xl bg-[#E0E7FF] text-indigo-950 flex items-center justify-center font-bold text-sm mb-4">
                  {mt.name}
                </div>
                <h3 className="text-base font-bold text-slate-900">{mt.description || mt.name}</h3>
                <p className="text-xs text-slate-400 mt-1">
                  Active Service Slot
                </p>
                <div className="mt-4 p-3 rounded-2xl bg-slate-50 border border-slate-100 text-xs font-mono font-semibold text-slate-700 flex items-center gap-2">
                  <Clock className="w-4 h-4 text-slate-400" />
                  <span>{mt.time_from || '08:00'} - {mt.time_to || '10:00'}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* MODAL 1: CONFIGURE SLOT MENU (Select items for Day & Slot) */}
      {showConfigureModal && targetMealType && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-lg rounded-3xl p-6 border border-slate-200 shadow-xl animate-in fade-in zoom-in duration-150 max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div>
                <h3 className="text-lg font-bold text-slate-900">
                  Configure {targetMealType.description || targetMealType.name}
                </h3>
                <p className="text-xs text-slate-500">
                  Day: <strong>{days.find((d) => d.id === activeDay)?.label}</strong>
                </p>
              </div>
              <button
                onClick={() => setShowConfigureModal(false)}
                className="p-1.5 rounded-full hover:bg-slate-100 text-slate-400 hover:text-slate-700"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto py-4 space-y-2">
              <div className="text-xs font-semibold text-slate-700 mb-2">Select dishes to serve:</div>
              {menuItems.map((item) => {
                const isSelected = item.id ? selectedItemIds.includes(item.id) : false;
                return (
                  <div
                    key={item.id}
                    onClick={() => item.id && handleToggleItemInSlot(item.id)}
                    className={`p-3 rounded-2xl border flex items-center justify-between cursor-pointer transition-all ${
                      isSelected
                        ? 'bg-[#D1F2EA] border-teal-300 text-teal-950 font-bold'
                        : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <span className={`w-2.5 h-2.5 rounded-full ${item.vegetarian ? 'bg-emerald-500' : 'bg-rose-500'}`} />
                      <span className="text-xs">{item.name}</span>
                    </div>
                    {isSelected && <Check className="w-4 h-4 text-teal-800" />}
                  </div>
                );
              })}
            </div>

            <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setShowConfigureModal(false)}
                className="px-4 py-2 rounded-full border border-slate-200 text-xs font-semibold text-slate-600 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveSlotMenu}
                className="px-6 py-2.5 rounded-full bg-[#0D3833] text-white text-xs font-semibold hover:bg-[#064E3B] shadow-sm"
              >
                Save Meal Plan
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 2: ADD / EDIT FOOD ITEM */}
      {showItemModal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-md rounded-3xl p-6 border border-slate-200 shadow-xl animate-in fade-in zoom-in duration-150">
            <h3 className="text-lg font-bold text-slate-900 mb-1">
              {editingItem ? 'Edit Culinary Dish' : 'Add Food Item'}
            </h3>
            <p className="text-xs text-slate-500 mb-5">Create or edit a catalog item for hostel menus.</p>

            <form onSubmit={handleSaveItem} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">Dish Name</label>
                <input
                  type="text"
                  required
                  value={itemName}
                  onChange={(e) => setItemName(e.target.value)}
                  placeholder="e.g. Aloo Paratha with Curd"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">Description (Optional)</label>
                <textarea
                  rows={2}
                  value={itemDesc}
                  onChange={(e) => setItemDesc(e.target.value)}
                  placeholder="e.g. Served hot with butter and pickle"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm"
                />
              </div>

              <div className="flex items-center gap-3 pt-2">
                <label className="flex items-center gap-2 text-xs font-semibold text-slate-700 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={isVeg}
                    onChange={(e) => setIsVeg(e.target.checked)}
                    className="w-4 h-4 text-emerald-600 rounded"
                  />
                  <span>Vegetarian Dish (100% Veg)</span>
                </label>
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowItemModal(false)}
                  className="px-4 py-2 rounded-full border border-slate-200 text-xs font-semibold text-slate-600 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-full bg-[#0D3833] text-white text-xs font-semibold hover:bg-[#064E3B] shadow-sm"
                >
                  Save Dish
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 3: ADD MEAL TYPE / TIMING SLOT */}
      {showMealTypeModal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-md rounded-3xl p-6 border border-slate-200 shadow-xl animate-in fade-in zoom-in duration-150">
            <h3 className="text-lg font-bold text-slate-900 mb-1">Add Dining Meal Slot</h3>
            <p className="text-xs text-slate-500 mb-5">Define a new dining service window (e.g. Midnight Snack).</p>

            <form onSubmit={handleCreateMealType} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Code</label>
                  <input
                    type="text"
                    required
                    value={newMealTypeCode}
                    onChange={(e) => setNewMealTypeCode(e.target.value)}
                    placeholder="e.g. MS"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Title</label>
                  <input
                    type="text"
                    required
                    value={newMealTypeDesc}
                    onChange={(e) => setNewMealTypeDesc(e.target.value)}
                    placeholder="e.g. Midnight Snacks"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 text-sm"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Service Start</label>
                  <input
                    type="time"
                    required
                    value={newTimeFrom}
                    onChange={(e) => setNewTimeFrom(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Service End</label>
                  <input
                    type="time"
                    required
                    value={newTimeTo}
                    onChange={(e) => setNewTimeTo(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 text-sm"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowMealTypeModal(false)}
                  className="px-4 py-2 rounded-full border border-slate-200 text-xs font-semibold text-slate-600 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-full bg-[#0D3833] text-white text-xs font-semibold hover:bg-[#064E3B] shadow-sm"
                >
                  Create Slot
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
