from flow_scanner.data.repository import SupabaseRepository

def test_repository_headers_use_service_key():
    repo=SupabaseRepository('https://example.supabase.co','secret')
    h=repo._headers()
    assert h['apikey']=='secret'
    assert h['Authorization']=='Bearer secret'
