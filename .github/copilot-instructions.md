# Instrucciones para Agentes IA — Proyecto corrector-vscode

## IDENTIDAD DEL PROYECTO

**Corrector** es una extensión de VS Code que añade un Chat Participant (`@corrector`) al chat de GitHub Copilot. Corrige ortografía y gramática en español, diseñada especialmente para personas con dislexia. Funciona 100% offline por defecto, con modo IA opcional.

- **Nombre del paquete:** `corrector-copilot`
- **Versión actual:** 0.2.0
- **Publisher:** Corrector (VS Code Marketplace)
- **Repo:** https://github.com/erbolamm/corrector-vscode
- **Marketplace:** https://marketplace.visualstudio.com/publishers/Corrector
- **Autor:** Javier Mateo (ApliArte / erbolamm)
- **Licencia:** MIT

## STACK TECNOLÓGICO

- **Lenguaje:** TypeScript
- **API:** VS Code Chat Participant API + Language Model API (opcional)
- **Motor versión:** VS Code `^1.93.0`
- **Build:** `tsc` (TypeScript compiler)
- **Paquetizado:** `@vscode/vsce` → genera `.vsix`
- **Dependencias externas:** NINGUNA (solo `@types/vscode`, `@types/node`, `typescript`, `@vscode/vsce` como dev)

## ARQUITECTURA

```
src/
├── extension.ts   — Punto de entrada. Registra Chat Participant, comandos,
│                    slash commands. Maneja el flujo dual offline/IA.
│                    ~580 líneas.
└── corrector.ts   — Motor de corrección offline. 150+ reglas para español.
                     Clase MotorCorrector con diccionario personal persistente.
                     ~510 líneas.
```

### Flujo de funcionamiento

1. Usuario escribe `@corrector <texto>` en el chat de Copilot
2. `manejarMensajeChat()` en extension.ts recibe el mensaje
3. `MotorCorrector.corregir(texto)` aplica 4 pasadas de corrección:
   - Diccionario directo (150+ pares error→correcto)
   - Diccionario personal (reglas del usuario)
   - Patrones fonéticos (regex)
   - Tildes automáticas
4. Si hay correcciones → muestra texto corregido + 3 botones (Copiar, Enviar a Copilot, Permitir siempre)
5. Si NO hay correcciones y `reenviarACopilot` está activado → reenvía al modelo de IA seleccionado

### Dos modos de funcionamiento

| Modo | Setting | Coste |
|------|---------|-------|
| **Offline** (defecto) | `reenviarACopilot: false` | 0 tokens |
| **IA** (opcional) | `reenviarACopilot: true` | Consume tokens del plan |

## ARCHIVOS CLAVE

| Archivo | Propósito |
|---------|-----------|
| `src/extension.ts` | Entry point, Chat Participant handler, comandos, selector de modelos |
| `src/corrector.ts` | Motor corrector offline con 150+ reglas español |
| `package.json` | Manifiesto de la extensión (commands, settings, chatParticipants) |
| `README.md` | Documentación completa + nota personal en 6 idiomas + links donación |
| `CHANGELOG.md` | Historial de versiones |
| `icon.png` | Icono de la extensión (128×128, escalado de apliarte.png) |
| `docs/blogger_corrector_post.html` | Post HTML para Blogger |
| `.vscode/launch.json` | Config para depurar con F5 |
| `.vscode/tasks.json` | Tareas de compilación |

## SLASH COMMANDS REGISTRADOS

| Comando | Función |
|---------|---------|
| `/ayuda` | Ayuda completa |
| `/agregar` | Añadir regla al diccionario personal (formato: error=correcto) |
| `/ignorar` | Marcar palabra como ignorada |
| `/stats` | Estadísticas de uso |
| `/modelos` | Lista todos los modelos de IA disponibles en VS Code |

## SETTINGS DE LA EXTENSIÓN

| Setting | Tipo | Default | Propósito |
|---------|------|---------|-----------|
| `corrector.mostrarOriginal` | boolean | true | Mostrar texto original junto a corrección |
| `corrector.mostrarExplicaciones` | boolean | true | Mostrar detalle de cada corrección |
| `corrector.reenviarACopilot` | boolean | false | Modo IA: reenviar texto sin errores al modelo |
| `corrector.modeloPreferido` | string | "" | Modelo preferido para reenvío (vacío = elegir cada vez) |

## FUNCIONES CLAVE EN EL CÓDIGO

### extension.ts
- `activate()` — Registra participant, comandos, mensaje de bienvenida
- `manejarMensajeChat()` — Handler principal del chat
- `seleccionarModelo()` — Selector dinámico: lee `modeloPreferido`, busca por familia/nombre/id, QuickPick si hay varios
- `mostrarModelosDisponibles()` — Lista modelos vía `vscode.lm.selectChatModels()` sin filtro
- `cargarDatosGuardados()` / `guardarDatos()` — Persistencia del diccionario personal

