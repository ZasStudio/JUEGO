# 🎮 Streamer Life 3D

Simulador de vida de streamer 100% en 3D, en el navegador (Three.js + Vite). Empiezas en un pequeño apartamento con una PC vieja y $500. Tu meta: llegar a **100.000 seguidores** sin que te desalojen.

## ▶️ Cómo ejecutarlo

```bash
npm install
npm run dev      # abre http://localhost:5173
npm run build    # genera la versión final en dist/
```

## 🕹️ Controles

| Tecla | Acción |
|---|---|
| WASD / Flechas | Moverse (Shift para correr) |
| Arrastrar ratón | Girar cámara · Rueda: zoom |
| E | Interactuar |
| Tab | Teléfono (estado, inventario, misiones, delivery, ajustes) |
| Esc | Pausa / volver |

## ✨ Funciones

**Personaje 3D**: creador con piel, 8 peinados, colores, ropa, lentes, barba, audífonos, altura y complexión. Animaciones procedurales: caminar, sentarse, teclear, dormir, comer, reacciones (saludar, celebrar, susto, facepalm).

**Mundo 3D**
- Apartamento: rincón de streaming, banco de trabajo, dormitorio, baño, cocina y sala. Las paredes se vuelven transparentes al tapar la cámara.
- Ciclo día/noche con luces que cambian, ventanas con la ciudad de fondo.
- Calle con Supermercado, PC Zone (comprar y vender piezas), Café Byte, Gimnasio, parque con fuente, peatones y autos.

**Streaming (app Streamix)**
- Eliges juego, título y resolución. Análisis previo: popularidad, competencia, descubribilidad, tendencia diaria, temperatura de la CPU, subida de internet y requisitos de la PC.
- Simulación de espectadores según seguidores, calidad de la PC, cámara, micrófono, luces, decoración, ánimo, horario, hype, anuncios en redes y carisma.
- Chat en vivo con cientos de mensajes, donaciones (agradecer), trolls (banear), preguntas con respuestas, raids, colaboraciones, anuncios y menciones de patrocinadores.
- **Minijuegos** según el género: puntería (shooters), timing (carreras/deportes/plataformas), QTE con flechas (terror/souls/MOBA, con sustos) y temas de charla.
- Facecam real renderizada en 3D si tienes webcam. Lag, frames perdidos y sobrecalentamiento, que puede apagarte la PC en pleno directo.
- Programa de Afiliado (subs, anuncios) y Partner (mejores ingresos, AutoMod). Placas de 1K/10K/100K colgadas en tu pared.

**Hardware**
- 45+ componentes: CPU, GPU, RAM, placa base, almacenamiento, fuente, disipador y gabinete.
- Banco de trabajo 3D: instalar en orden, sockets, DDR4/DDR5, vatios de la fuente, pasta térmica, pruebas de encendido y benchmark.
- **Pedidos de clientes**: armar PCs a medida y **reparar** PCs diagnosticando la pieza dañada según el síntoma.
- Mejora tu propia PC (las piezas viejas vuelven al inventario). La PC junta polvo y hay que limpiarla. Iluminación RGB configurable.

**Contenido y economía**
- VidCut: edita tus VODs eligiendo los mejores fragmentos, la miniatura y el título, y sube videos o shorts que generan vistas, dinero y seguidores. Pueden hacerse virales.
- Chirper (red social): anunciar directos, memes virales, agradecer a la comunidad.
- Correo con pedidos, patrocinios, colaboraciones y fans. Banco con movimientos, renta semanal, internet y electricidad.
- Tiendas: TecnoMarket (con envío a tu puerta), Vapor (juegos), periféricos, decoración, libros y planes de internet.

**Novedades inspiradas en Streamer Life Simulator 2**
- Historia inicial: te despiden de Café Byte y apuestas todo por el streaming. Puedes volver a cubrir **turnos de barista** (minijuego de preparar pedidos contra reloj).
- **Agencia / casa de streaming**: contrata streamers, entrénalos, mantenlos motivados y quédate con el 60% de lo que ganan.
- **ZonaGris**: compra bots de espectadores. Inflan tus números, pero pueden detectarte: 3 advertencias = canal suspendido.
- **Mascotas 3D** (gato o perro) que pasean por tu casa, necesitan comida y cariño, y aparecen en tus directos.

**Gráficos**
- Texturas procedurales PBR (color, relieve y rugosidad): madera, yeso, azulejos, mármol, tela, alfombra, ladrillo, asfalto, concreto y césped.
- Bloom en LEDs, neones y pantallas; reflejos de entorno; cielo dinámico con sol, nubes, atardecer y estrellas; niebla atmosférica.
- Calle más viva: semáforos, papeleras, hidrantes, jardineras, parada de bus, vallas y ciudad en el horizonte.

**Vida**
- Hambre, energía, higiene y diversión: comer, cocinar, café, dormir, ducharse, TV, guitarra, arcade, gimnasio y café.
- Habilidades: Carisma, Gaming, Edición y Hardware (niveles 1-10). Los libros las entrenan.
- 15 misiones guiadas, 15 logros y guardado automático.

## 🗂️ Estructura

```
src/
  core/    estado, guardado, audio sintetizado
  data/    piezas, juegos, objetos, chat, misiones
  world/   personaje, apartamento, calle, modelo 3D de PC
  game/    simulación (tiempo, economía, correos) y motor de directos
  ui/      HUD, PC del juego (apps), directo, banco de trabajo, creador
  main.js  bucle, cámara, controles e interacciones
```
