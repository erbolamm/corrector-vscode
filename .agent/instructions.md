# Instrucciones de Agente

---
description: instrucciones para instancias de Antigravity en este proyecto
---

## Contexto del Proyecto

Este es un corrector ortográfico para VS Code Chat (Copilot).
El núcleo es `src/corrector.ts` y se prueba con `npm test`.

## Reglas de Comportamiento

1. **Analogías de Flutter**: Javier aprende mejor cuando le explicas conceptos de TypeScript/VS Code usando analogías de Flutter (ej. "extensionHost es como un simulador").
2. **Offline First**: Nunca sugieras cambios que rompan la funcionalidad offline.
3. **Estructura**: Mantén las reglas ortográficas separadas de la lógica de UI de VS Code.
4. **Warnings**: Cero warnings en código y markdown.

## Uso de Workflows

Utiliza los archivos en `.agent/workflows/` para las tareas estándar de este repositorio.
