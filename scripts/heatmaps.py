"""Atualiza uma edição fechada. Execute python -m scripts.heatmaps AAAA-MM."""
import argparse
from pathlib import Path

from server.editions import publish
from server.service import Feed

ROOT = Path(__file__).resolve().parents[1]


def main():
    cli = argparse.ArgumentParser(description=__doc__)
    cli.add_argument("month", help="Última competência fechada, AAAA-MM")
    cli.add_argument("--archives", type=Path, help="Diretório de ZIPs oficiais previamente baixados")
    args = cli.parse_args()
    groups = publish(args.month, ROOT / "data/cache", Feed(ROOT / "data/cache/ecb.json"), args.archives)
    for group, tiles in groups.items():
        print(group, sum(bool(t["funds"]) for t in tiles), "/", len(tiles))


if __name__ == "__main__":
    main()
