export function ScanSearch({ query }: { query?: string | null }) {
  return (
    <section className="searchPanel" aria-label="Tìm kiếm mã theo toàn bộ lịch sử">
      <div>
        <div className="sectionLabel">Tìm kiếm toàn bộ lịch sử</div>
        <div className="historyHint">Nhập mã để xem tất cả phiên đã lưu, không bị giới hạn bởi ngày đang chọn.</div>
      </div>
      <form className="searchForm" action="/" method="get" role="search">
        <input
          className="searchInput"
          aria-label="Tên mã cổ phiếu"
          name="q"
          defaultValue={query ?? ''}
          placeholder="VD: VPI, GMD, TCB..."
          autoComplete="off"
          inputMode="text"
          maxLength={12}
        />
        <button className="searchButton" type="submit">
          Tìm mã
        </button>
        {query ? (
          <a className="searchClear" href="/">
            Xóa tìm kiếm
          </a>
        ) : null}
      </form>
    </section>
  );
}
