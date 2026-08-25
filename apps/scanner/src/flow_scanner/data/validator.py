from flow_scanner.domain.models import OHLCVRecord, ValidatedPrice

def validate_price_record(record: OHLCVRecord) -> tuple[bool, str | None]:
    if record.open <= 0 or record.high <= 0 or record.low <= 0 or record.close <= 0:
        return False, 'non-positive price'
    if record.volume < 0:
        return False, 'negative volume'
    if record.low > record.high:
        return False, 'low above high'
    if not (record.low <= record.open <= record.high):
        return False, 'open outside daily range'
    if not (record.low <= record.close <= record.high):
        return False, 'close outside daily range'
    return True, None

def resolve_price(primary: OHLCVRecord | None, fallback: OHLCVRecord | None, tolerance_pct: float = 0.5) -> ValidatedPrice:
    p_ok = validate_price_record(primary)[0] if primary else False
    f_ok = validate_price_record(fallback)[0] if fallback else False
    if p_ok and f_ok:
        if primary.market_date != fallback.market_date:
            return ValidatedPrice('DATA_CONFLICT', None, 'provider dates differ')
        diff_pct = abs(primary.close - fallback.close) / primary.close * 100
        if diff_pct > tolerance_pct:
            return ValidatedPrice('DATA_CONFLICT', None, f'close differs by {diff_pct:.2f}%')
        return ValidatedPrice('VALID', primary)
    if p_ok:
        return ValidatedPrice('VALID', primary)
    if f_ok:
        return ValidatedPrice('FALLBACK', fallback)
    return ValidatedPrice('INVALID', None, 'no valid provider record')
