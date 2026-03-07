-- Add reversible-delete markers for accounting records.
ALTER TABLE transactions
  ADD COLUMN IF NOT EXISTS deleted_at timestamp;

ALTER TABLE receipts
  ADD COLUMN IF NOT EXISTS deleted_at timestamp;
