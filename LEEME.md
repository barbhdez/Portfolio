# Portfolio

## Arrancar
1. Abre esta carpeta en VS Code → Terminal → Nueva terminal
2. `npm install`   (solo la primera vez o cuando cambien las dependencias)
3. `npm run dev`  → abre http://localhost:4321

## Dónde se cambia cada cosa
- Fotos del anillo/índice .... src/assets/galeria/        (orden = orden alfabético del nombre)
- Antes / Después ............ src/assets/antes-despues/  (foto-antes.jpg + foto-despues.jpg)
- Nombre, firma, bio, email .. src/data/config.json       ("firma" = el texto que se dibuja a mano)
- Modo inicial ............... src/data/config.json       ("temaInicial": "oscuro" o "claro")
- Títulos de fotos ........... src/data/fotos.json        (opcional)
- Colores de cada modo ....... src/styles/global.css      (arriba del todo)
- Animaciones ................ src/scripts/portfolio.ts   (busca los ⚙)

## Publicar gratis (Cloudflare Pages)
1. Sube la carpeta a un repositorio de GitHub (sin node_modules ni dist).
2. Cloudflare → Workers & Pages → Create → Pages → conecta el repo.
3. Framework: Astro · Build command: npm run build · Output: dist
4. Dominio propio: se añade en "Custom domains".
