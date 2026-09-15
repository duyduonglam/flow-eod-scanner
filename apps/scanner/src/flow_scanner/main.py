from __future__ import annotations
from flow_scanner.domain.models import OHLCVRecord
from flow_scanner.indicators.relative_strength import relative_performance, percentile_rs
from flow_scanner.indicators.mcdx import latest_mcdx, compute_mcdx
from flow_scanner.indicators.volume import volume_buzz, ud_volume_ratio
from flow_scanner.indicators.swing import swing_direction
from flow_scanner.flow.trend_template import compute_trend_template
from flow_scanner.flow.supplemental import compute_supplemental_strength, flow_strength_score, grade_for_score
from flow_scanner.flow.entry_engine import build_trade_plan
from flow_scanner.flow.ranking import rank_candidates


def _signal_summary(
    grade: str,
    core_pass: int,
    supplemental: float,
    rs_rating: int | None,
    banker: float | None,
    swing: str | None,
    buzz: float | None,
    supplemental_result,
) -> str:
    parts = [f'{grade} · Core {core_pass}/11 · Supp {supplemental:.0f}']
    if rs_rating is not None:
        parts.append(f'RS {rs_rating}')
    if banker is not None:
        parts.append(f'Banker {banker:.0f}%')
    if supplemental_result.rs_new_high:
        parts.append('RS NH')
    if supplemental_result.hv1:
        parts.append('HV1')
    elif supplemental_result.hve:
        parts.append('HVE')
    if supplemental_result.vcp:
        parts.append('VCP')
    if swing:
        parts.append(f'Swing {swing}')
    if buzz is not None:
        parts.append(f'VolBuzz {buzz:+.0f}%')
    if supplemental_result.penalty:
        parts.append(f'Penalty -{supplemental_result.penalty:.0f}')
    return ' · '.join(parts)


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
        rs = rs_ratings.get(symbol)
        mcdx_series = compute_mcdx(closes)
        mcdx = latest_mcdx(closes)
        core = compute_trend_template(closes, highs, lows, rs, mcdx.banker)
        if core is None:
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
        supplemental = compute_supplemental_strength(
            closes,
            highs,
            lows,
            volumes,
            index_closes,
            mcdx_series,
            swing,
            buzz,
            ud,
        )
        strength = flow_strength_score(core.score_pct, supplemental.score)
        grade = grade_for_score(strength)
        plan = build_trade_plan(highs, lows, closes, strength, swing)
        levels = plan.levels
        results.append({
            'symbol': symbol,
            'market_date': rows[-1].market_date.isoformat(),
            'close': rows[-1].close,
            'flow_score': strength,
            'flow_label': grade,
            'core_score': round(core.score_pct, 1),
            'core_label': core.label,
            'supplemental_score': supplemental.score,
            'supplemental_penalty': supplemental.penalty,
            'pass_count': core.pass_count,
            'total_count': core.total_count,
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
            'hv1': supplemental.hv1,
            'hve': supplemental.hve,
            'volume_contraction': supplemental.volume_contraction,
            'vcp': supplemental.vcp,
            'rs_new_high': supplemental.rs_new_high,
            'pivot_distance_pct': supplemental.pivot_distance_pct,
            'main_signal': _signal_summary(
                grade,
                core.pass_count,
                supplemental.score,
                rs,
                mcdx.banker,
                swing,
                buzz,
                supplemental,
            ),
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
