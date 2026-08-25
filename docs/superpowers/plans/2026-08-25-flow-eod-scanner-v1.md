# FLOW EOD Scanner V1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build an EOD scanner and dashboard that reproduces the V1 FLOW/MCDX baseline on validated Vietnam market data.

**Architecture:** Python owns deterministic market calculations and ranking. Supabase/PostgreSQL stores data and scans. Next.js renders table-first results. AI commentary is optional and non-authoritative.

**Tech Stack:** Python 3.11+, pandas/numpy optional, pytest, PostgreSQL/Supabase, Next.js/TypeScript, GitHub Actions, Vercel, Gemini API.

**Spec:** `docs/superpowers/specs/2026-08-25-flow-eod-scanner-v1-design.md`

## Global Constraints
- Accuracy before UI polish.
- Never fabricate missing numerical signals.
- DATA_CONFLICT prevents deterministic trade-plan output.
- V1 is EOD only.
- AI does not calculate deterministic market signals.

## Milestones
1. Repository, schema, domain models, provider interfaces, validation.
2. Exact deterministic indicators: SMA, Wilder RSI, MCDX, volume, RS, Trend Template.
3. Conservative entry/risk/ranking and scanner orchestration.
4. Next.js dashboard and API shell.
5. EOD automation and reference-symbol validation harness.
