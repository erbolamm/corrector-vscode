# Changelog

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
