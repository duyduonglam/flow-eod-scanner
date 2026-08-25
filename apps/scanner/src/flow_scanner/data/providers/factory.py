from __future__ import annotations
import os
from flow_scanner.data.providers.fireant import FireAntProvider
from flow_scanner.data.providers.openstockapi import OpenStockAPIProvider
from flow_scanner.data.providers.vnstock import VnStockProvider

def build_provider_chain() -> list[object]:
    providers: list[object] = []
    if os.getenv('FIREANT_API_KEY'):
        providers.append(FireAntProvider(api_key=os.environ['FIREANT_API_KEY']))
    # OpenStockAPI currently requires its own API key; leave adapter optional.
    if os.getenv('OPENSTOCK_API_KEY'):
        providers.append(OpenStockAPIProvider())
    # Always retain a zero-key VCI-backed fallback for V1 bootstrap.
    providers.append(VnStockProvider(source=os.getenv('VNSTOCK_SOURCE', 'VCI')))
    return providers
