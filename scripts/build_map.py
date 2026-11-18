"""Build offline geometry from Natural Earth v5.1.2 (50m admin 0)."""
import hashlib
import json
import math
from pathlib import Path
import sys

EXPECTED = "3e458fc036ad0a66411f2c1e6cac49c5d7bfb81cb1123bc513b22511a2b7fdeb"
REGIONS = {"Africa": "África", "North America": "Américas", "South America": "Américas",
           "Europe": "Europa", "Asia": "Ásia-Pacífico", "Oceania": "Ásia-Pacífico",
           "Antarctica": "Antártida"}


def project(lon, lat):
    return [round(500 + 2.68 * lon * math.cos(math.radians(lat * .53)), 2), round(231 - lat * 2.62, 2)]


def simplify(points, tolerance=.19):
    x, y = points[0]
    dx, dy = points[-1][0] - x, points[-1][1] - y
    denom = dx * dx + dy * dy
    worst, split = 0, 0
    for i, (px, py) in enumerate(points[1:-1], 1):
        t = max(0, min(1, ((px - x) * dx + (py - y) * dy) / denom)) if denom else 0
        dist = (px - x - t * dx) ** 2 + (py - y - t * dy) ** 2
        if dist > worst:
            worst, split = dist, i
    if worst > tolerance ** 2:
        return simplify(points[:split + 1], tolerance)[:-1] + simplify(points[split:], tolerance)
    return [points[0], points[-1]]


def main(source):
    data = Path(source).read_bytes()
    if hashlib.sha256(data).hexdigest() != EXPECTED:
        raise ValueError("Arquivo diferente da versão fixada")
    result = []
    for feature in json.loads(data)["features"]:
        prop, geo = feature["properties"], feature["geometry"]
        polygons = geo["coordinates"] if geo["type"] == "MultiPolygon" else [geo["coordinates"]]
        paths = []
        for polygon in polygons:
            for ring in polygon:
                pts = simplify([project(*p) for p in ring])
                if len(pts) < 4:
                    pts = [project(*p) for p in ring]
                paths.append("M" + "L".join(f"{x:g},{y:g}" for x, y in pts[:-1]) + "Z")
        result.append(dict(id=prop["ADM0_A3"], name=prop["NAME_PT"] or prop["ADMIN"],
                           region=REGIONS.get(prop["CONTINENT"], "Outras áreas"), d="".join(paths),
                           point=project(prop["LABEL_X"], prop["LABEL_Y"])))
    dest = Path(__file__).resolve().parents[1] / "web/world.json"
    dest.parent.mkdir(exist_ok=True)
    dest.write_text(json.dumps(result, ensure_ascii=False, separators=(",", ":")), encoding="utf8")


if __name__ == "__main__":
    main(sys.argv[1])
