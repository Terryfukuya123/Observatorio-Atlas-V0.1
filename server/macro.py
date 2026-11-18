"""Camada macro: catálogo configurável do BCB e do Banco Mundial.

Cada série é uma entrada independente no cache (data/cache/macro.json), com resumo
SHA-256 da resposta de origem, horário de recepção, tentativas e próxima coleta.
A requisição HTTP nunca espera a rede: a coleta roda em segundo plano e a página
recebe a última versão válida com seu estado.
"""
from datetime import UTC, date, datetime, timedelta, timezone
from decimal import Decimal
from hashlib import sha256
import json
import logging
from pathlib import Path
from threading import Lock, Thread
from time import monotonic

from providers import bcb, treasury, worldbank

TTL = {"sgs": timedelta(hours=4), "ptax": timedelta(hours=4), "focus": timedelta(hours=4), "ust": timedelta(hours=4), "wb": timedelta(hours=24)}
RETRY = timedelta(minutes=30)
HISTORY = {"Diária": 260, "Mensal": 60, "Anual": 30}
LIMIT = 8_000_000
# O BCB publica em datas de Brasília (sem horário de verão desde 2019).
BRASILIA = timezone(timedelta(hours=-3))
RIGHTS = {
    "sgs": dict(source="Banco Central do Brasil · SGS", license="ODbL 1.0",
                license_url="https://opendatacommons.org/licenses/odbl/1-0/",
                dataset="https://dadosabertos.bcb.gov.br/"),
    "ptax": dict(source="Banco Central do Brasil · PTAX", license="ODbL 1.0",
                 license_url="https://opendatacommons.org/licenses/odbl/1-0/",
                 dataset="https://dadosabertos.bcb.gov.br/dataset/taxas-de-cambio-todos-os-boletins-diarios"),
    "focus": dict(source="Banco Central do Brasil · Focus, expectativas de mercado", license="ODbL 1.0",
                  license_url="https://opendatacommons.org/licenses/odbl/1-0/",
                  dataset="https://dadosabertos.bcb.gov.br/dataset/expectativas-mercado"),
    "ust": dict(source="Departamento do Tesouro dos EUA · Daily Treasury Par Yield Curve Rates", license="Domínio público (obra do governo federal dos EUA)",
                license_url="https://home.treasury.gov/subfooter/site-policies-and-notices",
                dataset="https://home.treasury.gov/resource-center/data-chart-center/interest-rates/TextView?type=daily_treasury_yield_curve"),
    "wb": dict(source="Banco Mundial · World Development Indicators", license="CC BY 4.0",
               license_url="https://creativecommons.org/licenses/by/4.0/",
               dataset="https://databank.worldbank.org/source/world-development-indicators"),
}


def load_catalog(root):
    catalog = json.loads((Path(root) / "config/macro.json").read_text(encoding="utf8"))
    catalog.setdefault("focus", [])
    ids = [s["id"] for s in catalog["brasil"] + catalog["global"] + catalog["focus"]]
    if len(ids) != len(set(ids)):
        raise ValueError("Identificadores repetidos no catálogo macro")
    for series in catalog["brasil"]:
        if series["frequency"] not in HISTORY:
            raise ValueError(f"Periodicidade desconhecida em {series['id']}")
    return catalog


def territories(root):
    world = json.loads((Path(root) / "web/world.json").read_text(encoding="utf8"))
    return frozenset(row["id"] for row in world) | {"WLD"}


