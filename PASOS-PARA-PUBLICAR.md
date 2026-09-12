# Publicar «Corrector Español — Ortografía para Copilot Chat»

- Identificador: `apliarte.corrector-espanol`
- Versión que se va a publicar: `2.0.1`
- Actualizado: 2026-09-12

> Se publica **a mano**. Ningún agente sube nada a una tienda.

---

## 1. Enlaces · pulsa aquí

| Dónde | Enlace | Para qué |
| :--- | :--- | :--- |
| VS Marketplace | <https://marketplace.visualstudio.com/manage/publishers/apliarte> | Subir el `.vsix` y ver la ficha |
| Open VSX | <https://open-vsx.org/user-settings/extensions> | Subir el mismo `.vsix` |
| Token de VS Marketplace | <https://dev.azure.com/> | Renovar el token si caducó |
| Token de Open VSX | <https://open-vsx.org/user-settings/tokens> | Renovar el token si caducó |
| Repositorio | <https://github.com/erbolamm/corrector-vscode> | Código y releases |
| Landing | **Pendiente** — `homepage` en `package.json` apunta hoy a un producto distinto (`apliarte-click-pro-2026.web.app`); lo corrige la tarea `cl--extensiones--landings-segun-inbox-y-homepage` |

## 2. El fichero que hay que subir

```
entregas/apliarte-corrector-espanol-2.0.1.vsix
```

Si no está ahí, todavía no se ha empaquetado. Ver la sección 4.

## 3. Antes de subir · comprobar seis cosas

| # | Qué | Cómo se ve que está bien |
| :-: | :--- | :--- |
| 1 | No queda nada sin commit | `git status` sale limpio |
| 2 | La versión dice lo mismo en los cuatro sitios | `package.json`, `CHANGELOG.md`, el tag y `HEAD` coinciden |
| 3 | Está subido a GitHub | `git log origin/main..HEAD` no devuelve nada |
| 4 | Las imágenes del README existen en Git | `git ls-files media/screenshots/` las lista todas |
| 5 | Compila y pasa las pruebas | `npm run lint` y `npm test` en verde |
| 6 | El paquete está en `entregas/` | El fichero de la sección 2 existe |

Si alguna falla, **no se sube**. Se arregla primero.

## 4. Empaquetar

```bash
npm run lint && npm test
npm run package -- --out entregas/apliarte-corrector-espanol-2.0.1.vsix
```

## 5. Subir · los dos sitios

**VS Marketplace**: abrir el enlace de la sección 1, botón de nueva versión, arrastrar el `.vsix`.

**Open VSX**: abrir el enlace de la sección 1 y subir el **mismo** fichero.

> Open VSX es lo que hace que la extensión aparezca en **Cursor, Windsurf, VSCodium y Antigravity**.
> Si solo se publica en VS Marketplace, en esos editores no existe.

## 6. Después de subir

1. Crear el tag: `git tag v2.0.1 && git push --tags`
2. Comprobar que la ficha se ve bien y que **ninguna imagen sale rota**.
3. Anotar el proyecto en `bitacora.html` si aún no está.

## 7. Qué NO se hace aquí

- No se suben tokens, claves ni contraseñas a este archivo. Solo enlaces donde renovarlos.
- Ningún agente publica. Publica Javier.