### corrector.ts
- `CORRECCIONES_DIRECTAS` — Map con 150+ pares error→correcto
- `REGLAS_FONETICAS` — Array de regex para patrones fonéticos (ke→que, xq→porque, tb→también)
- `MotorCorrector.corregir(texto)` — 4 pasadas de corrección, preserva capitalización
- `MotorCorrector.agregarPalabra()` / `ignorarPalabra()` — Diccionario personal

## REGLAS PARA AGENTES

1. **Idioma:** Todo el código, comentarios y UI están en español
2. **Sin dependencias externas:** La corrección SIEMPRE debe funcionar offline. Nunca añadir APIs externas al motor corrector
3. **La IA es OPCIONAL:** El modo IA (`reenviarACopilot`) está desactivado por defecto. Nunca cambiar ese default
4. **Preservar capitalización:** El corrector ya maneja MAYÚSCULAS, Capitalizado y minúsculas. No romper esto
5. **Diccionario personal persistente:** Se guarda en `context.globalState`. No cambiar el mecanismo de persistencia sin motivo
6. **Compilar antes de empaquetar:** `npm run compile && npm run package`
7. **No editar promt.txt** — Es un log de referencia, no se modifica

## SOBRE EL AUTOR

Javier Mateo (ApliArte/erbolamm). Desarrollador indie autodidacta. Tiene dislexia y creó esta herramienta por necesidad propia. Es parte de un proyecto mayor: ApliArteBot, un bot autónomo que es su legado digital para su familia (Mabel, Alba y Fran).

Cada idea que aporte Javier se trata con máxima seriedad. Responder siempre en español castellano.

## HISTORIAL DE VERSIONES

- **v0.1.0** — Primera versión: Chat Participant + motor 150 reglas + diccionario personal
- **v0.1.1** — Bump de versión por conflicto en Marketplace
- **v0.1.2** — Eliminada dependencia de IA (quitado `vscode.lm.selectChatModels`). 100% offline sin diálogos de permisos
- **v0.2.0** — IA restaurada como OPCIONAL (`reenviarACopilot`, default false). Selector dinámico de modelos. Comando `/modelos`. Nota personal en 6 idiomas. Links de donación

---

## BUGS CONOCIDOS Y GAPS DEL MOTOR (revisión 2026-03-03)

### Bugs funcionales confirmados

**BUG-1: Estadísticas se pierden al reiniciar VS Code**
- `guardarDatos()` en `extension.ts` sí persiste `mensajesCorregidos` y `totalCorrecciones`
- `cargarDatosGuardados()` NUNCA los restaura, el motor siempre arranca con ceros
- FIX: añadir lectura del objeto `estadisticas` en `cargarDatosGuardados()`

**BUG-2: Lógica anti-doble-corrección incorrecta**
- En `corrector.ts` en `aplicarReglasPatron()`, la condición `c.corregido === match` debería ser `c.original === match`
- Efecto: algunas correcciones de patrones fonéticos se saltan incorrectamente

**BUG-3: Entrada duplicada en CORRECCIONES_DIRECTAS**
- `'yegar'` aparece dos veces en el Map. La segunda sobreescribe silenciosamente.

**BUG-4: Entradas inútiles en el diccionario**
- `'abrir'`, `'llegar'`, `'consejo'` tienen `corregido === error`, nunca hacen nada.

### Falsos positivos conocidos (alta frecuencia)

- `mas` se corrige a `más` pero `mas` es conjunción adversativa válida ("mas no lo hizo")
- `ay` se corrige a `hay` pero `¡Ay!` es interjección válida
- `q` (patrón fonético) se corrige a `que` pero es variable habitual en código, física, matemáticas

### Gaps en el diccionario (palabras que faltan, confirmadas con uso real)

Evidencia visual de fallo documentado — captura 2026-03-03:
- Entrada: `ola gue tal ertas`
- Salida real: `hola gue tal ertas` ("gue" y "ertas" NO se corrigen)
- Esperado: `hola que tal estas`

Palabras que hay que añadir:
- `gue` -> `que` (g->q: tecla adyacente en teclado, error típico dislexia)
- `ertas` -> `estas` (transposición: e-r-t-a-s -> e-s-t-a-s)
- `biene` -> `viene` (b->v: viene)
- `bienen` -> `vienen` (b->v: vienen)
- `abeces` -> `a veces` (b->v + separación)
- `hayga` -> `haya` (ultracorrección habitual)
- `estava` -> `estaba` (v->b: estaba)
- `estavamos` -> `estábamos` (v->b + tilde)

### Prioridad para v0.2.1

1. Corregir BUG-1 (estadísticas) y BUG-2 (anti-doble-corrección)
2. Añadir las palabras de la lista de gaps
3. Revisar falsos positivos `mas` y `ay` (posible eliminación)
4. Limpiar entradas duplicadas/vacías del diccionario
5. Tests unitarios con los casos de fallo documentados aquí
