# Portfolio

Photography portfolio of Bárbara Hernández.

https://portfolio-d9p.pages.dev

Photos are laid out on a rotating ring and can be sorted by color or grouped by trip. There is also an index view and an about page. The hanging lamp in the corner switches between a dark and a light theme, and the background sound is synthesized in the browser.

Built with Astro and GSAP, deployed on Cloudflare Pages.

```bash
npm install
npm run dev
npm run build
```

Photos go in `src/assets/gallery`, their places in `src/data/photos.json` and the trips in `src/data/trips.json`.

Before/after pairs go in `src/assets/before-after`, named `name-before.jpg` and `name-after.jpg`. The section shows up in the menu once there is at least one pair.

All photographs © Bárbara Hernández.
