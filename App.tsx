
import React, { useState, useMemo, useEffect, useRef } from 'react';
import { 
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, 
  Area, ComposedChart, Bar, Line, ReferenceLine 
} from 'recharts';
import { 
  TrendingUp, Settings2, Download, BrainCircuit, 
  ChevronRight, Calendar, FileText, Activity, Layers,
  Globe, Package, Truck, Database, 
  Zap, Trash2, HelpCircle, Search, Check, X, ChevronDown, BarChart3 as BarChart3Icon
} from 'lucide-react';
import { SKUS, SAMPLE_DATA, SAMPLE_ATTRIBUTES, SAMPLE_INVENTORY, DEFAULT_HORIZON } from './constants';
import { DataPoint, FilterState, TimeInterval, ForecastMethodology, ProductAttribute, InventoryLevel, Scenario } from './types';
import { calculateForecast, calculateMetrics, cleanAnomalies } from './utils/forecasting';
import { calculateSupplyChainMetrics, runParetoAnalysis } from './utils/supplyChain';
import { exportToCSV } from './utils/export';
import { getIndustryInsights, getMarketTrendAdjustment, MarketAdjustment } from './services/geminiService';
import MetricsCard from './components/MetricsCard';
import InfoTooltip from './components/InfoTooltip';

/**
 * Methodology Explanation Library Modal
 */
