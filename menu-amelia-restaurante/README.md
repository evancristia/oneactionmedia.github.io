# Menú Digital — Restaurante Amelia

Menú digital elegante para el restaurante **Amelia**, diseñado para ser usado desde el móvil del comensal.

## Características

- Diseño negro, dorado y blanco con tipografía serif de lujo
- 4 secciones navegables: Entradas (8), Platos Principales (15), Postres (4), Bebidas (12)
- Modal deslizante al tocar cada plato con descripción completa e ingredientes
- Imágenes desde Cloudinary (`cloud name: daircfrad`, carpeta `Restaurante/`)
- Placeholders en emoji para imágenes pendientes de subir a Cloudinary
- Animaciones suaves y diseño 100% responsivo para móvil

## Estructura

```
menu-amelia-restaurante/
├── amelia-menu.html   ← archivo principal (autocontenido, sin dependencias locales)
├── README.md
└── .gitignore
```

## Cómo agregar imágenes

En `amelia-menu.html`, cada plato tiene un campo `img`. Para reemplazar un placeholder:

```js
img: null  // ← placeholder actual (emoji)

// Reemplazar con la URL de Cloudinary:
img: 'https://res.cloudinary.com/daircfrad/image/upload/Restaurante/nombre_imagen.jpg'
```

El campo `CL` al inicio del script contiene la base de Cloudinary para facilitar el mantenimiento:

```js
const CL = 'https://res.cloudinary.com/daircfrad/image/upload/Restaurante/';
```

## Tecnologías

- HTML5 / CSS3 / JavaScript vanilla
- Fuentes: Cormorant Garamond + Raleway (Google Fonts)
- Imágenes: Cloudinary CDN
