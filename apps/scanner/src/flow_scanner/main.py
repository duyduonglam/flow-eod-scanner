from __future__ import annotations
from dataclasses import asdict
from flow_scanner.domain.models import OHLCVRecord
from flow_scanner.indicators.relative_strength import relative_performance, percentile_rs
from flow_scanner.indicators.mcdx import latest_mcdx
from flow_scanner.indicators.volume import volume_buzz, ud_volume_ratio
from flow_scanner.indicators.swing import swing_direction
from flow_scanner.flow.composite_score import compute_composite_score
from flow_scanner.flow.trend_template import compute_trend_template
from flow_scanner.flow.entry_engine import build_trade_plan
from flow_scanner.flow.ranking import rank_candidates


def _signal_summary(flow_label: str, rs_rating: int | None, banker: float | None, swing: str | None, buzz: float | None, components: dict[str, float] | None = None) -> str:
    parts = [flow_label]
    if components:
        parts.append(
            f"FLOW {components.get('structure', 0):.0f}"
            f"/MCDX {components.get('mcdx', 0):.0f}"
            f"/VOL {components.get('volume', 0):.0f}"
            f"/ENTRY {components.get('swing_entry', 0):.0f}"
        )
    if rs_rating is not None:
        parts.append(f'RS {rs_rating}')
    if banker is not None:
        parts.append(f'Banker {banker:.0f}%')
    if swing:
        parts.append(f'Swing {swing}')
    if buzz is not None:
        parts.append(f'VolBuzz {buzz:+.0f}%')
    return ' Â· '.join(parts)


def scan_universe(histories: dict[str, list[OHLCVRecord]], index_history: list[OHLCVRecord]) -> list[dict]:
    index_closes = [r.close for r in index_history]
    relative_scores = {
        symbol: relative_performance([r.close for r in rows], index_closes)
        for symbol, rows in histories.items()
    }
    rs_ratings = percentile_rs(relative_scores)

    results: list[dict] = []
    for symbol, rows in histories.items():
        if not rows:
            continue
        closes = [r.close for r in rows]
        highs = [r.high for r in rows]
        lows = [r.low for r in rows]
        volumes = [r.volume for r in rows]
        values = [r.close * 1000 * r.volume for r in rows]
        rs = rs_ratings.get(symbol)
        mcdx = latest_mcdx(closes)
        flow = compute_trend_template(closes, highs, lows, rs, mcdx.banker)
        if flow is None:
            results.append({
                'symbol': symbol,
                'market_date': rows[-1].market_date.isoformat(),
                'close': rows[-1].close,
                'flow_score': None,
                'flow_label': 'N/A',
                'main_signal': 'Insufficient history',
                'decision': 'WATCH',
                'invalidation': 'Insufficient validated history',
                'data_status': 'PRE_SCREEN',
            })
            continue

        swing = swing_direction(highs, lows)
        buzz = volume_buzz(volumes)
        ud = ud_volume_ratio(closes, volumes)
        plan = build_trade_plan(highs, lows, closes, flow.score_pct, swing)
        composite = compute_composite_score(
            closes=closes,
            highs=highs,
            lows=lows,
            volumes=volumes,
            trend=flow,
            mcdx=mcdx,
            rs_rating=rs,
            swing=swing,
            plan=plan,
        )
        plan = build_trade_plan(highs, lows, closes, composite.total_score, swing)
        levels = plan.levels
        results.append({
            'symbol': symbol,
            'market_date': rows[-1].market_date.isoformat(),
            'close': rows[-1].close,
            'current_value': values[-1],
            'avg_value_20': sum(values[-20:]) / min(len(values), 20),
            'flow_score': composite.total_score,
            'score_version': composite.score_version,
            'score_components': {
                'flow': composite.components.get('structure', 0),
                'mcdx': composite.components.get('mcdx', 0),
                'volume': composite.components.get('volume', 0),
                'rs': composite.components.get('rs', 0),
                'swing_entry': composite.components.get('swing_entry', 0),
            },
            'flow_label': composite.label,
            'pass_count': flow.pass_count,
            'total_count': flow.total_count,
            'rs_rating': rs,
            'banker': mcdx.banker,
            'banker_ma': mcdx.banker_ma,
            'hot_money': mcdx.hot_money,
            'hot_money_ma': mcdx.hot_money_ma,
            'retailer': mcdx.retailer,
            'retailer_ma': mcdx.retailer_ma,
            'swing_direction': swing,
            'volume_buzz': buzz,
            'ud_volume_ratio': ud,
            'main_signal': _signal_summary(composite.label, rs, mcdx.banker, swing, buzz, composite.components),
            'entry_low': plan.entry_low,
            'entry_high': plan.entry_high,
            'stop_price': plan.stop,
            'stop_distance_pct': levels.stop_distance_pct if levels else None,
            'one_r': levels.one_r if levels else None,
            'two_r': levels.two_r if levels else None,
            'three_r': levels.three_r if levels else None,
            'decision': plan.decision,
            'invalidation': plan.invalidation,
            'chase_risk': plan.chase_risk,
            'data_status': 'VALID',
        })
    return rank_candidates(results)

