
import React, { useState, useMemo, useEffect, useRef } from 'react';
import { 
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, 
  Area, ComposedChart, Bar, Line, ReferenceLine, Legend, LineChart, BarChart, Cell
} from 'recharts';
import { 
  TrendingUp, Download, BrainCircuit, 
  FileText, Activity, Layers,
  Globe, Package, Truck, Database, 
  Zap, Trash2, HelpCircle, Search, Check, X, ChevronDown, 
  Eye, EyeOff, Plus, AlertTriangle, Settings2, Cpu,
  Calendar, MessageSquare, Play, BarChart3, ShieldCheck, History, UserCircle
} from 'lucide-react';
import { SKUS, SAMPLE_DATA, SAMPLE_ATTRIBUTES, SAMPLE_INVENTORY, DEFAULT_HORIZON } from './constants';
import { DataPoint, FilterState, TimeInterval, ForecastMethodology, ProductAttribute, InventoryLevel, Scenario, AiProvider, AudienceType } from './types';
import { calculateForecast, calculateMetrics, cleanAnomalies } from './utils/forecasting';
import { calculateSupplyChainMetrics, runParetoAnalysis } from './utils/supplyChain';
import { exportToCSV } from './utils/export';
import { getIndustryInsights, getMarketTrendAdjustment, MarketAdjustment, getNarrativeSummary } from './services/aiService';
import MetricsCard from './components/MetricsCard';
import ChatAgent from './components/ChatAgent';

const ShockModal: React.FC<{ 
  isOpen: boolean; 
  onClose: () => void; 
  onSave: (s: Scenario) => void;
  forecastMonths: string[];
}> = ({ isOpen, onClose, onSave, forecastMonths }) => {
  const [name, setName] = useState('Marketing Promotion');
  const [monthIndex, setMonthIndex] = useState(0);
  const [multiplier, setMultiplier] = useState(1.2);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[300] flex items-center justify-center p-4 bg-slate-950/90 backdrop-blur-md animate-in fade-in duration-300">
      <div className="bg-slate-900 border border-slate-700 w-full max-w-md rounded-[2rem] shadow-2xl overflow-hidden flex flex-col">
        <div className="p-6 border-b border-slate-800 flex justify-between items-center bg-slate-900/50">
          <div>
            <h2 className="text-xl font-black text-white tracking-tight uppercase text-indigo-400">Define Strategic Shock</h2>
            <p className="text-[9px] text-slate-500 font-bold uppercase tracking-widest mt-1">Modeling Impact on Demand Curve</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-800 rounded-full text-slate-400"><X size={20} /></button>
        </div>
        <div className="p-6 space-y-5">
          <div className="space-y-2">
            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Shock Name</label>
            <input className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs text-white outline-none focus:ring-1 focus:ring-indigo-500" value={name} onChange={e => setName(e.target.value)} />
          </div>
          <div className="space-y-2">
            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Target Timeframe</label>
            <select className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs text-white outline-none appearance-none cursor-pointer" value={monthIndex} onChange={e => setMonthIndex(Number(e.target.value))}>
              <option value={0} disabled>Select Month...</option>
              {forecastMonths.map((m, i) => (
                <option key={m} value={i + 1}>{new Date(m).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}</option>
              ))}
            </select>
          </div>
          <div className="space-y-4 pt-2">
            <div className="flex justify-between items-end">
              <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Demand Multiplier</label>
              <span className={`text-xl font-black ${multiplier > 1 ? 'text-indigo-400' : 'text-orange-400'}`}>{multiplier.toFixed(2)}x</span>
            </div>
            <input type="range" min="0.1" max="3" step="0.05" className="w-full accent-indigo-500 h-1 bg-slate-800 rounded-lg appearance-none cursor-pointer" value={multiplier} onChange={e => setMultiplier(Number(e.target.value))} />
          </div>
        </div>
        <div className="p-6 bg-slate-950/50 flex gap-3">
          <button onClick={onClose} className="flex-1 py-3 text-[10px] font-black uppercase tracking-widest text-slate-400 hover:text-white transition-colors">Cancel</button>
          <button disabled={monthIndex === 0} onClick={() => { onSave({ id: Date.now().toString(), name, month: monthIndex, multiplier }); onClose(); }} className="flex-1 py-3 bg-indigo-600 rounded-xl text-[10px] font-black uppercase tracking-widest text-white shadow-lg shadow-indigo-500/20 hover:bg-indigo-500 transition-all">Apply Shock</button>
        </div>
      </div>
    </div>
  );
};

