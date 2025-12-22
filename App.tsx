
import React, { useState, useMemo, useEffect, useRef } from 'react';
import { 
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, 
  Area, ComposedChart, Bar, Line, Legend, ReferenceLine 
} from 'recharts';
import { 
  TrendingUp, Settings2, Download, BrainCircuit, 
  AlertCircle, ChevronRight, Calendar, Upload, FileText, Activity, Layers,
  Globe, Info, Package, Truck, Database, ShieldCheck, 
  Zap, DollarSign, ListFilter, Trash2, Plus, HelpCircle, Search, Check, X, ChevronDown
} from 'lucide-react';
import { SKUS, SAMPLE_DATA, SAMPLE_ATTRIBUTES, SAMPLE_INVENTORY, DEFAULT_HORIZON } from './constants';
import { DataPoint, FilterState, TimeInterval, ForecastPoint, ForecastMethodology, ProductAttribute, InventoryLevel, Scenario } from './types';
import { calculateForecast, calculateMetrics, cleanAnomalies } from './utils/forecasting';
import { calculateSupplyChainMetrics, runParetoAnalysis } from './utils/supplyChain';
import { exportToCSV } from './utils/export';
import { getIndustryInsights, getNarrativeSummary, getMarketTrendAdjustment, MarketAdjustment } from './services/geminiService';
import MetricsCard from './components/MetricsCard';
import InfoTooltip from './components/InfoTooltip';

/**
 * Model Explanation Modal Component
 */
const ModelExplanationModal: React.FC<{ isOpen: boolean; onClose: () => void }> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  const models = [
    {
      name: ForecastMethodology.HOLT_WINTERS,
      icon: <Activity className="text-indigo-400" size={20} />,
      description: "Standard for demand planning. It decomposes data into Level, Trend, and Seasonality components. Best for products with strong recurring seasonal patterns (e.g., peak holiday sales).",
      pro: "Excellent seasonal accuracy",
      con: "Less flexible with irregular shocks"
    },
    {
      name: ForecastMethodology.PROPHET,
      icon: <BrainCircuit className="text-purple-400" size={20} />,
      description: "A robust additive model designed for business time series. It handles missing data, large outliers, and shifts in trend effectively. Incorporates holiday effects and custom growth curves.",
      pro: "Robust to outliers and trend shifts",
      con: "Computationally heavier than HW"
    },
    {
      name: ForecastMethodology.ARIMA,
      icon: <TrendingUp className="text-emerald-400" size={20} />,
      description: "Auto-Regressive Integrated Moving Average. A sophisticated statistical approach that relies on the correlation between a point and its previous lags. Ideal for complex, high-frequency data.",
      pro: "Captures deep statistical patterns",
      con: "Requires stationary data (preprocessing)"
    },
    {
      name: ForecastMethodology.LINEAR,
      icon: <LineChartIcon className="text-blue-400" size={20} />,
      description: "Ordinary Least Squares regression. Projects a straight-line trend based on historical volume. Best used for long-term strategic growth planning rather than short-term inventory management.",
      pro: "Very easy to explain to stakeholders",
      con: "Ignores seasonality entirely"
    },
    {
      name: ForecastMethodology.NAIVE,
      icon: <Layers className="text-slate-400" size={20} />,
      description: "The baseline 'Persistence' model. It assumes that future demand will equal the demand from the same period in the previous cycle. Serves as the fundamental benchmark for model uplift.",
      pro: "Simple, transparent baseline",
      con: "Cannot react to changing trends"
    }
  ];

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-300">
      <div className="bg-slate-900 border border-slate-700 w-full max-w-2xl rounded-[2.5rem] shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        <div className="p-8 border-b border-slate-800 flex justify-between items-center bg-slate-900/50">
          <div>
            <h2 className="text-2xl font-black text-white tracking-tight uppercase">Methodology Library</h2>
            <p className="text-xs text-slate-500 font-bold uppercase tracking-widest mt-1">SSA & Company Decision Science</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-800 rounded-full text-slate-400 hover:text-white transition-all">
            <X size={24} />
          </button>
        </div>
        <div className="p-8 overflow-y-auto no-scrollbar space-y-6">
          {models.map((m) => (
            <div key={m.name} className="flex gap-6 p-6 rounded-3xl bg-slate-950 border border-slate-800 hover:border-indigo-500/50 transition-all group">
              <div className="shrink-0 p-4 bg-slate-900 rounded-2xl border border-slate-800 group-hover:bg-indigo-500/10 transition-colors">
                {m.icon}
              </div>
              <div className="space-y-3">
                <h3 className="text-lg font-black text-white uppercase tracking-tight">{m.name}</h3>
                <p className="text-sm text-slate-400 leading-relaxed font-medium">{m.description}</p>
                <div className="flex gap-4 pt-2">
                  <div className="text-[10px] font-black uppercase tracking-widest text-emerald-500 bg-emerald-500/10 px-3 py-1 rounded-lg">Pros: {m.pro}</div>
                  <div className="text-[10px] font-black uppercase tracking-widest text-red-400 bg-red-400/10 px-3 py-1 rounded-lg">Cons: {m.con}</div>
                </div>
              </div>
            </div>
          ))}
        </div>
        <div className="p-6 bg-slate-950/50 border-t border-slate-800 text-center">
          <p className="text-[10px] font-bold text-slate-600 uppercase tracking-[0.3em]">Proprietary Modeling Framework // SSA & COMPANY</p>
        </div>
      </div>
    </div>
  );
};

