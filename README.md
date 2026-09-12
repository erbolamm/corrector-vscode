<p align="center">
  <img src="icon.png" alt="Corrector Español" width="128" />
</p>

<h1 align="center">Corrector — Asistente de escritura para Copilot Chat</h1>

<p align="center">
  <strong>Corrección ortográfica en español para VS Code.</strong><br>
  100% offline, sin dependencias externas. Diseñado especialmente para personas con dislexia.
</p>

<p align="center">
  <a href="https://marketplace.visualstudio.com/items?itemName=apliarte.corrector-espanol">
    <img src="https://img.shields.io/visual-studio-marketplace/v/apliarte.corrector-espanol?label=Marketplace&color=blue" alt="VS Marketplace Version" />
  </a>
  <a href="https://marketplace.visualstudio.com/items?itemName=apliarte.corrector-espanol">
    <img src="https://img.shields.io/visual-studio-marketplace/i/apliarte.corrector-espanol?label=Installs&color=green" alt="VS Marketplace Installs" />
  </a>
  <a href="LICENSE">
    <img src="https://img.shields.io/github/license/erbolamm/corrector-vscode" alt="License" />
  </a>
</p>

<p align="center">
  <a href="https://marketplace.visualstudio.com/items?itemName=apliarte.corrector-espanol">VS Marketplace</a> · 
  <a href="https://open-vsx.org/extension/apliarte/corrector-espanol">Open VSX (Cursor/Windsurf/Antigravity)</a> · 
  <a href="https://github.com/erbolamm/corrector-vscode">GitHub</a>
  <a href="https://discord.gg/SRwuZXpsZw">Discord</a>
</p>

---

> 🇪🇸 **Este corrector funciona SOLO en español.** Detecta y corrige errores ortográficos del idioma español. No corrige otros idiomas.

Extensión de VS Code que corrige la ortografía y gramática en español dentro del chat de GitHub Copilot.

Diseñada especialmente para personas con dislexia. Funciona 100% offline, sin dependencias externas.

## Cómo usar

1. Abre el chat de Copilot (Ctrl+Shift+I / Cmd+Shift+I)
2. Escribe `@corrector` seguido de tu texto
3. El corrector muestra el texto corregido con explicaciones

### Ejemplo

```
@corrector ola vuenos dias kiero aser una app para el movil
```

Resultado:
> Hola buenos días quiero hacer una app para el móvil

Con las correcciones detalladas:
- ~~ola~~ → **hola** _(h omitida)_
- ~~vuenos~~ → **buenos** _(v→b)_
- ~~dias~~ → **días** _(tilde)_
- ~~kiero~~ → **quiero** _(k→qu)_
- ~~aser~~ → **hacer** _(h omitida + c→s)_

## Comandos en el chat

| Comando | Qué hace |
|---------|----------|
| `@corrector tu texto` | Corrige el texto |
| `@corrector /ayuda` | Muestra la ayuda completa |
| `@corrector /agregar errorr=correcto` | Añade una palabra al diccionario personal |
| `@corrector /ignorar wifi` | Ignora una palabra (no la corrige) |
| `@corrector /stats` | Muestra estadísticas de uso |

## Comandos en la paleta

- **Corrector: Abrir menú principal** — Abre un desplegable con todas las acciones rápidas (activar/desactivar, correcciones, diccionario, fuente, estadísticas, sugerencias)
- **Corrector: Activar/Desactivar corrección en el editor** — Enciende o apaga el subrayado ortográfico en archivos
- **Corrector: Ver correcciones del documento** — Abre el diálogo interactivo de correcciones del archivo activo
- **Corrector: Corregir todo el documento** — Aplica todas las correcciones detectadas de una vez
- **Corrector: Activar/Desactivar fuente OpenDyslexic** — Cambia la fuente del editor/terminal
- **Corrector: Agregar palabra al diccionario personal** — Añade pares error→correcto
- **Corrector: Ver diccionario personal** — Lista y elimina entradas
- **Corrector: Ver estadísticas de correcciones** — Estadísticas de uso
- **Corrector: Enviar sugerencias por email** — Envía `.corrector-sugerencias.md` al desarrollador
- **Corrector: Abrir IA local** — Abre el panel lateral de IA local (buscar, descargar y cargar modelos)

