# Gallery Manager (React)

This project is a React + TypeScript transcription of the original Python/Tkinter gallery manager.

## Implemented Features

- Create, open, and delete galleries
- Keep a recent gallery list (up to 10)
- Import image files into the current gallery
- Generate and show thumbnails
- Show/edit metadata inline (artist, technique, title, dimensions, notes)
- Preview full image on thumbnail double-click
- Delete selected image
- Export selected image (download)
- Persist all gallery data in browser `localStorage`

## Notes on Browser vs Python Version

- The Python app stores data/files on disk with SQLite; this React version stores state in browser `localStorage`.
- Folder pickers and direct filesystem writes are replaced with browser-safe interactions.

## Development

```bash
npm install
npm run dev
```

## Quality Checks

```bash
npm run lint
npm run build
```

## Build Output

Production output is generated in `dist/`.