class MacroStore:
    def __init__(self, root, fetch=None, clock=lambda: datetime.now(UTC), background=True, path=None):
        self.root = Path(root)
        self.path = Path(path) if path else self.root / "data/cache/macro.json"
        self.catalog = load_catalog(self.root)
        self.territories = territories(self.root)
        self.fetch = fetch
        self.clock = clock
        self.background = background
        self.lock = Lock()
        self.running = False
        self.entries = {}
        self.warning = None
        try:
            if self.path.stat().st_size > LIMIT:
                raise ValueError("Cache excede o limite")
            stored = json.loads(self.path.read_text(encoding="utf8"))
            for key, entry in stored.get("entries", {}).items():
                datetime.fromisoformat(entry["next"])
                if entry.get("received") and datetime.fromisoformat(entry["received"]) > self.clock():
                    raise ValueError("Recepção futura")
                self.entries[key] = entry
        except FileNotFoundError:
            pass
        except Exception as error:
            self.entries = {}
            self.warning = f"Cache macro rejeitado ({type(error).__name__})"

    # -- Coleta ---------------------------------------------------------------
    def jobs(self, today):
        for s in self.catalog["brasil"]:
            yield (f"sgs:{s['code']}", bcb.sgs_url(s["code"], s["frequency"], today),
                   lambda body, t=today: bcb.normalize_sgs(body, t))
        for currency in self.catalog["ptax"]:
            yield (f"ptax:{currency}", bcb.ptax_url(currency, today),
                   lambda body, t=today: bcb.normalize_ptax(body, t))
        names = frozenset(s["indicator"] for s in self.catalog["focus"])
        if names:
            yield ("focus:anuais", bcb.focus_url(names, today),
                   lambda body, t=today: bcb.normalize_focus(body, t, names))
        for year in (today.year - 1, today.year):
            yield (f"ust:{year}", treasury.url(year), lambda body, t=today: treasury.normalize(body, t))
        for s in self.catalog["global"]:
            yield (f"wb:{s['code']}", worldbank.url(s["code"]),
                   lambda body, c=s["code"]: worldbank.normalize(body, c, self.territories))

    def due(self, now):
        keys = {key for key, _, _ in self.jobs(now.astimezone(BRASILIA).date())}
        return [k for k in keys if k not in self.entries or now >= datetime.fromisoformat(self.entries[k]["next"])]

    def downloader(self, key):
        if self.fetch:
            return self.fetch
        return {"wb": worldbank.download, "ust": treasury.download}.get(key.split(":")[0], bcb.download)

    def collect(self, now):
        pending = set(self.due(now))
        for key, address, parse in self.jobs(now.astimezone(BRASILIA).date()):
            if key not in pending:
                continue
            entry = dict(self.entries.get(key, {}))
            started = monotonic()
            try:
                body = self.downloader(key)(address)
                data = parse(body)
                previous = entry.get("data")
                if isinstance(previous, list) and previous and data[-1][0] < previous[-1][0]:
                    raise ValueError("Regressão da última observação")
                received = self.clock()
                entry.update(data=data, sha256=sha256(body).hexdigest(), received=received.isoformat(),
                             url=address, error=None, next=(received + self.ttl(key, now)).isoformat(),
                             successes=entry.get("successes", 0) + 1)
            except Exception as error:
                detail = getattr(error, "code", None)
                entry.update(error=f"Falha na coleta ({f'HTTP {detail}' if detail else type(error).__name__})",
                             next=(now + RETRY).isoformat())
            entry.update(attempted=now.isoformat(), latency_ms=round((monotonic() - started) * 1000),
                         attempts=entry.get("attempts", 0) + 1)
            with self.lock:
                self.entries[key] = entry
        self.save()

    @staticmethod
    def ttl(key, now):
        prefix, _, suffix = key.partition(":")
        if prefix == "ust" and int(suffix) < now.astimezone(BRASILIA).year:
            return timedelta(days=7)
        return TTL[prefix]

    def save(self):
        with self.lock:
            payload = json.dumps({"entries": self.entries}, ensure_ascii=False, allow_nan=False)
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
            logging.exception("Coleta macro interrompida")
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

    # -- Leitura ----------------------------------------------------------------
    def status(self, key):
        entry = self.entries.get(key)
        if not entry:
            return {"status": "Coletando" if self.running else "Aguardando coleta"}
        meta = {k: entry.get(k) for k in ("received", "attempted", "sha256", "url", "error", "latency_ms", "attempts", "successes", "next")}
        meta["status"] = ("Fonte indisponível" if not entry.get("data") else
                          "Dado histórico" if entry.get("error") else "Atualizado")
        return meta

    def brasil(self):
        out = []
        for s in self.catalog["brasil"]:
            key = f"sgs:{s['code']}"
            points = (self.entries.get(key) or {}).get("data") or []
            item = dict(s, collection=self.status(key), **RIGHTS["sgs"])
            if points:
                day, value = points[-1]
                item.update(observed=day, value=value, history=points[-HISTORY[s["frequency"]]:])
                if len(points) > 1:
                    before_day, before = points[-2]
                    item["previous"] = {"observed": before_day, "value": before,
                                        "delta": str(Decimal(value) - Decimal(before))}
            out.append(item)
        return out

    def ptax(self):
        out = {}
        for currency in self.catalog["ptax"]:
            key = f"ptax:{currency}"
            points = (self.entries.get(key) or {}).get("data") or []
            item = dict(instrument=f"{currency}/BRL", unit=f"BRL por {currency}", method="Cotação de venda, boletim de fechamento PTAX",
                        frequency="Dias úteis", collection=self.status(key), **RIGHTS["ptax"])
            if points:
                day, value = points[-1]
                item.update(observed=day, value=value, history=points[-260:])
                if len(points) > 1:
                    item["change_percent"] = float(100 * (Decimal(value) / Decimal(points[-2][1]) - 1))
            out[currency] = item
        return out

    def focus(self, history=False):
        entry = self.entries.get("focus:anuais") or {}
        data = entry.get("data") or {}
        out = []
        for s in self.catalog["focus"]:
            years = []
            for year, points in sorted((data.get(s["indicator"]) or {}).items()):
                day, median, respondents = points[-1]
                item = dict(year=year, observed=day, median=median, respondents=respondents)
                for label, days in (("week_ago", 7), ("four_weeks_ago", 28)):
                    limit = (date.fromisoformat(day) - timedelta(days=days)).isoformat()
                    earlier = [p for p in points if p[0] <= limit]
                    if earlier:
                        item[label] = {"observed": earlier[-1][0], "median": earlier[-1][1]}
                item["trend"] = self.trend(points)
                if history:
                    item["history"] = [[d, m] for d, m, _ in points]
                years.append(item)
            out.append(dict(s, years=years))
        return dict(indicators=out, collection=self.status("focus:anuais"), **RIGHTS["focus"])

    @staticmethod
    def trend(points):
        """Sequência de altas ou quedas entre divulgações semanais, como no relatório Focus."""
        weekly, last_week = [], None
        for day, median, _ in points:
            week = date.fromisoformat(day).isocalendar()[:2]
            if week != last_week:
                weekly.append(Decimal(median))
                last_week = week
            else:
                weekly[-1] = Decimal(median)
        count, direction = 0, 0
        for before, after in zip(reversed(weekly[:-1]), reversed(weekly)):
            step = (after > before) - (after < before)
            if step == 0 or (direction and step != direction):
                break
            direction, count = step, count + 1
        return {"direction": {1: "alta", -1: "queda", 0: "estável"}[direction], "weeks": count}

    def curve(self, history=False):
        merged = {}
        keys = sorted(k for k in self.entries if k.startswith("ust:"))
        for key in keys:
            for day, values in self.entries[key].get("data") or []:
                merged[day] = values
        current = f"ust:{self.clock().astimezone(BRASILIA).year}"
        out = dict(collection=self.status(current if current in self.entries else (keys[-1] if keys else current)), **RIGHTS["ust"])
        if not merged:
            return out
        points = sorted(merged.items())
        day, latest = points[-1]

        def shape(values):
            return [dict(code=code, label=label, years=years, value=values[code])
                    for code, label, years in treasury.TENORS.values() if code in values]

        def spread(values, long, short):
            if long in values and short in values:
                return str(Decimal(values[long]) - Decimal(values[short]))
            return None

        end = date.fromisoformat(day)
        targets = (("1 semana", end - timedelta(days=7)), ("1 mês", end - timedelta(days=30)),
                   ("início do ano", end.replace(month=1, day=1) - timedelta(days=1)), ("1 ano", end - timedelta(days=365)))
        comparisons = []
        for label, target in targets:
            earlier = [pt for pt in points if pt[0] <= target.isoformat()]
            if earlier:
                comparisons.append(dict(label=label, observed=earlier[-1][0], curve=shape(earlier[-1][1])))
        spreads = {name: spread(latest, long, short) for name, long, short in (("10A-2A", "10A", "2A"), ("10A-3M", "10A", "3M"))}
        out.update(observed=day, curve=shape(latest), comparisons=comparisons, spreads=spreads,
                   inverted={k: v is not None and Decimal(v) < 0 for k, v in spreads.items()})
        if history:
            out["history"] = {code: [[d, v[code]] for d, v in points if code in v] for code in ("3M", "2A", "10A", "30A")}
            out["spread_history"] = {"10A-2A": [[d, spread(v, "10A", "2A")] for d, v in points if spread(v, "10A", "2A")]}
        return out

    def curve_summary(self):
        full = self.curve()
        summary = {k: full.get(k) for k in ("observed", "spreads", "inverted", "collection", "source", "license")}
        summary["key"] = [c for c in full.get("curve", []) if c["code"] in {"3M", "2A", "10A", "30A"}]
        return summary

    def indicators(self):
        out = []
        for s in self.catalog["global"]:
            key = f"wb:{s['code']}"
            values = (self.entries.get(key) or {}).get("data") or {}
            out.append(dict(s, coverage=len([k for k in values if k != "WLD"]),
                            years=sorted({v["year"] for v in values.values()}),
                            collection=self.status(key), **RIGHTS["wb"]))
        return out

    def overview(self):
        self.refresh_if_due()
        with self.lock:
            return dict(brasil=self.brasil(), ptax=self.ptax(), focus=self.focus(), us_curve=self.curve_summary(), indicators=self.indicators(),
                        warning=self.warning, generated=self.clock().isoformat())

    def curve_detail(self):
        self.refresh_if_due()
        with self.lock:
            return self.curve(history=True)

    def focus_detail(self):
        self.refresh_if_due()
        with self.lock:
            return self.focus(history=True)

    def indicator(self, identifier):
        spec = next((s for s in self.catalog["global"] if s["id"] == identifier), None)
        if spec is None:
            return None
        self.refresh_if_due()
        with self.lock:
            key = f"wb:{spec['code']}"
            values = dict((self.entries.get(key) or {}).get("data") or {})
            return dict(spec, values=values, collection=self.status(key), **RIGHTS["wb"])

    def country(self, iso):
        if iso not in self.territories:
            return None
        self.refresh_if_due()
        with self.lock:
            rows = []
            for s in self.catalog["global"]:
                key = f"wb:{s['code']}"
                values = (self.entries.get(key) or {}).get("data") or {}
                found = values.get(iso)
                world = values.get("WLD")
                rows.append(dict(id=s["id"], name=s["name"], unit=s["unit"], group=s["group"], decimals=s["decimals"],
                                 year=found and found["year"], value=found and found["value"],
                                 world=world, status=self.status(key)["status"]))
            return dict(iso=iso, indicators=rows, **RIGHTS["wb"])
