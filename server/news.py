"""Ao vivo: notícias oficiais coletadas em segundo plano e servidas numa linha do tempo.

Cada fonte tem seu intervalo (5 minutos para notas do BC e Agência Brasil). A coleta
acontece quando alguém lê e há fonte vencida, em uma thread, sem travar a resposta.
Guarda em data/cache/noticias.json só título, resumo curto, link, hora e classificação.
"""
import json
import logging
from datetime import UTC, datetime, timedelta
from pathlib import Path
from threading import Lock, Thread

from providers import news

RETRY = timedelta(minutes=10)
KEEP = timedelta(days=7)
PER_SOURCE = 60
LIMIT = 3_000_000


class NewsStore:
    def __init__(self, root, fetch=None, clock=lambda: datetime.now(UTC), background=True, path=None):
        self.path = Path(path) if path else Path(root) / "data/cache/noticias.json"
        self.fetch = fetch or news.download
        self.clock = clock
        self.background = background
        self.lock = Lock()
        self.running = False
        self.warning = None
        self.sources = {}
        try:
            if self.path.stat().st_size > LIMIT:
                raise ValueError("Cache excede o limite")
            stored = json.loads(self.path.read_text(encoding="utf8"))
            self.sources = {k: v for k, v in stored.get("sources", {}).items() if k in news.BY_ID}
        except FileNotFoundError:
            pass
        except Exception as error:
            self.sources = {}
            self.warning = f"Cache de notícias rejeitado ({type(error).__name__})"

    def due(self, now):
        return [s["id"] for s in news.SOURCES
                if not self.sources.get(s["id"], {}).get("next") or now >= datetime.fromisoformat(self.sources[s["id"]]["next"])]

    def collect(self, now):
        for source in self.due(now):
            meta = news.BY_ID[source]
            entry = dict(self.sources.get(source, {}))
            url = news.url_for(source, now.date())
            try:
                body = self.fetch(url)
                fresh = news.parse(source, body, now.date())
                # Junta com o que já havia: item que saiu do feed continua até completar 7 dias.
                known = {i["id"]: i for i in entry.get("items", [])}
                first_seen = {i["id"]: i.get("seen") for i in entry.get("items", [])}
                received = self.clock()
                for i in fresh:
                    i["seen"] = first_seen.get(i["id"]) or received.isoformat()
                    known[i["id"]] = i
                cutoff = (now - KEEP).isoformat()
                items = sorted((i for i in known.values() if i["time"] >= cutoff), key=lambda i: i["time"], reverse=True)
                entry.update(items=items[:PER_SOURCE], received=received.isoformat(), error=None, url=url,
                             next=(received + timedelta(minutes=meta["every"])).isoformat(), count=len(fresh))
            except Exception as error:
                detail = getattr(error, "code", None)
                entry.update(error=f"Falha na coleta ({f'HTTP {detail}' if detail else type(error).__name__})",
                             url=url, next=(now + RETRY).isoformat())
            entry["attempted"] = now.isoformat()
            with self.lock:
                self.sources[source] = entry
        self.save()

    def save(self):
        with self.lock:
            payload = json.dumps({"sources": self.sources}, ensure_ascii=False, allow_nan=False)
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
            logging.exception("Coleta de notícias interrompida")
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
        now = self.clock()
        cutoff = (now - KEEP).isoformat()
        with self.lock:
            sources = {k: dict(v) for k, v in self.sources.items()}
            running = self.running
        seen, items = set(), []
        for item in sorted((i for s in sources.values() for i in s.get("items", [])), key=lambda i: i["time"], reverse=True):
            # A mesma notícia pode vir de dois feeds (Economia e Política da Agência Brasil).
            key = item["link"] or item["title"]
            if item["time"] < cutoff or key in seen or item["time"] > (now + timedelta(hours=1)).isoformat():
                continue
            seen.add(key)
            items.append(item)
        status = []
        for meta in news.SOURCES:
            entry = sources.get(meta["id"], {})
            status.append(dict(id=meta["id"], name=meta["name"], short=meta["short"], license=meta["license"], lang=meta.get("lang", "pt"),
                               note=meta.get("note"), every=meta["every"], received=entry.get("received"),
                               next=entry.get("next"), error=entry.get("error"), url=entry.get("url"),
                               latest=entry["items"][0]["time"] if entry.get("items") else None))
        return dict(generated=now.isoformat(), collecting=running, items=items[:200], sources=status,
                    topics=news.TOPICS, links=news.LINKS, warning=self.warning,
                    method="Tema e impacto por regras fixas de palavras-chave, iguais para todas as fontes. "
                           "Alto: decisão de juros, intervenção no câmbio, medida fiscal ou dado de peso. "
                           "Rotinas como rolagem de swaps, estudos e relatórios valem um nível a menos.")
