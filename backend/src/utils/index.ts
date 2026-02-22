export const parseNumeric = (value: any): number | null => {
  if (value === null || value === undefined || value === '') return null;
  const parsed = parseFloat(value);
  return isNaN(parsed) ? null : parsed;
};

export const parseBoolean = (value: any): boolean | null => {
  if (value === null || value === undefined || value === '') return null;
  if (typeof value === 'boolean') return value;
  const str = String(value).toLowerCase();
  return str === 'yes' || str === 'true' || str === '1' ? true : str === 'no' || str === 'false' || str === '0' ? false : null;
};
