export function identifyDiscountIdType(text) {
  const normalized = String(text || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .replace(/[^A-Z0-9 ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  const seniorCitizen = /\bSENIOR\s+CITIZEN\b|\bOSCA\b|\bRA\s*9994\b|\bREPUBLIC\s+ACT\s+9994\b/.test(normalized);
  const pwd = /\bPWD\b|\bPERSONS?\s+WITH\s+DISABILIT(?:Y|IES)\b|\bNCDA\b|\bRA\s*(?:7277|10754)\b|\bREPUBLIC\s+ACT\s+(?:7277|10754)\b/.test(normalized);

  if (seniorCitizen && pwd) return 'ambiguous';
  if (seniorCitizen) return 'senior_citizen';
  if (pwd) return 'pwd';
  return null;
}