import React, { useState, useEffect, useMemo } from 'react';
import {
  Calendar as CalendarIcon,
  LayoutDashboard,
  History,
  Settings,
  Plus,
  Pill,
  ChevronLeft,
  ChevronRight,
  AlertTriangle,
  Info,
  ShieldCheck,
  Download,
  Upload,
  RotateCcw,
  Trash2,
  X,
  Check,
  CalendarDays,
  Sparkles,
  Heart,
  HelpCircle
} from 'lucide-react';


/**
 * Date formatting and calculation helpers without timezone shifting
 */
const formatDateKey = (year, month, day) => {
  const y = year;
  const m = String(month + 1).padStart(2, '0');
  const d = String(day).padStart(2, '0');
  return `${y}-${m}-${d}`;
};

const parseDateKey = (key) => {
  if (!key) return new Date();
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d);
};

const formatDisplayDate = (key, includeYear = true) => {
  if (!key) return '';
  const date = parseDateKey(key);
  const options = { month: 'short', day: 'numeric' };
  if (includeYear) options.year = 'numeric';
  return date.toLocaleDateString('en-US', options);
};

const formatShortDate = (key) => {
  if (!key) return '';
  const date = parseDateKey(key);
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
};

const addDaysToKey = (key, days) => {
  const d = parseDateKey(key);
  d.setDate(d.getDate() + days);
  return formatDateKey(d.getFullYear(), d.getMonth(), d.getDate());
};

const getDaysBetween = (startKey, endKey) => {
  const start = parseDateKey(startKey);
  const end = parseDateKey(endKey);
  const diffTime = end.getTime() - start.getTime();
  return Math.round(diffTime / (1000 * 60 * 60 * 24));
};

const getTodayKey = () => {
  const today = new Date();
  return formatDateKey(today.getFullYear(), today.getMonth(), today.getDate());
};


const SAMPLE_DATA = {
  periods: [
    { id: 'p1', startDate: '2026-06-01', endDate: '2026-06-05', notes: 'Normal cycle start' },
    { id: 'p2', startDate: '2026-07-01', endDate: '2026-07-05', notes: 'Regular' },
    { id: 'p3', startDate: '2026-07-31', endDate: '2026-08-04', notes: 'Regular' },
    { id: 'p4', startDate: '2026-08-30', endDate: '2026-09-03', notes: 'Regular' },
    { id: 'p5', startDate: '2026-09-29', endDate: '2026-10-03', notes: 'Most recent period' }
  ],
  ipills: [
    { id: 'i1', date: '2026-09-08', notes: 'Taken as emergency precaution' }
  ],
  settings: {
    averageCycleOverride: null,
    periodLengthDefault: 5
  }
};


function useCycleEngine(periods, ipills, settings) {
  return useMemo(() => {
    // Sort periods chronologically
    const sortedPeriods = [...periods].sort((a, b) => a.startDate.localeCompare(b.startDate));
    
    if (sortedPeriods.length === 0) {
      return {
        hasData: false,
        lastPeriod: null,
        avgCycleLength: 28,
        avgDuration: 5,
        cycleHistory: [],
        currentCycleDay: null,
        nextPredictedStart: null,
        nextPredictedRange: null,
        isCurrentCycleAffectedByIPill: false,
        confidenceLevel: 'Low',
        confidenceReason: 'No period history recorded'
      };
    }

    // Compute past cycle lengths
    const cycleHistory = [];
    let totalCycleLength = 0;
    let cycleCount = 0;

    for (let i = 0; i < sortedPeriods.length - 1; i++) {
      const currentP = sortedPeriods[i];
      const nextP = sortedPeriods[i + 1];
      const length = getDaysBetween(currentP.startDate, nextP.startDate);
      const duration = currentP.endDate ? (getDaysBetween(currentP.startDate, currentP.endDate) + 1) : 5;
      
      cycleHistory.push({
        id: currentP.id,
        startDate: currentP.startDate,
        endDate: currentP.endDate,
        duration: duration,
        cycleLength: length,
        notes: currentP.notes
      });

      // Filter out extreme outliers (e.g., < 15 or > 60 days) from calculation averages
      if (length >= 18 && length <= 50) {
        totalCycleLength += length;
        cycleCount++;
      }
    }

    // Append last period details to history
    const lastP = sortedPeriods[sortedPeriods.length - 1];
    const lastDuration = lastP.endDate ? (getDaysBetween(lastP.startDate, lastP.endDate) + 1) : 5;
    cycleHistory.push({
      id: lastP.id,
      startDate: lastP.startDate,
      endDate: lastP.endDate,
      duration: lastDuration,
      cycleLength: null, // latest cycle is ongoing
      notes: lastP.notes
    });

    // Calculate dynamic average cycle length
    let computedAvgCycle = 29;
    if (settings.averageCycleOverride) {
      computedAvgCycle = parseInt(settings.averageCycleOverride, 10);
    } else if (cycleCount > 0) {
      computedAvgCycle = Math.round(totalCycleLength / cycleCount);
    }

    const todayStr = getTodayKey();
    const currentCycleDay = getDaysBetween(lastP.startDate, todayStr) + 1;

    // Check if current cycle is affected by emergency contraception (i-Pill taken after current cycle start date)
    const currentCycleIPills = ipills.filter(item => item.date >= lastP.startDate);
    const isCurrentCycleAffectedByIPill = currentCycleIPills.length > 0;

    // Predict Next Period
    const nextPredictedStart = addDaysToKey(lastP.startDate, computedAvgCycle);
    const nextPredictedStartEarly = addDaysToKey(nextPredictedStart, -2);
    const nextPredictedStartLate = addDaysToKey(nextPredictedStart, 1);
    const nextPredictedRange = `${formatShortDate(nextPredictedStartEarly)} – ${formatShortDate(nextPredictedStartLate)}`;

    // Prediction confidence indicator
    let confidenceLevel = 'High';
    let confidenceReason = 'Based on consistent recent cycles';

    if (isCurrentCycleAffectedByIPill) {
      confidenceLevel = 'Adjusted';
      confidenceReason = 'Emergency contraception may shift cycle timing';
    } else if (sortedPeriods.length < 3) {
      confidenceLevel = 'Medium';
      confidenceReason = 'Prediction accuracy improves with more cycle entries';
    } else if (cycleHistory.some(c => c.cycleLength && Math.abs(c.cycleLength - computedAvgCycle) > 5)) {
      confidenceLevel = 'Medium';
      confidenceReason = 'Cycles show slight variation in length';
    }

    return {
      hasData: true,
      lastPeriod: lastP,
      avgCycleLength: computedAvgCycle,
      avgDuration: lastDuration,
      cycleHistory: cycleHistory.reverse(), // most recent first
      currentCycleDay,
      nextPredictedStart,
      nextPredictedRange,
      isCurrentCycleAffectedByIPill,
      confidenceLevel,
      confidenceReason
    };
  }, [periods, ipills, settings]);
}