// Helper for LineChart icon not available in standard lucide-react list provided in imports but standard
const LineChartIcon = ({ size, className }: { size: number; className?: string }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <path d="M3 3v18h18" /><path d="m19 9-5 5-4-4-3 3" />
  </svg>
);

/**
 * Custom Searchable Multi-Select Component
 */
const SearchableMultiSelect: React.FC<{
  options: string[];
  selected: string[];
  onChange: (selected: string[]) => void;
  label: string;
}> = ({ options, selected, onChange, label }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const filteredOptions = options.filter(opt => opt.toLowerCase().includes(search.toLowerCase()));
  const isAllSelected = selected.length === options.length;

  const toggleOption = (opt: string) => {
    if (selected.includes(opt)) {
      onChange(selected.filter(i => i !== opt));
    } else {
      onChange([...selected, opt]);
    }
  };

  const toggleAll = () => {
    if (isAllSelected) onChange([]);
    else onChange(options);
  };

  return (
    <div className="relative w-full" ref={containerRef}>
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between p-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs font-bold text-slate-200 hover:border-indigo-500 transition-all"
      >
        <span className="truncate">
          {isAllSelected ? 'All SKUs Selected' : selected.length === 0 ? 'Select SKUs' : `${selected.length} SKUs Selected`}
        </span>
        <ChevronDown size={14} className={`transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <div className="absolute top-full left-0 right-0 mt-2 bg-slate-900 border border-slate-700 rounded-xl shadow-2xl z-[100] p-2 animate-in fade-in slide-in-from-top-2 duration-200">
          <div className="relative mb-2">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-500" size={12} />
            <input 
              type="text" 
              className="w-full bg-slate-950 border border-slate-800 rounded-lg py-1.5 pl-7 pr-2 text-[11px] text-white focus:ring-1 focus:ring-indigo-500 outline-none" 
              placeholder="Search SKUs..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              autoFocus
            />
          </div>
          <div className="max-h-48 overflow-y-auto no-scrollbar space-y-1">
            <button 
              onClick={toggleAll}
              className="w-full flex items-center gap-2 p-1.5 hover:bg-slate-800 rounded-lg text-[10px] font-bold text-slate-300 transition-colors"
            >
              <div className={`w-3.5 h-3.5 rounded border flex items-center justify-center transition-colors ${isAllSelected ? 'bg-indigo-600 border-indigo-600' : 'border-slate-700'}`}>
                {isAllSelected && <Check size={10} className="text-white" />}
              </div>
              Select All
            </button>
            <div className="h-px bg-slate-800 my-1"></div>
            {filteredOptions.map(opt => (
              <button 
                key={opt}
                onClick={() => toggleOption(opt)}
                className="w-full flex items-center gap-2 p-1.5 hover:bg-slate-800 rounded-lg text-[10px] font-medium text-slate-400 hover:text-white transition-colors"
              >
                <div className={`w-3.5 h-3.5 rounded border flex items-center justify-center transition-colors ${selected.includes(opt) ? 'bg-indigo-600 border-indigo-600' : 'border-slate-700'}`}>
                  {selected.includes(opt) && <Check size={10} className="text-white" />}
                </div>
                {opt}
              </button>
            ))}
            {filteredOptions.length === 0 && <div className="text-[10px] text-slate-600 p-2 italic">No SKUs found</div>}
          </div>
        </div>
      )}
    </div>
  );
};

const App: React.FC = () => {
  const [data, setData] = useState<DataPoint[]>(SAMPLE_DATA);
  const [attributes, setAttributes] = useState<ProductAttribute[]>(SAMPLE_ATTRIBUTES);
  const [inventory, setInventory] = useState<InventoryLevel[]>(SAMPLE_INVENTORY);
  const [scenarios, setScenarios] = useState<Scenario[]>([]);
  
  const [industryPrompt, setIndustryPrompt] = useState<string>('Consumer electronics distributor in the US West coast');
  const [horizon, setHorizon] = useState<number>(DEFAULT_HORIZON);
  const [interval, setIntervalState] = useState<TimeInterval>(TimeInterval.MONTHLY);
  const [filters, setFilters] = useState<FilterState>({
    startDate: '2021-01-01', endDate: '2024-05-01', skus: SKUS, category: 'All',
    confidenceLevel: 95, methodology: ForecastMethodology.HOLT_WINTERS,
    includeExternalTrends: false, globalLeadTime: 30, globalServiceLevel: 0.95,
    applyAnomalyCleaning: false, showLeadTimeOffset: false
  });
  
  const [activeTab, setActiveTab] = useState<'future' | 'quality' | 'inventory' | 'pareto'>('future');
  const [aiInsight, setAiInsight] = useState<string>('Analyzing market context...');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [marketAdj, setMarketAdj] = useState<MarketAdjustment | null>(null);
  const [isModelModalOpen, setIsModelModalOpen] = useState(false);

  const histUploadRef = useRef<HTMLInputElement>(null);
  const attrUploadRef = useRef<HTMLInputElement>(null);
  const invUploadRef = useRef<HTMLInputElement>(null);

  // Available SKUs for filtering
  const allUniqueSkus = useMemo(() => Array.from(new Set(data.map(d => d.sku))), [data]);

  // 1. Data Processing
  const processedData = useMemo(() => {
    let d = filters.applyAnomalyCleaning ? cleanAnomalies(data) : data;
    return d.filter(item => {
      const year = new Date(item.date).getFullYear();
      if (year < 2021) return false;
      const dateMatch = item.date >= filters.startDate && item.date <= filters.endDate;
      const skuMatch = filters.skus.includes(item.sku);
      const catMatch = filters.category === 'All' || item.category === filters.category;
      return dateMatch && skuMatch && catMatch;
    }).sort((a, b) => a.date.localeCompare(b.date));
  }, [data, filters]);

  const aggregatedData = useMemo(() => {
    const map = new Map<string, number>();
    processedData.forEach(d => map.set(d.date, (map.get(d.date) || 0) + d.quantity));
    return Array.from(map.entries()).map(([date, quantity]) => ({ date, quantity, sku: 'ALL', category: 'ALL' } as DataPoint));
  }, [processedData]);

  const historicalStdDev = useMemo(() => {
    const values = aggregatedData.map(d => d.quantity);
    const mean = values.reduce((a, b) => a + b, 0) / (values.length || 1);
    return Math.sqrt(values.reduce((sq, x) => sq + Math.pow(x - mean, 2), 0) / (values.length || 1));
  }, [aggregatedData]);

  const currentOH = useMemo(() => {
    return inventory
      .filter(i => filters.skus.includes(i.sku))
      .reduce((sum, i) => sum + i.onHand, 0);
  }, [inventory, filters.skus]);

  // 2. Final Forecast
  const futureForecast = useMemo(() => {
    let raw = calculateForecast(aggregatedData, horizon, interval, filters.confidenceLevel, filters.methodology);
    if (filters.includeExternalTrends && marketAdj) {
      raw = raw.map(p => p.isForecast ? { ...p, forecast: Math.round(p.forecast * marketAdj.multiplier) } : p);
    }
    
    // For attributes, we use global or average if multiple SKUs are selected
    const selectedAttributes = attributes.filter(a => filters.skus.includes(a.sku));
    const avgLeadTime = selectedAttributes.length > 0 
      ? selectedAttributes.reduce((s, a) => s + a.leadTimeDays, 0) / selectedAttributes.length 
      : filters.globalLeadTime;
    const avgServiceLevel = selectedAttributes.length > 0
      ? selectedAttributes.reduce((s, a) => s + a.serviceLevel, 0) / selectedAttributes.length
      : filters.globalServiceLevel;

    return calculateSupplyChainMetrics(raw, historicalStdDev, avgLeadTime, avgServiceLevel, currentOH, scenarios, filters.showLeadTimeOffset);
  }, [aggregatedData, horizon, interval, filters, marketAdj, attributes, historicalStdDev, currentOH, scenarios]);

  // 3. Metrics
  const backtestResults = useMemo(() => {
    if (aggregatedData.length <= 8) return { comparisonData: [], metrics: null };
    const splitIndex = aggregatedData.length - 6;
    const trainData = aggregatedData.slice(0, splitIndex);
    const actualTestData = aggregatedData.slice(splitIndex);
    const rawForecast = calculateForecast(trainData, 6, interval, filters.confidenceLevel, filters.methodology);
    const predictedPoints = rawForecast.filter(f => f.isForecast).map((f, i) => ({
      ...f, actual: actualTestData[i]?.quantity || 0,
    }));
    
    const selectedAttributes = attributes.filter(a => filters.skus.includes(a.sku));
    const avgCost = selectedAttributes.reduce((s, a) => s + a.unitCost, 0) / (selectedAttributes.length || 1);
    const avgPrice = selectedAttributes.reduce((s, a) => s + a.sellingPrice, 0) / (selectedAttributes.length || 1);
    
    const metrics = calculateMetrics(actualTestData.map(d => d.quantity), predictedPoints.map(p => p.forecast), avgCost, avgPrice);
    return { comparisonData: predictedPoints, metrics };
  }, [aggregatedData, interval, filters, attributes]);

  const paretoResults = useMemo(() => {
    const skuMap = new Map<string, number>();
    data.forEach(d => skuMap.set(d.sku, (skuMap.get(d.sku) || 0) + d.quantity));
    return runParetoAnalysis(Array.from(skuMap.entries()).map(([sku, totalVolume]) => ({ sku, totalVolume })));
  }, [data]);

  useEffect(() => {
    const updateAI = async () => {
      if (aggregatedData.length === 0) return;
      setIsLoading(true);
      const histAvg = Math.round(aggregatedData.reduce((s, d) => s + d.quantity, 0) / aggregatedData.length);
      const res = await getIndustryInsights(industryPrompt, `Avg Hist: ${histAvg}. Method: ${filters.methodology}. Selection: ${filters.skus.length} SKUs.`);
      setAiInsight(res);
      if (filters.includeExternalTrends) {
        const adj = await getMarketTrendAdjustment(industryPrompt);
        setMarketAdj(adj);
      }
      setIsLoading(false);
    };
    const timer = setTimeout(updateAI, 2000);
    return () => clearTimeout(timer);
  }, [industryPrompt, filters.includeExternalTrends, filters.methodology, filters.skus.length]);

  const addScenario = () => setScenarios([...scenarios, { id: Date.now().toString(), name: 'Marketing Promo', month: 1, multiplier: 1.15 }]);
  const removeScenario = (id: string) => setScenarios(scenarios.filter(s => s.id !== id));
  const updateScenario = (id: string, field: keyof Scenario, value: any) => setScenarios(scenarios.map(s => s.id === id ? { ...s, [field]: value } : s));

  const handleFileUpload = (type: 'hist' | 'attr' | 'inv', e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      const lines = text.split('\n');
      if (type === 'hist') {
        const newData: DataPoint[] = [];
        lines.slice(1).forEach(line => {
          const parts = line.split(',');
          if (parts.length >= 4) newData.push({ date: parts[0].trim(), sku: parts[1].trim(), category: parts[2].trim(), quantity: parseInt(parts[3].trim()) || 0 });
        });
        if (newData.length > 0) setData(newData);
      } else if (type === 'attr') {
        const newAttr: ProductAttribute[] = [];
        lines.slice(1).forEach(line => {
          const parts = line.split(',');
          if (parts.length >= 5) newAttr.push({ sku: parts[0].trim(), leadTimeDays: parseInt(parts[1].trim()), unitCost: parseFloat(parts[2].trim()), sellingPrice: parseFloat(parts[3].trim()), serviceLevel: parseFloat(parts[4].trim()) });
        });
        if (newAttr.length > 0) setAttributes(newAttr);
      } else if (type === 'inv') {
        const newInv: InventoryLevel[] = [];
        lines.slice(1).forEach(line => {
          const parts = line.split(',');
          if (parts.length >= 2) newInv.push({ sku: parts[0].trim(), onHand: parseInt(parts[1].trim()), lastUpdated: new Date().toISOString() });
        });
        if (newInv.length > 0) setInventory(newInv);
      }
    };
    reader.readAsText(file);
  };

  return (
    <div className="min-h-screen flex flex-col lg:flex-row bg-slate-950 font-sans text-slate-100 selection:bg-indigo-500/30">
      {/* Sidebar Control Deck */}
      <aside className="w-full lg:w-80 bg-slate-900 border-r border-slate-800 p-6 flex flex-col gap-6 shadow-2xl h-screen overflow-y-auto no-scrollbar z-30">
        <div className="flex flex-col gap-1 mb-2">
          {/* SSA & COMPANY Logo Section */}
          <div className="mb-4">
            <svg viewBox="0 0 300 50" className="w-full h-auto text-[#1e40af]" xmlns="http://www.w3.org/2000/svg">
              <text x="50" y="35" font-family="Montserrat, sans-serif" font-weight="800" font-size="28" fill="currentColor">SSA & COMPANY</text>
              <path d="M5 5 H15 V15" fill="none" stroke="currentColor" stroke-width="3" />
              <path d="M5 45 H15 V35" fill="none" stroke="currentColor" stroke-width="3" />
              <path d="M15 15 L35 35 M35 35 V25 M35 35 H25" fill="none" stroke="currentColor" stroke-width="3" />
            </svg>
          </div>
          <div className="flex items-center gap-2">
            <div className="bg-indigo-600/10 p-1.5 rounded-lg"><Zap className="text-indigo-400 w-4 h-4" /></div>
            <h1 className="text-sm font-black tracking-tight text-slate-300 uppercase">Predictor Pro</h1>
          </div>
        </div>

        <div className="space-y-6">
          <section className="space-y-3">
            <h3 className="text-[10px] font-bold text-slate-500 uppercase tracking-[0.2em] flex items-center gap-2">
              <Database size={12} /> Data Sources
              <InfoTooltip title="CSV Ingestion" content="Upload your historical data. Recommended max file size: 20MB. Supports up to 1,000 unique SKUs." />
            </h3>
            <div className="grid grid-cols-1 gap-2">
              <button onClick={() => histUploadRef.current?.click()} className="p-3 border border-slate-800 rounded-xl text-[10px] text-slate-400 hover:bg-slate-800 hover:text-white transition-all flex items-center gap-3"><FileText size={16} className="text-indigo-400"/> Sales History (CSV)</button>
              <button onClick={() => attrUploadRef.current?.click()} className="p-3 border border-slate-800 rounded-xl text-[10px] text-slate-400 hover:bg-slate-800 hover:text-white transition-all flex items-center gap-3"><Truck size={16} className="text-emerald-400"/> Part Data (CSV)</button>
              <button onClick={() => invUploadRef.current?.click()} className="p-3 border border-slate-800 rounded-xl text-[10px] text-slate-400 hover:bg-slate-800 hover:text-white transition-all flex items-center gap-3"><Package size={16} className="text-orange-400"/> Current On-Hand</button>
            </div>
            <input type="file" ref={histUploadRef} className="hidden" onChange={e => handleFileUpload('hist', e)} />
            <input type="file" ref={attrUploadRef} className="hidden" onChange={e => handleFileUpload('attr', e)} />
            <input type="file" ref={invUploadRef} className="hidden" onChange={e => handleFileUpload('inv', e)} />
          </section>

          <section className="space-y-4 pt-6 border-t border-slate-800">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-[10px] font-bold text-slate-500 uppercase tracking-[0.2em] flex items-center gap-2">
                <Settings2 size={12} /> Model Settings
              </h3>
              <button 
                onClick={() => setIsModelModalOpen(true)}
                className="text-indigo-400 hover:text-indigo-300 transition-colors"
                title="Methodology Explanation"
              >
                <HelpCircle size={14} />
              </button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="block text-[10px] font-black text-slate-500 uppercase mb-2">Forecasting Logic</label>
                <select 
                  className="w-full p-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs font-bold text-slate-200 outline-none hover:border-indigo-500 cursor-pointer"
                  value={filters.methodology}
                  onChange={e => setFilters(f => ({...f, methodology: e.target.value as ForecastMethodology}))}
                >
                  {Object.values(ForecastMethodology).map(m => <option key={m} value={m}>{m}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-[10px] font-black text-slate-500 uppercase mb-2">Time Interval</label>
                <div className="flex bg-slate-950 p-1 rounded-xl border border-slate-800">
                  {Object.values(TimeInterval).map(iv => (
                    <button 
                      key={iv}
                      onClick={() => setIntervalState(iv)}
                      className={`flex-1 py-1.5 text-[9px] font-black uppercase rounded-lg transition-all ${interval === iv ? 'bg-indigo-600 text-white' : 'text-slate-500 hover:text-slate-300'}`}
                    >
                      {iv}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="block text-[10px] font-black text-slate-500 uppercase mb-2">Horizon: {horizon} Months</label>
                <input type="range" min="1" max="24" className="w-full accent-indigo-500 h-1" value={horizon} onChange={e => setHorizon(Number(e.target.value))} />
              </div>
            </div>
          </section>

          <section className="space-y-4 pt-6 border-t border-slate-800">
            <h3 className="text-[10px] font-bold text-slate-500 uppercase tracking-[0.2em] flex items-center gap-2">
              <Globe size={12} /> Industry Context
            </h3>
            <textarea 
              className="w-full h-20 p-3 text-[11px] border border-slate-800 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none bg-slate-950 text-slate-200"
              value={industryPrompt} onChange={e => setIndustryPrompt(e.target.value)}
              placeholder="e.g. US Auto parts distributor facing steel price spikes..."
            />
            <div className="flex items-center justify-between p-3 bg-indigo-500/10 rounded-xl border border-indigo-500/20">
              <span className="text-[10px] font-bold text-indigo-400 flex items-center gap-1">AI Grounding <InfoTooltip title="Market Verification" content="Gemini searches current trade reports and news to apply realistic multipliers to your projection." /></span>
              <input type="checkbox" checked={filters.includeExternalTrends} onChange={() => setFilters(f => ({...f, includeExternalTrends: !f.includeExternalTrends}))} className="accent-indigo-500 w-4 h-4" />
            </div>
          </section>

          <section className="space-y-4 pt-6 border-t border-slate-800">
            <h3 className="text-[10px] font-bold text-slate-500 uppercase tracking-[0.2em] flex items-center gap-2">
              <Zap size={12} /> Strategic Shocks
            </h3>
            <div className="space-y-3">
              {scenarios.map(s => (
                <div key={s.id} className="p-3 bg-slate-950 border border-slate-800 rounded-xl space-y-2 animate-in slide-in-from-top-1 duration-200">
                  <div className="flex justify-between items-center">
                    <input className="bg-transparent text-[10px] font-bold text-white outline-none border-b border-transparent hover:border-indigo-500" value={s.name} onChange={e => updateScenario(s.id, 'name', e.target.value)} />
                    <button onClick={() => removeScenario(s.id)} className="text-red-400 hover:text-red-600"><Trash2 size={12} /></button>
                  </div>
                  <div className="flex items-center justify-between text-[9px]">
                    <span className="text-slate-500">Offset: {s.month} Mo</span>
                    <input type="number" className="w-12 bg-slate-900 rounded px-1 text-indigo-400 font-bold outline-none" value={s.multiplier} step="0.1" onChange={e => updateScenario(s.id, 'multiplier', parseFloat(e.target.value))} />
                  </div>
                </div>
              ))}
              <button onClick={addScenario} className="w-full py-2 border border-dashed border-slate-700 text-slate-500 text-[10px] font-bold rounded-xl hover:border-indigo-500 hover:text-indigo-400 transition-all">
                + Add Shock
              </button>
            </div>
          </section>
        </div>
      </aside>

      {/* Main Command Center */}
      <main className="flex-1 overflow-y-auto p-4 lg:p-10 space-y-8 bg-slate-950">
        <header className="bg-slate-900 p-4 rounded-3xl border border-slate-800 shadow-2xl flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-3 min-w-0 flex-1">
            <div className="w-64">
              <SearchableMultiSelect 
                options={allUniqueSkus}
                selected={filters.skus}
                onChange={skus => setFilters(f => ({...f, skus}))}
                label="Filter SKUs"
              />
            </div>
            <div className="px-4 py-2 bg-slate-950 border border-slate-800 rounded-xl text-[11px] font-bold text-slate-400 flex items-center gap-2">
              <Calendar size={14} className="text-indigo-400"/> {filters.startDate} <ChevronRight size={10}/> {filters.endDate}
            </div>
            <button 
              onClick={() => exportToCSV(futureForecast, `ssa_forecast_${filters.skus.length}_items`)}
              className="px-4 py-2 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-xl text-[11px] font-bold text-white flex items-center gap-2 transition-all active:scale-95"
            >
              <Download size={14}/> CSV Export
            </button>
          </div>
          <div className="flex bg-slate-950 p-1.5 rounded-2xl border border-slate-800 shrink-0">
            {['future', 'inventory', 'quality', 'pareto'].map(tab => (
              <button key={tab} onClick={() => setActiveTab(tab as any)} className={`px-5 py-2 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all ${activeTab === tab ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/30' : 'text-slate-500 hover:text-slate-300'}`}>
                {tab}
              </button>
            ))}
          </div>
        </header>

        {activeTab === 'future' ? (
          <>
            <section className="grid grid-cols-1 lg:grid-cols-4 gap-6">
              <div className="lg:col-span-3 bg-slate-900 border border-slate-800 p-8 rounded-[2.5rem] shadow-2xl relative overflow-hidden group">
                <div className="relative z-10 flex flex-col h-full">
                  <div className="flex items-center gap-3 mb-6">
                    <div className="p-3 bg-indigo-500/10 rounded-2xl border border-indigo-500/20"><BrainCircuit size={22} className="text-indigo-400" /></div>
                    <h3 className="text-xl font-black text-white uppercase tracking-widest">Executive Brief <InfoTooltip title="Portfolio Insight" content="An AI-distilled summary of your projected operational performance and market exposure." /></h3>
                  </div>
                  <div className="text-slate-300 text-sm leading-relaxed font-medium italic mb-8 max-w-2xl">
                    {isLoading ? <div className="space-y-3 animate-pulse"><div className="h-4 bg-slate-800 rounded w-full"></div><div className="h-4 bg-slate-800 rounded w-2/3"></div></div> : aiInsight}
                  </div>
                </div>
              </div>

              <div className="bg-slate-900 p-6 rounded-[2rem] border border-slate-800 shadow-xl flex flex-col justify-between hover:border-indigo-500/40 transition-all">
                <div className="flex items-center gap-2 mb-6 text-xs font-black text-slate-500 uppercase tracking-widest"><Package size={14} className="text-orange-400"/> Inventory Buffer <InfoTooltip title="Safety Logic" content="Calculated using Z-score based on Service Level targets and demand variability." /></div>
                <div className="space-y-4">
                  <div className="p-4 bg-slate-950 rounded-2xl border border-slate-800 group hover:border-indigo-500/30 transition-all">
                    <p className="text-[10px] font-black text-slate-500 mb-1 uppercase tracking-widest">Reorder Point</p>
                    <p className="text-3xl font-black text-white group-hover:text-indigo-400 transition-colors">{Math.round(futureForecast[0]?.reorderPoint || 0)}</p>
                  </div>
                  <div className="p-4 bg-slate-950 rounded-2xl border border-slate-800 group hover:border-emerald-500/30 transition-all">
                    <p className="text-[10px] font-black text-slate-500 mb-1 uppercase tracking-widest">Safety Stock</p>
                    <p className="text-3xl font-black text-white group-hover:text-emerald-400 transition-colors">{Math.round(futureForecast[0]?.safetyStock || 0)}</p>
                  </div>
                </div>
              </div>
            </section>

            <section className="bg-slate-900 p-8 rounded-[3rem] border border-slate-800 shadow-2xl">
              <div className="flex items-center justify-between mb-10">
                <h2 className="text-3xl font-black text-white tracking-tighter uppercase flex items-center gap-3">
                  Forecast Strategy
                  <InfoTooltip title="Demand Viz" content="Blue line tracks historical truth. Dashed orange shows statistical trend. Solid red reflects AI and manual scenario adjustments." />
                </h2>
                <div className="flex gap-4 text-[10px] font-black text-slate-500 uppercase tracking-widest">
                  <div className="flex items-center gap-2"><div className="w-3 h-3 bg-indigo-500 rounded-sm" /> Historical</div>
                  <div className="flex items-center gap-2"><div className="w-3 h-3 border-2 border-orange-500 rounded-sm" /> Base</div>
                  <div className="flex items-center gap-2"><div className="w-3 h-3 bg-red-500 rounded-sm" /> Adjusted</div>
                </div>
              </div>
              <div className="h-[500px]">
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={futureForecast} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#1e293b" />
                    <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{fontSize: 10, fill: '#64748b', fontWeight: 700}} />
                    <YAxis axisLine={false} tickLine={false} tick={{fontSize: 10, fill: '#64748b', fontWeight: 700}} />
                    <Tooltip 
                      contentStyle={{backgroundColor: '#0f172a', borderRadius: '16px', border: '1px solid #334155', boxShadow: '0 20px 40px rgba(0,0,0,0.5)'}}
                      itemStyle={{fontSize: '11px', fontWeight: 'bold'}}
                    />
                    <Area type="monotone" dataKey="historical" name="Actual Sales" stroke="#6366f1" strokeWidth={4} fill="url(#colorHist)" connectNulls />
                    <Area type="monotone" dataKey="forecast" name="Model Base" stroke="#fb923c" strokeWidth={2} strokeDasharray="8 8" fill="none" />
                    <Line type="monotone" dataKey="scenarioForecast" name="Scenario" stroke="#ef4444" strokeWidth={4} dot={{r: 4, fill: '#ef4444', strokeWidth: 0}} />
                    <defs>
                      <linearGradient id="colorHist" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#6366f1" stopOpacity={0.2}/><stop offset="95%" stopColor="#6366f1" stopOpacity={0}/></linearGradient>
                    </defs>
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
            </section>
          </>
        ) : activeTab === 'quality' ? (
          <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4">
             <header className="flex items-center gap-3">
              <h2 className="text-3xl font-black text-white tracking-tighter uppercase">Validation & Error Audit</h2>
              <InfoTooltip title="Hold-out Backtest" content="The model is trained on past data and then tested against the most recent 6 months of truth to calculate exact error rates." />
            </header>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <MetricsCard label="Validation Accuracy" value={backtestResults.metrics?.accuracy.toFixed(1) || '--'} suffix="%" description="100 - MAPE performance" />
              <MetricsCard label="System Bias" value={backtestResults.metrics?.bias.toFixed(1) || '--'} suffix="%" description="Indicates a tendency to over or under forecast." />
              <MetricsCard label="Mean Abs Error" value={Math.round(backtestResults.metrics?.mad || 0)} description="Average unit variance" />
              <MetricsCard label="Exposure Risk" value={Math.round(backtestResults.metrics?.holdingCostRisk || 0)} suffix="$" description="Holding cost of excess prediction" />
            </div>
            
            <section className="bg-slate-900 p-8 rounded-[3rem] border border-slate-800 shadow-xl">
              <div className="h-[450px]">
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={backtestResults.comparisonData}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#1e293b" />
                    <XAxis dataKey="date" tick={{fontSize: 10, fill: '#64748b'}} />
                    <YAxis tick={{fontSize: 10, fill: '#64748b'}} />
                    <Tooltip contentStyle={{backgroundColor: '#0f172a', border: '1px solid #334155'}} />
                    <Bar dataKey="actual" name="Historical Truth" fill="#334155" radius={[10,10,0,0]} barSize={50} />
                    <Line dataKey="forecast" name="Model Estimation" stroke="#ef4444" strokeWidth={5} dot={{r: 7}} />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
            </section>
          </div>
        ) : activeTab === 'pareto' ? (
          <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4">
            <header className="flex items-center gap-3">
              <h2 className="text-3xl font-black text-white tracking-tighter uppercase">ABC Value Stratification</h2>
              <InfoTooltip title="Portfolio Class" content="A-Grade items drive 80% of volume and require high-touch forecasting." />
            </header>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              <div className="lg:col-span-2 bg-slate-900 rounded-[2.5rem] border border-slate-800 shadow-2xl overflow-hidden">
                <table className="w-full text-left">
                  <thead className="bg-slate-950 text-[10px] font-black text-slate-500 uppercase tracking-[0.2em]">
                    <tr>
                      <th className="px-8 py-6">Product ID</th>
                      <th className="px-8 py-6">Units</th>
                      <th className="px-8 py-6">Global Share</th>
                      <th className="px-8 py-6">Priority</th>
                    </tr>
                  </thead>
                  <tbody className="text-sm">
                    {paretoResults.slice(0, 10).map((item) => (
                      <tr key={item.sku} className="border-t border-slate-800 hover:bg-slate-800/40 transition-colors group">
                        <td className="px-8 py-6 font-bold text-slate-200 group-hover:text-indigo-400 transition-colors">{item.sku}</td>
                        <td className="px-8 py-6 text-slate-400 font-mono">{item.totalVolume.toLocaleString()}</td>
                        <td className="px-8 py-6 text-slate-500">{item.share.toFixed(1)}%</td>
                        <td className="px-8 py-6">
                          <span className={`px-4 py-1.5 rounded-full text-[9px] font-black tracking-widest border ${item.grade === 'A' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : item.grade === 'B' ? 'bg-orange-500/10 text-orange-400 border-orange-500/20' : 'bg-slate-800/50 text-slate-500 border-slate-700'}`}>
                            {item.grade}-CLASS
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="bg-slate-900 p-8 rounded-[2.5rem] border border-slate-800 shadow-2xl h-fit">
                <h4 className="text-[10px] font-black text-slate-500 mb-8 uppercase tracking-widest">Revenue Concentration</h4>
                <div className="h-[300px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart3 data={paretoResults.slice(0, 5)} margin={{top: 0, bottom: 0, left: -20, right: 0}}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#1e293b" />
                      <XAxis dataKey="sku" hide />
                      <YAxis tick={{fill: '#64748b', fontSize: 10}} />
                      <Tooltip contentStyle={{backgroundColor: '#0f172a', border: '1px solid #334155'}} />
                      <Bar dataKey="totalVolume" fill="#6366f1" radius={[12,12,0,0]} />
                    </BarChart3>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-8 animate-in fade-in">
            <header className="flex items-center gap-3">
              <h2 className="text-3xl font-black text-white tracking-tighter uppercase">Inventory Burn Projection</h2>
              <InfoTooltip title="Exhaustion Path" content="Visualizes when current on-hand stock will be depleted based on the project forecast." />
            </header>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <MetricsCard label="Active Stock" value={currentOH} description="Total selection balance" />
              <MetricsCard label="Consumption/Day" value={(historicalStdDev / 30).toFixed(1)} description="Estimated unit burn rate" />
              <MetricsCard label="Safety Floor" value={Math.round(futureForecast[0]?.safetyStock || 0)} description="Target minimum balance" />
              <MetricsCard label="Fill Rate Goal" value={Math.round(filters.globalServiceLevel * 100)} suffix="%" description="Desired service level" />
            </div>

            <section className="bg-slate-900 p-8 rounded-[3rem] border border-slate-800 shadow-2xl">
              <div className="h-[450px]">
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={futureForecast.filter(f => f.isForecast)}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#1e293b" />
                    <XAxis dataKey="date" tick={{fontSize: 10, fill: '#64748b'}} />
                    <YAxis tick={{fontSize: 10, fill: '#64748b'}} />
                    <Tooltip contentStyle={{backgroundColor: '#0f172a', border: '1px solid #334155'}} />
                    <Area type="monotone" dataKey="projectedInventory" name="Inv Level" stroke="#10b981" fill="url(#colorInv)" strokeWidth={4} />
                    <ReferenceLine y={futureForecast[0]?.safetyStock} stroke="#ef4444" strokeDasharray="5 5" strokeWidth={2} label={{value: 'Safety Floor', fill: '#ef4444', fontSize: 10, fontWeight: 900}} />
                    <defs>
                      <linearGradient id="colorInv" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#10b981" stopOpacity={0.2}/><stop offset="95%" stopColor="#10b981" stopOpacity={0}/></linearGradient>
                    </defs>
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
            </section>
          </div>
        )}

        <footer className="text-center text-slate-800 text-[10px] font-black uppercase tracking-[0.5em] py-12">
          SSA & COMPANY // Decision Intelligence // v4.3.0
        </footer>
      </main>

      {/* Methodology Explanation Modal */}
      <ModelExplanationModal 
        isOpen={isModelModalOpen} 
        onClose={() => setIsModelModalOpen(false)} 
      />
    </div>
  );
};

// Re-import missing icon for chart
import { BarChart3 as BarChart3Icon } from 'lucide-react';
const BarChart3 = ({ children, data, margin }: any) => <ResponsiveContainer><BarChart3Icon data={data} margin={margin}>{children}</BarChart3Icon></ResponsiveContainer>

export default App;
