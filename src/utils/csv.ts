/**
 * CSV export.
 *
 * CSV, not .xlsx: Excel opens CSV natively, so a spreadsheet library would be a megabyte of
 * dependency for a format the user already has.
 *
 * The BOM is load-bearing. Without it Excel guesses the encoding, and every Arabic category
 * name in the file arrives as mojibake. It is written as an escape rather than a literal —
 * an invisible character in source is a trap for the next person to read this file.
 */
const BOM = '﻿';

export function downloadCsv(filename: string, rows: string[][]): void {
  const escape = (cell: string) => (/[",\n]/.test(cell) ? `"${cell.replace(/"/g, '""')}"` : cell);
  const csv = rows.map((row) => row.map(escape).join(',')).join('\n');

  const blob = new Blob([BOM + csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}
