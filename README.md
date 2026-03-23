# stShifts

Gestión de horarios de trabajo para equipos de cocina y caja.

## Desarrollo local

```bash
npm install
npm run dev
```

Abre http://localhost:5173

## Deploy en Netlify desde GitHub

1. Sube esta carpeta a un repositorio GitHub nuevo
2. Ve a [netlify.com](https://netlify.com) → **Add new site** → **Import from Git**
3. Selecciona tu repositorio
4. Netlify detecta automáticamente la configuración desde `netlify.toml`
5. Clic en **Deploy site**

El build corre `npm run build` y publica la carpeta `dist/`.

## Backup y restauración

Usa los botones ↓ y ↑ en la barra superior para guardar y restaurar toda la información (horarios, turnos, tareas, colación, plancha) en un archivo `.json`.
