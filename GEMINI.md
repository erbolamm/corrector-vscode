# Corrector Copilot — Contexto para Antigravity

Extensión de VSCode que corrige la ortografía en español dentro del chat de Copilot.
100% offline por defecto (sin IA). Modo IA opcional. 150+ reglas. Diseñado para dislexia.

## Usuario

Javier (ApliArte) — autodidacta, aprende con analogías de Flutter.

- Explica SIEMPRE con analogías de Flutter antes de codear
- PLANNING mode primero para cambios grandes
- Warnings inaceptables (lint y markdown)
- Terminal siempre visible

## Stack

- **Lenguaje**: TypeScript
- **Build**: tsc (pendiente migrar a esbuild)
- **API**: VS Code Chat Participants API (chatParticipants)
- **Marketplace**: `apliarte.corrector-copilot` (pendiente migración desde `Corrector.corrector-copilot`)
- **Publisher**: `apliarte`

## Estructura (actual, pendiente refactorizar)

```text
corrector-vscode/
├── src/
│   ├── extension.ts      ← Activación, comandos, editor diagnostics (1391 líneas)
│   └── corrector.ts      ← Motor de reglas ortográficas (59K bytes)
├── package.json           ← Definición de comandos, chat participant, configuración
├── icon.png               ← Icono del marketplace
└── test/                  ← Tests
```

## Reglas del proyecto

1. NO romper la funcionalidad offline — es el selling point
2. Las reglas ortográficas viven en `corrector.ts` — no mezclar con UI
3. El `chatParticipants` es la API core — no usar alternativas deprecated
4. Probar SIEMPRE en Extension Development Host antes de publicar
5. `vsce package` para generar .vsix, `vsce publish` para publicar

## Publicación

```bash
# Generar paquete local
npx @vscode/vsce package

# Publicar al marketplace (necesita PAT de Azure DevOps)
npx @vscode/vsce publish
```
