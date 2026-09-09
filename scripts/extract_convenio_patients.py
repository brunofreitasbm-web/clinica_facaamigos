"""Extrai a lista de pacientes das planilhas de agendamento em PDF enviadas
pelo convenio (modelo "CONTROLE PORTO TERAPIAS" / NAU Unimed).

Uso:
    python scripts/extract_convenio_patients.py "Modelos de PDF PLanos"
    python scripts/extract_convenio_patients.py "Modelos de PDF PLanos/arquivo.pdf" -o saida.csv

Requer: pdfplumber (pip install pdfplumber)
"""

from __future__ import annotations

import argparse
import csv
import json
import re
import sys
from dataclasses import asdict, dataclass
from pathlib import Path

import pdfplumber

HEADER_MARKER = "SEQ."
EXPECTED_COLUMNS = 9  # SEQ. | TERAPIAS | CLIENTE | DATA NASC./IDADE | CONTATO | GUIA | SENHA | COD. CARTAO | TURNO


@dataclass
class PatientRecord:
    source_file: str
    seq: str
    therapies: list[str]
    client_name: str
    birth_date: str | None
    age: str | None
    phone: str | None
    guia: str
    senha: str
    card_code: str
    shift: str | None


def _clean_cell(value: str | None) -> str:
    if not value:
        return ""
    return re.sub(r"\s+", " ", value.replace("\n", " ")).strip()


def _split_therapies(raw: str) -> list[str]:
    if not raw:
        return []
    normalized = re.sub(r"\s+e\s+(?=[A-ZÀ-Ü])", ", ", raw)
    parts = [p.strip(" .") for p in normalized.split(",")]
    return [p for p in parts if p]


def _split_birth_age(raw: str) -> tuple[str | None, str | None]:
    if not raw:
        return None, None
    match = re.match(r"(\d{2}/\d{2}/\d{4})\s*[–—-]\s*(.+)", raw)
    if match:
        return match.group(1), match.group(2).strip()
    return raw.strip() or None, None


def _find_data_rows(table: list[list[str | None]]) -> list[list[str]]:
    header_idx = None
    for i, row in enumerate(table):
        first_cell = _clean_cell(row[0] if row else None)
        if first_cell == HEADER_MARKER:
            header_idx = i
            break
    if header_idx is None:
        return []

    rows = []
    for row in table[header_idx + 1 :]:
        cells = [_clean_cell(c) for c in row]
        while len(cells) < EXPECTED_COLUMNS:
            cells.append("")
        if not any(cells):
            continue
        rows.append(cells[:EXPECTED_COLUMNS])
    return rows


def extract_pdf(path: Path) -> list[PatientRecord]:
    records: list[PatientRecord] = []
    with pdfplumber.open(path) as pdf:
        for page in pdf.pages:
            for table in page.extract_tables():
                for cells in _find_data_rows(table):
                    seq, therapies_raw, client_name, birth_age_raw, phone, guia, senha, card_code, shift = cells
                    if not seq.isdigit():
                        continue
                    birth_date, age = _split_birth_age(birth_age_raw)
                    records.append(
                        PatientRecord(
                            source_file=path.name,
                            seq=seq,
                            therapies=_split_therapies(therapies_raw),
                            client_name=client_name,
                            birth_date=birth_date,
                            age=age,
                            phone=phone or None,
                            guia=guia,
                            senha=senha,
                            card_code=card_code,
                            shift=shift or None,
                        )
                    )
    return records


def collect_pdfs(target: Path) -> list[Path]:
    if target.is_dir():
        return sorted(target.glob("*.pdf"))
    return [target]


def write_csv(records: list[PatientRecord], out_path: Path) -> None:
    fieldnames = list(asdict(records[0]).keys()) if records else []
    with out_path.open("w", newline="", encoding="utf-8-sig") as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()
        for record in records:
            row = asdict(record)
            row["therapies"] = "; ".join(row["therapies"])
            writer.writerow(row)


def write_json(records: list[PatientRecord], out_path: Path) -> None:
    with out_path.open("w", encoding="utf-8") as f:
        json.dump([asdict(r) for r in records], f, ensure_ascii=False, indent=2)


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("input", help="Arquivo PDF ou pasta com os PDFs do convenio")
    parser.add_argument("-o", "--output", default="pacientes_convenio", help="Caminho de saida sem extensao (gera .csv e .json)")
    args = parser.parse_args()

    target = Path(args.input)
    if not target.exists():
        print(f"Caminho nao encontrado: {target}", file=sys.stderr)
        return 1

    pdf_paths = collect_pdfs(target)
    if not pdf_paths:
        print("Nenhum PDF encontrado.", file=sys.stderr)
        return 1

    all_records: list[PatientRecord] = []
    for pdf_path in pdf_paths:
        records = extract_pdf(pdf_path)
        print(f"{pdf_path.name}: {len(records)} pacientes")
        all_records.extend(records)

    if not all_records:
        print("Nenhum paciente extraido.", file=sys.stderr)
        return 1

    out_base = Path(args.output)
    out_base.parent.mkdir(parents=True, exist_ok=True)
    write_csv(all_records, out_base.with_suffix(".csv"))
    write_json(all_records, out_base.with_suffix(".json"))
    print(f"Total: {len(all_records)} pacientes -> {out_base.with_suffix('.csv')} / {out_base.with_suffix('.json')}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