## Panel de IA local

La 2.0.0 añade un panel lateral para gestionar los modelos que corren en tu máquina, sin enviar nada
a ningún servidor. Se abre con **Corrector: Abrir IA local** o desde su icono en la barra de actividad.

| Sección | Qué hace |
|---------|----------|
| **Modelo actual** | Qué modelo está cargado, con botón para liberarlo y devolver la memoria |
| **Modelos instalados** | Los que ya tienes en disco, con su tamaño. Se leen de tu carpeta de modelos y de la caché de HuggingFace (`~/.cache/huggingface/hub`) |
| **Recomendados** | SmolLM2 360M y Qwen 2.5 0.5B, listos para cargar con un botón |
| **Buscar en HuggingFace** | Busca modelos ONNX compatibles con transformers.js y muestra nombre, repositorio y descargas |
| **Carpeta de modelos** | Dónde se guardan y cuántos hay. Si detecta la carpeta configurada en ApliArte AI, ofrece reutilizarla en vez de descargar lo mismo dos veces |

Antes de cargar un modelo, el panel **comprueba la memoria disponible**. Si no llega, avisa y no
carga: un modelo más grande que tu RAM puede dejar el equipo sin responder, y eso no se arregla
esperando.

Los modelos se descargan a un archivo temporal dentro de la carpeta permitida, se comprueba su
integridad y solo entonces se renombran a su destino. Un archivo a medias nunca se confunde con un
modelo válido, y no se acepta ningún identificador que no sea del formato `org/modelo` de un
repositorio de la lista permitida.

El panel se pinta con `textContent` y nada de `innerHTML` con texto de fuera, tiene tema claro y
oscuro, y respeta `prefers-reduced-motion`.

## Configuración

| Opción | Por defecto | Descripción |
|--------|-------------|-------------|
| `corrector.mostrarOriginal` | `true` | Mostrar el texto original junto a la corrección |
| `corrector.mostrarExplicaciones` | `true` | Mostrar qué se corrigió y por qué |
| `corrector.reenviarACopilot` | `false` | **Modo IA (opcional):** reenvía el texto sin errores directamente a Copilot. ⚠️ Consume tokens |

### Dos modos de funcionamiento

| Modo | Setting | Comportamiento | Coste |
|------|---------|---------------|-------|
| **Offline** (defecto) | `reenviarACopilot: false` | Corrige → muestra resultado → tú decides si envías a Copilot con el botón | **0 tokens** |
| **IA** (opcional) | `reenviarACopilot: true` | Corrige → si no hay errores, reenvía automáticamente a Copilot y recibes su respuesta | **Consume tokens de tu plan** |

> ⚠️ **El modo IA consume Premium Requests de GitHub Copilot.** Si tienes un plan limitado, úsalo con cuidado. La corrección ortográfica siempre es gratuita y offline.

## Reglas incluidas

El motor incluye más de 150 reglas para los errores más comunes en español:

- **Confusión b/v** — vueno→bueno, bamos→vamos
- **H omitida/añadida** — ola→hola, aser→hacer
- **Confusión c/s/z** — desir→decir, grasias→gracias
- **Confusión g/j** — jenial→genial, pajina→página
- **Confusión ll/y** — yegar→llegar, yamar→llamar
- **Tildes automáticas** — dias→días, tambien→también, aplicacion→aplicación
- **N→M antes de b/p** — enpezar→empezar, tanpoco→tampoco
- **Abreviaturas chat** — q→que, xq→porque, tb→también
- **Transposiciones** — porgrama→programa, comadno→comando
- **Diccionario personal** — Tus propias reglas personalizadas

## Desarrollo

```bash
# Instalar dependencias
npm install

# Compilar
npm run compile

# Modo watch (recompila al guardar)
npm run watch

# Probar: F5 en VS Code abre una ventana con la extensión cargada

# Empaquetar
npm run package
```