export default function App() {
  const [periods, setPeriods] = useState(() => {
    const saved = localStorage.getItem('cycle_track_periods');
    return saved ? JSON.parse(saved) : SAMPLE_DATA.periods;
  });

  const [ipills, setIpills] = useState(() => {
    const saved = localStorage.getItem('cycle_track_ipills');
    return saved ? JSON.parse(saved) : SAMPLE_DATA.ipills;
  });

  const [settings, setSettings] = useState(() => {
    const saved = localStorage.getItem('cycle_track_settings');
    return saved ? JSON.parse(saved) : SAMPLE_DATA.settings;
  });

  const [activeTab, setActiveTab] = useState('dashboard');
  const [currentMonthDate, setCurrentMonthDate] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });

  // Modal States
  const [isAddPeriodOpen, setIsAddPeriodOpen] = useState(false);
  const [isAddIPillOpen, setIsAddIPillOpen] = useState(false);
  const [selectedDayModal, setSelectedDayModal] = useState(null);
  const [toastMessage, setToastMessage] = useState(null);
  const [confirmDialog, setConfirmDialog] = useState(null);

  // Sync state to local storage
  useEffect(() => {
    localStorage.setItem('cycle_track_periods', JSON.stringify(periods));
  }, [periods]);

  useEffect(() => {
    localStorage.setItem('cycle_track_ipills', JSON.stringify(ipills));
  }, [ipills]);

  useEffect(() => {
    localStorage.setItem('cycle_track_settings', JSON.stringify(settings));
  }, [settings]);

  // Cycle Engine Analysis
  const engine = useCycleEngine(periods, ipills, settings);

  const showToast = (msg, type = 'success') => {
    setToastMessage({ text: msg, type });
    setTimeout(() => setToastMessage(null), 3500);
  };


  const handleAddPeriod = (startDate, endDate, notes) => {
    if (!startDate) return;
    
    // Check duplicates
    if (periods.some(p => p.startDate === startDate)) {
      showToast('A period already starts on this date!', 'error');
      return;
    }

    if (endDate && endDate < startDate) {
      showToast('End date cannot be earlier than start date.', 'error');
      return;
    }

    const newPeriod = {
      id: 'p_' + Date.now(),
      startDate,
      endDate: endDate || startDate,
      notes: notes || ''
    };

    setPeriods(prev => [...prev, newPeriod]);
    setIsAddPeriodOpen(false);
    showToast('Period recorded successfully');
  };

  const handleDeletePeriod = (id) => {
    setPeriods(prev => prev.filter(p => p.id !== id));
    showToast('Period entry removed');
  };

  const handleAddIPill = (date, notes) => {
    if (!date) return;

    if (ipills.some(i => i.date === date)) {
      showToast('i-Pill already recorded for this date!', 'error');
      return;
    }

    const newIPill = {
      id: 'i_' + Date.now(),
      date,
      notes: notes || 'Emergency contraception'
    };

    setIpills(prev => [...prev, newIPill]);
    setIsAddIPillOpen(false);
    showToast('Emergency contraception marked');
  };

  const handleDeleteIPill = (id) => {
    setIpills(prev => prev.filter(i => i.id !== id));
    showToast('i-Pill entry removed');
  };

  const handleLoadSampleData = () => {
    setPeriods(SAMPLE_DATA.periods);
    setIpills(SAMPLE_DATA.ipills);
    setSettings(SAMPLE_DATA.settings);
    showToast('Sample workflow data loaded');
  };

  const handleClearAllData = () => {
    setConfirmDialog({
      title: 'Clear All Saved Data?',
      message: 'This will erase all recorded period dates, emergency contraception markers, and user settings from this device.',
      onConfirm: () => {
        setPeriods([]);
        setIpills([]);
        setSettings(SAMPLE_DATA.settings);
        localStorage.clear();
        setConfirmDialog(null);
        showToast('All tracking data cleared', 'info');
      }
    });
  };


  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 font-sans antialiased selection:bg-rose-100 flex flex-col">
      {/* Privacy Header Banner */}
      <div className="bg-slate-900 text-slate-200 px-4 py-2 text-xs font-medium text-center flex items-center justify-center gap-2 shadow-inner">
        <ShieldCheck className="w-4 h-4 text-emerald-400" />
        <span>🔒 Private & Local: Your personal cycle data never leaves this browser device.</span>
      </div>

      {/* Main Top Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-20 shadow-sm">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-rose-500 to-pink-500 flex items-center justify-center text-white shadow-md shadow-rose-200">
              <Heart className="w-5 h-5 fill-white/20" />
            </div>
            <div>
              <h1 className="font-bold text-slate-900 text-lg leading-tight tracking-tight">CycleTrack</h1>
              <p className="text-[11px] text-slate-500 font-medium hidden sm:block">Private Couple's Cycle Calendar</p>
            </div>
          </div>

          {/* Desktop Navigation */}
          <nav className="hidden md:flex items-center gap-1 bg-slate-100/80 p-1 rounded-xl border border-slate-200/60">
            <NavButton active={activeTab === 'dashboard'} onClick={() => setActiveTab('dashboard')} icon={<LayoutDashboard className="w-4 h-4" />}>
              Dashboard
            </NavButton>
            <NavButton active={activeTab === 'calendar'} onClick={() => setActiveTab('calendar')} icon={<CalendarIcon className="w-4 h-4" />}>
              Calendar
            </NavButton>
            <NavButton active={activeTab === 'history'} onClick={() => setActiveTab('history')} icon={<History className="w-4 h-4" />}>
              History
            </NavButton>
            <NavButton active={activeTab === 'settings'} onClick={() => setActiveTab('settings')} icon={<Settings className="w-4 h-4" />}>
              Settings
            </NavButton>
          </nav>

          {/* Quick Header Record Actions */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsAddPeriodOpen(true)}
              className="bg-rose-600 hover:bg-rose-700 active:scale-[0.98] text-white px-3.5 py-2 rounded-xl text-xs font-semibold flex items-center gap-1.5 shadow-sm shadow-rose-200 transition-all"
            >
              <Plus className="w-4 h-4" />
              <span>Record Period</span>
            </button>
            <button
              onClick={() => setIsAddIPillOpen(true)}
              className="bg-sky-50 hover:bg-sky-100 text-sky-700 border border-sky-200 active:scale-[0.98] px-3 py-2 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all"
              title="Mark Emergency Contraception"
            >
              <Pill className="w-4 h-4 text-sky-600" />
              <span className="hidden sm:inline">i-Pill</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="flex-1 max-w-6xl w-full mx-auto px-4 sm:px-6 py-6 pb-24 md:pb-10">
        {activeTab === 'dashboard' && (
          <DashboardView
            engine={engine}
            setActiveTab={setActiveTab}
            setIsAddPeriodOpen={setIsAddPeriodOpen}
            setIsAddIPillOpen={setIsAddIPillOpen}
            handleLoadSampleData={handleLoadSampleData}
          />
        )}

        {activeTab === 'calendar' && (
          <CalendarView
            engine={engine}
            periods={periods}
            ipills={ipills}
            currentMonthDate={currentMonthDate}
            setCurrentMonthDate={setCurrentMonthDate}
            onSelectDay={(dayKey) => setSelectedDayModal(dayKey)}
          />
        )}

        {activeTab === 'history' && (
          <HistoryView
            engine={engine}
            periods={periods}
            ipills={ipills}
            onDeletePeriod={handleDeletePeriod}
            onDeleteIPill={handleDeleteIPill}
            setIsAddPeriodOpen={setIsAddPeriodOpen}
          />
        )}

        {activeTab === 'settings' && (
          <SettingsView
            settings={settings}
            setSettings={setSettings}
            periods={periods}
            ipills={ipills}
            setPeriods={setPeriods}
            setIpills={setIpills}
            onLoadSampleData={handleLoadSampleData}
            onClearAllData={handleClearAllData}
            showToast={showToast}
          />
        )}
      </main>

      {/* Mobile Bottom Navigation Bar */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 bg-white/95 backdrop-blur-md border-t border-slate-200 px-3 py-2 z-30 flex items-center justify-around shadow-lg">
        <MobileNavButton active={activeTab === 'dashboard'} onClick={() => setActiveTab('dashboard')} icon={<LayoutDashboard className="w-5 h-5" />} label="Overview" />
        <MobileNavButton active={activeTab === 'calendar'} onClick={() => setActiveTab('calendar')} icon={<CalendarIcon className="w-5 h-5" />} label="Calendar" />
        <MobileNavButton active={activeTab === 'history'} onClick={() => setActiveTab('history')} icon={<History className="w-5 h-5" />} label="History" />
        <MobileNavButton active={activeTab === 'settings'} onClick={() => setActiveTab('settings')} icon={<Settings className="w-5 h-5" />} label="Settings" />
      </div>

      {/* Modals & Dialogs */}
      {isAddPeriodOpen && (
        <AddPeriodModal
          onClose={() => setIsAddPeriodOpen(false)}
          onSubmit={handleAddPeriod}
        />
      )}

      {isAddIPillOpen && (
        <AddIPillModal
          onClose={() => setIsAddIPillOpen(false)}
          onSubmit={handleAddIPill}
        />
      )}

      {selectedDayModal && (
        <DayDetailsModal
          dateKey={selectedDayModal}
          engine={engine}
          periods={periods}
          ipills={ipills}
          onClose={() => setSelectedDayModal(null)}
          onAddPeriodForDate={(date) => {
            setSelectedDayModal(null);
            setIsAddPeriodOpen(true);
          }}
          onAddIPillForDate={(date) => {
            setSelectedDayModal(null);
            setIsAddIPillOpen(true);
          }}
          onDeletePeriod={handleDeletePeriod}
          onDeleteIPill={handleDeleteIPill}
        />
      )}

      {/* Toast Banner */}
      {toastMessage && (
        <div className={`fixed bottom-20 md:bottom-6 right-6 z-50 px-4 py-3 rounded-xl shadow-lg border text-sm font-medium flex items-center gap-2 transition-all animate-bounce ${
          toastMessage.type === 'error' ? 'bg-rose-900 text-white border-rose-800' : 'bg-slate-900 text-slate-100 border-slate-800'
        }`}>
          <Sparkles className="w-4 h-4 text-rose-400" />
          <span>{toastMessage.text}</span>
        </div>
      )}

      {/* Confirmation Modal */}
      {confirmDialog && (
        <Modal title={confirmDialog.title} onClose={() => setConfirmDialog(null)}>
          <p className="text-sm text-slate-600 mb-6">{confirmDialog.message}</p>
          <div className="flex justify-end gap-3">
            <button
              onClick={() => setConfirmDialog(null)}
              className="px-4 py-2 rounded-xl text-sm font-medium text-slate-600 hover:bg-slate-100 transition-all"
            >
              Cancel
            </button>
            <button
              onClick={confirmDialog.onConfirm}
              className="px-4 py-2 rounded-xl text-sm font-medium bg-rose-600 text-white hover:bg-rose-700 transition-all"
            >
              Confirm
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}


function NavButton({ active, onClick, icon, children }) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
        active
          ? 'bg-white text-slate-900 shadow-sm border border-slate-200/80'
          : 'text-slate-500 hover:text-slate-900 hover:bg-slate-200/50'
      }`}
    >
      {icon}
      <span>{children}</span>
    </button>
  );
}

function MobileNavButton({ active, onClick, icon, label }) {
  return (
    <button
      onClick={onClick}
      className={`flex flex-col items-center justify-center py-1 px-3 rounded-xl text-[11px] font-medium transition-all ${
        active ? 'text-rose-600 font-bold' : 'text-slate-500 hover:text-slate-800'
      }`}
    >
      {icon}
      <span className="mt-1">{label}</span>
    </button>
  );
}


function DashboardView({ engine, setActiveTab, setIsAddPeriodOpen, setIsAddIPillOpen, handleLoadSampleData }) {
  const todayKey = getTodayKey();

  if (!engine.hasData) {
    return (
      <div className="max-w-md mx-auto my-12 text-center bg-white p-8 rounded-3xl border border-slate-200/80 shadow-sm">
        <div className="w-16 h-16 bg-rose-50 text-rose-500 rounded-2xl flex items-center justify-center mx-auto mb-4">
          <Heart className="w-8 h-8" />
        </div>
        <h2 className="text-xl font-bold text-slate-900 mb-2">Start Your Cycle Calendar</h2>
        <p className="text-slate-500 text-sm mb-6 leading-relaxed">
          Record your first period to instantly calculate cycle lengths, predict upcoming dates, and estimate fertile windows.
        </p>
        <div className="space-y-3">
          <button
            onClick={() => setIsAddPeriodOpen(true)}
            className="w-full bg-rose-600 hover:bg-rose-700 text-white py-3 rounded-xl font-semibold text-sm shadow-md shadow-rose-200 transition-all flex items-center justify-center gap-2"
          >
            <Plus className="w-4 h-4" />
            <span>Record First Period</span>
          </button>
          <button
            onClick={handleLoadSampleData}
            className="w-full bg-slate-100 hover:bg-slate-200 text-slate-700 py-2.5 rounded-xl font-medium text-xs transition-all flex items-center justify-center gap-2"
          >
            <Sparkles className="w-4 h-4 text-amber-500" />
            <span>Load Demo Sample Data</span>
          </button>
        </div>
      </div>
    );
  }

  // Calculate day status for Today
  const { lastPeriod, avgCycleLength, currentCycleDay, nextPredictedRange, isCurrentCycleAffectedByIPill, confidenceLevel } = engine;
  
  // Estimate Progress percentage
  const progressPercent = Math.min(100, Math.round((currentCycleDay / avgCycleLength) * 100));

  return (
    <div className="space-y-6">
      {/* Overview Cards (4 Key Metrics) */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5 sm:gap-4">
        {/* Card 1: Last Period */}
        <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200/80 shadow-sm flex flex-col justify-between hover:border-slate-300 transition-all">
          <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Last Period</span>
          <div>
            <div className="text-base sm:text-lg font-bold text-slate-900">
              {formatDisplayDate(lastPeriod.startDate, false)}
            </div>
            <div className="text-xs text-slate-500 font-medium mt-0.5">
              {lastPeriod.endDate ? `to ${formatDisplayDate(lastPeriod.endDate, false)}` : 'Duration: 5 days'}
            </div>
          </div>
        </div>

        {/* Card 2: Current Cycle Day */}
        <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200/80 shadow-sm flex flex-col justify-between hover:border-slate-300 transition-all">
          <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Current Cycle</span>
          <div>
            <div className="text-xl sm:text-2xl font-black text-rose-600">
              Day {currentCycleDay}
            </div>
            <div className="text-xs text-slate-500 font-medium mt-0.5">
              of approx {avgCycleLength} days
            </div>
          </div>
        </div>

        {/* Card 3: Next Expected Period */}
        <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200/80 shadow-sm flex flex-col justify-between hover:border-slate-300 transition-all">
          <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Next Expected Period</span>
          <div>
            <div className="text-base sm:text-lg font-bold text-slate-900">
              {nextPredictedRange}
            </div>
            <div className="flex items-center gap-1 text-[11px] font-medium text-slate-500 mt-0.5">
              <span>Confidence:</span>
              <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                confidenceLevel === 'High' ? 'bg-emerald-100 text-emerald-800' :
                confidenceLevel === 'Adjusted' ? 'bg-amber-100 text-amber-800' : 'bg-slate-100 text-slate-700'
              }`}>
                {confidenceLevel}
              </span>
            </div>
          </div>
        </div>

        {/* Card 4: Average Cycle */}
        <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200/80 shadow-sm flex flex-col justify-between hover:border-slate-300 transition-all">
          <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Average Cycle</span>
          <div>
            <div className="text-xl sm:text-2xl font-bold text-slate-900">
              {avgCycleLength} Days
            </div>
            <div className="text-xs text-slate-500 font-medium mt-0.5">
              {engine.cycleHistory.length > 1 ? `Calculated from past cycles` : 'Standard cycle estimate'}
            </div>
          </div>
        </div>
      </div>

      {/* Main Cycle Status & Progress Card */}
      <div className="bg-white rounded-2xl border border-slate-200/80 p-5 sm:p-6 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4">
          <div>
            <h2 className="text-lg font-bold text-slate-900">Current Cycle Progress</h2>
            <p className="text-xs text-slate-500">Day {currentCycleDay} of approximately {avgCycleLength} days</p>
          </div>
          <span className="inline-flex items-center text-xs font-semibold px-3 py-1 bg-slate-100 text-slate-700 rounded-full w-fit">
            Next Period: {nextPredictedRange}
          </span>
        </div>

        {/* Visual Cycle Progress Bar */}
        <div className="w-full bg-slate-100 rounded-full h-3.5 mb-3 overflow-hidden p-0.5 border border-slate-200/50">
          <div
            className="bg-gradient-to-r from-rose-400 to-rose-600 h-full rounded-full transition-all duration-500"
            style={{ width: `${progressPercent}%` }}
          />
        </div>

        {/* Emergency Contraception Warning Banner */}
        {isCurrentCycleAffectedByIPill && (
          <div className="mt-4 p-3.5 bg-amber-50/90 border border-amber-200 rounded-xl flex items-start gap-3 text-amber-900 text-xs sm:text-sm">
            <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
            <div>
              <span className="font-semibold block mb-0.5">Cycle Potentially Affected by Emergency Contraception</span>
              <p className="text-amber-800/90 text-xs leading-relaxed">
                Emergency contraception (i-Pill) was recorded during this cycle. Period timing may occur earlier or later than calculated. Predictions will automatically realign once your next period begins.
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Quick Action Buttons Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <button
          onClick={() => setIsAddPeriodOpen(true)}
          className="p-4 bg-rose-50 hover:bg-rose-100/80 border border-rose-200/80 rounded-2xl text-left transition-all active:scale-[0.98] group"
        >
          <div className="w-8 h-8 rounded-xl bg-rose-600 text-white flex items-center justify-center mb-2 shadow-sm group-hover:scale-105 transition-transform">
            <Plus className="w-5 h-5" />
          </div>
          <div className="font-bold text-slate-900 text-sm">Record Period</div>
          <div className="text-[11px] text-slate-500 mt-0.5">Log start or end date</div>
        </button>

        <button
          onClick={() => setIsAddIPillOpen(true)}
          className="p-4 bg-sky-50 hover:bg-sky-100/80 border border-sky-200/80 rounded-2xl text-left transition-all active:scale-[0.98] group"
        >
          <div className="w-8 h-8 rounded-xl bg-sky-600 text-white flex items-center justify-center mb-2 shadow-sm group-hover:scale-105 transition-transform">
            <Pill className="w-5 h-5" />
          </div>
          <div className="font-bold text-slate-900 text-sm">Mark i-Pill</div>
          <div className="text-[11px] text-slate-500 mt-0.5">Emergency contraception</div>
        </button>

        <button
          onClick={() => setActiveTab('calendar')}
          className="p-4 bg-slate-50 hover:bg-slate-100 border border-slate-200/80 rounded-2xl text-left transition-all active:scale-[0.98] group"
        >
          <div className="w-8 h-8 rounded-xl bg-slate-800 text-white flex items-center justify-center mb-2 shadow-sm group-hover:scale-105 transition-transform">
            <CalendarIcon className="w-5 h-5" />
          </div>
          <div className="font-bold text-slate-900 text-sm">Open Calendar</div>
          <div className="text-[11px] text-slate-500 mt-0.5">Monthly color breakdown</div>
        </button>

        <button
          onClick={() => setActiveTab('history')}
          className="p-4 bg-slate-50 hover:bg-slate-100 border border-slate-200/80 rounded-2xl text-left transition-all active:scale-[0.98] group"
        >
          <div className="w-8 h-8 rounded-xl bg-slate-800 text-white flex items-center justify-center mb-2 shadow-sm group-hover:scale-105 transition-transform">
            <History className="w-5 h-5" />
          </div>
          <div className="font-bold text-slate-900 text-sm">View History</div>
          <div className="text-[11px] text-slate-500 mt-0.5">Past cycles & logs</div>
        </button>
      </div>

      {/* Safety & Medical Disclaimer */}
      <div className="p-4 rounded-xl bg-slate-100/80 border border-slate-200 text-slate-500 text-xs flex items-start gap-2.5">
        <Info className="w-4 h-4 text-slate-400 flex-shrink-0 mt-0.5" />
        <p className="leading-relaxed">
          <strong className="text-slate-700">Contraceptive Notice:</strong> Calendar-based cycle estimates cannot guarantee prevention of pregnancy and should not be relied upon as standard contraception. Predictions are based on standard mathematical cycle models.
        </p>
      </div>
    </div>
  );
}


