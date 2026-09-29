-- ============================================================
-- 023_default_currency_kes
--
-- WhatsWise is used by Kenyan businesses, so the default deal
-- currency becomes KES (Kenyan Shilling) instead of USD.
--
-- - New accounts default to KES (`accounts.default_currency`).
-- - Deals inserted without an explicit currency default to KES
--   (`deals.currency`). The app always sends the account currency,
--   so this only matters for raw SQL inserts.
-- - Existing accounts still on the old USD default move to KES.
--   An account that really wants USD can switch back under
--   Settings → Deals. Existing deals keep their saved currency, so
--   no stored value changes meaning.
--
-- The app-side fallback lives in `src/lib/currency.ts`
-- (DEFAULT_CURRENCY) and must stay in sync with this default.
-- ============================================================

ALTER TABLE accounts
  ALTER COLUMN default_currency SET DEFAULT 'KES';

ALTER TABLE deals
  ALTER COLUMN currency SET DEFAULT 'KES';

UPDATE accounts
  SET default_currency = 'KES'
  WHERE default_currency = 'USD';
