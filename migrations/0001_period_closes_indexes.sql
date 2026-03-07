-- Enforce one close-status row per owner/account/month and speed common lookups.
CREATE UNIQUE INDEX IF NOT EXISTS period_closes_owner_account_period_uidx
  ON period_closes (owner_user_id, bank_account_id, period_month);

CREATE INDEX IF NOT EXISTS period_closes_owner_account_status_idx
  ON period_closes (owner_user_id, bank_account_id, status);