function CalendarView({ engine, periods, ipills, currentMonthDate, setCurrentMonthDate, onSelectDay }) {
  const year = currentMonthDate.getFullYear();
  const month = currentMonthDate.getMonth();

  const handlePrevMonth = () => {
    setCurrentMonthDate(new Date(year, month - 1, 1));
  };

  const handleNextMonth = () => {
    setCurrentMonthDate(new Date(year, month + 1, 1));
  };

  const handleToday = () => {
    const now = new Date();
    setCurrentMonthDate(new Date(now.getFullYear(), now.getMonth(), 1));
  };

  const monthLabel = currentMonthDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

  // Compute Calendar Grid Days
  const firstDayOfMonth = new Date(year, month, 1);
  const lastDayOfMonth = new Date(year, month + 1, 0);
  
  // Calculate offset to make Monday start (0=Mon, 6=Sun)
  let startDayOfWeek = firstDayOfMonth.getDay() - 1;
  if (startDayOfWeek === -1) startDayOfWeek = 6;

  const totalDays = lastDayOfMonth.getDate();

  const calendarCells = [];
  
  // Previous month padding
  const prevMonthLastDay = new Date(year, month, 0).getDate();
  for (let i = startDayOfWeek - 1; i >= 0; i--) {
    const prevDayNum = prevMonthLastDay - i;
    const dateKey = formatDateKey(year, month - 1, prevDayNum);
    calendarCells.push({ dateKey, dayNum: prevDayNum, isCurrentMonth: false });
  }

  // Current month days
  for (let day = 1; day <= totalDays; day++) {
    const dateKey = formatDateKey(year, month, day);
    calendarCells.push({ dateKey, dayNum: day, isCurrentMonth: true });
  }

  // Next month padding to complete grid
  const remainingCells = 42 - calendarCells.length;
  for (let day = 1; day <= remainingCells; day++) {
    const dateKey = formatDateKey(year, month + 1, day);
    calendarCells.push({ dateKey, dayNum: day, isCurrentMonth: false });
  }

  const todayKey = getTodayKey();

  return (
    <div className="space-y-4">
      {/* Calendar Month Header Bar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-sm flex items-center justify-between">
        <div className="flex items-center gap-2">
          <button
            onClick={handlePrevMonth}
            className="p-2 hover:bg-slate-100 rounded-xl transition-all text-slate-600"
            aria-label="Previous Month"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <h2 className="text-lg font-bold text-slate-900 w-40 text-center">{monthLabel}</h2>
          <button
            onClick={handleNextMonth}
            className="p-2 hover:bg-slate-100 rounded-xl transition-all text-slate-600"
            aria-label="Next Month"
          >
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>

        <button
          onClick={handleToday}
          className="px-3.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-xl transition-all"
        >
          Today
        </button>
      </div>

      {/* Main Calendar Grid */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-3 sm:p-5 overflow-hidden">
        {/* Weekday Headers MON - SUN */}
        <div className="grid grid-cols-7 mb-2 text-center">
          {['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'].map((dayName) => (
            <div key={dayName} className="text-[11px] font-bold text-slate-400 py-1">
              {dayName}
            </div>
          ))}
        </div>

        {/* Days Matrix */}
        <div className="grid grid-cols-7 gap-1 sm:gap-2">
          {calendarCells.map((cell) => {
            const dayStatus = getDayCycleStatus(cell.dateKey, engine, periods, ipills);
            const isToday = cell.dateKey === todayKey;

            return (
              <button
                key={cell.dateKey}
                onClick={() => onSelectDay(cell.dateKey)}
                className={`relative min-h-[64px] sm:min-h-[80px] p-1.5 sm:p-2 rounded-xl text-left border transition-all flex flex-col justify-between ${
                  !cell.isCurrentMonth ? 'opacity-40 bg-slate-50/50' : ''
                } ${dayStatus.bgClass} ${
                  isToday ? 'ring-2 ring-slate-900 ring-offset-1 font-bold' : 'border-slate-200/50'
                }`}
              >
                {/* Date Number Header */}
                <div className="flex items-center justify-between w-full">
                  <span className={`text-xs sm:text-sm ${isToday ? 'font-black text-slate-900' : 'font-semibold text-slate-700'}`}>
                    {cell.dayNum}
                  </span>
                  
                  {/* Emergency Pill Marker Icon Badge */}
                  {dayStatus.hasIPill && (
                    <span className="inline-flex items-center justify-center bg-sky-600 text-white text-[10px] p-0.5 px-1 rounded-md shadow-sm" title="i-Pill Taken">
                      💊
                    </span>
                  )}
                </div>

                {/* Event Label Indicator */}
                <div className="mt-1">
                  {dayStatus.label && (
                    <span className={`text-[10px] font-medium block truncate leading-tight ${dayStatus.textClass}`}>
                      {dayStatus.label}
                    </span>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Calendar Legend Bar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-sm">
        <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">Calendar Color System</h3>
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 text-xs">
          <div className="flex items-center gap-2">
            <span className="w-3.5 h-3.5 rounded-md bg-rose-200 border border-rose-300 flex-shrink-0" />
            <span className="font-medium text-slate-700">🔴 Actual Period</span>
          </div>

          <div className="flex items-center gap-2">
            <span className="w-3.5 h-3.5 rounded-md bg-rose-50 border border-dashed border-rose-300 flex-shrink-0" />
            <span className="font-medium text-slate-700">🌸 Expected Period</span>
          </div>

          <div className="flex items-center gap-2">
            <span className="w-3.5 h-3.5 rounded-md bg-amber-100 border border-amber-300 flex-shrink-0" />
            <span className="font-medium text-slate-700">🟡 Fertile Window</span>
          </div>

          <div className="flex items-center gap-2">
            <span className="w-3.5 h-3.5 rounded-md bg-emerald-100 border border-emerald-300 flex-shrink-0" />
            <span className="font-medium text-slate-700">🟢 Lower Pregnancy-Risk</span>
          </div>

          <div className="flex items-center gap-2">
            <span className="w-3.5 h-3.5 rounded-md bg-sky-200 border border-sky-300 flex-shrink-0 flex items-center justify-center text-[8px]">💊</span>
            <span className="font-medium text-slate-700">🔵 i-Pill Marker</span>
          </div>
        </div>

        <p className="mt-3 text-[11px] text-slate-500 border-t border-slate-100 pt-2.5">
          * Note: "Lower estimated pregnancy risk" days are based on standardized fertile window calculations and should not be used as guaranteed contraception.
        </p>
      </div>
    </div>
  );
}


function getDayCycleStatus(dateKey, engine, periods, ipills) {
  const hasIPill = ipills.some(i => i.date === dateKey);

  // 1. Actual Period check
  const actualPeriod = periods.find(p => {
    const end = p.endDate || p.startDate;
    return dateKey >= p.startDate && dateKey <= end;
  });

  if (actualPeriod) {
    return {
      bgClass: 'bg-rose-100/90 border-rose-200 hover:bg-rose-200/90',
      textClass: 'text-rose-900 font-semibold',
      label: 'Period',
      hasIPill
    };
  }

  if (!engine.hasData || !engine.nextPredictedStart) {
    return {
      bgClass: 'bg-white hover:bg-slate-50',
      textClass: 'text-slate-500',
      label: null,
      hasIPill
    };
  }

  // 2. Expected Period check
  const nextStart = engine.nextPredictedStart;
  const nextEnd = addDaysToKey(nextStart, engine.avgDuration - 1);
  if (dateKey >= nextStart && dateKey <= nextEnd) {
    return {
      bgClass: 'bg-rose-50/80 border-2 border-dashed border-rose-300 hover:bg-rose-100/60',
      textClass: 'text-rose-800 font-medium',
      label: 'Expected',
      hasIPill
    };
  }

  // 3. Fertile Window check (~12-16 days before predicted next period)
  const ovulationDate = addDaysToKey(nextStart, -14);
  const fertileStart = addDaysToKey(ovulationDate, -4);
  const fertileEnd = addDaysToKey(ovulationDate, 1);

  if (dateKey >= fertileStart && dateKey <= fertileEnd) {
    return {
      bgClass: 'bg-amber-50/90 border-amber-200 hover:bg-amber-100/80',
      textClass: 'text-amber-800 font-medium',
      label: dateKey === ovulationDate ? 'Ovulation' : 'Fertile',
      hasIPill
    };
  }

  // 4. Lower Pregnancy Risk check (remaining days)
  return {
    bgClass: 'bg-emerald-50/60 border-emerald-100 hover:bg-emerald-100/60',
    textClass: 'text-emerald-800 font-normal',
    label: 'Lower Risk',
    hasIPill
  };
}


function HistoryView({ engine, periods, ipills, onDeletePeriod, onDeleteIPill, setIsAddPeriodOpen }) {
  return (
    <div className="space-y-6">
      {/* History Header Card */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-slate-900">Period & Cycle History</h2>
          <p className="text-xs text-slate-500">Recorded history used to calculate cycle length averages</p>
        </div>
        <button
          onClick={() => setIsAddPeriodOpen(true)}
          className="bg-rose-600 hover:bg-rose-700 text-white px-4 py-2 rounded-xl text-xs font-semibold flex items-center gap-1.5 shadow-sm shadow-rose-200 transition-all w-fit"
        >
          <Plus className="w-4 h-4" />
          <span>Add Historical Period</span>
        </button>
      </div>

      {/* Period History Table / Cards */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-slate-100">
          <h3 className="font-bold text-slate-800 text-sm">Past Period Cycles</h3>
        </div>

        {engine.cycleHistory.length === 0 ? (
          <div className="p-8 text-center text-slate-400 text-sm">No periods recorded yet.</div>
        ) : (
          <div className="divide-y divide-slate-100">
            {/* Desktop Table View */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-500 uppercase tracking-wider font-semibold">
                  <tr>
                    <th className="p-3.5 px-4">Period Dates</th>
                    <th className="p-3.5">Duration</th>
                    <th className="p-3.5">Cycle Length</th>
                    <th className="p-3.5">Notes</th>
                    <th className="p-3.5 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                  {engine.cycleHistory.map((item) => (
                    <tr key={item.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="p-3.5 px-4 font-bold text-slate-900">
                        {formatDisplayDate(item.startDate, true)}
                        {item.endDate && ` – ${formatDisplayDate(item.endDate, true)}`}
                      </td>
                      <td className="p-3.5">{item.duration} Days</td>
                      <td className="p-3.5">
                        {item.cycleLength ? (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-slate-100 text-slate-800 font-bold">
                            {item.cycleLength} Days
                          </span>
                        ) : (
                          <span className="text-rose-600 font-semibold text-[11px] bg-rose-50 px-2 py-0.5 rounded">Current Cycle</span>
                        )}
                      </td>
                      <td className="p-3.5 text-slate-500 max-w-xs truncate">{item.notes || '—'}</td>
                      <td className="p-3.5 text-right">
                        <button
                          onClick={() => onDeletePeriod(item.id)}
                          className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-all"
                          title="Delete Period Record"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile Card List View */}
            <div className="md:hidden divide-y divide-slate-100">
              {engine.cycleHistory.map((item) => (
                <div key={item.id} className="p-4 flex flex-col gap-2">
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="font-bold text-slate-900 text-sm">
                        {formatDisplayDate(item.startDate, true)}
                      </div>
                      <div className="text-xs text-slate-500 mt-0.5">
                        Duration: {item.duration} Days
                      </div>
                    </div>
                    <button
                      onClick={() => onDeletePeriod(item.id)}
                      className="p-2 text-slate-400 hover:text-rose-600 rounded-lg"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>

                  <div className="flex items-center justify-between text-xs pt-1 border-t border-slate-50">
                    <span className="text-slate-500">Cycle Length to next:</span>
                    <span className="font-bold text-slate-800">
                      {item.cycleLength ? `${item.cycleLength} Days` : 'Ongoing'}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Emergency Contraception Log */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-4 sm:p-5">
        <h3 className="font-bold text-slate-800 text-sm mb-3 flex items-center gap-2">
          <Pill className="w-4 h-4 text-sky-600" />
          <span>Emergency Contraception (i-Pill) Logs</span>
        </h3>

        {ipills.length === 0 ? (
          <p className="text-xs text-slate-400 italic">No emergency contraception dates recorded.</p>
        ) : (
          <div className="space-y-2">
            {ipills.map((item) => (
              <div key={item.id} className="flex items-center justify-between p-3 rounded-xl bg-sky-50/60 border border-sky-100 text-xs">
                <div className="flex items-center gap-3">
                  <span className="text-base">💊</span>
                  <div>
                    <span className="font-bold text-slate-900 block">{formatDisplayDate(item.date, true)}</span>
                    <span className="text-slate-500">{item.notes}</span>
                  </div>
                </div>
                <button
                  onClick={() => onDeleteIPill(item.id)}
                  className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}


function SettingsView({ settings, setSettings, periods, ipills, setPeriods, setIpills, onLoadSampleData, onClearAllData, showToast }) {
  const [overrideInput, setOverrideInput] = useState(settings.averageCycleOverride || '');

  const handleSaveSettings = (e) => {
    e.preventDefault();
    const parsed = overrideInput ? parseInt(overrideInput, 10) : null;
    setSettings(prev => ({ ...prev, averageCycleOverride: parsed }));
    showToast('Settings saved successfully');
  };

  const handleExportJSON = () => {
    const dataObj = { periods, ipills, settings, exportedAt: new Date().toISOString() };
    const blob = new Blob([JSON.stringify(dataObj, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `cycletrack-backup-${getTodayKey()}.json`;
    a.click();
    showToast('Backup JSON downloaded');
  };

  const handleImportJSON = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const parsed = JSON.parse(event.target.result);
        if (parsed.periods && Array.isArray(parsed.periods)) {
          setPeriods(parsed.periods);
          if (parsed.ipills) setIpills(parsed.ipills);
          if (parsed.settings) setSettings(parsed.settings);
          showToast('Data imported successfully');
        } else {
          showToast('Invalid backup file format', 'error');
        }
      } catch (err) {
        showToast('Error reading JSON file', 'error');
      }
    };
    reader.readAsText(file);
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Cycle Engine Configuration */}
      <form onSubmit={handleSaveSettings} className="bg-white p-5 sm:p-6 rounded-2xl border border-slate-200/80 shadow-sm space-y-4">
        <h3 className="text-base font-bold text-slate-900">Cycle Settings</h3>
        
        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1">
            Manual Cycle Length Override (Days)
          </label>
          <input
            type="number"
            min="20"
            max="45"
            placeholder="Auto-calculated if blank (e.g. 29)"
            value={overrideInput}
            onChange={(e) => setOverrideInput(e.target.value)}
            className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-rose-500"
          />
          <p className="text-[11px] text-slate-400 mt-1">
            Leave empty to automatically calculate average cycle length from recorded period history.
          </p>
        </div>

        <button
          type="submit"
          className="bg-slate-900 hover:bg-slate-800 text-white px-4 py-2 rounded-xl text-xs font-semibold transition-all"
        >
          Save Configuration
        </button>
      </form>

      {/* Data Backup & Export */}
      <div className="bg-white p-5 sm:p-6 rounded-2xl border border-slate-200/80 shadow-sm space-y-4">
        <h3 className="text-base font-bold text-slate-900">Data & Backup</h3>
        <p className="text-xs text-slate-500 leading-relaxed">
          Export your cycle logs to keep a offline personal backup file or import records when changing browsers or devices.
        </p>

        <div className="flex flex-wrap items-center gap-3 pt-2">
          <button
            onClick={handleExportJSON}
            className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-xl text-xs font-semibold flex items-center gap-2 transition-all"
          >
            <Download className="w-4 h-4 text-slate-600" />
            <span>Export Backup (JSON)</span>
          </button>

          <label className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-xl text-xs font-semibold flex items-center gap-2 cursor-pointer transition-all">
            <Upload className="w-4 h-4 text-slate-600" />
            <span>Import Backup (JSON)</span>
            <input type="file" accept=".json" onChange={handleImportJSON} className="hidden" />
          </label>
        </div>
      </div>

      {/* Testing & Reset Options */}
      <div className="bg-white p-5 sm:p-6 rounded-2xl border border-slate-200/80 shadow-sm space-y-4">
        <h3 className="text-base font-bold text-slate-900">Demo Testing & Reset</h3>

        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
          <button
            onClick={onLoadSampleData}
            className="px-4 py-2.5 bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-200 rounded-xl text-xs font-semibold flex items-center justify-center gap-2 transition-all"
          >
            <RotateCcw className="w-4 h-4 text-amber-600" />
            <span>Load Sample Test Workflow Data</span>
          </button>

          <button
            onClick={onClearAllData}
            className="px-4 py-2.5 bg-rose-50 hover:bg-rose-100 text-rose-800 border border-rose-200 rounded-xl text-xs font-semibold flex items-center justify-center gap-2 transition-all"
          >
            <Trash2 className="w-4 h-4 text-rose-600" />
            <span>Clear All Data</span>
          </button>
        </div>
      </div>
    </div>
  );
}


function DayDetailsModal({ dateKey, engine, periods, ipills, onClose, onAddPeriodForDate, onAddIPillForDate, onDeletePeriod, onDeleteIPill }) {
  const displayDate = formatDisplayDate(dateKey, true);
  const status = getDayCycleStatus(dateKey, engine, periods, ipills);

  // Check matching events on this date
  const periodOnDate = periods.find(p => {
    const end = p.endDate || p.startDate;
    return dateKey >= p.startDate && dateKey <= end;
  });

  const ipillOnDate = ipills.find(i => i.date === dateKey);

  return (
    <Modal title={displayDate} onClose={onClose}>
      <div className="space-y-4">
        {/* Cycle Day badge if data exists */}
        {engine.hasData && engine.lastPeriod && dateKey >= engine.lastPeriod.startDate && (
          <div className="text-xs font-bold text-slate-500">
            Cycle Day: <span className="text-slate-900 font-extrabold">{getDaysBetween(engine.lastPeriod.startDate, dateKey) + 1}</span>
          </div>
        )}

        {/* Status Card */}
        <div className={`p-4 rounded-xl border text-xs space-y-1 ${status.bgClass}`}>
          <div className={`font-bold text-sm ${status.textClass}`}>
            {status.label ? status.label : 'No primary event recorded'}
          </div>
          <p className="text-slate-600">
            {status.label === 'Period' && 'Actual recorded period date.'}
            {status.label === 'Expected' && 'Predicted period based on historical cycle model.'}
            {status.label === 'Fertile' && 'Estimated fertile window.'}
            {status.label === 'Ovulation' && 'Estimated ovulation date.'}
            {status.label === 'Lower Risk' && 'Estimated lower pregnancy risk window.'}
          </p>
        </div>

        {/* Recorded Entries for this date */}
        {periodOnDate && (
          <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl flex items-center justify-between text-xs">
            <div>
              <span className="font-bold text-rose-900 block">🩸 Period Event</span>
              <span className="text-rose-700">{periodOnDate.notes || 'Period recorded'}</span>
            </div>
            <button
              onClick={() => onDeletePeriod(periodOnDate.id)}
              className="p-1.5 text-rose-600 hover:bg-rose-100 rounded-lg"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        )}

        {ipillOnDate && (
          <div className="p-3 bg-sky-50 border border-sky-200 rounded-xl flex items-center justify-between text-xs">
            <div>
              <span className="font-bold text-sky-900 block">💊 Emergency Contraception Recorded</span>
              <span className="text-sky-700">{ipillOnDate.notes}</span>
            </div>
            <button
              onClick={() => onDeleteIPill(ipillOnDate.id)}
              className="p-1.5 text-sky-600 hover:bg-sky-100 rounded-lg"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Quick Add Actions */}
        <div className="pt-2 flex flex-col gap-2">
          {!periodOnDate && (
            <button
              onClick={() => onAddPeriodForDate(dateKey)}
              className="w-full py-2.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-semibold flex items-center justify-center gap-2"
            >
              <Plus className="w-4 h-4" />
              <span>Record Period Starting Here</span>
            </button>
          )}

          {!ipillOnDate && (
            <button
              onClick={() => onAddIPillForDate(dateKey)}
              className="w-full py-2 bg-sky-50 hover:bg-sky-100 text-sky-700 border border-sky-200 rounded-xl text-xs font-semibold flex items-center justify-center gap-2"
            >
              <Pill className="w-4 h-4 text-sky-600" />
              <span>Mark i-Pill On This Date</span>
            </button>
          )}
        </div>
      </div>
    </Modal>
  );
}


function AddPeriodModal({ onClose, onSubmit }) {
  const [startDate, setStartDate] = useState(getTodayKey());
  const [endDate, setEndDate] = useState('');
  const [notes, setNotes] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    onSubmit(startDate, endDate || null, notes);
  };

  return (
    <Modal title="Record Period" onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1">
            Period Start Date <span className="text-rose-600">*</span>
          </label>
          <input
            type="date"
            required
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-rose-500"
          />
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1">
            Period End Date (Optional)
          </label>
          <input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-rose-500"
          />
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1">Notes</label>
          <input
            type="text"
            placeholder="e.g. Light flow, mild cramping"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-rose-500"
          />
        </div>

        <div className="pt-2 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100"
          >
            Cancel
          </button>
          <button
            type="submit"
            className="px-5 py-2 rounded-xl text-xs font-semibold bg-rose-600 text-white hover:bg-rose-700 shadow-sm"
          >
            Save Period Record
          </button>
        </div>
      </form>
    </Modal>
  );
}

function AddIPillModal({ onClose, onSubmit }) {
  const [date, setDate] = useState(getTodayKey());
  const [notes, setNotes] = useState('Emergency contraception taken');

  const handleSubmit = (e) => {
    e.preventDefault();
    onSubmit(date, notes);
  };

  return (
    <Modal title="Mark Emergency Contraception" onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1">
            Date Taken <span className="text-rose-600">*</span>
          </label>
          <input
            type="date"
            required
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500"
          />
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1">Notes</label>
          <input
            type="text"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500"
          />
        </div>

        <div className="p-3 bg-sky-50 rounded-xl text-sky-800 text-xs leading-relaxed">
          💊 Recording emergency contraception will flag predictions for the current cycle as potentially shifted.
        </div>

        <div className="pt-2 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100"
          >
            Cancel
          </button>
          <button
            type="submit"
            className="px-5 py-2 rounded-xl text-xs font-semibold bg-sky-600 text-white hover:bg-sky-700 shadow-sm"
          >
            Mark i-Pill
          </button>
        </div>
      </form>
    </Modal>
  );
}


function Modal({ title, onClose, children }) {
  return (
    <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4 animate-fadeIn">
      <div className="bg-white w-full max-w-md rounded-3xl border border-slate-200 shadow-2xl overflow-hidden p-5 sm:p-6 space-y-4 transform transition-all scale-100">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <h3 className="font-bold text-slate-900 text-base">{title}</h3>
          <button
            onClick={onClose}
            className="p-1 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-all"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        <div>{children}</div>
      </div>
    </div>
  );
}