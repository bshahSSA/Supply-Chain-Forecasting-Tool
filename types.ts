
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
  offsetDate?: string; // For Lead-Time Offset view
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
  DAILY = 'daily',
  WEEKLY = 'weekly',
  MONTHLY = 'monthly'
}

export enum ForecastMethodology {
  HOLT_WINTERS = 'Holt-Winters (Triple Exponential)',
  PROPHET = 'Prophet-Inspired (Additive)',
  ARIMA = 'ARIMA (Auto-Regressive)',
  LINEAR = 'Linear Regression',
  NAIVE = 'Naive (Seasonal Moving Average)'
}

export interface Scenario {
  id: string;
  name: string;
  month: number; // 1-12 relative to horizon start
  multiplier: number; // e.g. 1.2 for +20%
}

export interface FilterState {
  startDate: string;
  endDate: string;
  skus: string[]; // Changed from sku: string
  category: string;
  confidenceLevel: number;
  methodology: ForecastMethodology;
  includeExternalTrends: boolean;
  globalLeadTime: number;
  globalServiceLevel: number;
  applyAnomalyCleaning: boolean;
  showLeadTimeOffset: boolean;
}
