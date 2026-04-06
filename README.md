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

> ℹ️ **Nota:** El texto siguiente es un mensaje personal del autor, escrito en varios idiomas para que pueda leerlo gente de todo el mundo. Esto **no significa** que el corrector funcione en esos idiomas — el motor de corrección es exclusivamente para **español**.

> ℹ️ **Note:** The text below is a personal message from the author, written in several languages so people around the world can read it. This does **not** mean the corrector works in those languages — the correction engine is exclusively for **Spanish**.

<details>
<summary>🇪🇸 Español</summary>

Soy un desarrollador indie, sin estudios, que ha aprendido todo por su cuenta a base de esfuerzo y persistencia. Tengo dislexia y necesitaba un corrector así para poder comunicarme mejor con las herramientas de IA. Cuando lo tuve funcionando, pensé: ¿para qué tenerlo solo para mí?

He decidido compartirlo con el mundo. Me ha costado mucho esfuerzo construir esto.

Si te sirve y te ahorra tiempo, te agradecería mucho una ⭐ en GitHub y 5 estrellas en el Marketplace. Y si puedes, un pequeño donativo me ayudaría enormemente — soy padre de dos niños y cada euro cuenta para colegio, libros, comedor y alquiler.

Gracias de corazón por usar Corrector.

</details>

<details>
<summary>🇬🇧 English</summary>

I'm an indie developer, self-taught, who learned everything from scratch through sheer effort and persistence. I have dyslexia and I needed a spell checker like this to communicate better with AI tools. When I got it working, I thought: why keep it just for myself?

So I decided to share it with the world. Building this took a lot of effort.

If it helps you, I'd really appreciate a ⭐ on GitHub and 5 stars on the Marketplace. And if you can, a small donation would help me enormously — I'm a father of two kids and every euro counts for school, books, meals, and rent.

Thank you from the bottom of my heart for using Corrector.

</details>

<details>
<summary>🇧🇷 Português</summary>

Sou um desenvolvedor indie, autodidata, que aprendeu tudo do zero com muito esforço e persistência. Tenho dislexia e precisava de um corretor assim para me comunicar melhor com ferramentas de IA. Quando consegui fazer funcionar, pensei: por que guardar só para mim?

Decidi compartilhar com o mundo. Construir isso me custou muito esforço.

Se te ajudar, agradeceria muito uma ⭐ no GitHub e 5 estrelas no Marketplace. E se puder, uma pequena doação me ajudaria enormemente — sou pai de duas crianças e cada euro conta para escola, livros, alimentação e aluguel.

Obrigado de coração por usar o Corrector.

</details>

<details>
<summary>🇫🇷 Français</summary>

Je suis un développeur indie, autodidacte, qui a tout appris par lui-même à force d'efforts et de persévérance. J'ai une dyslexie et j'avais besoin d'un correcteur comme celui-ci pour mieux communiquer avec les outils d'IA. Quand il a fonctionné, je me suis dit : pourquoi le garder pour moi seul ?

J'ai décidé de le partager avec le monde. Construire cet outil m'a demandé beaucoup d'efforts.

S'il vous est utile, je vous serais très reconnaissant de laisser une ⭐ sur GitHub et 5 étoiles sur le Marketplace. Et si vous le pouvez, un petit don m'aiderait énormément — je suis père de deux enfants et chaque euro compte pour l'école, les livres, la cantine et le loyer.

Merci du fond du cœur d'utiliser Corrector.

</details>

<details>
<summary>🇩🇪 Deutsch</summary>

Ich bin ein Indie-Entwickler, Autodidakt, der sich alles selbst beigebracht hat — durch Anstrengung und Ausdauer. Ich habe Legasthenie und brauchte einen Korrektor wie diesen, um besser mit KI-Tools kommunizieren zu können. Als er funktionierte, dachte ich: Warum ihn nur für mich behalten?

Ich habe mich entschlossen, ihn mit der Welt zu teilen. Dieses Tool zu bauen hat mich viel Mühe gekostet.

Wenn es dir hilft, würde ich mich sehr über einen ⭐ auf GitHub und 5 Sterne im Marketplace freuen. Und wenn du kannst, würde mir eine kleine Spende enorm helfen — ich bin Vater von zwei Kindern und jeder Euro zählt für Schule, Bücher, Essen und Miete.

Danke von ganzem Herzen, dass du Corrector benutzt.

</details>

<details>
<summary>🇮🇹 Italiano</summary>

Sono uno sviluppatore indie, autodidatta, che ha imparato tutto da zero con tanto impegno e perseveranza. Ho la dislessia e avevo bisogno di un correttore così per comunicare meglio con gli strumenti di IA. Quando ha funzionato, ho pensato: perché tenerlo solo per me?

Ho deciso di condividerlo con il mondo. Costruire questo mi è costato molto sforzo.

Se ti è utile, ti sarei molto grato per una ⭐ su GitHub e 5 stelle sul Marketplace. E se puoi, una piccola donazione mi aiuterebbe enormemente — sono padre di due bambini e ogni euro conta per scuola, libri, mensa e affitto.

Grazie di cuore per usare Corrector.

</details>

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

🌐 [Sitio Oficial](https://apliarte-click-pro-2026.web.app/) · 📦 [GitHub](https://github.com/erbolamm/corrector-vscode)

## Licencia

MIT — © 2026 ApliArte
