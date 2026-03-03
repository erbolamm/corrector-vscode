# Corrector — Asistente de escritura para Copilot Chat

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

- **Corrector: Agregar palabra al diccionario personal** — Añade pares error→correcto
- **Corrector: Ver diccionario personal** — Lista y elimina entradas
- **Corrector: Ver estadísticas de correcciones** — Estadísticas de uso

## Configuración

| Opción | Por defecto | Descripción |
|--------|-------------|-------------|
| `corrector.mostrarOriginal` | `true` | Mostrar el texto original junto a la corrección |
| `corrector.mostrarExplicaciones` | `true` | Mostrar qué se corrigió y por qué |

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

## Autor

Javier Mateo (ApliArte) — [github.com/erbolamm](https://github.com/erbolamm)

## 💖 Apoya el proyecto

Herramienta gratuita y open source. Si te ahorra tiempo, un café ayuda a mantener el desarrollo.

| Plataforma | Enlace |
|------------|--------|
| PayPal | [paypal.me/erbolamm](https://www.paypal.com/paypalme/erbolamm) |
| Ko-fi | [ko-fi.com/C0C11TWR1K](https://ko-fi.com/C0C11TWR1K) |
| Twitch Tip | [streamelements.com/apliarte/tip](https://streamelements.com/apliarte/tip) |

🌐 [Sitio Oficial](https://apliarte-click-pro-2026.web.app/) · 📦 [GitHub](https://github.com/erbolamm/corrector-vscode)

## Licencia

MIT — © 2026 ApliArte
