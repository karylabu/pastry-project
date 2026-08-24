const normalizeHeader = (value = '') => String(value || '').trim().toLowerCase().replace(/[^a-z0-9]+/g, '');

const normalizeNumber = (value) => {
  if (value === null || value === undefined || value === '') return 0;
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  const cleaned = String(value).replace(/[^0-9.-]/g, '');
  const parsed = Number(cleaned);
  return Number.isFinite(parsed) ? parsed : 0;
};

const parseCsvRow = (line) => {
  const values = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      values.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }

  values.push(current.trim());
  return values;
};

const parseCsvText = (text) => {
  const rows = [];
  const lines = text.replace(/\r\n/g, '\n').split('\n');
  const parsedLines = [];

  lines.forEach((line) => {
    if (line.trim()) {
      parsedLines.push(parseCsvRow(line));
    }
  });

  if (parsedLines.length === 0) {
    return [];
  }

  const [headerRow, ...dataRows] = parsedLines;
  const headers = headerRow.map((header) => normalizeHeader(header));

  return dataRows
    .filter((row) => row.some((cell) => cell && String(cell).trim()))
    .map((row) => {
      const rowObject = {};
      headers.forEach((header, index) => {
        rowObject[header] = row[index] || '';
      });
      return rowObject;
    });
};

export const parseCsvSalesFile = (file) => {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const rows = parseCsvText(reader.result || '');
        const items = rows
          .map((row) => {
            const itemName =
              row.itemname ||
              row.productname ||
              row.product ||
              row.item ||
              row.name ||
              '';
            const quantityValue =
              row.quantity ||
              row.qty ||
              row.units ||
              row.count ||
              0;
            const priceValue =
              row.price ||
              row.unitprice ||
              row.unit_price ||
              row.cost ||
              row.amountperunit ||
              0;
            const totalValue =
              row.totalamount ||
              row.total ||
              row.amount ||
              row.linetotal ||
              '';

            const quantity = normalizeNumber(quantityValue);
            const price = normalizeNumber(priceValue);
            const totalAmount = normalizeNumber(totalValue || (quantity * price));

            if (!itemName || quantity <= 0) {
              return null;
            }

            return {
              name: String(itemName).trim(),
              quantity,
              price,
              totalAmount: totalAmount > 0 ? totalAmount : quantity * price,
            };
          })
          .filter(Boolean);

        resolve({
          items,
          totalRevenue: items.reduce((sum, item) => sum + Number(item.totalAmount || 0), 0),
          totalQuantity: items.reduce((sum, item) => sum + Number(item.quantity || 0), 0),
          warnings: items.length === 0 ? ['No valid rows found in the CSV file.'] : [],
        });
      } catch (error) {
        resolve({
          items: [],
          totalRevenue: 0,
          totalQuantity: 0,
          warnings: [error.message || 'Unable to parse the CSV file.'],
        });
      }
    };

    reader.onerror = () => {
      resolve({
        items: [],
        totalRevenue: 0,
        totalQuantity: 0,
        warnings: ['The file could not be read.'],
      });
    };

    reader.readAsText(file);
  });
};

export const createCsvTemplate = () => {
  const header = ['item_name', 'quantity', 'price', 'total_amount'];
  const rows = [
    ['Chocolate Cake', '2', '350', '700'],
    ['Cheese Ensaymada', '10', '25', '250'],
  ];
  const csv = [header, ...rows].map((row) => row.join(',')).join('\n');
  return csv;
};

export const downloadCsvTemplate = () => {
  const csv = createCsvTemplate();
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = 'sales-import-template.csv';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  window.URL.revokeObjectURL(url);
};

export const formatCurrency = (amount) => `₱${Number(amount || 0).toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
