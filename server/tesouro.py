"""Juros e inflação implícita a partir do Tesouro Direto, com coleta em segundo plano.

O arquivo do Tesouro Transparente (cerca de 15 MB, histórico desde 2002) sai uma vez por
dia útil com as taxas do dia anterior. Consultamos a cada 6 horas e guardamos só o resumo
calculado (curvas, inflação implícita, títulos e dois anos de histórico) em
data/cache/tesouro.json.
"""
import json
import logging
from datetime import UTC, datetime, timedelta, timezone
from hashlib import sha256
from pathlib import Path
from threading import Lock, Thread

from providers import tesouro

BRASILIA = timezone(timedelta(hours=-3))
TTL = timedelta(hours=6)
RETRY = timedelta(hours=1)
LIMIT = 2_000_000
RIGHTS = dict(source="Tesouro Nacional · Tesouro Direto (Tesouro Transparente)", license="ODbL 1.0",
              license_url="https://opendatacommons.org/licenses/odbl/1-0/", dataset=tesouro.DATASET)


class TesouroStore:
    def __init__(self, root, fetch=None, clock=lambda: datetime.now(UTC), background=True, path=None):
        self.path = Path(path) if path else Path(root) / "data/cache/tesouro.json"
        self.fetch = fetch or tesouro.download
        self.clock = clock
        self.background = background
        self.lock = Lock()
        self.running = False
        self.warning = None
        self.state = {}
        try:
            if self.path.stat().st_size > LIMIT:
                raise ValueError("Cache excede o limite")
            self.state = json.loads(self.path.read_text(encoding="utf8"))
        except FileNotFoundError:
            pass
        except Exception as error:
            self.state = {}
            self.warning = f"Cache do Tesouro rejeitado ({type(error).__name__})"

    def due(self, now):
        return not self.state.get("next") or now >= datetime.fromisoformat(self.state["next"])

    def collect(self, now):
        state = dict(self.state)
        try:
            body = self.fetch(tesouro.URL)
            today = now.astimezone(BRASILIA).date()
            days = tesouro.parse(body, today - timedelta(days=tesouro.HISTORY_DAYS + 400))
            summary = tesouro.summarize(days, today)
            previous = (state.get("data") or {}).get("observed")
            if previous and summary["observed"] < previous:
                raise ValueError("Regressão da última data")
            received = self.clock()
            state.update(data=summary, sha256=sha256(body).hexdigest(), received=received.isoformat(),
                         error=None, next=(received + TTL).isoformat())
        except Exception as error:
            detail = getattr(error, "code", None)
            # Sem nenhum dado ainda, tenta de novo mais cedo.
            state.update(error=f"Falha na coleta ({f'HTTP {detail}' if detail else type(error).__name__})",
                         next=(now + (RETRY if state.get("data") else timedelta(minutes=15))).isoformat())
        state["attempted"] = now.isoformat()
        with self.lock:
            self.state = state
        try:
            self.path.parent.mkdir(parents=True, exist_ok=True)
            tmp = self.path.with_suffix(".tmp")
            tmp.write_text(json.dumps(state, ensure_ascii=False, allow_nan=False), encoding="utf8")
            tmp.replace(self.path)
        except OSError:
            self.warning = "Persistência indisponível"

    def _run(self, now):
        try:
            self.collect(now)
        except Exception:
            logging.exception("Coleta do Tesouro interrompida")
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

    def read(self):
        self.refresh_if_due()
        with self.lock:
            state = dict(self.state)
            running = self.running
        data = state.get("data")
        status = ("Atualizado" if data and not state.get("error") else "Dado histórico" if data
                  else "Coletando" if running else "Fonte indisponível" if state.get("error") else "Aguardando coleta")
        return dict(status=status, data=data, received=state.get("received"), next=state.get("next"),
                    error=state.get("error"), url=tesouro.URL, warning=self.warning, **RIGHTS)