const SearchableMultiSelect: React.FC<{
  options: string[];
  selected: string[];
  onChange: (selected: string[]) => void;
}> = ({ options, selected, onChange }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => { if (containerRef.current && !containerRef.current.contains(e.target as Node)) setIsOpen(false); };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);
  const filtered = options.filter(opt => opt.toLowerCase().includes(search.toLowerCase()));
  return (
    <div className="relative w-full" ref={containerRef}>
      <button onClick={() => setIsOpen(!isOpen)} className="w-full flex items-center justify-between p-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs font-bold text-slate-200 hover:border-indigo-500 transition-all">
        <span className="truncate">{selected.length === options.length ? 'All Portfolio SKUs' : `${selected.length} Items Selected`}</span>
        <ChevronDown size={14} />
      </button>
      {isOpen && (
        <div className="absolute top-full left-0 right-0 mt-2 bg-slate-900 border border-slate-700 rounded-xl shadow-2xl z-[100] p-2 animate-in slide-in-from-top-2 duration-200">
          <input className="w-full bg-slate-950 border border-slate-800 rounded-lg py-1.5 px-3 text-[11px] text-white outline-none mb-2 focus:ring-1 focus:ring-indigo-500" placeholder="Search SKU..." value={search} onChange={e => setSearch(e.target.value)} />
          <div className="max-h-40 overflow-y-auto space-y-1">
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
  // --- Data State ---
  const [data, setData] = useState<DataPoint[]>(SAMPLE_DATA);
  const [attributes, setAttributes] = useState<ProductAttribute[]>(SAMPLE_ATTRIBUTES);
  const [inventory, setInventory] = useState<InventoryLevel[]>(SAMPLE_INVENTORY);
  const [scenarios, setScenarios] = useState<Scenario[]>([]);

  // --- UI/Draft State ---
  const [draftIndustryPrompt, setDraftIndustryPrompt] = useState('Consumer electronics distributor in the US West coast');
  const [draftHorizon, setDraftHorizon] = useState(DEFAULT_HORIZON);
  const [draftAudience, setDraftAudience] = useState<AudienceType>(AudienceType.EXECUTIVE);
  
  const [filters, setFilters] = useState<FilterState>({
    startDate: '2021-01-01', endDate: '2024-05-01', skus: SKUS, category: 'All',
    confidenceLevel: 95, methodology: ForecastMethodology.HOLT_WINTERS,
    includeExternalTrends: false, globalLeadTime: 30, globalServiceLevel: 0.95,
    applyAnomalyCleaning: false, showLeadTimeOffset: false, aiProvider: AiProvider.GEMINI
  });
  const [showConfidenceBand, setShowConfidenceBand] = useState(true);

  // --- Committed Engine State ---
  const [committedSettings, setCommittedSettings] = useState({
    filters: { ...filters },
    horizon: draftHorizon,
    industryPrompt: draftIndustryPrompt,
    audience: draftAudience,
    triggerToken: 0
  });

  // --- Computed State ---
  const [activeTab, setActiveTab] = useState<'future' | 'quality' | 'inventory' | 'pareto'>('future');
  const [aiInsight, setAiInsight] = useState('Ready for analysis...');
  const [narrativeText, setNarrativeText] = useState('Run engine to generate business narrative.');
  const [isLoading, setIsLoading] = useState(false);
  const [marketAdj, setMarketAdj] = useState<MarketAdjustment | null>(null);
  const [isShockModalOpen, setIsShockModalOpen] = useState(false);
  const [comparativeData, setComparativeData] = useState<any[]>([]);

  const histUploadRef = useRef<HTMLInputElement>(null);
  const attrUploadRef = useRef<HTMLInputElement>(null);
  const invUploadRef = useRef<HTMLInputElement>(null);

  // Core Engine Run
  const handleRunAnalysis = () => {
    setCommittedSettings({
      filters: { ...filters },
      horizon: draftHorizon,
      industryPrompt: draftIndustryPrompt,
      audience: draftAudience,
      triggerToken: Date.now()
    });
  };

  // 1. Data Processing (Uses Committed Settings)
  const processedData = useMemo(() => {
    let d = committedSettings.filters.applyAnomalyCleaning ? cleanAnomalies(data) : data;
    return d.filter(item => {
      const itemDate = new Date(item.date).getTime();
      const start = new Date(committedSettings.filters.startDate).getTime();
      const end = new Date(committedSettings.filters.endDate).getTime();
      return itemDate >= start && itemDate <= end && committedSettings.filters.skus.includes(item.sku);
    }).sort((a, b) => a.date.localeCompare(b.date));
  }, [data, committedSettings]);

  const aggregatedData = useMemo(() => {
    const map = new Map<string, number>();
    processedData.forEach(d => map.set(d.date, (map.get(d.date) || 0) + d.quantity));
    return Array.from(map.entries()).map(([date, quantity]) => ({ date, quantity, sku: 'ALL', category: 'ALL' } as DataPoint)).sort((a, b) => a.date.localeCompare(b.date));
  }, [processedData]);

  const stats = useMemo(() => {
    const values = aggregatedData.map(d => d.quantity);
    const avg = values.length > 0 ? values.reduce((a, b) => a + b, 0) / values.length : 0;
    const std = values.length > 0 ? Math.sqrt(values.reduce((sq, x) => sq + Math.pow(x - avg, 2), 0) / values.length) : 0;
    return { avg, std };
  }, [aggregatedData]);

  const futureForecast = useMemo(() => {
    if (aggregatedData.length === 0) return [];
    let raw = calculateForecast(aggregatedData, committedSettings.horizon, 'monthly', committedSettings.filters.confidenceLevel, committedSettings.filters.methodology);
    if (committedSettings.filters.includeExternalTrends && marketAdj) {
      raw = raw.map(p => p.isForecast ? { ...p, forecast: Math.round(p.forecast * marketAdj.multiplier) } : p);
    }
    const currentInv = inventory.filter(i => committedSettings.filters.skus.includes(i.sku)).reduce((s, i) => s + i.onHand, 0);
    return calculateSupplyChainMetrics(raw, stats.std, committedSettings.filters.globalLeadTime, committedSettings.filters.globalServiceLevel, currentInv, scenarios, committedSettings.filters.showLeadTimeOffset);
  }, [aggregatedData, committedSettings, marketAdj, stats.std, inventory, scenarios]);

  const forecastStats = useMemo(() => {
    const values = futureForecast.filter(f => f.isForecast).map(f => f.forecast);
    const avg = values.length > 0 ? values.reduce((a, b) => a + b, 0) / values.length : 0;
    return { avg, months: futureForecast.filter(f => f.isForecast).map(f => f.date) };
  }, [futureForecast]);

  const backtestResults = useMemo(() => {
    if (aggregatedData.length <= 8) return { comparisonData: [], metrics: null };
    const splitIndex = aggregatedData.length - 6;
    const trainData = aggregatedData.slice(0, splitIndex);
    const actualTestData = aggregatedData.slice(splitIndex);
    const rawForecast = calculateForecast(trainData, 6, 'monthly', committedSettings.filters.confidenceLevel, committedSettings.filters.methodology);
    const predictedPoints = rawForecast.filter(f => f.isForecast).map((f, i) => ({
      ...f, actual: actualTestData[i]?.quantity || 0,
    }));
    return { comparisonData: predictedPoints, metrics: calculateMetrics(actualTestData.map(d => d.quantity), predictedPoints.map(p => p.forecast), 50, 100) };
  }, [aggregatedData, committedSettings]);

  const paretoResults = useMemo(() => {
    const skuMap = new Map<string, number>();
    data.forEach(d => skuMap.set(d.sku, (skuMap.get(d.sku) || 0) + d.quantity));
    return runParetoAnalysis(Array.from(skuMap.entries()).map(([sku, totalVolume]) => ({ sku, totalVolume })));
  }, [data]);

  // Summarize dashboard state into a small context string for the Chat Agent
  const dashboardContext = useMemo(() => {
    const activeSkus = committedSettings.filters.skus.join(', ');
    const forecastSummary = `Next ${committedSettings.horizon}mo avg: ${Math.round(forecastStats.avg)}. Current historical avg: ${Math.round(stats.avg)}.`;
    const inventorySummary = `On Hand: ${inventory.filter(i => committedSettings.filters.skus.includes(i.sku)).reduce((s, i) => s + i.onHand, 0)}. Lead Time: ${committedSettings.filters.globalLeadTime}d.`;
    const topClassA = paretoResults.filter(p => p.grade === 'A').slice(0, 3).map(p => p.sku).join(', ');
    const quality = backtestResults.metrics ? `Forecast Accuracy: ${backtestResults.metrics.accuracy.toFixed(1)}%.` : '';
    
    return `Dashboard State: Business: "${committedSettings.industryPrompt}". SKUs: ${activeSkus}. ${forecastSummary} ${inventorySummary} Top Items: ${topClassA}. ${quality}`;
  }, [committedSettings, stats, forecastStats, inventory, paretoResults, backtestResults]);

  // Comparative Logic: Run all models side-by-side
  useEffect(() => {
    if (aggregatedData.length === 0 || committedSettings.triggerToken === 0) return;
    const methodologies = Object.values(ForecastMethodology);
    const multiForecasts = methodologies.map(m => ({
      method: m, points: calculateForecast(aggregatedData, committedSettings.horizon, 'monthly', 95, m).filter(f => f.isForecast)
    }));
    const comparison = multiForecasts[0].points.map((p, i) => {
      const entry: any = { date: p.date };
      multiForecasts.forEach(mf => { entry[mf.method] = Math.round(mf.points[i].forecast); });
      return entry;
    });
    setComparativeData(comparison);
  }, [aggregatedData, committedSettings]);

  // AI Synchronization
  useEffect(() => {
    if (committedSettings.triggerToken === 0) return;
    const runAI = async () => {
      setIsLoading(true);
      const [insights, narrative] = await Promise.all([
        getIndustryInsights(committedSettings.filters.aiProvider, committedSettings.industryPrompt, `Avg: ${Math.round(stats.avg)}. StdDev: ${Math.round(stats.std)}.`),
        getNarrativeSummary(
          committedSettings.filters.aiProvider, 
          committedSettings.industryPrompt, 
          stats.avg, 
          forecastStats.avg, 
          committedSettings.horizon, 
          committedSettings.audience,
          committedSettings.filters.skus
        )
      ]);
      setAiInsight(insights);
      setNarrativeText(narrative);
      if (committedSettings.filters.includeExternalTrends) setMarketAdj(await getMarketTrendAdjustment(committedSettings.filters.aiProvider, committedSettings.industryPrompt));
      setIsLoading(false);
    };
    runAI();
  }, [committedSettings.triggerToken]);

  const handleFileUpload = (type: 'hist' | 'attr' | 'inv', e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      const lines = text.split('\n');
      if (type === 'hist') {
        const newData = lines.slice(1).filter(l => l.includes(',')).map(line => {
          const p = line.split(','); return { date: p[0].trim(), sku: p[1].trim(), category: p[2].trim(), quantity: parseInt(p[3].trim()) || 0 };
        });
        if (newData.length > 0) setData(newData);
      }
    };
    reader.readAsText(file);
  };

  const isEngineInitialized = committedSettings.triggerToken > 0;

  return (
    <div className="min-h-screen flex flex-col lg:flex-row bg-slate-950 font-sans text-slate-100 overflow-hidden">
      {/* Sidebar */}
      <aside className="w-full lg:w-80 bg-slate-900 border-r border-slate-800 p-5 flex flex-col gap-4 h-screen overflow-y-auto no-scrollbar z-30 shadow-2xl shrink-0">
        <div className="mb-1">
          <svg viewBox="0 0 300 50" className="w-full h-auto text-[#1e40af]" xmlns="http://www.w3.org/2000/svg">
            <text x="50" y="35" font-family="Montserrat, sans-serif" font-weight="800" font-size="28" fill="currentColor">SSA & COMPANY</text>
            <path d="M5 5 H15 V15 M5 45 H15 V35 M15 15 L35 35" fill="none" stroke="currentColor" stroke-width="3" />
          </svg>
          <div className="flex items-center gap-2 mt-2 text-[8px] font-black uppercase tracking-[0.2em] text-slate-500">
            <Zap size={10} className="text-indigo-400" /> Demand Planning Module
          </div>
        </div>

        <section className="space-y-2">
          <h3 className="text-[9px] font-bold text-slate-500 uppercase tracking-widest flex items-center gap-2">
            <Database size={10} className="text-slate-500"/> Data Console
          </h3>
          <div className="grid grid-cols-3 gap-1.5">
            <button onClick={() => histUploadRef.current?.click()} className="p-2 bg-slate-950 border border-slate-800 rounded-lg text-slate-400 hover:border-indigo-500 transition-all flex flex-col items-center gap-1 group">
              <FileText size={12} className="text-indigo-400 group-hover:scale-110 transition-transform"/><span className="text-[7px] font-black uppercase">Sales</span>
            </button>
            <button onClick={() => attrUploadRef.current?.click()} className="p-2 bg-slate-950 border border-slate-800 rounded-lg text-slate-400 hover:border-emerald-500 transition-all flex flex-col items-center gap-1 group">
              <Truck size={12} className="text-emerald-400 group-hover:scale-110 transition-transform"/><span className="text-[7px] font-black uppercase">Parts</span>
            </button>
            <button onClick={() => invUploadRef.current?.click()} className="p-2 bg-slate-950 border border-slate-800 rounded-lg text-slate-400 hover:border-orange-500 transition-all flex flex-col items-center gap-1 group">
              <Package size={12} className="text-orange-400 group-hover:scale-110 transition-transform"/><span className="text-[7px] font-black uppercase">Stock</span>
            </button>
          </div>
          <input type="file" ref={histUploadRef} className="hidden" onChange={e => handleFileUpload('hist', e)} />
          <input type="file" ref={attrUploadRef} className="hidden" onChange={e => handleFileUpload('attr', e)} />
          <input type="file" ref={invUploadRef} className="hidden" onChange={e => handleFileUpload('inv', e)} />
        </section>

        <section className="space-y-2 pt-2 border-t border-slate-800">
          <h3 className="text-[9px] font-bold text-slate-500 uppercase tracking-widest flex items-center gap-2">
            <Calendar size={10} className="text-slate-500"/> Forecast Scope
          </h3>
          <div className="space-y-1.5 p-2.5 bg-slate-950 rounded-xl border border-slate-800">
            <div className="flex justify-between text-[8px] font-black text-slate-500 uppercase tracking-widest">
              <span>Time Horizon</span>
              <span className="text-indigo-400">{draftHorizon} Months</span>
            </div>
            <input type="range" min="1" max="24" className="w-full accent-indigo-500 h-1 bg-slate-800 rounded-lg appearance-none cursor-pointer" value={draftHorizon} onChange={e => setDraftHorizon(Number(e.target.value))} />
            <div className="pt-2">
              <label className="text-[8px] font-black text-slate-500 uppercase tracking-widest mb-1 block">Forecasting Model</label>
              <select className="w-full p-1.5 bg-slate-900 border border-slate-800 rounded text-[10px] font-bold text-slate-200 outline-none" value={filters.methodology} onChange={e => setFilters(f => ({...f, methodology: e.target.value as ForecastMethodology}))}>
                {Object.values(ForecastMethodology).map(m => <option key={m} value={m}>{m}</option>)}
              </select>
            </div>
          </div>
        </section>

        <section className="space-y-2 pt-2 border-t border-slate-800">
          <h3 className="text-[9px] font-bold text-slate-500 uppercase tracking-widest flex items-center gap-2">
            <UserCircle size={10} className="text-slate-500"/> Narrative Audience
          </h3>
          <div className="space-y-1.5">
            <select 
              className="w-full p-2 bg-slate-950 border border-slate-800 rounded-lg text-[10px] font-bold text-slate-200 outline-none hover:border-indigo-500 transition-all" 
              value={draftAudience} onChange={e => setDraftAudience(e.target.value as AudienceType)}
            >
              {Object.values(AudienceType).map(a => <option key={a} value={a}>{a}</option>)}
            </select>
          </div>
        </section>

        <section className="space-y-2 pt-2 border-t border-slate-800">
          <h3 className="text-[9px] font-bold text-slate-500 uppercase tracking-widest flex items-center gap-2">
            <Settings2 size={10} className="text-slate-500"/> Statistical Rigor
          </h3>
          <div className="grid grid-cols-2 gap-2">
            <div className="p-2 bg-slate-950 rounded-lg border border-slate-800 flex flex-col justify-between">
              <span className="text-[8px] font-black text-slate-500 uppercase">Confidence</span>
              <div className="flex items-center justify-between mt-1">
                <span className="text-[11px] font-black text-indigo-400">{filters.confidenceLevel}%</span>
                <button onClick={() => setShowConfidenceBand(!showConfidenceBand)} className={`p-1 rounded ${showConfidenceBand ? 'text-indigo-400 bg-indigo-500/10' : 'text-slate-700'}`}><Eye size={10}/></button>
              </div>
            </div>
            <div className="p-2 bg-slate-950 rounded-lg border border-slate-800">
               <span className="text-[8px] font-black text-slate-500 uppercase block mb-1">Threshold</span>
               <input type="range" min="80" max="99" step="1" className="w-full accent-indigo-500 h-1 bg-slate-800 rounded-lg appearance-none cursor-pointer" value={filters.confidenceLevel} onChange={e => setFilters(f => ({...f, confidenceLevel: Number(e.target.value)}))} />
            </div>
          </div>
        </section>

        {/* Shocks Compact */}
        <div className="pt-2 border-t border-slate-800">
          <div className="flex justify-between items-center mb-1.5 px-1">
            <h3 className="text-[9px] font-bold text-slate-500 uppercase flex items-center gap-1.5"><TrendingUp size={10}/> Shocks</h3>
            <button onClick={() => setIsShockModalOpen(true)} className="p-1 bg-indigo-600/10 text-indigo-400 rounded hover:bg-indigo-600/30 transition-all"><Plus size={10}/></button>
          </div>
          <div className="flex flex-nowrap overflow-x-auto gap-2 no-scrollbar pb-1">
            {scenarios.map(s => (
              <div key={s.id} className="shrink-0 w-24 p-1.5 bg-slate-950 border border-slate-800 rounded flex items-center justify-between">
                <span className="text-[7px] font-bold text-slate-400 truncate pr-1">{s.name}</span>
                <button onClick={() => setScenarios(p => p.filter(sc => sc.id !== s.id))} className="text-slate-600 hover:text-red-400"><X size={8}/></button>
              </div>
            ))}
          </div>
        </div>

        <section className="space-y-2 pt-2 border-t border-slate-800">
          <h3 className="text-[9px] font-bold text-slate-500 uppercase tracking-widest flex items-center gap-2">
            <Cpu size={10} className="text-slate-500"/> Intelligence Node
          </h3>
          <div className="space-y-2">
            <select className="w-full p-2 bg-slate-950 border border-slate-800 rounded-lg text-[10px] font-bold text-slate-200 outline-none" value={filters.aiProvider} onChange={e => setFilters(f => ({...f, aiProvider: e.target.value as AiProvider}))}>
              {Object.values(AiProvider).map(p => <option key={p} value={p}>{p}</option>)}
            </select>
            <textarea className="w-full h-12 p-2 text-[9px] border border-slate-800 rounded-lg bg-slate-950 text-slate-300 outline-none resize-none focus:border-indigo-500 transition-colors" placeholder="Industry context..." value={draftIndustryPrompt} onChange={e => setDraftIndustryPrompt(e.target.value)} />
            <div className="flex items-center justify-between px-2 py-1.5 bg-indigo-500/5 rounded-lg border border-indigo-500/10">
              <span className="text-[7px] font-black text-indigo-400 uppercase tracking-widest">Grounding Search</span>
              <input type="checkbox" checked={filters.includeExternalTrends} onChange={() => setFilters(f => ({...f, includeExternalTrends: !f.includeExternalTrends}))} className="accent-indigo-500 w-3 h-3 cursor-pointer" />
            </div>
          </div>
        </section>

        <div className="mt-auto pt-3 border-t border-slate-800">
          <button onClick={handleRunAnalysis} disabled={isLoading} className={`w-full py-3.5 rounded-2xl flex items-center justify-center gap-3 transition-all active:scale-95 shadow-2xl shadow-indigo-600/10 ${isLoading ? 'bg-slate-800 text-slate-500 cursor-not-allowed' : 'bg-indigo-600 hover:bg-indigo-500 text-white font-black text-[11px] uppercase tracking-[0.15em]'}`}>
            {isLoading ? <><div className="w-3 h-3 border-2 border-indigo-400 border-t-transparent rounded-full animate-spin"/> Syncing Engine...</> : <><Play size={14} fill="white" /> Run Analysis</>}
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto p-4 lg:p-6 space-y-6 bg-slate-950 no-scrollbar relative">
        <header className="bg-slate-900 p-4 rounded-3xl border border-slate-800 flex flex-col md:flex-row items-center justify-between gap-4 shadow-xl">
          <div className="w-full md:w-80"><SearchableMultiSelect options={SKUS} selected={filters.skus} onChange={skus => setFilters(f => ({...f, skus}))} /></div>
          <div className="flex bg-slate-950 p-1 rounded-2xl border border-slate-800">
            {['future', 'inventory', 'quality', 'pareto'].map(tab => (
              <button key={tab} onClick={() => setActiveTab(tab as any)} className={`px-5 py-2 text-[9px] font-black uppercase tracking-widest rounded-xl transition-all ${activeTab === tab ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-500 hover:text-slate-300'}`}>
                {tab}
              </button>
            ))}
          </div>
          <button onClick={() => exportToCSV(futureForecast, 'demand_planning_report')} className="px-5 py-2 bg-slate-800 border border-slate-700 rounded-xl text-[9px] font-black uppercase tracking-widest flex items-center gap-2 hover:bg-slate-700 transition-colors"><Download size={14}/> Export</button>
        </header>

        {!isEngineInitialized ? (
          <div className="flex flex-col items-center justify-center py-32 bg-slate-900/50 border-2 border-slate-800 border-dashed rounded-[3rem]">
            <div className="p-5 bg-indigo-500/10 rounded-full mb-6 border border-indigo-500/20 animate-pulse"><Cpu className="text-indigo-400" size={40}/></div>
            <h2 className="text-xl font-black text-white uppercase tracking-tight mb-2">Engine Not Initialized</h2>
            <p className="text-slate-500 text-xs font-bold uppercase tracking-widest">Adjust settings in the sidebar and click <span className="text-indigo-400">'Run Analysis'</span> to calculate projections.</p>
          </div>
        ) : (
          <div className="animate-in fade-in slide-in-from-bottom-4 duration-700">
            {activeTab === 'future' && (
              <div className="space-y-6">
                <section className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <div className="bg-slate-900 border border-slate-800 p-6 rounded-[2rem] shadow-2xl relative overflow-hidden group min-h-[160px] flex flex-col">
                    <div className="flex items-center gap-3 mb-4 shrink-0">
                      <div className="p-2.5 bg-indigo-500/10 rounded-xl border border-indigo-500/20"><BrainCircuit size={18} className="text-indigo-400" /></div>
                      <h3 className="text-sm font-black text-white uppercase tracking-widest">Strategic Intelligence</h3>
                    </div>
                    <div className="text-slate-300 text-[11px] leading-relaxed font-medium overflow-y-auto pr-2 custom-scrollbar flex-1 max-h-[100px]">
                      {isLoading ? "Analyzing industry vectors..." : aiInsight}
                      {!isLoading && marketAdj && marketAdj.sources && marketAdj.sources.length > 0 && (
                        <div className="mt-4 pt-3 border-t border-slate-800">
                          <p className="text-[8px] font-black text-slate-500 uppercase tracking-widest mb-2 flex items-center gap-1.5"><Globe size={10}/> Research Sources</p>
                          <div className="flex flex-wrap gap-2">
                            {marketAdj.sources.map((s, i) => (
                              <a key={i} href={s.uri} target="_blank" rel="noopener noreferrer" className="text-[8px] font-bold text-indigo-400 hover:text-indigo-300 transition-colors flex items-center gap-1 bg-indigo-500/5 px-2 py-1 rounded border border-indigo-500/10">
                                {s.title.length > 25 ? s.title.substring(0, 25) + '...' : s.title} <Globe size={8}/>
                              </a>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="bg-slate-900 border border-slate-800 p-6 rounded-[2rem] shadow-2xl relative overflow-hidden group min-h-[160px] flex flex-col">
                    <div className="flex items-center justify-between mb-4 shrink-0">
                      <div className="flex items-center gap-3">
                        <div className="p-2.5 bg-emerald-500/10 rounded-xl border border-emerald-500/20"><MessageSquare size={18} className="text-emerald-400" /></div>
                        <h3 className="text-sm font-black text-white uppercase tracking-widest">Planning Narrative</h3>
                      </div>
                      <span className="text-[8px] font-black bg-emerald-500/10 text-emerald-400 px-2 py-1 rounded-md border border-emerald-500/20 uppercase tracking-widest">{committedSettings.audience}</span>
                    </div>
                    <div className="text-slate-300 text-[11px] leading-relaxed font-medium italic overflow-y-auto pr-2 custom-scrollbar flex-1 max-h-[100px]">
                      {isLoading ? "Synthesizing business outlook..." : narrativeText}
                    </div>
                  </div>
                </section>
                {/* Forecast Chart Content */}
                <section className="bg-slate-900 p-6 rounded-[2.5rem] border border-slate-800 shadow-2xl">
                  <div className="flex items-center justify-between mb-8">
                    <div><h2 className="text-lg font-black text-white uppercase tracking-tighter">Primary Projection</h2><p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mt-1">Model: {committedSettings.filters.methodology}</p></div>
                  </div>
                  <div className="h-[350px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <ComposedChart data={futureForecast} margin={{ left: -10, right: 10, top: 20 }}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#1e293b" /><XAxis dataKey="date" axisLine={false} tickLine={false} tick={{fontSize: 9, fill: '#64748b', fontWeight: 700}} /><YAxis axisLine={false} tickLine={false} tick={{fontSize: 9, fill: '#64748b', fontWeight: 700}} /><Tooltip contentStyle={{backgroundColor: '#0f172a', borderRadius: '12px', border: '1px solid #334155'}} />
                        <Area type="monotone" dataKey="historical" stroke="#6366f1" strokeWidth={3} fillOpacity={0.1} fill="#6366f1" connectNulls />
                        {showConfidenceBand && <><Area type="monotone" dataKey="upperBound" stroke="none" fill="#fb923c" fillOpacity={0.08} /><Area type="monotone" dataKey="lowerBound" stroke="none" fill="#fb923c" fillOpacity={0.08} /></>}
                        <Area type="monotone" dataKey="forecast" stroke="#fb923c" strokeWidth={2} strokeDasharray="5 5" fill="none" />
                        <Line type="monotone" dataKey="scenarioForecast" stroke="#ef4444" strokeWidth={3} dot={{r: 4, fill: '#ef4444', strokeWidth: 2, stroke: '#020617'}} />
                      </ComposedChart>
                    </ResponsiveContainer>
                  </div>
                </section>
              </div>
            )}
            {activeTab === 'inventory' && (
              <div className="space-y-6">
                <section className="grid grid-cols-1 md:grid-cols-3 gap-6">
                   <MetricsCard label="On Hand" value={inventory.filter(i => committedSettings.filters.skus.includes(i.sku)).reduce((s, i) => s + i.onHand, 0)} description="Aggregated live stock across selected SKUs" />
                   <MetricsCard label="Reorder Point" value={Math.round(futureForecast[0]?.reorderPoint || 0)} description="Trigger level for procurement replenishment" />
                   <MetricsCard label="Safety Stock" value={Math.round(futureForecast[0]?.safetyStock || 0)} description="Statistical buffer against demand variance" />
                </section>
                <section className="bg-slate-900 p-8 rounded-[3rem] border border-slate-800 shadow-2xl h-[400px]">
                   <ResponsiveContainer width="100%" height="100%">
                      <ComposedChart data={futureForecast.filter(f => f.isForecast)}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#1e293b" /><XAxis dataKey="date" axisLine={false} tickLine={false} tick={{fontSize: 9, fill: '#64748b', fontWeight: 700}} /><YAxis axisLine={false} tickLine={false} tick={{fontSize: 9, fill: '#64748b', fontWeight: 700}} /><Tooltip contentStyle={{backgroundColor: '#0f172a', borderRadius: '12px', border: '1px solid #334155'}} />
                        <Area type="monotone" dataKey="projectedInventory" stroke="#10b981" strokeWidth={3} fillOpacity={0.1} fill="#10b981" />
                      </ComposedChart>
                    </ResponsiveContainer>
                </section>
              </div>
            )}
            {activeTab === 'quality' && (
              <div className="space-y-6">
                <section className="grid grid-cols-1 md:grid-cols-3 gap-6">
                   <MetricsCard label="Forecast Accuracy" value={backtestResults.metrics?.accuracy.toFixed(1) || 0} suffix="%" description="100% - MAPE" />
                   <MetricsCard label="Model Bias" value={backtestResults.metrics?.bias.toFixed(2) || 0} suffix="%" description="Over/Under Bias" />
                   <MetricsCard label="RMSE" value={Math.round(backtestResults.metrics?.rmse || 0)} description="Root Mean Square Error" />
                </section>
              </div>
            )}
            {activeTab === 'pareto' && (
               <div className="space-y-6">
                 <section className="bg-slate-900 p-8 rounded-[3rem] border border-slate-800 shadow-2xl h-[400px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={paretoResults.slice(0, 15)}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#1e293b" /><XAxis dataKey="sku" axisLine={false} tickLine={false} tick={{fontSize: 8, fill: '#64748b', fontWeight: 700}} /><YAxis axisLine={false} tickLine={false} tick={{fontSize: 9, fill: '#64748b', fontWeight: 700}} /><Tooltip contentStyle={{backgroundColor: '#0f172a', borderRadius: '12px', border: '1px solid #334155'}} />
                        <Bar dataKey="totalVolume" name="Historical Vol.">
                          {paretoResults.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.grade === 'A' ? '#10b981' : entry.grade === 'B' ? '#f59e0b' : '#ef4444'} fillOpacity={0.8} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                 </section>
               </div>
            )}
          </div>
        )}
        
        {/* Chat Agent Integration */}
        <ChatAgent 
          provider={filters.aiProvider} 
          audience={committedSettings.audience} 
          context={dashboardContext}
        />
      </main>

      <ShockModal isOpen={isShockModalOpen} onClose={() => setIsShockModalOpen(false)} onSave={s => setScenarios(p => [...p, s])} forecastMonths={forecastStats.months} />
    </div>
  );
};

export default App;
