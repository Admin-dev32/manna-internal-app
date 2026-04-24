import test from 'node:test';
import assert from 'node:assert/strict';

import { buildFinanceReceiptStoragePath, normalizeReceiptFileName, validateReceiptFile } from '../lib/finance/receipt-upload.ts';

test('normalizeReceiptFileName sanitizes and normalizes', () => {
  const normalized = normalizeReceiptFileName('Tícket súper #1!!.PDF');
  assert.equal(normalized, 'ticket-super-1-.pdf');
});

test('buildFinanceReceiptStoragePath uses expense folder and timestamp prefix', () => {
  const path = buildFinanceReceiptStoragePath('expense-123', 'My Ticket.png', 1710000000000);
  assert.equal(path, 'expense-123/1710000000000-my-ticket.png');
});

test('validateReceiptFile accepts pdf and rejects oversized/invalid mime', () => {
  const pdf = new File(['hola'], 'receipt.pdf', { type: 'application/pdf' });
  assert.equal(validateReceiptFile(pdf).ok, true);

  const uppercasePdf = new File(['hola'], 'receipt.PDF', { type: 'application/pdf' });
  assert.equal(validateReceiptFile(uppercasePdf).ok, true);

  const jpg = new File(['hola'], 'photo.jpg', { type: 'image/jpeg' });
  assert.equal(validateReceiptFile(jpg).ok, true);

  const jpeg = new File(['hola'], 'photo.v2.jpeg', { type: 'image/jpeg' });
  assert.equal(validateReceiptFile(jpeg).ok, true);

  const png = new File(['hola'], 'ticket final.png', { type: 'image/png' });
  assert.equal(validateReceiptFile(png).ok, true);

  const webp = new File(['hola'], 'ticket.webp', { type: 'image/webp' });
  assert.equal(validateReceiptFile(webp).ok, true);

  const exe = new File(['hola'], 'malware.exe', { type: 'application/octet-stream' });
  assert.equal(validateReceiptFile(exe).ok, false);

  const noExtension = new File(['hola'], 'receipt', { type: 'application/pdf' });
  assert.equal(validateReceiptFile(noExtension).ok, false);

  const oversized = new File([new Uint8Array(8 * 1024 * 1024 + 1)], 'big.pdf', { type: 'application/pdf' });
  assert.equal(validateReceiptFile(oversized).ok, false);
});