## Instalación en Windsurf / Antigravity / Open VSX

Estas IDEs usan Open VSX en lugar del Marketplace de Microsoft. Como el proceso de publicación en Open VSX requiere cuenta Eclipse + acuerdo legal, la forma más rápida de instalar es:

### Opción 1: Instalación manual (recomendada)

1. Descarga el archivo `.vsix` desde [GitHub Releases](https://github.com/erbolamm/corrector-vscode/releases)
2. En Windsurf/Antigravity: abre la paleta de comandos (`Ctrl+Shift+P` / `Cmd+Shift+P`)
3. Ejecuta: `Extensions: Install from VSIX...`
4. Selecciona el archivo descargado
5. ¡Listo! La extensión se instala y se activa automáticamente

### Opción 2: Desde el Marketplace de Microsoft

Si tu IDE lo permite, cambia el origen de extensiones:
1. Settings (`Ctrl+,`) → busca `extensions gallery`
2. Cambia las URLs al Marketplace de Microsoft:
   - Service URL: `https://marketplace.visualstudio.com/_apis/public/gallery`
   - Item URL: `https://marketplace.visualstudio.com/items`

## Autor

Javier Mateo (ApliArte) — [github.com/erbolamm](https://github.com/erbolamm)

---

### 💬 Una nota personal del autor / A personal note from the author

Se movió a la landing: [erbolamm.github.io/corrector-vscode](https://erbolamm.github.io/corrector-vscode/#author), escrita en 6 idiomas.

---

## � Comparte

Si te gusta Corrector Español, ayuda a que más gente lo conozca:

[![Compartir en Twitter](https://img.shields.io/badge/Twitter-Compartir-1DA1F2?logo=twitter&logoColor=white)](https://twitter.com/intent/tweet?text=Corrector%20ortogr%C3%A1fico%20en%20espa%C3%B1ol%20para%20VS%20Code.%20100%25%20offline%2C%20dise%C3%B1ado%20para%20dislexia.&url=https%3A%2F%2Fgithub.com%2Ferbolamm%2Fcorrector-vscode&via=erbolamm)
[![Compartir en LinkedIn](https://img.shields.io/badge/LinkedIn-Compartir-0A66C2?logo=linkedin&logoColor=white)](https://www.linkedin.com/sharing/share-offsite/?url=https%3A%2F%2Fgithub.com%2Ferbolamm%2Fcorrector-vscode)
[![Compartir en Reddit](https://img.shields.io/badge/Reddit-Compartir-FF4500?logo=reddit&logoColor=white)](https://www.reddit.com/submit?url=https%3A%2F%2Fgithub.com%2Ferbolamm%2Fcorrector-vscode&title=Corrector%20Espa%C3%B1ol%20%E2%80%94%20Ortograf%C3%ADa%20para%20Copilot%20Chat)
[![Compartir en WhatsApp](https://img.shields.io/badge/WhatsApp-Compartir-25D366?logo=whatsapp&logoColor=white)](https://api.whatsapp.com/send?text=Corrector%20ortogr%C3%A1fico%20para%20VS%20Code%20%E2%80%94%20100%25%20offline%2C%20dise%C3%B1ado%20para%20dislexia.%20https%3A%2F%2Fgithub.com%2Ferbolamm%2Fcorrector-vscode)

## �💖 Apoya el proyecto

Herramienta gratuita y open source. Si te ahorra tiempo, un café ayuda a mantener el desarrollo.

| Plataforma | Enlace |
|------------|--------|
| PayPal | [paypal.me/erbolamm](https://www.paypal.com/paypalme/erbolamm) |
| Ko-fi | [ko-fi.com/C0C11TWR1K](https://ko-fi.com/C0C11TWR1K) |
| Twitch Tip | [streamelements.com/apliarte/tip](https://streamelements.com/apliarte/tip) |

🌐 [Landing](https://erbolamm.github.io/corrector-vscode/) · 📦 [GitHub](https://github.com/erbolamm/corrector-vscode)

## Licencia

MIT — © 2026 ApliArte
