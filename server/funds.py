"""Fluxo dos fundos de investimento (CVM, informe diário) com coleta em segundo plano.

Guarda só agregados por dia e categoria em data/cache/fundos.json. O mês corrente
é recoletado a cada 6 horas; o anterior, diariamente (revisões); os demais, a cada 30 dias.
"""
import json
import logging
from datetime import UTC, date, datetime, timedelta, timezone
from decimal import Decimal
from hashlib import sha256
from pathlib import Path
from statistics import median
from threading import Lock, Thread

from providers import cvm_daily

BRASILIA = timezone(timedelta(hours=-3))
RETRY = timedelta(hours=1)
LIMIT = 20_000_000
MONTHS = 13
DAYS = 25
MILLION = Decimal(1_000_000)
RIGHTS = dict(source="CVM · Informe diário e cadastro de fundos", license="ODbL 1.0",
              license_url="https://opendatacommons.org/licenses/odbl/1-0/",
              dataset="https://dados.cvm.gov.br/dataset/fi-doc-inf_diario")


def periods(today):
    """Competências de janeiro do ano anterior até o mês corrente."""
    out, cursor = [], date(today.year - 1, 1, 1)
    while cursor <= today:
        out.append(cursor.strftime("%Y%m"))
        cursor = (cursor.replace(day=28) + timedelta(days=4)).replace(day=1)
    return out


def _m(value):
    return str((value / MILLION).quantize(Decimal("0.1")))


