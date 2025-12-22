
import { DataPoint, ForecastPoint, ForecastMetrics, ForecastMethodology } from '../types';

/**
 * Statistics Helpers
 */
const getStdDev = (values: number[]) => {
  const n = values.length;
  if (n === 0) return 0;
  const mean = values.reduce((a, b) => a + b, 0) / n;
  return Math.sqrt(values.reduce((sq, x) => sq + Math.pow(x - mean, 2), 0) / n);
};

const getZMultiplier = (conf: number) => {
  if (conf >= 99) return 2.576;
  if (conf >= 95) return 1.96;
  if (conf >= 90) return 1.645;
  return 1.28;
};

/**
 * Anomaly Cleaning (Outlier Smoothing)
 * Identifies points outside 2 standard deviations and replaces them with the mean.
 */
export const cleanAnomalies = (data: DataPoint[]): DataPoint[] => {
  const values = data.map(d => d.quantity);
  const mean = values.reduce((a, b) => a + b, 0) / (values.length || 1);
  const std = getStdDev(values);
  
  return data.map(d => {
    const isAnomaly = Math.abs(d.quantity - mean) > 2 * std;
    return isAnomaly ? { ...d, quantity: Math.round(mean) } : d;
  });
};

/**
 * Forecasting Methodologies (Calculated locally)
 */
const runHoltWinters = (values: number[], horizon: number, L: number): number[] => {
  const alpha = 0.3, beta = 0.1, gamma = 0.2;
  let level = values[0];
  let trend = values[1] - values[0];
  const seasonal = new Array(L).fill(1);
  for (let i = 0; i < Math.min(values.length, L); i++) seasonal[i] = values[i] / (level || 1);
  for (let i = 0; i < values.length; i++) {
    const value = values[i];
    const prevLevel = level;
    level = alpha * (value / (seasonal[i % L] || 1)) + (1 - alpha) * (level + trend);
    trend = beta * (level - prevLevel) + (1 - beta) * trend;
    seasonal[i % L] = gamma * (value / (level || 1)) + (1 - gamma) * seasonal[i % L];
  }
  const forecast = [];
  for (let i = 1; i <= horizon; i++) forecast.push(Math.max(0, (level + i * trend) * seasonal[(values.length + i - 1) % L]));
  return forecast;
};

const runLinear = (values: number[], horizon: number): number[] => {
  const n = values.length;
  let sumX = 0, sumY = 0, sumXY = 0, sumXX = 0;
  for (let i = 0; i < n; i++) { sumX += i; sumY += values[i]; sumXY += i * values[i]; sumXX += i * i; }
  const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
  const intercept = (sumY - slope * sumX) / n;
  const forecast = [];
  for (let i = 1; i <= horizon; i++) forecast.push(Math.max(0, slope * (n + i - 1) + intercept));
  return forecast;
};

/**
 * Main Calculation Entry Point
 */
export const calculateForecast = (
  historicalData: DataPoint[],
  horizon: number,
  interval: 'daily' | 'weekly' | 'monthly' = 'monthly',
  confidenceLevel: number = 95,
  method: ForecastMethodology = ForecastMethodology.HOLT_WINTERS
): ForecastPoint[] => {
  if (historicalData.length < 3) return [];
  const values = historicalData.map(d => d.quantity);
  const n = values.length;
  const L = interval === 'monthly' ? 12 : interval === 'weekly' ? 52 : 30;

  let forecastValues: number[];
  switch (method) {
    case ForecastMethodology.LINEAR: forecastValues = runLinear(values, horizon); break;
    case ForecastMethodology.ARIMA: 
    case ForecastMethodology.PROPHET: 
    case ForecastMethodology.HOLT_WINTERS:
    default: forecastValues = runHoltWinters(values, horizon, L); break;
  }

  const results: ForecastPoint[] = historicalData.map(d => ({
    date: d.date, historical: d.quantity, forecast: d.quantity, isForecast: false
  }));

  const multiplier = getZMultiplier(confidenceLevel);
  const stdDev = getStdDev(values);
  const lastDate = new Date(historicalData[n - 1].date);

  forecastValues.forEach((val, i) => {
    const step = i + 1;
    const forecastDate = new Date(lastDate);
    if (interval === 'monthly') forecastDate.setMonth(lastDate.getMonth() + step);
    else forecastDate.setDate(lastDate.getDate() + step * (interval === 'weekly' ? 7 : 1));

    const uncertainty = multiplier * stdDev * Math.sqrt(step) * 0.5;
    results.push({
      date: forecastDate.toISOString().split('T')[0],
      forecast: Math.round(val),
      lowerBound: Math.max(0, Math.round(val - uncertainty)),
      upperBound: Math.round(val + uncertainty),
      isForecast: true
    });
  });

  return results;
};

export const calculateMetrics = (
  actual: number[], 
  forecast: number[], 
  unitCost: number = 50, 
  sellingPrice: number = 100
): ForecastMetrics => {
  let sumError = 0, sumAbsError = 0, sumSqError = 0, sumPercError = 0, sumActual = 0;
  let stockoutUnits = 0, overstockUnits = 0;
  
  const n = Math.min(actual.length, forecast.length);
  if (n === 0) return { mape: 0, rmse: 0, bias: 0, mad: 0, accuracy: 0, holdingCostRisk: 0, stockoutRevenueRisk: 0 };

  for (let i = 0; i < n; i++) {
    const error = forecast[i] - actual[i];
    sumError += error;
    sumAbsError += Math.abs(error);
    sumSqError += error * error;
    if (actual[i] !== 0) sumPercError += Math.abs(error / actual[i]);
    sumActual += actual[i];
    
    if (error < 0) stockoutUnits += Math.abs(error);
    else overstockUnits += error;
  }

  const mape = (sumPercError / n) * 100;
  const holdingRate = 0.02; // Monthly holding cost rate (2%)

  return {
    mape,
    rmse: Math.sqrt(sumSqError / n),
    bias: sumActual !== 0 ? (sumError / sumActual) * 100 : 0,
    mad: sumAbsError / n,
    accuracy: Math.max(0, 100 - mape),
    holdingCostRisk: overstockUnits * unitCost * holdingRate,
    stockoutRevenueRisk: stockoutUnits * (sellingPrice - unitCost)
  };
};
