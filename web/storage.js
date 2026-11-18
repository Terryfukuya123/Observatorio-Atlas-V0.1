// Preferências do usuário no navegador (localStorage, prefixo "oeg."), sem conta.
// Se o navegador bloquear o armazenamento, vale o padrão e nada quebra.
export const read = (k, d) => {
  try {
    return localStorage.getItem("oeg." + k) || d;
  } catch {
    return d;
  }
};
export const save = (k, v) => {
  try {
    localStorage.setItem("oeg." + k, v);
  } catch {}
};
