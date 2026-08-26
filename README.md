# JOFFREY’S BAKERY JEDDAH — Bakery Inventory Management System

Production inventory application backed by the existing Supabase PostgreSQL database. Supabase is the permanent source of truth; no demo inventory is bundled.

## Operational modules
- Dashboard with live warehouse/Jeddah Shops KPIs, period filters, stock health and operational trends
- ERP-style stock positions with zero-stock visibility, filters, sorting, pagination, CSV/XLS export and print
- Read-only movement ledger with running balance and transaction references
- Atomic multi-line receiving with expiry/batch capture and duplicate-post protection
- Atomic Bakery Warehouse → active branch transfers with server-side stock validation and FEFO batch movement
- Controlled physical-count / delta adjustments
- Waste posting with FEFO batch consumption and server-side unit cost
- Expiry/FEFO reporting
- Daily/monthly management reports
- Real product and supplier masters

## Inventory integrity
Inventory-changing browser actions call authenticated PostgreSQL RPC wrappers. The wrappers derive the current application user server-side, use idempotency posting keys, and delegate to the atomic stock transaction engine. Current stock, movement ledger and inventory batches are reconciled in Supabase.

The physical database location `Warehouse` is displayed in the UI as **Bakery Warehouse**. **Jeddah Shops** is a reporting aggregate of active non-Warehouse destinations and is not stored as a physical location.

## Security
The frontend contains only the Supabase publishable key. Never add a Supabase service-role key to browser code or GitHub. Row-level security remains enabled in Supabase. Production mutation access is intended to go through the hardened `post_*` RPCs.

## Deployment
Static web application deployed on Vercel. Before release, validate JavaScript syntax, database reconciliation and rollback-only posting tests.
