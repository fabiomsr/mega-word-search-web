# Mega Word Search — web

Landing page, privacy policy and web version of Mega Word Search, served with GitHub Pages.

- `index.html`: landing page, with links to Google Play and to the web version.
- `privacy.html`: privacy policy (the URL Google Play asks for).
- Both pages are in Spanish, English and German; `i18n.js` shows the browser's language, or the one given with `?lang=es|en|de`.
- `carousel.js`: arrows of the screenshot row.
- `img/`: icon, feature graphics and screenshots, copied from the game's `store/google-play`.

## The game in the browser (`play/`)

The game remade in plain JavaScript (no build step): challenges, custom games, Wordittos and options, with the progress and the game in progress kept in the browser (`localStorage`).

- `play/js/core.js`: the model and the generator, ported from the game's `MegaWordSearch.Core` (with .NET's `System.Random`), so the same options and seed give the same board as the app.
- `play/js/board.js`: the board on a canvas (drag, pinch or wheel to zoom, taps to select letters, minimap); `play/js/app.js`: the screens; `play/js/sound.js`: the sounds.
- `play/content/` and `play/fonts/`: words, challenges, emoji, Wordittos, texts and fonts, copied from the game by `python3 tools/sync-play-content.py [path to the game]` (default `../mega-word-search-game`; macOS, it scales the Wordittos down with `sips`). Run it again whenever the game's content changes.
- `tools/check-generator.sh [path to the game]` (macOS, needs .NET) generates every stage in the three languages and some custom games with the game's `tools/PrintPuzzle` and with `core.js`, and checks they are the same boards. Run it after changing the game's generator or words.

To try it locally (ES modules need a server):

```bash
python3 -m http.server 8765
```

and open `http://localhost:8765/play/`.

### Shared boards

A custom game can be shared (button *Compartir* in the custom game, the pause menu and the result): the link carries its options and seed, and opens that board directly.

```
play/?seed=123456&lang=es&size=40&words=normal&shapes=hvd&board=letters&cats=frutas,colores&time=10
```

| Parameter | Values | Default |
| --- | --- | --- |
| `seed` | integer (required) | |
| `lang` | `es`, `en`, `de` (the words come from that language) | the player's |
| `size` | `20`, `40`, `60`, `80` | `40` |
| `words` | `few`, `normal`, `many` | `normal` |
| `shapes` | letters: `h` horizontal, `v` vertical, `d` diagonal, `r` also backwards, `o` straight snake, `s` free snake | `hv` |
| `board` | `letters`, `few`, `symbols`, `emoji`, `numbers` | `letters` |
| `cats` | category ids, comma-separated (letters only; none: random words) | none |
| `time` | minutes: `0`, `10`, `25`, `50`, `100` | `0` (no limit) |

The same options and seed in the app's custom game give the same board.
