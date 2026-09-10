# Changelog

## [1.0.1] — 2026-03-08

### Cambiado
- Bump de versión para publicación en Marketplace bajo publisher `apliarte`

## [1.0.0] — 2026-03-08

### Cambiado
- **Nuevo nombre del paquete:** `corrector-espanol` (antes: `corrector-copilot`)
- **Nuevo publisher:** `apliarte` (antes: `Corrector`)
- Eliminados todos los `.vsix` generados bajo el publisher antiguo
- Corrección en el editor activada desde barra de estado con menú principal
- Motor bilingüe completo (ES/EN) probado con 83 tests automatizados

### Añadido
- Proveedor de Quick Fixes (Code Actions): botones ✏️ Cambiar, 📖 Diccionario, 💡 Sugerir
- Comando "Corregir todo el documento" con confirmación previa
- Archivo `.corrector-sugerencias.md` — log de sugerencias de usuarios
- Comando "Enviar sugerencias por email" con las sugerencias agrupadas
- Menú principal desde barra de estado (QuickPick con todas las acciones)
- Detección automática de idioma (español / inglés) con indicador 🇪🇸/🇬🇧

### Arreglado (consolidado desde v0.2.1)
- BUG-1: Estadísticas persisten correctamente al reiniciar VS Code
- BUG-2: Lógica anti-doble-corrección corregida (`c.original === match`)
- BUG-3: Entrada duplicada de `yegar` eliminada del diccionario
- BUG-4: Entradas inútiles (`abrir`, `llegar`, `consejo`) eliminadas
- Palabras añadidas al diccionario: `gue→que`, `ertas→estas`, `biene→viene`, `bienen→vienen`, `abeces→a veces`, `hayga→haya`, `estava→estaba`, `estavamos→estábamos`

## [0.2.4] — 2026-03-03

### Añadido
- **Correcciones interactivas (Quick Fixes):** Al hacer clic en la bombilla (💡) o `Cmd+.` sobre una palabra subrayada aparecen 3 opciones:
  - ✏️ **Cambiar** — aplica la corrección directamente en el código
  - 📖 **Añadir al diccionario personal** — la palabra deja de marcarse como error
  - 💡 **Sugerir para el diccionario oficial** — guarda la sugerencia en `.corrector-sugerencias.md`
- **Comando "Corregir todo el documento"** — aplica todas las correcciones de golpe con confirmación previa
- **Archivo de sugerencias** (`.corrector-sugerencias.md`) — log de palabras sugeridas por los usuarios para mejorar el diccionario
- **Comando "Enviar sugerencias por email"** — abre el cliente de email con las sugerencias para enviar al desarrollador

## [0.2.1] — 2026-03-03

### Añadido
- Soporte bilingüe completo: el corrector detecta automáticamente si el texto es español o inglés
- Diccionario inglés con 110+ reglas (transposiciones, ie/ei, doble letra, letras mudas, fonética, ortografía, términos técnicos)
- Patrones fonéticos en inglés: abreviaturas de chat (u→you, r→are, b4→before, thx→thanks, tmr→tomorrow, idk, btw, imo)
- Indicador de idioma detectado en la cabecera de respuesta del chat (🇬🇧 English / 🇪🇸 Español)
- Suite de tests completa: 83 tests automatizados (18 suites) para español e inglés
- Infraestructura de testing con Node.js test runner nativo (sin dependencias externas)

### Arreglado
- BUG-1: Las estadísticas de uso ya se restauran correctamente al reiniciar VS Code
- BUG-2: Lógica anti-doble-corrección incorrecta (`c.corregido === match` → `c.original === match`)
- BUG-3: Entrada duplicada de `yegar` en el diccionario eliminada
- BUG-4: Entradas inútiles (`abrir`, `llegar`, `consejo`) eliminadas del diccionario
- Palabras del diccionario ampliadas con errores reales documentados: `gue→que`, `ertas→estas`, `biene→viene`, `bienen→vienen`, `abeces→a veces`, `hayga→haya`, `estava→estaba`, `estavamos→estábamos`
- Sección `g→q` añadida al diccionario (tecla adyacente, error típico de dislexia)

### Cambiado
- Cabecera de respuesta rediseñada: siempre visible, muestra modo y idioma detectado
- Encabezado de texto corregido en H2 con número de correcciones
- El modo IA con correcciones ahora envía el texto ya corregido al modelo de IA
- README: clarificación explícita de que el corrector funciona solo en español (antes de la nota personal)

## [0.2.0] — 2026-03-03

### Añadido
- Modo IA opcional: reenvío automático a Copilot cuando no hay errores (`corrector.reenviarACopilot`, desactivado por defecto)
- Selector dinámico de modelos de IA: detecta todos los modelos disponibles en VS Code
- Setting `corrector.modeloPreferido` para elegir modelo favorito
- Comando `/modelos` para listar todos los modelos de IA disponibles
- QuickPick cuando hay múltiples modelos disponibles
- Nota personal del autor en 6 idiomas (ES, EN, PT, FR, DE, IT) en README
- Links de donación (PayPal, Ko-fi, Twitch Tip)
- Mensaje de bienvenida en la primera activación
- Advertencias claras sobre consumo de tokens en modo IA

### Cambiado
- La corrección ortográfica es ahora explícitamente "100% offline y gratuita"
- El modo IA requiere activación manual por el usuario

## [0.1.2] — 2026-03-03

### Cambiado
- Eliminada completamente la dependencia de `vscode.lm.selectChatModels` — ya no aparece diálogo de permisos de IA
- Mensajes claros indicando que la corrección es 100% offline

### Arreglado
- Diálogo confuso pidiendo acceso a modelos de IA al instalar la extensión

## [0.1.1] — 2026-03-03

### Cambiado
- Bump de versión por conflicto con versión existente en Marketplace

## [0.1.0] — 2026-03-03

### Añadido
- Chat Participant `@corrector` para el chat de Copilot
- Motor de corrección ortográfica offline para español
- 150+ reglas para errores comunes de dislexia
- Diccionario personal persistente (agregar/eliminar palabras)
- Lista de palabras ignoradas
- Estadísticas de uso (mensajes corregidos, top 10 palabras)
- Comandos slash: /ayuda, /agregar, /ignorar, /stats
- Comandos en paleta: agregar palabra, ver diccionario, ver estadísticas
- Preservación de capitalización (Ola→Hola, OLA→HOLA)
- Configuración: mostrar original, mostrar explicaciones
