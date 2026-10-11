#!/usr/bin/env python3
"""Copies the game's content into play/ (the web version): words, worlds, emoji, Wordittos, fonts and texts.

    python3 tools/sync-play-content.py [path to the game's repository]

The game's repository defaults to ../mega-word-search-game. JSON files lose their // comments; each language's
words go in one file (play/content/words-<lang>.json, categories in order); the Wordittos atlas is scaled down to
128 px per picture (sips, macOS); the English and German texts are read from Model/Strings.cs.
"""
import json
import os
import re
import shutil
import subprocess
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
SITE = os.path.dirname(HERE)
GAME = os.path.abspath(sys.argv[1] if len(sys.argv) > 1 else os.path.join(SITE, "..", "mega-word-search-game"))
CORE = os.path.join(GAME, "src", "MegaWordSearch.Core")
CONTENT = os.path.join(CORE, "Content")
OUT = os.path.join(SITE, "play", "content")
FONTS = os.path.join(SITE, "play", "fonts")
LANGUAGES = ["es", "en", "de"]
WORDITTO_SIZE = 128


def read_json(path):
    with open(path, encoding="utf-8") as f:
        text = "\n".join(line for line in f.read().splitlines() if not line.lstrip().startswith("//"))
    return json.loads(text)


def write_json(name, data):
    with open(os.path.join(OUT, name), "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, separators=(",", ":"))


def strings():
    """The English and German tables of Strings.cs: { "en": { spanish: text }, "de": {...} }."""
    with open(os.path.join(CORE, "Model", "Strings.cs"), encoding="utf-8") as f:
        source = f.read()
    tables = {}
    for code, name in (("en", "English"), ("de", "German")):
        start = source.index("Dictionary<string, string> " + name)
        body = source[start:source.index("};", start)]
        pairs = re.findall(r'\["((?:[^"\\]|\\.)*)"\]\s*=\s*"((?:[^"\\]|\\.)*)"', body)
        tables[code] = {json.loads('"' + key + '"'): json.loads('"' + value + '"') for key, value in pairs}
    return tables


def main():
    if not os.path.isdir(CONTENT):
        sys.exit(f"no game content in {CONTENT}")
    os.makedirs(OUT, exist_ok=True)
    os.makedirs(FONTS, exist_ok=True)

    for language in LANGUAGES:
        folder = os.path.join(CONTENT, "words", language)
        ids = read_json(os.path.join(folder, "categories.json"))["categories"]
        write_json(f"words-{language}.json", {
            "language": language,
            "categories": [read_json(os.path.join(folder, f"{id}.json")) for id in ids],
        })
    write_json("worlds.json", read_json(os.path.join(CONTENT, "worlds", "worlds.json")))
    write_json("emoji.json", read_json(os.path.join(CONTENT, "emoji", "emoji.json")))
    write_json("strings.json", strings())
    shutil.copy(os.path.join(CONTENT, "emoji", "emoji-atlas.png"), OUT)
    shutil.copy(os.path.join(CONTENT, "emoji", "LICENSE-NotoEmoji.txt"), OUT)

    # 10 pictures a row of 256 px: scaled to WORDITTO_SIZE.
    atlas = os.path.join(CONTENT, "wordittos", "wordittos.png")
    width = int(subprocess.check_output(["sips", "-g", "pixelWidth", atlas], text=True).split()[-1])
    subprocess.run(["sips", "--resampleWidth", str(width * WORDITTO_SIZE // 256), atlas, "--out", os.path.join(OUT, "wordittos.png")],
                   check=True, stdout=subprocess.DEVNULL)

    for name in ("UbuntuMono-Regular.ttf", "UFL.txt", "NotoSansSymbols2-Regular.ttf", "OFL-NotoSansSymbols2.txt"):
        shutil.copy(os.path.join(CONTENT, "fonts", name), FONTS)
    print(f"Copied the content of {GAME} into play/")


if __name__ == "__main__":
    main()
