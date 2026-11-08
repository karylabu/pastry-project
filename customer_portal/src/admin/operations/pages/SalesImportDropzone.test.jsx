import React from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { buildCsvTemplate, describeCleaningReport, getCsvTemplateSampleDates } from './SalesImportDropzone';
import SalesImportDropzone from './SalesImportDropzone';

jest.mock('../../../services/config', () => ({
  LARAVEL_BASE: 'https://example.test/laravel',
}));

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

describe('compact sales report import', () => {
  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  test('shows the import and download buttons together in one row', () => {
    render(<SalesImportDropzone compact onDownloadCsvReport={jest.fn()} onDownloadPdfReport={jest.fn()} />);

    expect(screen.getByRole('button', { name: 'Import Sales Report' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Import Customized Cake Sales' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Import Finished Product Sales' })).not.toBeInTheDocument();
    expect(screen.getByText(/reports are cleaned automatically/i)).toBeInTheDocument();
    expect(screen.queryByLabelText('CSV overlap handling')).not.toBeInTheDocument();
    const importButton = screen.getByRole('button', { name: 'Import Sales Report' });
    const csvButton = screen.getByRole('button', { name: 'Download CSV Report' });
    const pdfButton = screen.getByRole('button', { name: 'Download PDF Report' });
    expect(importButton.parentElement).toHaveClass('grid-cols-3');
    expect(csvButton.parentElement).toBe(importButton.parentElement);
    expect(pdfButton.parentElement).toBe(importButton.parentElement);
  });

  test('notifies the reports page as soon as a CSV is queued so it can be cancelled', async () => {
    jest.useFakeTimers();
    const onImportQueued = jest.fn();
    global.fetch = jest.fn()
      .mockResolvedValueOnce({
        ok: true,
        status: 202,
        json: async () => ({ success: true, import_id: 42, status: 'queued' }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, import: { id: 42, status: 'cancellation_requested' } }),
      });

    const { container } = render(<SalesImportDropzone compact onImportQueued={onImportQueued} />);
    const file = new File(['sale_date,item_name,quantity,price\n2026-11-08,Cake,1,500'], 'sales.csv', { type: 'text/csv' });

    await act(async () => {
      fireEvent.change(container.querySelector('input[type="file"]'), { target: { files: [file] } });
      await Promise.resolve();
      await Promise.resolve();
    });

    await waitFor(() => expect(onImportQueued).toHaveBeenCalledWith({
      source: 'csv',
      importId: 42,
      status: 'queued',
      salesType: 'other',
    }));

    await act(async () => {
      jest.advanceTimersByTime(1000);
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(await screen.findByText(/Cancellation requested for sales\.csv/i)).toBeInTheDocument();
  });
});
