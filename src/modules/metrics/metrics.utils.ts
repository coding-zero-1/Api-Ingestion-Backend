// Pure metric calculation functions

export const calculateAverageLatency = (responseTimes: number[]): number => {
  if (responseTimes.length === 0) return 0;
  const sum = responseTimes.reduce((acc, t) => acc + t, 0);
  return sum / responseTimes.length;
};

export const calculateP95 = (responseTimes: number[]): number => {
  if (responseTimes.length === 0) return 0;
  const sorted = [...responseTimes].sort((a, b) => a - b);
  const index = Math.ceil(sorted.length * 0.95) - 1;
  return sorted[Math.max(0, index)] ?? 0;
};

export const calculateErrorRate = (statusCodes: number[]): number => {
  if (statusCodes.length === 0) return 0;
  const errors = statusCodes.filter((code) => code >= 400).length;
  return (errors / statusCodes.length) * 100;
};

export const calculateThroughput = (
  timestamps: Date[],
  windowSeconds: number = 60
): number => {
  if (timestamps.length === 0) return 0;
  const now = Date.now();
  const windowStart = now - windowSeconds * 1000;
  const inWindow = timestamps.filter((t) => t.getTime() >= windowStart).length;
  return inWindow / windowSeconds;
};

export const calculateMean = (values: number[]): number => {
  if (values.length === 0) return 0;
  return values.reduce((acc, v) => acc + v, 0) / values.length;
};

export const calculateStdDev = (values: number[]): number => {
  if (values.length === 0) return 0;
  const mean = calculateMean(values);
  const squaredDiffs = values.map((v) => Math.pow(v - mean, 2));
  const variance = calculateMean(squaredDiffs);
  return Math.sqrt(variance);
};