class FundFlows:
    def __init__(self, root, fetch=None, clock=lambda: datetime.now(UTC), background=True, path=None):
        self.path = Path(path) if path else Path(root) / "data/cache/fundos.json"
        self.fetch = fetch or cvm_daily.download
        self.clock = clock
        self.background = background
        self.lock = Lock()
        self.running = False
        self.warning = None
        self.registry = {}
        self.months = {}
        try:
            if self.path.stat().st_size > LIMIT:
                raise ValueError("Cache excede o limite")
            stored = json.loads(self.path.read_text(encoding="utf8"))
            self.registry = stored.get("registry", {})
            self.months = stored.get("months", {})
        except FileNotFoundError:
            pass
        except Exception as error:
            self.registry, self.months = {}, {}
            self.warning = f"Cache de fundos rejeitado ({type(error).__name__})"

    # -- Coleta -------------------------------------------------------------------
    def ttl(self, period, today):
        current = today.strftime("%Y%m")
        if period == current:
            return timedelta(hours=6)
        previous = (today.replace(day=1) - timedelta(days=1)).strftime("%Y%m")
        return timedelta(days=1) if period == previous else timedelta(days=30)

    def due(self, now):
        today = now.astimezone(BRASILIA).date()
        out = []
        if not self.registry.get("map") or now >= datetime.fromisoformat(self.registry["next"]):
            out.append("registry")
        for period in periods(today):
            entry = self.months.get(period)
            if not entry or now >= datetime.fromisoformat(entry["next"]):
                out.append(period)
        return out

    def collect(self, now):
        today = now.astimezone(BRASILIA).date()
        for job in self.due(now):
            if job == "registry":
                url = cvm_daily.REGISTRY
                entry = dict(self.registry)
            else:
                url = cvm_daily.DAILY.format(period=job)
                entry = dict(self.months.get(job, {}))
                if not self.registry.get("map"):
                    break
            try:
                body = self.fetch(url)
                if job == "registry":
                    entry.update(map=cvm_daily.normalize_registry(body))
                else:
                    entry.update(days=cvm_daily.normalize_daily(body, self.registry["map"], job))
                received = self.clock()
                ttl = timedelta(days=1) if job == "registry" else self.ttl(job, today)
                entry.update(sha256=sha256(body).hexdigest(), url=url, received=received.isoformat(),
                             error=None, next=(received + ttl).isoformat())
            except Exception as error:
                detail = getattr(error, "code", None)
                entry.update(error=f"Falha na coleta ({f'HTTP {detail}' if detail else type(error).__name__})",
                             url=url, next=(now + RETRY).isoformat())
            with self.lock:
                if job == "registry":
                    self.registry = entry
                else:
                    self.months[job] = entry
            self.save()

    def save(self):
        with self.lock:
            payload = json.dumps({"registry": self.registry, "months": self.months}, ensure_ascii=False, allow_nan=False)
        try:
            self.path.parent.mkdir(parents=True, exist_ok=True)
            tmp = self.path.with_suffix(".tmp")
            tmp.write_text(payload, encoding="utf8")
            tmp.replace(self.path)
        except OSError:
            self.warning = "Persistência indisponível"

    def _run(self, now):
        try:
            self.collect(now)
        except Exception:
            logging.exception("Coleta de fundos interrompida")
        finally:
            with self.lock:
                self.running = False

    def refresh_if_due(self):
        now = self.clock()
        with self.lock:
            if self.running or not self.due(now):
                return
            self.running = True
        if self.background:
            Thread(target=self._run, args=(now,), daemon=True).start()
        else:
            self._run(now)

    # -- Leitura -----------------------------------------------------------------
    def days(self):
        out = {}
        for period in sorted(self.months):
            for day, cats in (self.months[period].get("days") or {}).items():
                if day != "_":
                    out[day] = cats
        return dict(sorted(out.items()))

    @staticmethod
    def complete(days):
        """Dias com cobertura completa: ao menos 95% das classes que costumam reportar."""
        counts = {d: sum(v[3] for v in cats.values()) for d, cats in days.items()}
        values = list(counts.values())
        full = set()
        # Referência móvel: o número de classes muda ao longo dos anos (encerramentos e
        # fundos novos), então cada dia é comparado com os 40 dias anteriores.
        for i, (d, n) in enumerate(counts.items()):
            window = values[max(0, i - 40):i] or [n]
            if n >= 0.95 * median(window):
                full.add(d)
        return full, counts

    def summary(self):
        days = self.days()
        full, counts = self.complete(days)
        if not full:
            return None
        through = max(full)
        end = date.fromisoformat(through)
        cats = list(cvm_daily.CATEGORIES)

        def net(day):
            return {k: Decimal(v[0]) - Decimal(v[1]) for k, v in days[day].items()}

        def total(selection):
            out = {k: Decimal(0) for k in cats}
            for d in selection:
                for k, v in net(d).items():
                    out[k] += v
            return out

        window = (end.month, end.day)
        current = total(d for d in full if d[:4] == str(end.year) and d <= through)
        previous_days = [d for d in full if d[:4] == str(end.year - 1)
                         and (int(d[5:7]), int(d[8:10])) <= window]
        previous = total(previous_days) if previous_days else None
        ytd = [{"id": k, "name": cvm_daily.CATEGORIES[k], "value": _m(current[k]),
                "previous": _m(previous[k]) if previous else None} for k in cats]

        months = sorted({d[:7] for d in days})[-MONTHS:]
        month_rows = []
        for m in months:
            sums = total(d for d in days if d[:7] == m and d <= through)
            month_rows.append({"month": m, "partial": m == through[:7], **{k: _m(v) for k, v in sums.items()}})
        day_rows = [{"date": d, **{k: _m(v) for k, v in total([d]).items()}}
                    for d in sorted(d for d in full if d <= through)[-DAYS:]]

        equity = {k: Decimal(days[through][k][2]) if k in days[through] else Decimal(0) for k in cats}
        month_ends = {}
        for d in sorted(full):
            month_ends[d[:7]] = d
        history = [[m, str((sum(Decimal(v[2]) for v in days[d].values()) / Decimal(10**9)).quantize(Decimal("0.1")))]
                   for m, d in sorted(month_ends.items())][-24:]
        pending = sorted(d for d in days if d > through)
        coverage = {}
        for period, entry in self.months.items():
            rows, unknown = (entry.get("days") or {}).get("_", [0, 0])
            year = coverage.setdefault(period[:4], [0, 0])
            year[0] += rows
            year[1] += rows - unknown
        return {"through": through, "year": end.year, "ytd": ytd, "months": month_rows, "days": day_rows,
                "equity": {"date": through, "items": [{"id": k, "name": cvm_daily.CATEGORIES[k], "value": _m(equity[k])}
                                                      for k in cats],
                           "total": _m(sum(equity.values(), Decimal(0))), "history": history},
                "classes": counts[through],
                "coverage": {y: round(m / r * 100, 1) for y, (r, m) in sorted(coverage.items()) if r}, "pending": [{"date": d, "classes": counts[d]} for d in pending]}

    def read(self):
        self.refresh_if_due()
        status = {p: {k: e.get(k) for k in ("received", "error", "sha256", "url")} for p, e in self.months.items()}
        status["registry"] = {k: self.registry.get(k) for k in ("received", "error", "sha256", "url")}
        return dict(data=self.summary(), collection=status, collecting=self.running, warning=self.warning,
                    categories=cvm_daily.CATEGORIES, generated=self.clock().isoformat(), **RIGHTS)
