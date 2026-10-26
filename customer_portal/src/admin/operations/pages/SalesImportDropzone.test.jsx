import { buildCsvTemplate, describeCleaningReport, getCsvTemplateSampleDates } from './SalesImportDropzone';

describe('CSV import template date samples', () => {
  const now = new Date(2026, 9, 16, 12);

  test('uses dates inside the selected day, week, month, or all-time interval', () => {
    expect(getCsvTemplateSampleDates('today', '', '', now)).toEqual([
      '2026-10-16',
      '2026-10-16',
    ]);
    expect(getCsvTemplateSampleDates('week', '', '', now)).toEqual([
      '2026-10-12',
      '2026-10-14',
    ]);
    expect(getCsvTemplateSampleDates('month', '', '', now)).toEqual([
      '2026-10-01',
      '2026-10-15',
    ]);
    expect(getCsvTemplateSampleDates('all', '', '', now)).toEqual([
      '2026-10-15',
      '2026-10-16',
    ]);
  });

  test('uses the selected custom date range for template rows', () => {
    expect(getCsvTemplateSampleDates('month', '2026-09-02', '2026-09-18', now)).toEqual([
      '2026-09-02',
      '2026-09-18',
    ]);
  });

  test('puts the selected interval dates in the downloadable CSV rows', () => {
    expect(buildCsvTemplate('week', '', '', now)).toBe([
      'sale_date,item_name,size,quantity,price,total_amount',
      '2026-10-12,Chocolate Cake,8 inch,2,850,1700',
      '2026-10-14,Vanilla Cake,6 inch,1,650,650',
    ].join('\n'));
  });

  test('summarizes cleaned, skipped, duplicate, and warning rows for the admin', () => {
    expect(describeCleaningReport({
      rows_cleaned: 2,
      rows_skipped: 1,
      rows_with_warnings: 2,
      possible_duplicates: 1,
      total_mismatches: 1,
      quantity_inferred: 0,
      aliases_mapped: 1,
      warnings: [{ row: 4, message: 'Sale date is blank.' }],
    })).toContain('row 4: Sale date is blank.');
  });
});
