"""Publicação atômica da edição mensal e atualização fora da requisição HTTP."""
import logging
import calendar
import hashlib
import json
import os
import tempfile
from datetime import UTC, date, datetime, timedelta
from io import BytesIO
from threading import Lock, Thread
from urllib.request import urlopen

from providers.cvm import build_tiles, fx_at, unit_marks


DATA_URL = "https://dados.cvm.gov.br/dados/FI/DOC/CDA/DADOS/cda_fi_{}.zip"


def publish(month, directory, feed, archives=None):
    start = date.fromisoformat(month + "-01")
    end = start.replace(day=calendar.monthrange(start.year, start.month)[1])
    if end >= datetime.now(UTC).date():
        raise ValueError("Selecione uma competência encerrada")
    months = [start - timedelta(days=1), end]
    snapshot = feed.read()
    exchange = [fx_at(snapshot["series"], day) for day in months]
    marks, sources, weights = [], [], {}
    for day in months:
        period = day.strftime("%Y%m")
        url = DATA_URL.format(period)
        if archives:
            body = (archives / f"cda_fi_{period}.zip").read_bytes()
        else:
            with urlopen(url, timeout=45) as response:
                body = response.read(65_000_001)
        if len(body) > 65_000_000:
            raise ValueError("Arquivo excede o limite de entrada")
        marks.append(unit_marks(BytesIO(body), period, day, weights if day == end else None))
        sources.append(dict(url=url, sha256=hashlib.sha256(body).hexdigest()))
    groups = build_tiles(*marks, *exchange, weights=weights)
    if not all(any(a["funds"] for a in items) for items in groups.values()):
        raise ValueError("Amostra comparável ausente em uma classe. Edição anterior preservada.")
    edition = {"weight_currency": "BRL", "from": months[0].isoformat(), "to": end.isoformat(),
               "generated": datetime.now(UTC).isoformat(), "archives": sources,
               "fx": exchange, "fx_snapshot": snapshot["source"]["snapshot"],
               "fx_received": snapshot["source"]["received"], "fx_url": snapshot["endpoint"],
               "source": "CVM · CDA", "license": "https://opendatacommons.org/licenses/odbl/1-0/",
               "dataset": "https://dados.cvm.gov.br/dataset/fi-doc-cda", "groups": groups}
    directory.mkdir(parents=True, exist_ok=True)
    with tempfile.NamedTemporaryFile("w", dir=directory, suffix=".tmp", encoding="utf8", delete=False) as f:
        json.dump(edition, f, ensure_ascii=False, indent=2, allow_nan=False)
        f.write("\n")
    os.replace(f.name, directory / "heatmaps.json")
    return groups


class MonthlyEdition:
    def __init__(self, root, feed):
        self.seed = root / "data/editions/heatmaps.json"
        self.directory = root / "data/cache"
        self.attempt = root / "data/cache/heatmaps-attempt.json"
        self.feed = feed
        self.lock = Lock()
        self.running = False
        self.next_check = None
        try:
            self.next_check = datetime.fromisoformat(json.loads(self.attempt.read_text())["next"])
        except (OSError, ValueError, KeyError, TypeError):
            pass

    def read(self):
        body, observed, weighted = None, "", False
        for file in (self.directory / "heatmaps.json", self.seed):
            try:
                candidate = file.read_bytes()
                parsed = json.loads(candidate)
                day = date.fromisoformat(parsed["to"]).isoformat()
                has_weights = parsed.get("weight_currency") == "BRL"
                if (day, has_weights) > (observed, weighted) and parsed["groups"] and parsed["fx"]:
                    body, observed, weighted = candidate, day, has_weights
            except (OSError, ValueError, KeyError, TypeError):
                continue
        now = datetime.now(UTC)
        target = now.date().replace(day=1) - timedelta(days=1)
        if observed < target.isoformat():
            with self.lock:
                if not self.running and (self.next_check is None or now >= self.next_check):
                    self.running = True
                    self.next_check = now + timedelta(days=1)
                    Thread(target=self.update, args=(target,), daemon=True).start()
        return body

    def update(self, target):
        try:
            self.attempt.parent.mkdir(parents=True, exist_ok=True)
            self.attempt.write_text(json.dumps({"next": self.next_check.isoformat()}))
            publish(target.strftime("%Y-%m"), self.directory, self.feed)
        except Exception:
            logging.exception("Edição mensal pendente para %s", target)
        finally:
            with self.lock:
                self.running = False
