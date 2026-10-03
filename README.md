# Quantact Partners — M. Umer Ijaz

Single-page site for an accounting and advisory practice. Plain HTML, CSS and a small script: no frameworks, no build step, no image downloads. The hero backdrop is layered CSS gradients plus a lightweight 2D canvas; everything else is glass surfaces over soft colour fields.

## Run locally

Open `index.html` directly, or serve the folder with any static server:

```sh
python3 -m http.server 8000
```

## Structure

```
index.html            page markup
assets/css/style.css  design tokens, layout, animations, responsive rules
assets/js/main.js     navigation, scroll reveals, counters, calculator, hero canvas
```

## Palette

| Role     | Hex       |
|----------|-----------|
| Teal     | `#004B49` |
| Sage     | `#B7C7A3` |
| Ivory    | `#F6F5EF` |
| Charcoal | `#1F2523` |

## Contact details

Edit the email and phone in `index.html` (search for `mumeraijaz` and `+92 336`).
