import React, { useEffect, useState } from 'react';
import { Plus, Trash2, Edit2, Download, Check, X, Clock, Coffee, Sun, Sunset, Moon, UtensilsCrossed, Building2, Search, Tag, Filter } from 'lucide-react';
import type { MealType, MenuItem, Menu, Hostel } from '../../types';
import { useNotification } from '../../context/NotificationContext';
import { useAuth } from '../../context/AuthContext';
import { wardenService } from '../../services/wardenService';
import { adminService } from '../../services/adminService';
import { diningService } from '../../services/facilitiesService';
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
  const { user } = useAuth();
  const { showSuccess, showError, confirm } = useNotification();
  const [hostels, setHostels] = useState<Hostel[]>([]);
  const [selectedHostelId, setSelectedHostelId] = useState<string>('');
  const [mealTypes, setMealTypes] = useState<MealType[]>([]);
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [menus, setMenus] = useState<Menu[]>([]);
  const [activeDay, setActiveDay] = useState<string>('0');
  const [activeTab, setActiveTab] = useState<'timetable' | 'catalog'>('timetable');

  // Catalog Filtering & Search
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState<string>('ALL');
  const [catalogSearch, setCatalogSearch] = useState<string>('');

  // Modal State for Food Item
  const [showItemModal, setShowItemModal] = useState(false);
  const [editingItem, setEditingItem] = useState<MenuItem | null>(null);
  const [itemName, setItemName] = useState('');
  const [itemCategory, setItemCategory] = useState('Main Course');
  const [isCustomCategory, setIsCustomCategory] = useState(false);
  const [customCategoryInput, setCustomCategoryInput] = useState('');
  const [itemDesc, setItemDesc] = useState('');
  const [isVeg, setIsVeg] = useState(true);

  // Modal State for Meal Slot Configuration
  const [showConfigureModal, setShowConfigureModal] = useState(false);
  const [targetMealType, setTargetMealType] = useState<MealType | null>(null);
  const [selectedItemIds, setSelectedItemIds] = useState<number[]>([]);
  const [slotCategoryFilter, setSlotCategoryFilter] = useState<string>('ALL');
  const [slotStartTime, setSlotStartTime] = useState('07:30');
  const [slotEndTime, setSlotEndTime] = useState('09:30');
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    fetchHostelsAndData();
  }, [user?.id, user?.role]);

  useEffect(() => {
    if (selectedHostelId) {
      fetchMenus(selectedHostelId);
    }
  }, [selectedHostelId]);

  const fetchHostelsAndData = async () => {
    try {
      let loadedHostels: Hostel[] = [];
      if (user?.role === 'WARDEN') {
        loadedHostels = await wardenService.getAssignedHostels(user.id);
      } else {
        loadedHostels = await adminService.getHostelsList();
      }

      const mealTypesData = await diningService.getMealTypes();
      setHostels(loadedHostels);
      setMealTypes(mealTypesData || []);

      if (loadedHostels.length > 0 && !selectedHostelId) {
        setSelectedHostelId(String(loadedHostels[0].id));
      } else if (!loadedHostels.length) {
        const { menuItems: itemsData, categories: categoriesData } = await diningService.getHostelDiningData();
        setMenuItems(itemsData || []);
        setCategories(categoriesData || []);
      }
    } catch (err) {
      console.error('Failed to load menu planner data', err);
    }
  };

  const fetchMenus = async (hostelId: string) => {
    try {
      const { menus: menusData, menuItems: itemsData, categories: categoriesData } =
        await diningService.getHostelDiningData(hostelId);

      setMenus(menusData || []);
      setMenuItems(itemsData || []);
      setCategories(categoriesData || []);
    } catch (err) {
      console.error('Failed to load menus for hostel', err);
    }
  };

  const handleOpenAddItem = () => {
    setEditingItem(null);
    setItemName('');
    const defaultCat = categories[0] || 'Main Course';
    setItemCategory(defaultCat);
    setIsCustomCategory(false);
    setCustomCategoryInput('');
    setItemDesc('');
    setIsVeg(true);
    setShowItemModal(true);
  };

  const handleOpenEditItem = (item: MenuItem) => {
    setEditingItem(item);
    setItemName(item.name);
    const cat = item.category || 'Main Course';
    if (categories.includes(cat)) {
      setItemCategory(cat);
      setIsCustomCategory(false);
      setCustomCategoryInput('');
    } else {
      setItemCategory('__custom__');
      setIsCustomCategory(true);
      setCustomCategoryInput(cat);
    }
    setItemDesc(item.description || '');
    setIsVeg(Boolean(item.is_veg ?? item.vegetarian ?? true));
    setShowItemModal(true);
  };

  const handleSaveItem = async (e: React.FormEvent) => {
    e.preventDefault();
    const finalCategory = isCustomCategory
      ? (customCategoryInput.trim() || 'Main Course')
      : itemCategory;

    const payload = {
      name: itemName,
      category: finalCategory,
      description: itemDesc,
      is_veg: isVeg,
      vegetarian: isVeg,
    };

    try {
      if (editingItem) {
        await diningService.updateMenuItem(editingItem.id, payload);
        showSuccess(`Food item "${itemName}" updated successfully.`);
      } else {
        await diningService.createMenuItem(payload);
        showSuccess(`Food item "${itemName}" created successfully.`);
      }
      setShowItemModal(false);
      if (selectedHostelId) {
        fetchMenus(selectedHostelId);
      } else {
        const [itemsData, categoriesData] = await Promise.all([
          diningService.getMenuItems(),
          diningService.getCategories(),
        ]);
        setMenuItems(itemsData || []);
        setCategories(categoriesData || []);
      }
    } catch (err) {
      showError('Failed to save food item');
    }
  };

  const handleDeleteItem = async (id: number) => {
    const isConfirmed = await confirm({
      title: 'Delete Food Item',
      message: 'Are you sure you want to delete this food item? It will be unlinked from current dining schedules.',
      confirmText: 'Delete Item',
      isDestructive: true
    });
    if (!isConfirmed) return;
    try {
      await diningService.deleteMenuItem(id);
      showSuccess('Food item removed successfully.');
      if (selectedHostelId) {
        fetchMenus(selectedHostelId);
      } else {
        const [itemsData, categoriesData] = await Promise.all([
          diningService.getMenuItems(),
          diningService.getCategories(),
        ]);
        setMenuItems(itemsData || []);
        setCategories(categoriesData || []);
      }
    } catch (err) {
      showError('Failed to delete food item');
    }
  };

  const handleOpenConfigureSlot = (mealType: MealType) => {
    if (!selectedHostelId) {
      showError('Please select a hostel block first');
      return;
    }
    setTargetMealType(mealType);
    setSlotCategoryFilter('ALL');
    const rawStart = mealType.start_time || mealType.time_from || '07:30';
    const rawEnd = mealType.end_time || mealType.time_to || '09:30';
    setSlotStartTime(rawStart.substring(0, 5));
    setSlotEndTime(rawEnd.substring(0, 5));

    const existing = menus.find(
      (m) =>
        String(m.day_of_week) === String(activeDay) &&
        Number(m.meal_type_id || m.meal_type?.id || m.meal_type) === Number(mealType.id) &&
        (!m.hostel_id || String(m.hostel_id) === String(selectedHostelId) || String((m as any).hostel?.id || (m as any).hostel) === String(selectedHostelId))
    );
    if (existing) {
      const items = existing.items || existing.items_detail || (existing as any).menu_items || [];
      setSelectedItemIds(items.map((i: any) => (typeof i === 'object' ? i.id : i)));
    } else {
      setSelectedItemIds([]);
    }
    setShowConfigureModal(true);
  };

  const handleSaveSlotMenu = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!targetMealType || !selectedHostelId) return;
    setIsSaving(true);
    try {
      await diningService.saveMenuSlot(
        activeDay,
        targetMealType.id,
        selectedItemIds,
        selectedHostelId
      );
      const selectedHostelName = hostels.find((h) => String(h.id) === String(selectedHostelId))?.name || 'Selected Hostel';
      showSuccess(`Dining schedule updated for ${targetMealType.name} (${selectedHostelName}).`);
      setShowConfigureModal(false);
      fetchMenus(selectedHostelId);
    } catch (err: any) {
      console.error('Failed to update dining slot:', err);
      showError('Failed to update dining menu slot: ' + (err.response?.data?.detail || err.message));
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
          <p className="text-xs text-slate-500 mt-0.5">Configure 7-day recurring meal timetables, food catalog, and nutritional slots</p>
        </div>
        {activeTab === 'catalog' && (
          <div className="shrink-0 self-start sm:self-auto">
            <button
              onClick={handleOpenAddItem}
              className="flex items-center gap-2 px-4 py-2 rounded-full bg-[#0B1437] text-white text-xs font-semibold hover:bg-[#111f54] transition-all shadow-xs cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Add Food Item</span>
            </button>
          </div>
        )}
      </div>

      {/* Primary Navigation & Filter Toolbar Bar */}
      <div className="bg-white p-3.5 sm:p-4 rounded-3xl border border-slate-200/80 shadow-xs space-y-4">
        {/* Primary Tab Navigation */}
        <div className="flex items-center gap-2 p-1 bg-slate-100 rounded-full w-fit">
          <button
            onClick={() => setActiveTab('timetable')}
            className={`px-4 py-2 rounded-full text-xs font-semibold transition-all cursor-pointer ${
              activeTab === 'timetable'
                ? 'bg-[#0B1437] text-white shadow-xs'
                : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
            }`}
          >
            Weekly Timetable Matrix
          </button>
          <button
            onClick={() => setActiveTab('catalog')}
            className={`px-4 py-2 rounded-full text-xs font-semibold transition-all cursor-pointer ${
              activeTab === 'catalog'
                ? 'bg-[#0B1437] text-white shadow-xs'
                : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
            }`}
          >
            Food Items Catalog ({menuItems.length})
          </button>
        </div>

        {/* Hostel Selection & Day of Week Selectors */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-3 border-t border-slate-100">
          {/* Hostel Selection Dropdown */}
          <div className="flex items-center gap-2.5 w-full sm:w-auto">
            <span className="text-xs font-semibold text-slate-500 whitespace-nowrap shrink-0 flex items-center gap-1.5">
              <Building2 className="w-3.5 h-3.5 text-teal-700" />
              <span>Select Hostel:</span>
            </span>
            <div className="flex-1 min-w-0 sm:w-60">
              <Select
                value={selectedHostelId}
                onValueChange={(val) => setSelectedHostelId(val)}
              >
                <SelectTrigger className="w-full bg-slate-50 border-slate-200 text-xs font-semibold rounded-full h-9 px-3.5">
                  <SelectValue placeholder="-- Select Hostel Block --" />
                </SelectTrigger>
                <SelectContent>
                  {hostels.map((hostel) => (
                    <SelectItem key={hostel.id} value={String(hostel.id)}>
                      {hostel.name} ({hostel.gender === 'M' ? 'Boys' : hostel.gender === 'F' ? 'Girls' : 'Co-ed'})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Select Day of Week Dropdown (Mobile view inline) */}
          {activeTab === 'timetable' && (
            <div className="flex items-center gap-2.5 w-full sm:w-auto block md:hidden">
              <label className="text-xs font-semibold text-slate-500 whitespace-nowrap shrink-0">
                Select Day of Week:
              </label>
              <div className="flex-1 min-w-0 sm:w-48">
                <Select value={activeDay} onValueChange={(val) => setActiveDay(val)}>
                  <SelectTrigger className="w-full bg-slate-50 border-slate-200 text-xs font-bold text-slate-800 rounded-full h-9 px-3.5">
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
            </div>
          )}
        </div>
      </div>

      {activeTab === 'timetable' && (
        <div className="space-y-5">
          {hostels.length === 0 ? (
            <div className="bg-amber-50 p-10 rounded-3xl border border-amber-200 text-center space-y-2">
              <Building2 className="w-8 h-8 text-amber-600 mx-auto" />
              <h3 className="font-bold text-amber-900 text-sm">
                {user?.role === 'WARDEN' ? 'No Hostels Assigned' : 'No Hostels Found'}
              </h3>
              <p className="text-xs text-amber-700">
                {user?.role === 'WARDEN'
                  ? 'You are not currently assigned to any hostel block. Please contact the administrator to assign your block.'
                  : 'Please add hostel blocks first in Hostel Management.'}
              </p>
            </div>
          ) : !selectedHostelId ? (
            <div className="bg-white p-10 rounded-3xl border border-dashed border-slate-200 text-center space-y-2">
              <Building2 className="w-8 h-8 text-slate-400 mx-auto" />
              <h3 className="font-bold text-slate-700 text-sm">Select a Hostel Block</h3>
              <p className="text-xs text-slate-400">Please choose a hostel block from the dropdown above to view and configure its menu.</p>
            </div>
          ) : (
            <>
              {/* Desktop View: Horizontal Day Pills (>= 768px) */}
              <div className="hidden md:flex items-center gap-2 overflow-x-auto pb-2">
                {DAYS.map((day) => (
                  <button
                    key={day.id}
                    onClick={() => setActiveDay(day.id)}
                    className={`px-5 py-2.5 rounded-2xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
                      activeDay === day.id
                        ? 'bg-blue-100 text-teal-950 border border-teal-300 shadow-sm'
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
                (m) => String(m.day_of_week) === String(activeDay) && Number(m.meal_type_id || m.meal_type?.id || m.meal_type) === Number(mealType.id)
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
                      className="px-3.5 py-1.5 rounded-full bg-slate-50 hover:bg-[#0B1437] text-slate-700 hover:text-white border border-slate-200 hover:border-transparent text-xs font-semibold transition-all shadow-2xs cursor-pointer flex items-center gap-1.5"
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
        </>
      )}
    </div>
  )}

      {activeTab === 'catalog' && (
        <div className="space-y-4">
          {/* Category Filter Pills & Search Bar */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-white p-3.5 sm:p-4 rounded-3xl border border-slate-200/80 shadow-xs">
            {/* Category Filter Chips */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0 scrollbar-none">
              <button
                onClick={() => setSelectedCategoryFilter('ALL')}
                className={`px-3.5 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-all cursor-pointer ${
                  selectedCategoryFilter === 'ALL'
                    ? 'bg-[#0B1437] text-white shadow-xs'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                All Items ({menuItems.length})
              </button>
              {categories.map((cat) => {
                const count = menuItems.filter(
                  (i) => (i.category || 'Main Course').trim().toLowerCase() === cat.trim().toLowerCase()
                ).length;
                return (
                  <button
                    key={cat}
                    onClick={() => setSelectedCategoryFilter(cat)}
                    className={`px-3.5 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-all cursor-pointer ${
                      selectedCategoryFilter === cat
                        ? 'bg-[#0B1437] text-white shadow-xs'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    {cat} {count > 0 && <span className="opacity-75 font-normal">({count})</span>}
                  </button>
                );
              })}
            </div>

            {/* Quick Search */}
            <div className="relative shrink-0 sm:w-60">
              <input
                type="text"
                placeholder="Search catalog items..."
                value={catalogSearch}
                onChange={(e) => setCatalogSearch(e.target.value)}
                className="w-full bg-slate-50 pl-8 pr-3 py-1.5 rounded-full text-xs border border-slate-200 focus:outline-none focus:ring-2 focus:ring-[#0B1437]/20"
              />
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2" />
            </div>
          </div>

          {/* Catalog Cards Grid */}
          {(() => {
            const filteredItems = menuItems.filter((item) => {
              const matchesCategory =
                selectedCategoryFilter === 'ALL' ||
                (item.category || 'Main Course').trim().toLowerCase() === selectedCategoryFilter.trim().toLowerCase();
              const matchesSearch =
                !catalogSearch.trim() ||
                item.name.toLowerCase().includes(catalogSearch.toLowerCase()) ||
                (item.description && item.description.toLowerCase().includes(catalogSearch.toLowerCase())) ||
                (item.category && item.category.toLowerCase().includes(catalogSearch.toLowerCase()));
              return matchesCategory && matchesSearch;
            });

            if (filteredItems.length === 0) {
              return (
                <div className="bg-white p-12 rounded-3xl border border-dashed border-slate-200 text-center space-y-2">
                  <UtensilsCrossed className="w-8 h-8 text-slate-300 mx-auto" />
                  <h3 className="font-bold text-slate-700 text-sm">No food items found</h3>
                  <p className="text-xs text-slate-400">
                    {catalogSearch || selectedCategoryFilter !== 'ALL'
                      ? 'No items match your filter criteria. Try clearing search or selecting another category.'
                      : 'No food items in the catalog yet. Click "+ Add Food Item" to create dishes.'}
                  </p>
                </div>
              );
            }

            return (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredItems.map((item) => {
                  const isVegetarian = item.is_veg ?? item.vegetarian ?? true;
                  return (
                    <div
                      key={item.id}
                      className="bg-white p-5 rounded-3xl border border-slate-200/80 shadow-sm hover:shadow-md hover:border-slate-300 transition-all flex items-center justify-between"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        {/* Clean Veg/Non-Veg Square Stamp Indicator */}
                        <div
                          className={`w-4 h-4 rounded-sm border shrink-0 flex items-center justify-center ${
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

                        <div className="min-w-0">
                          <h4 className="text-sm font-bold text-slate-800 leading-tight truncate">{item.name}</h4>
                          <div className="flex items-center gap-1.5 mt-1">
                            <span className="text-[10px] font-semibold px-2 py-0.5 rounded-md bg-slate-100 text-slate-600 border border-slate-200/60">
                              {item.category || (isVegetarian ? 'Vegetarian' : 'Non-Vegetarian')}
                            </span>
                          </div>
                          {item.description && (
                            <p className="text-[11px] text-slate-400 mt-1 truncate">{item.description}</p>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-1 shrink-0 ml-2">
                        <button
                          onClick={() => handleOpenEditItem(item)}
                          className="p-2 rounded-xl hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors cursor-pointer"
                          title="Edit Item"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDeleteItem(item.id)}
                          className="p-2 rounded-xl hover:bg-rose-50 text-slate-400 hover:text-rose-600 transition-colors cursor-pointer"
                          title="Delete Item"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            );
          })()}
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
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">Item Name <span className="text-red-500">*</span></label>
                <input
                  type="text"
                  required
                  value={itemName}
                  onChange={(e) => setItemName(e.target.value)}
                  placeholder="e.g. Masala Dosa, Paneer Butter Masala"
                  className="w-full bg-slate-50 px-4 py-2.5 rounded-2xl text-sm border border-slate-200 focus:outline-none focus:ring-2 focus:ring-[#0B1437]/20 focus:border-[#0B1437]"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-semibold text-slate-700">Category <span className="text-red-500">*</span></label>
                  <button
                    type="button"
                    onClick={() => {
                      setIsCustomCategory(!isCustomCategory);
                      if (!isCustomCategory) {
                        setCustomCategoryInput('');
                      }
                    }}
                    className="text-[11px] text-teal-700 hover:underline font-semibold cursor-pointer"
                  >
                    {isCustomCategory ? 'Choose from list' : '+ Custom Category'}
                  </button>
                </div>

                {isCustomCategory ? (
                  <input
                    type="text"
                    required
                    value={customCategoryInput}
                    onChange={(e) => setCustomCategoryInput(e.target.value)}
                    placeholder="Enter new category name..."
                    className="w-full bg-slate-50 px-4 py-2.5 rounded-2xl text-sm border border-slate-200 focus:outline-none focus:ring-2 focus:ring-[#0B1437]/20 focus:border-[#0B1437]"
                  />
                ) : (
                  <Select value={itemCategory} onValueChange={(val) => setItemCategory(val)}>
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Select Category" />
                    </SelectTrigger>
                    <SelectContent>
                      {categories.map((cat) => (
                        <SelectItem key={cat} value={cat}>
                          {cat}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">Description (Optional)</label>
                <textarea
                  value={itemDesc}
                  onChange={(e) => setItemDesc(e.target.value)}
                  placeholder="Ingredients or allergens notes..."
                  rows={2}
                  className="w-full bg-slate-50 px-4 py-2.5 rounded-2xl text-sm border border-slate-200 focus:outline-none focus:ring-2 focus:ring-[#0B1437]/20 focus:border-[#0B1437]"
                />
              </div>

              <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-2xl border border-slate-200">
                <input
                  type="checkbox"
                  id="isVegCheck"
                  checked={isVeg}
                  onChange={(e) => setIsVeg(e.target.checked)}
                  className="w-4 h-4 text-[#0B1437] rounded focus:ring-0 cursor-pointer"
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
                  className="px-5 py-2.5 rounded-full bg-[#0B1437] text-white text-xs font-semibold hover:bg-[#111f54] shadow-sm cursor-pointer"
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
                <p className="text-xs text-slate-500 mt-0.5">
                  Hostel: <strong className="text-teal-950 font-semibold">{hostels.find((h) => String(h.id) === String(selectedHostelId))?.name || 'Selected Hostel'}</strong> · {DAYS.find((d) => d.id === activeDay)?.name}
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
                      className="w-full bg-white px-3 py-2 rounded-xl text-xs font-mono font-bold border border-slate-200 focus:outline-none focus:ring-2 focus:ring-[#0B1437]/20"
                    />
                  </div>
                  <div>
                    <span className="text-[10px] font-semibold text-slate-400 block mb-1">End Time</span>
                    <input
                      type="time"
                      value={slotEndTime}
                      onChange={(e) => setSlotEndTime(e.target.value)}
                      required
                      className="w-full bg-white px-3 py-2 rounded-xl text-xs font-mono font-bold border border-slate-200 focus:outline-none focus:ring-2 focus:ring-[#0B1437]/20"
                    />
                  </div>
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs font-bold text-slate-700">
                    Select Menu Items ({selectedItemIds.length} Selected)
                  </label>
                  {/* Category Filter Chips for Slot Config */}
                  <div className="flex items-center gap-1 overflow-x-auto max-w-[200px] scrollbar-none">
                    <button
                      type="button"
                      onClick={() => setSlotCategoryFilter('ALL')}
                      className={`text-[10px] font-semibold px-2 py-0.5 rounded-full transition-all cursor-pointer ${
                        slotCategoryFilter === 'ALL'
                          ? 'bg-[#0B1437] text-white'
                          : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                      }`}
                    >
                      All
                    </button>
                    {categories.map((cat) => (
                      <button
                        key={cat}
                        type="button"
                        onClick={() => setSlotCategoryFilter(cat)}
                        className={`text-[10px] font-semibold px-2 py-0.5 rounded-full whitespace-nowrap transition-all cursor-pointer ${
                          slotCategoryFilter === cat
                            ? 'bg-[#0B1437] text-white'
                            : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                        }`}
                      >
                        {cat}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="max-h-56 overflow-y-auto space-y-2 pr-1">
                  {menuItems
                    .filter((item) => {
                      if (slotCategoryFilter === 'ALL') return true;
                      return (item.category || 'Main Course').trim().toLowerCase() === slotCategoryFilter.trim().toLowerCase();
                    })
                    .map((item) => {
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
                          <div className="flex items-center gap-2.5 min-w-0">
                            <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${isVegetarian ? 'bg-emerald-500' : 'bg-rose-500'}`} />
                            <div className="min-w-0">
                              <p className="text-xs font-bold text-slate-800 truncate">{item.name}</p>
                              <p className="text-[10px] text-slate-400 truncate">{item.category || (isVegetarian ? 'Vegetarian' : 'Non-Vegetarian')}</p>
                            </div>
                          </div>

                          <div className={`w-5 h-5 rounded-lg border shrink-0 flex items-center justify-center transition-all ${
                            isSelected ? 'bg-[#0B1437] border-[#0B1437] text-white' : 'border-slate-300'
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
                  className="px-5 py-2.5 rounded-full bg-[#0B1437] text-white text-xs font-semibold hover:bg-[#111f54] shadow-sm cursor-pointer disabled:opacity-60"
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
