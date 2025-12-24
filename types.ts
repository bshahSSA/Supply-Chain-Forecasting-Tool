
export interface DataPoint {
  date: string;
  sku: string;
  category: string;
  quantity: number;
}

export interface ProductAttribute {
  sku: string;
  leadTimeDays: number;
  unitCost: number;
  sellingPrice: number;
  serviceLevel: number; // e.g. 0.95
}

export interface InventoryLevel {
  sku: string;
  onHand: number;
  lastUpdated: string;
}

export interface ForecastPoint {
  date: string;
  historical?: number;
  forecast: number;
  lowerBound?: number;
  upperBound?: number;
  isForecast: boolean;
  projectedInventory?: number;
  safetyStock?: number;
  reorderPoint?: number;
  scenarioForecast?: number;
  offsetDate?: string;
}

export interface ForecastMetrics {
  mape: number;
  rmse: number;
  bias: number;
  mad: number;
  accuracy: number;
  holdingCostRisk: number;
  stockoutRevenueRisk: number;
}

export enum TimeInterval {
  MONTHLY = 'monthly'
}

export enum ForecastMethodology {
  HOLT_WINTERS = 'Holt-Winters (Triple Exponential)',
  PROPHET = 'Prophet-Inspired (Additive)',
  ARIMA = 'ARIMA (Auto-Regressive)',
  LINEAR = 'Linear Regression'
}

export enum AiProvider {
  GEMINI = 'Gemini 2.5 Flash',
  OPENAI = 'GPT-4o',
  CLAUDE = 'Claude 3.5 Sonnet'
}

export enum AudienceType {
  PLANT_MANAGER = 'Plant Manager',
  DEMAND_PLANNER = 'Demand Planner',
  SALES = 'Sales Representative',
  EXECUTIVE = 'Executive Leadership'
}

export interface Scenario {
  id: string;
  name: string;
  month: number;
  multiplier: number;
}

export interface FilterState {
  startDate: string;
  endDate: string;
  skus: string[];
  category: string;
  confidenceLevel: number;
  methodology: ForecastMethodology;
  includeExternalTrends: boolean;
  globalLeadTime: number;
  globalServiceLevel: number;
  applyAnomalyCleaning: boolean;
  showLeadTimeOffset: boolean;
  aiProvider: AiProvider;
}
