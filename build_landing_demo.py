"""Упаковать интерактивный прототип будущего приложения по Figma."""
from __future__ import annotations

import logging
from pathlib import Path

ROOT = Path(__file__).resolve().parent


def main() -> None:
    """Скопировать автономный прототип в ресурсы существующих лендингов."""
    destinations = [ROOT.parent / "landing", ROOT.parent / "pulse-landing",
                    ROOT.parent / "repository-split/pulse-landing"]
    source = next((path / "planned-demo.html" for path in destinations
                   if (path / "planned-demo.html").is_file()), None)
    if source is None:
        raise FileNotFoundError("Не найден planned-demo.html рядом с лендингом")
    for destination in destinations:
        if destination.is_dir():
            output = destination / "assets/app-demo.html"
            output.parent.mkdir(exist_ok=True)
            output.write_text(source.read_text(encoding="utf-8"), encoding="utf-8")
            logging.info("Прототип по Figma сохранён: %s", output)


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    main()
