from flow_scanner.flow.unified_score import SCORE_VERSION


EXPECTED_SCORE_VERSION = "volume-mcdx-flow-v1"

if SCORE_VERSION != EXPECTED_SCORE_VERSION:
    raise SystemExit(f"Expected {EXPECTED_SCORE_VERSION}, got {SCORE_VERSION}")

print(f"Using unified score: {SCORE_VERSION}")