const ModelExplanationModal: React.FC<{ isOpen: boolean; onClose: () => void }> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;
  const models = [
    {
      name: ForecastMethodology.HOLT_WINTERS,
      icon: <Activity className="text-indigo-400" size={20} />,
      description: "Decomposes data into Level, Trend, and Seasonality. Best for products with strong recurring cycles like holiday peaks.",
      pro: "Excellent seasonal precision",
      con: "Slow to adapt to sudden trend pivots"
    },
    {
      name: ForecastMethodology.PROPHET,
      icon: <BrainCircuit className="text-purple-400" size={20} />,
      description: "Additive model designed for business data. Handles missing values, outliers, and trend shifts effectively.",
      pro: "Robust to noisy datasets",
      con: "Increased computational overhead"
    },
    {
      name: ForecastMethodology.ARIMA,
      icon: <TrendingUp className="text-emerald-400" size={20} />,
      description: "Uses auto-regression on lagged values. Best for stable data with clear statistical correlations.",
      pro: "Statistical rigor",
      con: "Requires stationary data"
    },
    {
      name: ForecastMethodology.LINEAR,
      icon: <LineChartIcon size={20} className="text-blue-400" />,
      description: "Basic OLS regression. Projects a straight-line growth path. Best for broad strategic direction.",
      pro: "High transparency",
      con: "Ignores all seasonality"
    }
  ];

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-slate-950/90 backdrop-blur-sm animate-in fade-in duration-300">
      <div className="bg-slate-900 border border-slate-700 w-full max-w-2xl rounded-[2.5rem] shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        <div className="p-8 border-b border-slate-800 flex justify-between items-center">
          <div>
            <h2 className="text-2xl font-black text-white tracking-tight uppercase">Methodology Library</h2>
            <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mt-1">SSA & Company Science Standards</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-800 rounded-full text-slate-400 transition-all"><X size={24} /></button>
        </div>
        <div className="p-8 overflow-y-auto space-y-4">
          {models.map((m) => (
            <div key={m.name} className="flex gap-6 p-6 rounded-3xl bg-slate-950 border border-slate-800 hover:border-indigo-500/50 transition-all">
              <div className="shrink-0 p-4 bg-slate-900 rounded-2xl border border-slate-800">{m.icon}</div>
              <div className="space-y-2">
                <h3 className="text-sm font-black text-white uppercase">{m.name}</h3>
                <p className="text-xs text-slate-400 leading-relaxed">{m.description}</p>
                <div className="flex gap-3 pt-1">
                  <div className="text-[9px] font-bold uppercase text-emerald-500 bg-emerald-500/10 px-2 py-0.5 rounded">Pro: {m.pro}</div>
                  <div className="text-[9px] font-bold uppercase text-red-400 bg-red-400/10 px-2 py-0.5 rounded">Con: {m.con}</div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

const LineChartIcon = ({ size, className }: { size: number; className?: string }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <path d="M3 3v18h18" /><path d="m19 9-5 5-4-4-3 3" />
  </svg>
);

const SearchableMultiSelect: React.FC<{
  options: string[];
  selected: string[];
  onChange: (selected: string[]) => void;
}> = ({ options, selected, onChange }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setIsOpen(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const filtered = options.filter(opt => opt.toLowerCase().includes(search.toLowerCase()));
  const isAll = selected.length === options.length;

  return (
    <div className="relative w-full" ref={containerRef}>
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between p-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs font-bold text-slate-200 hover:border-indigo-500 transition-all"
      >
        <span className="truncate">{isAll ? 'All Portfolio SKUs' : `${selected.length} Items Selected`}</span>
        <ChevronDown size={14} />
      </button>
      {isOpen && (
        <div className="absolute top-full left-0 right-0 mt-2 bg-slate-900 border border-slate-700 rounded-xl shadow-2xl z-[100] p-2 animate-in slide-in-from-top-2 duration-200">
          <input 
            className="w-full bg-slate-950 border border-slate-800 rounded-lg py-1.5 px-3 text-[11px] text-white outline-none mb-2 focus:ring-1 focus:ring-indigo-500" 
            placeholder="Search SKU..." value={search} onChange={e => setSearch(e.target.value)}
          />
          <div className="max-h-48 overflow-y-auto space-y-1">
            <button onClick={() => onChange(isAll ? [] : options)} className="w-full text-left p-1.5 hover:bg-slate-800 rounded-lg text-[10px] font-bold text-slate-300">
              {isAll ? 'Deselect All' : 'Select All Portfolio'}
            </button>
            <div className="h-px bg-slate-800 my-1" />
            {filtered.map(opt => (
              <button key={opt} onClick={() => onChange(selected.includes(opt) ? selected.filter(s => s !== opt) : [...selected, opt])} className="w-full flex items-center gap-2 p-1.5 hover:bg-slate-800 rounded-lg text-[10px]">
                <div className={`w-3.5 h-3.5 rounded border transition-colors ${selected.includes(opt) ? 'bg-indigo-600 border-indigo-600' : 'border-slate-700'}`}>
                  {selected.includes(opt) && <Check size={10} className="text-white mx-auto mt-0.5" />}
                </div>
                {opt}
              </button>
            ))}
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
  
  const [industryPrompt, setIndustryPrompt] = useState('Consumer electronics distributor in the US West coast');
  const [horizon, setHorizon] = useState(DEFAULT_HORIZON);
  const [interval, setIntervalState] = useState<TimeInterval>(TimeInterval.MONTHLY);
  const [filters, setFilters] = useState<FilterState>({
    startDate: '2021-01-01', endDate: '2024-05-01', skus: SKUS, category: 'All',
    confidenceLevel: 95, methodology: ForecastMethodology.HOLT_WINTERS,
    includeExternalTrends: false, globalLeadTime: 30, globalServiceLevel: 0.95,
    applyAnomalyCleaning: false, showLeadTimeOffset: false
  });
  
  const [activeTab, setActiveTab] = useState<'future' | 'quality' | 'inventory' | 'pareto'>('future');
  const [aiInsight, setAiInsight] = useState('Initializing market context...');
  const [isLoading, setIsLoading] = useState(false);
  const [marketAdj, setMarketAdj] = useState<MarketAdjustment | null>(null);
  const [isModelModalOpen, setIsModelModalOpen] = useState(false);

  const histUploadRef = useRef<HTMLInputElement>(null);
  const attrUploadRef = useRef<HTMLInputElement>(null);
  const invUploadRef = useRef<HTMLInputElement>(null);

  // 1. Data Processing
  const processedData = useMemo(() => {
    let d = filters.applyAnomalyCleaning ? cleanAnomalies(data) : data;
    return d.filter(item => {
      const dateMatch = item.date >= filters.startDate && item.date <= filters.endDate;
      const skuMatch = filters.skus.includes(item.sku);
      return dateMatch && skuMatch;
    }).sort((a, b) => a.date.localeCompare(b.date));
  }, [data, filters]);

  const aggregatedData = useMemo(() => {
    const map = new Map<string, number>();
    processedData.forEach(d => map.set(d.date, (map.get(d.date) || 0) + d.quantity));
    return Array.from(map.entries())
      .map(([date, quantity]) => ({ date, quantity, sku: 'ALL', category: 'ALL' } as DataPoint))
      .sort((a, b) => a.date.localeCompare(b.date));
  }, [processedData]);

  const historicalStdDev = useMemo(() => {
    const values = aggregatedData.map(d => d.quantity);
    if (values.length === 0) return 0;
    const mean = values.reduce((a, b) => a + b, 0) / values.length;
    return Math.sqrt(values.reduce((sq, x) => sq + Math.pow(x - mean, 2), 0) / values.length);
  }, [aggregatedData]);

  const currentOH = useMemo(() => {
    return inventory.filter(i => filters.skus.includes(i.sku)).reduce((s, i) => s + i.onHand, 0);
  }, [inventory, filters.skus]);

  // 2. Analysis & Forecasting
  const futureForecast = useMemo(() => {
    if (aggregatedData.length === 0) return [];
    let raw = calculateForecast(aggregatedData, horizon, interval, filters.confidenceLevel, filters.methodology);
    if (filters.includeExternalTrends && marketAdj) {
      raw = raw.map(p => p.isForecast ? { ...p, forecast: Math.round(p.forecast * marketAdj.multiplier) } : p);
    }
    
    // Use first selected SKU's attributes if available, else globals
    const activeAttr = attributes.find(a => filters.skus.includes(a.sku)) || { leadTimeDays: filters.globalLeadTime, serviceLevel: filters.globalServiceLevel };

    return calculateSupplyChainMetrics(
      raw, 
      historicalStdDev, 
      activeAttr.leadTimeDays, 
      activeAttr.serviceLevel || filters.globalServiceLevel, 
      currentOH, 
      scenarios, 
      filters.showLeadTimeOffset
    );
  }, [aggregatedData, horizon, interval, filters, marketAdj, historicalStdDev, currentOH, scenarios, attributes]);

  const backtestResults = useMemo(() => {
    if (aggregatedData.length <= 8) return { comparisonData: [], metrics: null };
    const splitIndex = aggregatedData.length - 6;
    const trainData = aggregatedData.slice(0, splitIndex);
    const actualTestData = aggregatedData.slice(splitIndex);
    const rawForecast = calculateForecast(trainData, 6, interval, filters.confidenceLevel, filters.methodology);
    const predictedPoints = rawForecast.filter(f => f.isForecast).map((f, i) => ({
      ...f, actual: actualTestData[i]?.quantity || 0,
    }));
    
    const activeAttr = attributes.find(a => filters.skus.includes(a.sku)) || { unitCost: 50, sellingPrice: 100 };
    const metrics = calculateMetrics(actualTestData.map(d => d.quantity), predictedPoints.map(p => p.forecast), activeAttr.unitCost, activeAttr.sellingPrice);
    return { comparisonData: predictedPoints, metrics };
  }, [aggregatedData, interval, filters, attributes]);

  const paretoResults = useMemo(() => {
    const skuMap = new Map<string, number>();
    data.forEach(d => skuMap.set(d.sku, (skuMap.get(d.sku) || 0) + d.quantity));
    return runParetoAnalysis(Array.from(skuMap.entries()).map(([sku, totalVolume]) => ({ sku, totalVolume })));
  }, [data]);

  // 3. Side Effects
  useEffect(() => {
    const updateAI = async () => {
      if (aggregatedData.length === 0) return;
      setIsLoading(true);
      const res = await getIndustryInsights(industryPrompt, `Avg: ${Math.round(historicalStdDev)}. Methodology: ${filters.methodology}. Selection: ${filters.skus.length} SKUs.`);
      setAiInsight(res);
      if (filters.includeExternalTrends) {
        setMarketAdj(await getMarketTrendAdjustment(industryPrompt));
      }
      setIsLoading(false);
    };
    const timer = setTimeout(updateAI, 2000);
    return () => clearTimeout(timer);
  }, [industryPrompt, filters.includeExternalTrends, filters.methodology, filters.skus.length]);

  // 4. Handlers
  const addScenario = () => setScenarios([...scenarios, { id: Date.now().toString(), name: 'Strategic Promo', month: 1, multiplier: 1.15 }]);
  
  const handleFileUpload = (type: 'hist' | 'attr' | 'inv', e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      const lines = text.split('\n');
      if (type === 'hist') {
        const newData: DataPoint[] = lines.slice(1).filter(l => l.includes(',')).map(line => {
          const p = line.split(',');
          return { date: p[0].trim(), sku: p[1].trim(), category: p[2].trim(), quantity: parseInt(p[3].trim()) || 0 };
        });
        if (newData.length > 0) setData(newData);
      } else if (type === 'attr') {
        const newAttr: ProductAttribute[] = lines.slice(1).filter(l => l.includes(',')).map(line => {
          const p = line.split(',');
          return { sku: p[0].trim(), leadTimeDays: parseInt(p[1].trim()) || 30, unitCost: parseFloat(p[2].trim()) || 0, sellingPrice: parseFloat(p[3].trim()) || 0, serviceLevel: parseFloat(p[4].trim()) || 0.95 };
        });
        if (newAttr.length > 0) setAttributes(newAttr);
      } else if (type === 'inv') {
        const newInv: InventoryLevel[] = lines.slice(1).filter(l => l.includes(',')).map(line => {
          const p = line.split(',');
          return { sku: p[0].trim(), onHand: parseInt(p[1].trim()) || 0, lastUpdated: new Date().toISOString() };
        });
        if (newInv.length > 0) setInventory(newInv);
      }
    };
    reader.readAsText(file);
  };

  return (
    <div className="min-h-screen flex flex-col lg:flex-row bg-slate-950 font-sans text-slate-100">
      {/* Control Sidebar */}
      <aside className="w-full lg:w-80 bg-slate-900 border-r border-slate-800 p-6 flex flex-col gap-6 h-screen overflow-y-auto no-scrollbar z-30">
        <div className="mb-4">
          <svg viewBox="0 0 300 50" className="w-full h-auto text-[#1e40af]" xmlns="http://www.w3.org/2000/svg">
            <text x="50" y="35" font-family="Montserrat, sans-serif" font-weight="800" font-size="28" fill="currentColor">SSA & COMPANY</text>
            <path d="M5 5 H15 V15 M5 45 H15 V35 M15 15 L35 35" fill="none" stroke="currentColor" stroke-width="3" />
          </svg>
          <div className="flex items-center gap-2 mt-4 text-[10px] font-black uppercase tracking-widest text-slate-500">
            <Zap size={14} className="text-indigo-400" /> Supply Chain Predictor
          </div>
        </div>

        <section className="space-y-4">
          <h3 className="text-[10px] font-bold text-slate-500 uppercase tracking-widest flex items-center gap-2">
            <Database size={12} /> Data Console
          </h3>
          <div className="grid grid-cols-1 gap-2">
            <button onClick={() => histUploadRef.current?.click()} className="p-3 border border-slate-800 rounded-xl text-[10px] text-slate-400 hover:bg-slate-800 flex items-center gap-3 transition-all">
              <FileText size={16} className="text-indigo-400"/> Sales History (CSV)
            </button>
            <button onClick={() => attrUploadRef.current?.click()} className="p-3 border border-slate-800 rounded-xl text-[10px] text-slate-400 hover:bg-slate-800 flex items-center gap-3 transition-all">
              <Truck size={16} className="text-emerald-400"/> Part Data (CSV)
            </button>
            <button onClick={() => invUploadRef.current?.click()} className="p-3 border border-slate-800 rounded-xl text-[10px] text-slate-400 hover:bg-slate-800 flex items-center gap-3 transition-all">
              <Package size={16} className="text-orange-400"/> Current Inventory
            </button>
          </div>
          <input type="file" ref={histUploadRef} className="hidden" onChange={e => handleFileUpload('hist', e)} />
          <input type="file" ref={attrUploadRef} className="hidden" onChange={e => handleFileUpload('attr', e)} />
          <input type="file" ref={invUploadRef} className="hidden" onChange={e => handleFileUpload('inv', e)} />
        </section>

        <section className="space-y-4 pt-4 border-t border-slate-800">
          <div className="flex justify-between items-center">
            <h3 className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Model Engine</h3>
            <button onClick={() => setIsModelModalOpen(true)} className="text-indigo-400 hover:text-white transition-colors"><HelpCircle size={14} /></button>
          </div>
          <select 
            className="w-full p-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs font-bold text-slate-200 outline-none hover:border-indigo-500"
            value={filters.methodology} onChange={e => setFilters(f => ({...f, methodology: e.target.value as ForecastMethodology}))}
          >
            {Object.values(ForecastMethodology).map(m => <option key={m} value={m}>{m}</option>)}
          </select>
          <div className="flex bg-slate-950 p-1 rounded-xl border border-slate-800">
            {Object.values(TimeInterval).map(iv => (
              <button key={iv} onClick={() => setIntervalState(iv)} className={`flex-1 py-1.5 text-[9px] font-black uppercase rounded-lg transition-all ${interval === iv ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-500 hover:text-slate-300'}`}>{iv}</button>
            ))}
          </div>
          <div className="space-y-2">
            <label className="text-[9px] font-black text-slate-500 uppercase flex justify-between">Horizon <span>{horizon} Mo</span></label>
            <input type="range" min="1" max="24" className="w-full accent-indigo-500 h-1 bg-slate-800 rounded-lg appearance-none" value={horizon} onChange={e => setHorizon(Number(e.target.value))} />
          </div>
          <div className="space-y-2">
            <label className="text-[9px] font-black text-slate-500 uppercase flex justify-between">Confidence <span>{filters.confidenceLevel}%</span></label>
            <input type="range" min="80" max="99" step="5" className="w-full accent-emerald-500 h-1 bg-slate-800 rounded-lg appearance-none" value={filters.confidenceLevel} onChange={e => setFilters(f => ({...f, confidenceLevel: Number(e.target.value)}))} />
          </div>
        </section>

        <section className="space-y-4 pt-4 border-t border-slate-800">
          <h3 className="text-[10px] font-bold text-slate-500 uppercase tracking-widest flex items-center gap-2">
            <Globe size={12} /> Industry Context
          </h3>
          <textarea 
            className="w-full h-24 p-3 text-[11px] border border-slate-800 rounded-xl bg-slate-950 text-slate-200 outline-none focus:ring-1 focus:ring-indigo-500"
            value={industryPrompt} onChange={e => setIndustryPrompt(e.target.value)}
          />
          <div className="flex items-center justify-between p-3 bg-indigo-500/10 rounded-xl border border-indigo-500/20">
            <span className="text-[10px] font-bold text-indigo-400">AI Trends Grounding</span>
            <input type="checkbox" checked={filters.includeExternalTrends} onChange={() => setFilters(f => ({...f, includeExternalTrends: !f.includeExternalTrends}))} className="accent-indigo-500 w-4 h-4 cursor-pointer" />
          </div>
        </section>

        <section className="space-y-4 pt-4 border-t border-slate-800">
          <h3 className="text-[10px] font-bold text-slate-500 uppercase tracking-widest flex items-center gap-2">
            <Zap size={12} /> Strategic Shocks
          </h3>
          <div className="space-y-2">
            {scenarios.map(s => (
              <div key={s.id} className="p-3 bg-slate-950 border border-slate-800 rounded-xl flex items-center justify-between">
                <span className="text-[10px] font-bold truncate">{s.name}</span>
                <span className="text-indigo-400 font-mono text-[10px]">{s.multiplier}x</span>
              </div>
            ))}
            <button onClick={addScenario} className="w-full py-2 border border-dashed border-slate-700 text-slate-500 text-[9px] font-bold rounded-xl hover:border-indigo-500 transition-all">+ Add Promo/Shock</button>
          </div>
        </section>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 overflow-y-auto p-4 lg:p-10 space-y-8 bg-slate-950">
        <header className="bg-slate-900 p-4 rounded-3xl border border-slate-800 flex flex-col md:flex-row items-center justify-between gap-4 shadow-2xl">
          <div className="w-full md:w-80"><SearchableMultiSelect options={SKUS} selected={filters.skus} onChange={skus => setFilters(f => ({...f, skus}))} /></div>
          
          <div className="flex bg-slate-950 p-1.5 rounded-2xl border border-slate-800">
            {['future', 'inventory', 'quality', 'pareto'].map(tab => (
              <button key={tab} onClick={() => setActiveTab(tab as any)} className={`px-5 py-2 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all ${activeTab === tab ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/20' : 'text-slate-500 hover:text-slate-300'}`}>
                {tab}
              </button>
            ))}
          </div>

          <button onClick={() => exportToCSV(futureForecast, 'ssa_supply_chain_forecast')} className="px-5 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-[10px] font-bold flex items-center gap-2 hover:bg-slate-700 transition-colors">
            <Download size={14}/> CSV Export
          </button>
        </header>

        {activeTab === 'future' ? (
          <>
            <section className="grid grid-cols-1 lg:grid-cols-4 gap-6">
              <div className="lg:col-span-3 bg-slate-900 border border-slate-800 p-8 rounded-[2.5rem] shadow-2xl relative overflow-hidden">
                <div className="relative z-10 flex flex-col h-full">
                  <div className="flex items-center gap-3 mb-6">
                    <div className="p-3 bg-indigo-500/10 rounded-2xl border border-indigo-500/20"><BrainCircuit size={22} className="text-indigo-400" /></div>
                    <h3 className="text-xl font-black text-white uppercase tracking-widest">Executive Brief</h3>
                  </div>
                  <div className="text-slate-300 text-sm leading-relaxed font-medium italic">
                    {isLoading ? <div className="space-y-3 animate-pulse"><div className="h-4 bg-slate-800 rounded w-full"></div><div className="h-4 bg-slate-800 rounded w-2/3"></div></div> : aiInsight}
                  </div>
                </div>
              </div>
              <div className="bg-slate-900 p-6 rounded-[2rem] border border-slate-800 shadow-xl flex flex-col justify-center gap-4">
                <div className="p-4 bg-slate-950 rounded-2xl border border-slate-800 group hover:border-indigo-500/50 transition-all">
                  <p className="text-[10px] font-black text-slate-500 mb-1 uppercase tracking-widest">Reorder Point</p>
                  <p className="text-3xl font-black text-white group-hover:text-indigo-400 transition-colors">{Math.round(futureForecast[0]?.reorderPoint || 0)}</p>
                </div>
                <div className="p-4 bg-slate-950 rounded-2xl border border-slate-800 group hover:border-emerald-500/50 transition-all">
                  <p className="text-[10px] font-black text-slate-500 mb-1 uppercase tracking-widest">Safety Stock</p>
                  <p className="text-3xl font-black text-white group-hover:text-emerald-400 transition-colors">{Math.round(futureForecast[0]?.safetyStock || 0)}</p>
                </div>
              </div>
            </section>

            <section className="bg-slate-900 p-8 rounded-[3rem] border border-slate-800 shadow-2xl">
              <h2 className="text-3xl font-black text-white tracking-tighter uppercase mb-10 flex items-center gap-4">
                Forecasting Strategy
                <div className="flex gap-4 ml-auto text-[10px] font-black text-slate-500 uppercase tracking-widest">
                  <div className="flex items-center gap-2"><div className="w-3 h-3 bg-indigo-500 rounded-sm" /> Historical</div>
                  <div className="flex items-center gap-2"><div className="w-3 h-3 border-2 border-orange-500 rounded-sm" /> Projection</div>
                </div>
              </h2>
              <div className="h-[500px]">
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={futureForecast} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#1e293b" />
                    <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{fontSize: 10, fill: '#64748b', fontWeight: 700}} />
                    <YAxis axisLine={false} tickLine={false} tick={{fontSize: 10, fill: '#64748b', fontWeight: 700}} />
                    <Tooltip 
                      contentStyle={{backgroundColor: '#0f172a', borderRadius: '16px', border: '1px solid #334155'}}
                      itemStyle={{fontSize: '11px', fontWeight: 'bold'}}
                    />
                    <Area type="monotone" dataKey="historical" name="Historical Truth" stroke="#6366f1" strokeWidth={4} fill="url(#colorHist)" connectNulls />
                    <Area type="monotone" dataKey="upperBound" name="CI Upper" stroke="none" fill="#fb923c" fillOpacity={0.1} />
                    <Area type="monotone" dataKey="lowerBound" name="CI Lower" stroke="none" fill="#fb923c" fillOpacity={0.1} />
                    <Area type="monotone" dataKey="forecast" name="Model Projection" stroke="#fb923c" strokeWidth={2} strokeDasharray="8 8" fill="none" />
                    <Line type="monotone" dataKey="scenarioForecast" name="Scenario Adjusted" stroke="#ef4444" strokeWidth={4} dot={{r: 4, fill: '#ef4444'}} />
                    <defs><linearGradient id="colorHist" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#6366f1" stopOpacity={0.2}/><stop offset="95%" stopColor="#6366f1" stopOpacity={0}/></linearGradient></defs>
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
            </section>
          </>
        ) : activeTab === 'quality' ? (
          <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4">
            <h2 className="text-3xl font-black text-white uppercase tracking-tighter">Analytical Backtesting Audit</h2>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <MetricsCard label="Validation Accuracy" value={backtestResults.metrics?.accuracy.toFixed(1) || '--'} suffix="%" description="Performance against last 6 mo truth" />
              <MetricsCard label="System Bias" value={backtestResults.metrics?.bias.toFixed(1) || '--'} suffix="%" description="Propensity to over/under estimate" />
              <MetricsCard label="Mean Abs Error" value={Math.round(backtestResults.metrics?.mad || 0)} description="Average monthly unit variance" />
              <MetricsCard label="Exposure Risk" value={Math.round(backtestResults.metrics?.holdingCostRisk || 0)} suffix="$" description="Estimated cost of error variance" />
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
                    <Line dataKey="forecast" name="Validation Projection" stroke="#ef4444" strokeWidth={5} dot={{r: 7}} />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
            </section>
          </div>
        ) : activeTab === 'pareto' ? (
          <div className="space-y-8 animate-in fade-in">
            <h2 className="text-3xl font-black text-white uppercase tracking-tighter">ABC Value Stratification</h2>
            <div className="bg-slate-900 rounded-[2.5rem] border border-slate-800 shadow-2xl overflow-hidden">
              <table className="w-full text-left">
                <thead className="bg-slate-950 text-[10px] font-black text-slate-500 uppercase tracking-widest">
                  <tr><th className="px-8 py-6">Portfolio SKU</th><th className="px-8 py-6">Annual Volume</th><th className="px-8 py-6">Impact Share</th><th className="px-8 py-6">Class</th></tr>
                </thead>
                <tbody className="text-sm">
                  {paretoResults.slice(0, 15).map(item => (
                    <tr key={item.sku} className="border-t border-slate-800 hover:bg-slate-800 transition-colors">
                      <td className="px-8 py-6 font-bold">{item.sku}</td>
                      <td className="px-8 py-6 font-mono text-slate-400">{item.totalVolume.toLocaleString()}</td>
                      <td className="px-8 py-6 text-slate-500">{item.share.toFixed(1)}%</td>
                      <td className="px-8 py-6">
                        <span className={`px-4 py-1.5 rounded-full text-[9px] font-black tracking-widest border ${item.grade === 'A' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 'bg-slate-800 text-slate-500 border-slate-700'}`}>{item.grade}-CLASS</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          <div className="space-y-8 animate-in fade-in">
            <h2 className="text-3xl font-black text-white uppercase tracking-tighter">Inventory Burn Curve</h2>
            <section className="bg-slate-900 p-8 rounded-[3rem] border border-slate-800 shadow-2xl">
              <div className="h-[450px]">
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={futureForecast.filter(f => f.isForecast)}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#1e293b" />
                    <XAxis dataKey="date" tick={{fontSize: 10, fill: '#64748b'}} />
                    <YAxis tick={{fontSize: 10, fill: '#64748b'}} />
                    <Tooltip contentStyle={{backgroundColor: '#0f172a', border: '1px solid #334155'}} />
                    <Area type="monotone" dataKey="projectedInventory" name="Stock Balance" stroke="#10b981" fill="url(#colorInv)" strokeWidth={4} />
                    <ReferenceLine y={futureForecast[0]?.safetyStock} stroke="#ef4444" strokeDasharray="5 5" strokeWidth={2} label={{value: 'Safety Floor', fill: '#ef4444', fontSize: 10, fontWeight: 900}} />
                    <defs><linearGradient id="colorInv" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#10b981" stopOpacity={0.2}/><stop offset="95%" stopColor="#10b981" stopOpacity={0}/></linearGradient></defs>
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
            </section>
          </div>
        )}

        <footer className="text-center text-slate-800 text-[10px] font-black uppercase tracking-[0.5em] py-12">
          SSA & COMPANY // Decision Intelligence
        </footer>
      </main>

      <ModelExplanationModal isOpen={isModelModalOpen} onClose={() => setIsModelModalOpen(false)} />
    </div>
  );
};

export default App;
