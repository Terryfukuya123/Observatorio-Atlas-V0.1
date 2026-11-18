# Observatório Econômico Global em container.
# Só a biblioteca padrão do Python: nenhuma dependência para instalar.
FROM python:3.13-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    TZ=America/Sao_Paulo \
    OEG_HOST=0.0.0.0 \
    OEG_PORT=8842

WORKDIR /app
COPY . .

# Usuário sem privilégios; data/ é onde ficam cache, retratos da B3 e saídas locais.
RUN useradd --create-home --uid 1000 observatorio \
    && mkdir -p data/cache data/b3 data/run \
    && chown -R observatorio:observatorio data
USER observatorio

EXPOSE 8842
VOLUME ["/app/data/cache", "/app/data/b3"]

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
    CMD python -c "import urllib.request,os; p=os.environ.get('OEG_PUBLIC_PORT') or os.environ['OEG_PORT']; urllib.request.urlopen(urllib.request.Request('http://127.0.0.1:'+os.environ['OEG_PORT']+'/', headers={'Host':'127.0.0.1:'+p}), timeout=4)"

CMD ["python", "observatorio.py"]
