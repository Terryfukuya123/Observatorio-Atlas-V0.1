// Camada única de dados: cada endereço da API é buscado uma vez e compartilhado entre
// as seções que pedem o mesmo dado no mesmo minuto. Cada seção recebe a própria cópia
// (JSON.parse por chamada), então uma seção não altera o dado da outra.
const TTL = 60_000;
const store = new Map();

export function cachedFetch(url) {
  const hit = store.get(url);
  if (hit && Date.now() - hit.at < TTL) return hit.promise;
  const promise = fetch(url)
    .then(async (r) => {
      if (!r.ok) {
        store.delete(url);
        return { ok: false, status: r.status, json: () => Promise.reject(Error("HTTP " + r.status)) };
      }
      const text = await r.text();
      return { ok: true, status: r.status, json: () => Promise.resolve(JSON.parse(text)) };
    })
    .catch((error) => {
      store.delete(url);
      throw error;
    });
  store.set(url, { at: Date.now(), promise });
  return promise;
}
