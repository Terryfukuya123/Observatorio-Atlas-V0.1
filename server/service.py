from base64 import b64decode, b64encode
from datetime import UTC, date, datetime, timedelta
from hashlib import sha256
import json
from pathlib import Path
from threading import Lock
from time import monotonic
from urllib.error import HTTPError
from email.utils import parsedate_to_datetime

from core.calendar import expected_day, is_target_day
from core.indicators import variation
from providers import ecb

TTL = timedelta(hours=4)
RETRY = timedelta(minutes=30)
RETENTION = timedelta(days=7)
LIMIT = 720_000


def retry_delay(error, now):
    if isinstance(error, HTTPError):
        hint = error.headers.get("Retry-After", "")
        try:
            seconds = int(hint) if hint.isdigit() else (parsedate_to_datetime(hint) - now).total_seconds()
            return max(RETRY, timedelta(seconds=seconds))
        except (TypeError, ValueError, OverflowError):
            pass
    return RETRY


class Feed:
    def __init__(self, path, fetch=ecb.download, clock=lambda: datetime.now(UTC)):
        self.path = Path(path)
        self.fetch = fetch
        self.clock = clock
        self.lock = Lock()
        self.state = {}
        self.rows = {}
        try:
            if self.path.stat().st_size > LIMIT:
                raise ValueError("Cache excede o limite")
            state = json.loads(self.path.read_text(encoding="utf8"))
            if state.get("xml"):
                body = b64decode(state["xml"], validate=True)
                if sha256(body).hexdigest() != state["snapshot"]:
                    raise ValueError("Falha de integridade")
                received = datetime.fromisoformat(state["received"])
                if received > self.clock():
                    raise ValueError("Recepção futura")
                self.rows = ecb.normalize(body, received.date())
            datetime.fromisoformat(state["next"])
            self.state = state
        except FileNotFoundError:
            pass
        except Exception as error:
            self.rows = {}
            self.state = {"cache_warning": f"Cache rejeitado ({type(error).__name__})"}

    def refresh(self, now):
        state = self.state
        started = monotonic()
        try:
            body = self.fetch()
            rows = ecb.normalize(body, now.date())
            for code, previous in self.rows.items():
                updated = rows.get(code)
                if updated and previous and updated[-1][0] < previous[-1][0]:
                    raise ValueError("Regressão da última observação")
            received = self.clock()
            state.update(xml=b64encode(body).decode("ascii"), snapshot=sha256(body).hexdigest(),
                         received=received.isoformat(), error=None, next=(received + TTL).isoformat())
            self.rows = rows
            state["successes"] = state.get("successes", 0) + 1
        except Exception as error:
            detail = f"HTTP {error.code}" if isinstance(error, HTTPError) else type(error).__name__
            state.update(error=f"Falha na consulta ao BCE ({detail})", next=(now + retry_delay(error, now)).isoformat())
        state.update(attempted=now.isoformat(), latency_ms=round((monotonic() - started) * 1000),
                     attempts=state.get("attempts", 0) + 1)
        self.expire(now)
        self.save()

    def expire(self, now):
        if self.state.get("received") and now - datetime.fromisoformat(self.state["received"]) >= RETENTION:
            for key in ("xml", "snapshot", "received"):
                self.state.pop(key, None)
            self.rows = {}
            return True
        return False

    def save(self):
        try:
            self.path.parent.mkdir(parents=True, exist_ok=True)
            tmp = self.path.with_suffix(".tmp")
            tmp.write_text(json.dumps(self.state, allow_nan=False), encoding="utf8")
            tmp.replace(self.path)
        except OSError:
            self.state["cache_warning"] = "Persistência indisponível"

    def read(self):
        with self.lock:
            now = self.clock()
            if not self.state.get("next") or now >= datetime.fromisoformat(self.state["next"]):
                self.refresh(now)
            elif self.expire(now):
                self.save()
            state = self.state
            expected = expected_day(now)
            series = {}
            for code, points in self.rows.items():
                if not points:
                    continue
                day, value = points[-1]
                freshness = "Atualizado" if day >= expected.isoformat() else "Atrasado"
                if state.get("error"):
                    freshness = "Dado histórico"
                daily = variation(points, "1D")
                if daily:
                    previous = date.fromisoformat(day) - timedelta(days=1)
                    while not is_target_day(previous):
                        previous -= timedelta(days=1)
                    if daily["from"] != previous.isoformat():
                        daily = None
                series[code] = dict(instrument=f"EUR/{code}", currency=code, unit=f"{code} por EUR",
                                    value=value, observed=day, observation_time=None, received=state["received"],
                                    market="Referência cambial do Eurosistema", frequency="Diária TARGET",
                                    session="Não se aplica à referência diária", status=freshness,
                                    source="BCE", method="Referência cambial diária do BCE", rights="ECB-REF",
                                    history=points, change=daily)
            health = {k: v for k, v in state.items() if k != "xml"}
            health["status"] = ("Fonte indisponível" if state.get("error") or not series else
                                "Atrasado" if any(v["status"] == "Atrasado" for v in series.values()) else
                                "Cobertura parcial" if set(series) != ecb.CURRENCIES else "Atualizado")
            return dict(series=series, source=health, endpoint=ecb.URL, expected=expected.isoformat())
