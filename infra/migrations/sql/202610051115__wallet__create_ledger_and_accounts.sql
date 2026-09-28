-- Migration: 202610051115__wallet__create_ledger_and_accounts.sql
-- Schema: wallet
-- Description: Double-entry style append-only wallet ledger and account balance view

-- >>> UP >>>
CREATE SCHEMA IF NOT EXISTS wallet;

CREATE TABLE IF NOT EXISTS wallet.accounts (
  id BIGSERIAL PRIMARY KEY,
  owner_type TEXT NOT NULL CHECK (owner_type IN ('user', 'company', 'system')),
  owner_id BIGINT NOT NULL,
  currency CHAR(3) NOT NULL DEFAULT 'LKR',
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(owner_type, owner_id, currency)
);
CREATE INDEX IF NOT EXISTS idx_wallet_accounts_owner ON wallet.accounts(owner_type, owner_id);

CREATE TABLE IF NOT EXISTS wallet.ledger_entries (
  id BIGSERIAL PRIMARY KEY,
  txn_id UUID NOT NULL,
  account_id BIGINT NOT NULL REFERENCES wallet.accounts(id) ON DELETE RESTRICT,
  trip_id BIGINT,
  user_id BIGINT,
  amount_minor BIGINT NOT NULL CHECK (amount_minor > 0),
  direction TEXT NOT NULL CHECK (direction IN ('CREDIT', 'DEBIT')),
  reason TEXT NOT NULL CHECK (reason IN ('trip_share', 'fuel_reimbursement', 'topup', 'adjustment')),
  idempotency_key TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_ledger_account ON wallet.ledger_entries(account_id);
CREATE INDEX IF NOT EXISTS idx_ledger_txn ON wallet.ledger_entries(txn_id);

-- Enforce append-only semantics via database trigger
CREATE OR REPLACE FUNCTION wallet.forbid_mutation() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'wallet.ledger_entries is append-only: updates and deletes are strictly forbidden.';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_no_update ON wallet.ledger_entries;
CREATE TRIGGER trg_no_update
  BEFORE UPDATE OR DELETE ON wallet.ledger_entries
  FOR EACH ROW EXECUTE FUNCTION wallet.forbid_mutation();

-- Account balances calculated view
CREATE OR REPLACE VIEW wallet.account_balances AS
SELECT
  a.id AS account_id,
  a.owner_type,
  a.owner_id,
  a.currency,
  COALESCE(SUM(CASE WHEN l.direction = 'CREDIT' THEN l.amount_minor ELSE -l.amount_minor END), 0) AS balance_minor,
  COUNT(l.id) AS entry_count,
  MAX(l.created_at) AS last_activity_at
FROM wallet.accounts a
LEFT JOIN wallet.ledger_entries l ON l.account_id = a.id
GROUP BY a.id, a.owner_type, a.owner_id, a.currency;

-- >>> DOWN >>>
DROP VIEW IF EXISTS wallet.account_balances;
DROP TRIGGER IF EXISTS trg_no_update ON wallet.ledger_entries;
DROP FUNCTION IF EXISTS wallet.forbid_mutation();
DROP TABLE IF EXISTS wallet.ledger_entries CASCADE;
DROP TABLE IF EXISTS wallet.accounts CASCADE;
