#!/usr/bin/env python3
"""Helper de extracao de texto do PDF (backend Python via PyMuPDF/fitz).

Motivo do backend Python: pdfjs-dist sofre SIGBUS neste ambiente. PyMuPDF e
rapido (nao decodifica as imagens grandes do PDF "AI Upscaled") e fornece
coordenadas + direcao de cada linha, permitindo:
  - descartar texto vertical de margem (linhas cuja direcao nao e horizontal);
  - separar as duas colunas da pagina pelo centro horizontal;
  - reagrupar spans em linhas por coordenada vertical.

Saida (stdout, JSON): [{ "page": 1, "columns": [...], "text": "..." }, ...]
Uso: python3 extract_pdf.py <pdf> [pagina_inicial] [pagina_final]
"""
import json
import sys
import fitz  # PyMuPDF

LINE_TOL = 4.0
COL_MIN_CHARS = 40


def is_horizontal(direction):
    return abs(direction[0]) > abs(direction[1])


def collect_spans(page):
    spans = []
    for block in page.get_text("dict").get("blocks", []):
        if block.get("type") != 0:
            continue
        for line in block.get("lines", []):
            if not is_horizontal(line.get("dir", (1, 0))):
                continue
            for span in line.get("spans", []):
                txt = span.get("text", "")
                if not txt.strip():
                    continue
                x0, y0, x1, y1 = span["bbox"]
                spans.append({"text": txt, "x0": x0, "x1": x1, "y": (y0 + y1) / 2})
    return spans


def spans_to_text(spans):
    if not spans:
        return ""
    spans = sorted(spans, key=lambda s: (round(s["y"] / LINE_TOL), s["x0"]))
    lines, current, line_y = [], [], None
    for s in spans:
        if line_y is None or abs(s["y"] - line_y) > LINE_TOL:
            if current:
                lines.append(current)
            current, line_y = [], s["y"]
        current.append(s)
    if current:
        lines.append(current)
    out = []
    for ln in lines:
        ln = sorted(ln, key=lambda s: s["x0"])
        text = " ".join(" ".join(s["text"] for s in ln).split())
        if text:
            out.append(text)
    return "\n".join(out)


def split_columns(spans, page_width):
    mid = page_width / 2
    left = [s for s in spans if (s["x0"] + s["x1"]) / 2 < mid]
    right = [s for s in spans if (s["x0"] + s["x1"]) / 2 >= mid]
    if sum(len(s["text"]) for s in left) > COL_MIN_CHARS and \
       sum(len(s["text"]) for s in right) > COL_MIN_CHARS:
        return [left, right]
    return [spans]


def main():
    path = sys.argv[1]
    start = int(sys.argv[2]) if len(sys.argv) > 2 else 1
    end = int(sys.argv[3]) if len(sys.argv) > 3 else None
    doc = fitz.open(path)
    last = end if end else doc.page_count
    pages_out = []
    for idx in range(start - 1, last):
        page = doc.load_page(idx)
        cols = split_columns(collect_spans(page), page.rect.width)
        columns = [c for c in (spans_to_text(c) for c in cols) if c]
        pages_out.append({"page": idx + 1, "columns": columns,
                          "text": "\n\n".join(columns)})
        print(f"PROGRESS {idx + 1}/{last}", file=sys.stderr)
    doc.close()
    json.dump(pages_out, sys.stdout, ensure_ascii=False)


if __name__ == "__main__":
    main()
