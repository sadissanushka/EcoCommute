-- Migration: 202610190900__wallet__add_vehicles_registry_and_txn_balance_trigger.sql
-- Schema: wallet
-- Description: Vehicles registry and deferred constraint trigger for transaction balancing

-- >>> UP >>>
CREATE SCHEMA IF NOT EXISTS wallet;

-- Step 1.2: Vehicles registry for commuters and drivers
CREATE TABLE IF NOT EXISTS wallet.vehicles_registry (
  id BIGSERIAL PRIMARY KEY,
  owner_user_id BIGINT NOT NULL,
  vehicle_type_id INT NOT NULL REFERENCES wallet.vehicle_types(id) ON DELETE RESTRICT,
  reg_no TEXT NOT NULL UNIQUE,
  km_per_litre_override FLOAT CHECK (km_per_litre_override > 0),
  seats INT NOT NULL DEFAULT 4 CHECK (seats >= 1),
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_vehicles_owner ON wallet.vehicles_registry(owner_user_id);

-- Step 1.4: Constraint trigger (deferred) ensuring that all entries sharing a txn_id balance (sum debits = sum credits)
CREATE OR REPLACE FUNCTION wallet.check_transaction_balance() RETURNS trigger AS $$
DECLARE
  v_credit_sum BIGINT;
  v_debit_sum BIGINT;
BEGIN
  SELECT
    COALESCE(SUM(CASE WHEN direction = 'CREDIT' THEN amount_minor ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN direction = 'DEBIT' THEN amount_minor ELSE 0 END), 0)
  INTO v_credit_sum, v_debit_sum
  FROM wallet.ledger_entries
  WHERE txn_id = NEW.txn_id;

  IF v_credit_sum <> v_debit_sum THEN
    RAISE EXCEPTION 'Unbalanced transaction %: credits (%) != debits (%)', NEW.txn_id, v_credit_sum, v_debit_sum;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_check_txn_balance ON wallet.ledger_entries;
CREATE CONSTRAINT TRIGGER trg_check_txn_balance
  AFTER INSERT ON wallet.ledger_entries
  DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW
  EXECUTE FUNCTION wallet.check_transaction_balance();

-- >>> DOWN >>>
DROP TRIGGER IF EXISTS trg_check_txn_balance ON wallet.ledger_entries;
DROP FUNCTION IF EXISTS wallet.check_transaction_balance();
DROP TABLE IF EXISTS wallet.vehicles_registry CASCADE;
