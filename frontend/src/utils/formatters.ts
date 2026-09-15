export const formatNumber = (value: number, decimals: number = 2): string => {
  return value.toLocaleString('th-TH', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
};
