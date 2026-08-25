# FLOW EOD Scanner

End-of-day Vietnam equity scanner based on the user's FLOW System and MCDX/volume logic.

## Layout
- `apps/scanner`: deterministic Python calculation engine
- `apps/web`: Next.js dashboard
- `supabase/migrations`: PostgreSQL schema
- `.github/workflows`: EOD automation

## Principle
Market data and deterministic calculations are authoritative. AI commentary may explain results but cannot invent or override numeric signals.
