#!/usr/bin/env python3
"""Extrai o "INDEX OF STAT BLOCKS" (paginas 5-7) do PDF -> lista (nome, pagina).

Serve como fonte de verdade para os NOMES dos monstros (o indice tem menos
ruido de OCR que alguns stat blocks densos). Saida local, gitignored.
Uso: python3 build_index.py <pdf> > data/intermediate/book-index.json
"""
import json, re, sys, subprocess, os

HERE = os.path.dirname(os.path.abspath(__file__))
EXTRACT = os.path.join(HERE, "..", "extract", "extract_pdf.py")


def main():
    pdf = sys.argv[1]
    raw = subprocess.run([sys.executable, EXTRACT, pdf, "5", "7"],
                         capture_output=True, text=True).stdout
    pages = json.loads(raw)
    text = "\n".join(p["text"] for p in pages)
    i = text.find("INDEX OF STAT BLOCKS")
    body = text[i + 20:] if i >= 0 else text
    pairs = re.findall(r"([A-Z][A-Za-z0-9'’()<\-\.\s]+?)\s*\.{2,}\s*(\d[\d ]*)", body)
    out = []
    for nm, pg in pairs:
        nm = " ".join(nm.split()).strip(" .")
        pg = int(re.sub(r"\s", "", pg)[:3] or 0)
        if len(nm) >= 3 and pg >= 10:
            out.append({"name": nm, "page": pg})
    json.dump(out, sys.stdout, ensure_ascii=False)


if __name__ == "__main__":
    main()
