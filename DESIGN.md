---
version: alpha
colors:
  primary: "#185ea8"
  ink: "#071527"
  paper: "#f3f6fa"
  panel: "#ffffff"
  signal: "#0f8f5f"
  caution: "#b96a13"
  info: "#185ea8"
  danger: "#bf2f24"
typography:
  display:
    fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif"
  body:
    fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif"
  data:
    fontFamily: "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace"
rounded:
  sm: "6px"
  md: "8px"
  lg: "12px"
spacing:
  xs: "6px"
  sm: "10px"
  md: "14px"
  lg: "20px"
components:
  button:
    rounded: "8px"
  card:
    rounded: "8px"
  table:
    rounded: "8px"
---

## Overview

FLOW EOD Scanner is a product dashboard for end-of-day Vietnam equity review. It should feel like a calm trading desk after market close: dense, numerical, trustworthy, and quick to scan. The interface is product-first, not marketing-first.

The memorable signature is the dark command header with a small live-market strip, contrasted with bright paper-like data surfaces. Visual drama belongs in the framing; the table, search, news, and manual scan controls stay restrained.

## Colors

Runtime CSS variables in `apps/web/src/app/globals.css` are the canonical implementation. This file mirrors the accepted values and intent.

Use `ink` for the command header and primary text, `paper` for the application background, `panel` for data surfaces, `signal` for constructive/buy states, `caution` for test/trim states, `info` for watch/navigation links, and `danger` for no-chase/exit risk.

## Typography

Use Inter/system sans for UI text and tabular numeric settings for market values. Data cells should feel precise, not decorative. Avoid oversized hero type inside cards; reserve larger type for the product name and top-level metrics.

## Layout

The dashboard is table-first. The top area gives status and controls, the middle area owns historical selection and results, and the lower area contains review notes, quick assessments, exclusions, and verified news.

Tables may scroll horizontally on narrow screens because row comparison matters. The ticker column stays visible to preserve row identity.

## Elevation & Depth

Use subtle borders and low shadows only to separate operational surfaces. Avoid nested card stacks and decorative backgrounds.

## Shapes

Use 8px radius for cards, controls, and table shells. Pills are reserved for status badges only.

## Components

Buttons use semantic color: dark for primary search/action framing, green for positive scan dispatch, amber/red only when the action or result carries that meaning. Search and secret fields must have clear focus states, stable sizing, and accessible labels.

## Do's and Don'ts

Do keep the screen dense enough for daily review. Do make the latest date, data source, manual scan status, and verified news obvious. Do not make the dashboard look like a generic SaaS landing page. Do not use decorative gradients or oversized empty cards that push the table down.
