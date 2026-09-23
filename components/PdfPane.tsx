"use client";

export function PdfPane({
  title,
  src,
  page,
  onPage,
}: {
  title: string;
  src: string;
  page: number;
  onPage: (n: number) => void;
}) {
  const hash = `#page=${page}`;
  return (
    <div className="card" style={{ minWidth: 0 }}>
      <div className="card-h">
        <span>{title}</span>
        <span className="row">
          <button type="button" className="btn secondary" onClick={() => onPage(Math.max(1, page - 1))}>
            Prev
          </button>
          <span className="small muted" style={{ alignSelf: "center" }}>
            Page {page}
          </span>
          <button type="button" className="btn secondary" onClick={() => onPage(page + 1)}>
            Next
          </button>
          <a className="btn secondary" href={src} target="_blank" rel="noreferrer">
            Full screen
          </a>
        </span>
      </div>
      <iframe className="pdf-frame" title={title} src={`${src}${hash}`} />
    </div>
  );
}
