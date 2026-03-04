/**
 * Corrector Ortográfico para Copilot Chat
 * Extensión de VS Code que corrige la ortografía en español
 * dentro del chat de GitHub Copilot.
 *
 * Diseñado para personas con dislexia.
 * Sin dependencias externas — funciona 100% offline.
 *
 * Autor: Javier Mateo (ApliArte)
 * Repo: https://github.com/erbolamm/corrector-vscode
 */

import * as vscode from 'vscode';
import { MotorCorrector, ResultadoCorreccion } from './corrector';

let motor: MotorCorrector;
let contextoGlobal: vscode.ExtensionContext;
let diagnosticos: vscode.DiagnosticCollection;
let diagnosticosActivos = false;
let debounceTimer: ReturnType<typeof setTimeout> | undefined;

export function activate(context: vscode.ExtensionContext) {
    contextoGlobal = context;
    motor = new MotorCorrector();

    // Cargar diccionario personal persistido
    cargarDatosGuardados();

    // ─── REGISTRAR CHAT PARTICIPANT ─────────────────────────────────────
    const participante = vscode.chat.createChatParticipant(
        'corrector.corrector',
        manejarMensajeChat
    );

    participante.iconPath = vscode.Uri.joinPath(context.extensionUri, 'icon.png');

    // ─── REGISTRAR COMANDOS ─────────────────────────────────────────────

    const cmdAgregarPalabra = vscode.commands.registerCommand(
        'corrector.agregarPalabra',
        comandoAgregarPalabra
    );

    const cmdVerDiccionario = vscode.commands.registerCommand(
        'corrector.verDiccionario',
        comandoVerDiccionario
    );

    const cmdEstadisticas = vscode.commands.registerCommand(
        'corrector.estadisticas',
        comandoEstadisticas
    );

    // Comando: copiar texto corregido al portapapeles
    const cmdCopiarTexto = vscode.commands.registerCommand(
        'corrector.copiarTexto',
        async (textoCorregido: string) => {
            await vscode.env.clipboard.writeText(textoCorregido);
            vscode.window.showInformationMessage('Corrector: Texto copiado al portapapeles');
        }
    );

    // ─── DIAGNÓSTICOS EN EL EDITOR ───────────────────────────────────────
    diagnosticos = vscode.languages.createDiagnosticCollection('corrector');
    diagnosticosActivos = vscode.workspace.getConfiguration('corrector').get<boolean>('corregirEnEditor', false);

    // Comando: activar/desactivar corrección en editor
    const cmdToggleEditor = vscode.commands.registerCommand(
        'corrector.toggleEditor',
        async () => {
            diagnosticosActivos = !diagnosticosActivos;
            // Persistir la preferencia
            await vscode.workspace.getConfiguration('corrector').update(
                'corregirEnEditor', diagnosticosActivos, vscode.ConfigurationTarget.Global
            );
            if (diagnosticosActivos) {
                vscode.window.showInformationMessage('Corrector: Corrección en editor ACTIVADA 🟢');
                // Analizar documento activo inmediatamente
                if (vscode.window.activeTextEditor) {
                    analizarDocumento(vscode.window.activeTextEditor.document);
                }
            } else {
                diagnosticos.clear();
                vscode.window.showInformationMessage('Corrector: Corrección en editor DESACTIVADA 🔴');
            }
        }
    );

    // Listener: analizar documento al cambiar
    const onDidChange = vscode.workspace.onDidChangeTextDocument(event => {
        if (!diagnosticosActivos) { return; }
        // Debounce: esperar 500ms después del último cambio
        if (debounceTimer) { clearTimeout(debounceTimer); }
        debounceTimer = setTimeout(() => {
            analizarDocumento(event.document);
        }, 500);
    });

    // Listener: analizar al cambiar de pestaña
    const onDidChangeEditor = vscode.window.onDidChangeActiveTextEditor(editor => {
        if (!diagnosticosActivos || !editor) { return; }
        analizarDocumento(editor.document);
    });

    // Listener: reaccionar a cambios del setting
    const onDidChangeConfig = vscode.workspace.onDidChangeConfiguration(event => {
        if (event.affectsConfiguration('corrector.corregirEnEditor')) {
            diagnosticosActivos = vscode.workspace.getConfiguration('corrector').get<boolean>('corregirEnEditor', false);
            if (!diagnosticosActivos) {
                diagnosticos.clear();
            } else if (vscode.window.activeTextEditor) {
                analizarDocumento(vscode.window.activeTextEditor.document);
            }
        }
    });

    // Analizar el documento activo al arrancar (si está activo)
    if (diagnosticosActivos && vscode.window.activeTextEditor) {
        analizarDocumento(vscode.window.activeTextEditor.document);
    }

    // ─── FUENTE OPENDYSLEXIC ────────────────────────────────────────────
    const cmdToggleFuente = vscode.commands.registerCommand(
        'corrector.toggleFuente',
        async () => {
            const config = vscode.workspace.getConfiguration('corrector');
            const opcion = config.get<string>('fuenteDislexia', 'desactivada');
            const estaActiva = opcion !== 'desactivada';

            if (estaActiva) {
                // Desactivar: restaurar fuentes originales
                const fuenteOriginalEditor = contextoGlobal.globalState.get<string>('fuenteOriginalEditor', '');
                const fuenteOriginalTerminal = contextoGlobal.globalState.get<string>('fuenteOriginalTerminal', '');
                const editorConfig = vscode.workspace.getConfiguration('editor');
                const terminalConfig = vscode.workspace.getConfiguration('terminal.integrated');

                if (fuenteOriginalEditor) {
                    await editorConfig.update('fontFamily', fuenteOriginalEditor, vscode.ConfigurationTarget.Global);
                } else {
                    await editorConfig.update('fontFamily', undefined, vscode.ConfigurationTarget.Global);
                }
                if (fuenteOriginalTerminal) {
                    await terminalConfig.update('fontFamily', fuenteOriginalTerminal, vscode.ConfigurationTarget.Global);
                } else {
                    await terminalConfig.update('fontFamily', undefined, vscode.ConfigurationTarget.Global);
                }

                await config.update('fuenteDislexia', 'desactivada', vscode.ConfigurationTarget.Global);
                vscode.window.showInformationMessage('Corrector: Fuente OpenDyslexic DESACTIVADA — fuente original restaurada');
            } else {
                // Activar: preguntar dónde
                const donde = await vscode.window.showQuickPick(
                    [
                        { label: 'Solo editor', description: 'Cambia la fuente del editor de código', value: 'editor' },
                        { label: 'Solo terminal', description: 'Cambia la fuente del terminal', value: 'terminal' },
                        { label: 'Editor + Terminal', description: 'Cambia ambas fuentes', value: 'ambos' },
                    ],
                    { placeHolder: '¿Dónde quieres usar OpenDyslexic?' }
                );
                if (!donde) { return; }

                const editorConfig = vscode.workspace.getConfiguration('editor');
                const terminalConfig = vscode.workspace.getConfiguration('terminal.integrated');
                const FUENTE = '"OpenDyslexic", monospace';

                // Guardar fuentes actuales
                const fuenteActualEditor = editorConfig.get<string>('fontFamily', '');
                const fuenteActualTerminal = terminalConfig.get<string>('fontFamily', '');
                await contextoGlobal.globalState.update('fuenteOriginalEditor', fuenteActualEditor);
                await contextoGlobal.globalState.update('fuenteOriginalTerminal', fuenteActualTerminal);

                if (donde.value === 'editor' || donde.value === 'ambos') {
                    await editorConfig.update('fontFamily', FUENTE, vscode.ConfigurationTarget.Global);
                }
                if (donde.value === 'terminal' || donde.value === 'ambos') {
                    await terminalConfig.update('fontFamily', FUENTE, vscode.ConfigurationTarget.Global);
                }

                await config.update('fuenteDislexia', donde.value, vscode.ConfigurationTarget.Global);

                const msg = await vscode.window.showInformationMessage(
                    'Corrector: Fuente OpenDyslexic ACTIVADA 🟢 — ' +
                    'Si no la ves, asegúrate de tenerla instalada en tu sistema.',
                    'Descargar OpenDyslexic'
                );
                if (msg === 'Descargar OpenDyslexic') {
                    vscode.env.openExternal(vscode.Uri.parse('https://opendyslexic.org/'));
                }
            }
        }
    );

    // Comando: enviar texto corregido directamente a Copilot
    const cmdEnviarACopilot = vscode.commands.registerCommand(
        'corrector.enviarACopilot',
        async (textoCorregido: string) => {
            await vscode.commands.executeCommand('workbench.action.chat.open', {
                query: textoCorregido,
                isPartialQuery: false
            });
        }
    );

    // Comando: permitir siempre (ignorar palabras originales)
    const cmdPermitirSiempre = vscode.commands.registerCommand(
        'corrector.permitirSiempre',
        async (palabrasOriginales: string[]) => {
            for (const palabra of palabrasOriginales) {
                motor.ignorarPalabra(palabra.toLowerCase());
            }
            guardarDatos();
            vscode.window.showInformationMessage(
                'Corrector: ' + palabrasOriginales.length + ' palabra(s) añadida(s) a la lista de permitidas'
            );
        }
    );

    // Registrar todo en el contexto para limpieza
    context.subscriptions.push(
        participante,
        cmdAgregarPalabra,
        cmdVerDiccionario,
        cmdEstadisticas,
        cmdCopiarTexto,
        cmdEnviarACopilot,
        cmdPermitirSiempre,
        cmdToggleEditor,
        cmdToggleFuente,
        diagnosticos,
        onDidChange,
        onDidChangeEditor,
        onDidChangeConfig
    );

    // Mensaje de bienvenida la primera vez
    const yaMostrado = context.globalState.get<boolean>('bienvenidaMostrada', false);
    if (!yaMostrado) {
        vscode.window.showInformationMessage(
            '🔤 Corrector instalado — Escribe @corrector en el chat de Copilot. ' +
            'La corrección es 100% offline, NO usa inteligencia artificial ni internet. ' +
            'Motor integrado con 150+ reglas de español.',
            'Entendido'
        );
        context.globalState.update('bienvenidaMostrada', true);
    }

    console.log('[Corrector] Extensión activada — ' + motor.obtenerTotalReglas() + ' reglas cargadas');
}

// ─── HANDLER DEL CHAT PARTICIPANT ───────────────────────────────────────────

async function manejarMensajeChat(
    request: vscode.ChatRequest,
    _context: vscode.ChatContext,
    stream: vscode.ChatResponseStream,
    _token: vscode.CancellationToken
): Promise<void> {
    const texto = request.prompt;

    if (!texto.trim()) {
        stream.markdown('Escribe algo después de `@corrector` para que lo corrija.');
        return;
    }

    // Comando especial: /ayuda
    if (request.command === 'ayuda') {
        mostrarAyuda(stream);
        return;
    }

    // Comando especial: /agregar
    if (request.command === 'agregar') {
        await manejarComandoAgregar(texto, stream);
        return;
    }

    // Comando especial: /ignorar
    if (request.command === 'ignorar') {
        manejarComandoIgnorar(texto, stream);
        return;
    }

    // Comando especial: /stats
    if (request.command === 'stats') {
        mostrarEstadisticasEnChat(stream);
        return;
    }

    // Comando especial: /modelos
    if (request.command === 'modelos') {
        await mostrarModelosDisponibles(stream);
        return;
    }

    // ── CORRECCIÓN PRINCIPAL ──
    const resultado = motor.corregir(texto);
    const config = vscode.workspace.getConfiguration('corrector');
    const mostrarOriginal = config.get<boolean>('mostrarOriginal', true);
    const mostrarExplicaciones = config.get<boolean>('mostrarExplicaciones', true);

    const reenviarIA = config.get<boolean>('reenviarACopilot', false);

    // ── CABECERA DE MODO (siempre visible, primera línea) ──
    const idiomaLabel = resultado.idioma === 'en' ? '🇬🇧 English' : '🇪🇸 Español';
    if (reenviarIA) {
        stream.markdown('> 🤖 **Modo IA** · ' + idiomaLabel + ' · ⚠️ _consume tokens_\n\n');
    } else {
        stream.markdown('> 🔌 **Modo offline** · ' + idiomaLabel + ' · sin IA · sin internet · 250+ reglas\n\n');
    }

    if (resultado.totalCorrecciones === 0) {
        // Sin errores ortográficos
        if (reenviarIA) {
            // ── MODO IA: reenviar directamente a Copilot ──
            stream.markdown('✅ **Sin errores ortográficos** — reenviando a Copilot...\n\n');
            try {
                const modeloSeleccionado = await seleccionarModelo(config, stream);
                if (modeloSeleccionado) {
                    stream.markdown('_Modelo: **' + modeloSeleccionado.name + '** (' + modeloSeleccionado.vendor + ')_\n\n');
                    stream.markdown('---\n\n');
                    const mensajes = [vscode.LanguageModelChatMessage.User(texto)];
                    const respuesta = await modeloSeleccionado.sendRequest(mensajes, {}, _token);
                    for await (const fragmento of respuesta.text) {
                        stream.markdown(fragmento);
                    }
                } else {
                    // Sin modelo disponible → fallback a botones
                    stream.markdown('⚠️ **No se encontró ningún modelo de IA disponible.**\n\n');
                    stream.markdown('Asegúrate de tener GitHub Copilot activo, o usa `@corrector /modelos` para ver qué hay disponible.\n\n');
                    stream.markdown('> ' + texto + '\n\n');
                    stream.button({
                        command: 'corrector.enviarACopilot',
                        title: '🚀 Enviar a Copilot manualmente',
                        arguments: [texto],
                    });
                }
            } catch (err) {
                stream.markdown('⚠️ **Error al conectar con Copilot:** ' + String(err) + '\n\n');
                stream.markdown('> ' + texto + '\n\n');
                stream.button({
                    command: 'corrector.enviarACopilot',
                    title: '🚀 Enviar a Copilot manualmente',
                    arguments: [texto],
                });
            }
        } else {
            // ── MODO OFFLINE (por defecto): sin errores ──
            stream.markdown('✅ **Sin errores ortográficos** — tu texto está bien escrito.\n\n');
            stream.markdown('> ' + texto + '\n\n');
            stream.markdown('---\n\n');
            stream.markdown('_¿Quieres que pase directo a la IA cuando no tenga errores? ' +
                'Activa `corrector.reenviarACopilot` en Ajustes. ⚠️ Consume tokens._\n\n');

            stream.button({
                command: 'corrector.enviarACopilot',
                title: '🚀 Enviar a Copilot',
                arguments: [texto],
            });
            stream.button({
                command: 'corrector.copiarTexto',
                title: '📋 Copiar',
                arguments: [texto],
            });
        }
    } else {
        // ── HAY CORRECCIONES ──
        const palabrasOriginales = resultado.correcciones.map(c => c.original);
        const n = resultado.totalCorrecciones;
        const label = n === 1 ? '1 corrección' : n + ' correcciones';

        // Texto corregido (protagonista)
        stream.markdown('## ✏️ Texto corregido · ' + label + '\n\n');
        stream.markdown('> ' + resultado.textoCorregido + '\n\n');

        // Original + detalle de cambios
        if (mostrarOriginal || mostrarExplicaciones) {
            stream.markdown('---\n\n');
        }

        if (mostrarOriginal) {
            stream.markdown('**Original:** `' + resultado.textoOriginal + '`\n\n');
        }

        if (mostrarExplicaciones && resultado.correcciones.length > 0) {
            stream.markdown('**Cambios aplicados:**\n\n');
            for (const c of resultado.correcciones) {
                stream.markdown('- ~~' + c.original + '~~ → **' + c.corregido + '** — _' + c.regla + '_\n');
            }
            stream.markdown('\n');
        }

        // Botones de acción
        stream.button({
            command: 'corrector.copiarTexto',
            title: '📋 Copiar texto corregido',
            arguments: [resultado.textoCorregido],
        });
        stream.button({
            command: 'corrector.enviarACopilot',
            title: '🚀 Enviar a Copilot',
            arguments: [resultado.textoCorregido],
        });
        stream.button({
            command: 'corrector.permitirSiempre',
            title: '✅ Permitir siempre',
            arguments: [palabrasOriginales],
        });

        // Si modo IA está activo, reenviar el texto ya corregido
        if (reenviarIA) {
            stream.markdown('\n---\n\n');
            stream.markdown('🤖 **Modo IA activo** — reenviando el texto **corregido** a Copilot...\n\n');
            try {
                const modeloSeleccionado = await seleccionarModelo(config, stream);
                if (modeloSeleccionado) {
                    stream.markdown('_Modelo: **' + modeloSeleccionado.name + '** (' + modeloSeleccionado.vendor + ')_\n\n');
                    stream.markdown('---\n\n');
                    const mensajes = [vscode.LanguageModelChatMessage.User(resultado.textoCorregido)];
                    const respuesta = await modeloSeleccionado.sendRequest(mensajes, {}, _token);
                    for await (const fragmento of respuesta.text) {
                        stream.markdown(fragmento);
                    }
                }
            } catch (err) {
                stream.markdown('⚠️ _Error al reenviar a Copilot: ' + String(err) + '_\n');
            }
        }
    }

    // Guardar datos actualizados
    guardarDatos();
}

// ─── COMANDOS SLASH DEL CHAT ────────────────────────────────────────────────

function mostrarAyuda(stream: vscode.ChatResponseStream): void {
    stream.markdown('## 🔤 Corrector Ortográfico — Ayuda\n\n');
    stream.markdown('### Uso básico\n');
    stream.markdown('Escribe `@corrector` seguido de tu texto y te lo corrijo.\n\n');
    stream.markdown('### Comandos\n');
    stream.markdown('- `/ayuda` — Muestra esta ayuda\n');
    stream.markdown('- `/agregar error=correcto` — Añade una palabra al diccionario personal\n');
    stream.markdown('- `/ignorar palabra` — Marca una palabra para no corregirla\n');
    stream.markdown('- `/stats` — Muestra estadísticas de uso\n\n');
    stream.markdown('### Ejemplos\n');
    stream.markdown('```\n@corrector ola vuenos dias kiero aser una app\n```\n');
    stream.markdown('→ "Hola, buenos días, quiero hacer una app"\n\n');
    stream.markdown('### Reglas incluidas\n');
    stream.markdown('- **' + motor.obtenerTotalReglas() + '** reglas activas\n');
    stream.markdown('- Confusión b/v, c/s/z, g/j, ll/y\n');
    stream.markdown('- H omitida o añadida\n');
    stream.markdown('- Tildes automáticas\n');
    stream.markdown('- Abreviaturas tipo chat (q, xq, tb, pa...)\n');
    stream.markdown('- N→M antes de B/P\n');
    stream.markdown('- Transposiciones comunes\n');
    stream.markdown('- Diccionario personal ampliable\n');
    stream.markdown('\n### Modo IA (opcional)\n');
    stream.markdown('- Activa `corrector.reenviarACopilot` en Ajustes para reenviar automáticamente a una IA\n');
    stream.markdown('- Configura `corrector.modeloPreferido` para elegir el modelo (ej: `gpt-4o-mini`, `claude-3-haiku`)\n');
    stream.markdown('- Usa `/modelos` para ver todos los modelos disponibles\n');
    stream.markdown('- ⚠️ El modo IA consume tokens de tu plan\n');
}

// ─── SELECTOR DINÁMICO DE MODELOS IA ────────────────────────────────────────

/**
 * Selecciona un modelo de IA disponible según la preferencia del usuario.
 * Si hay preferencia configurada, la usa. Si no, muestra picker.
 * Si no hay modelos disponibles, retorna null.
 */
async function seleccionarModelo(
    config: vscode.WorkspaceConfiguration,
    stream: vscode.ChatResponseStream
): Promise<vscode.LanguageModelChat | null> {
    const preferido = config.get<string>('modeloPreferido', '').trim();

    // Obtener TODOS los modelos disponibles (sin filtro)
    const todosModelos = await vscode.lm.selectChatModels();

    if (todosModelos.length === 0) {
        return null;
    }

    // Si hay un modelo preferido configurado, buscarlo
    if (preferido) {
        // Buscar por familia, nombre o id (flexible)
        const encontrado = todosModelos.find(m =>
            m.family.toLowerCase() === preferido.toLowerCase() ||
            m.name.toLowerCase().includes(preferido.toLowerCase()) ||
            m.id.toLowerCase().includes(preferido.toLowerCase())
        );
        if (encontrado) {
            return encontrado;
        }
        // No encontrado → avisar y mostrar los disponibles
        stream.markdown('⚠️ _Modelo preferido "' + preferido + '" no encontrado. ' +
            'Usa `@corrector /modelos` para ver los disponibles._\n\n');
    }

    // Si solo hay 1 modelo, usarlo directamente
    if (todosModelos.length === 1) {
        return todosModelos[0];
    }

    // Varios disponibles → mostrar picker
    const opciones = todosModelos.map(m => ({
        label: m.name,
        description: m.vendor + ' · ' + m.family,
        detail: 'ID: ' + m.id,
        modelo: m,
    }));

    const seleccion = await vscode.window.showQuickPick(opciones, {
        placeHolder: 'Elige un modelo de IA (o configura corrector.modeloPreferido)',
        title: 'Corrector — Modelos de IA disponibles',
    });

    if (seleccion) {
        return seleccion.modelo;
    }

    return null;
}

/**
 * Muestra todos los modelos de IA disponibles en VS Code.
 */
async function mostrarModelosDisponibles(stream: vscode.ChatResponseStream): Promise<void> {
    stream.markdown('## 🤖 Modelos de IA disponibles\n\n');

    const modelos = await vscode.lm.selectChatModels();

    if (modelos.length === 0) {
        stream.markdown('❌ No se encontró ningún modelo de IA.\n\n');
        stream.markdown('Para usar el modo IA necesitas tener instalada una extensión que proporcione modelos, como:\n');
        stream.markdown('- **GitHub Copilot** (Pro / Pro+)\n');
        stream.markdown('- Otras extensiones de IA para VS Code\n');
        return;
    }

    stream.markdown('Se encontraron **' + modelos.length + '** modelos disponibles:\n\n');
    stream.markdown('| # | Modelo | Proveedor | Familia | Para configurar |\n');
    stream.markdown('|---|--------|-----------|---------|----------------|\n');

    modelos.forEach((m, i) => {
        stream.markdown('| ' + (i + 1) + ' | ' + m.name + ' | ' + m.vendor + ' | `' + m.family + '` | `"corrector.modeloPreferido": "' + m.family + '"` |\n');
    });

    stream.markdown('\n### Cómo configurar\n\n');
    stream.markdown('1. Abre **Ajustes** (`Cmd+,` / `Ctrl+,`)\n');
    stream.markdown('2. Busca `corrector.modeloPreferido`\n');
    stream.markdown('3. Escribe la **familia** del modelo que prefieras (ej: `gpt-4o-mini`)\n');
    stream.markdown('4. Activa `corrector.reenviarACopilot` para usar el modo IA\n\n');
    stream.markdown('💡 _Consejo: los modelos "mini" o "haiku" son más rápidos y consumen menos tokens._\n');
}

async function manejarComandoAgregar(texto: string, stream: vscode.ChatResponseStream): Promise<void> {
    // Formato esperado: error=correcto
    const partes = texto.split('=');
    if (partes.length !== 2 || !partes[0].trim() || !partes[1].trim()) {
        stream.markdown('❌ Formato incorrecto. Usa: `/agregar errorr=correcto`\n\n');
        stream.markdown('Ejemplo: `/agregar tegnologia=tecnología`');
        return;
    }

    const error = partes[0].trim().toLowerCase();
    const correcto = partes[1].trim().toLowerCase();

    motor.agregarPalabra(error, correcto);
    guardarDatos();

    stream.markdown('✅ Palabra añadida al diccionario personal:\n\n');
    stream.markdown('- ~~' + error + '~~ → **' + correcto + '**\n\n');
    stream.markdown('A partir de ahora, "' + error + '" se corregirá automáticamente.');
}

function manejarComandoIgnorar(texto: string, stream: vscode.ChatResponseStream): void {
    const palabra = texto.trim().toLowerCase();
    if (!palabra) {
        stream.markdown('❌ Escribe la palabra que quieres ignorar. Ejemplo: `/ignorar wifi`');
        return;
    }

    motor.ignorarPalabra(palabra);
    guardarDatos();

    stream.markdown('✅ "' + palabra + '" se ignorará en las correcciones.');
}

function mostrarEstadisticasEnChat(stream: vscode.ChatResponseStream): void {
    const stats = motor.obtenerEstadisticas();

    stream.markdown('## 📊 Estadísticas del Corrector\n\n');
    stream.markdown('- **Mensajes corregidos:** ' + stats.mensajesCorregidos + '\n');
    stream.markdown('- **Total de correcciones:** ' + stats.totalCorrecciones + '\n');
    stream.markdown('- **Reglas activas:** ' + motor.obtenerTotalReglas() + '\n\n');

    if (stats.top10PalabrasMasCorregidas.length > 0) {
        stream.markdown('### Top 10 palabras más corregidas\n\n');
        for (let i = 0; i < stats.top10PalabrasMasCorregidas.length; i++) {
            const item = stats.top10PalabrasMasCorregidas[i];
            stream.markdown((i + 1) + '. **' + item.palabra + '** — ' + item.veces + ' veces\n');
        }
    } else {
        stream.markdown('_Aún no hay datos. ¡Empieza a usar `@corrector`!_');
    }
}

// ─── COMANDOS DE LA PALETA ──────────────────────────────────────────────────

async function comandoAgregarPalabra(): Promise<void> {
    const error = await vscode.window.showInputBox({
        prompt: 'Escribe la palabra MAL escrita (como la escribirías tú)',
        placeHolder: 'Ejemplo: tegnologia',
    });

    if (!error) { return; }

    const correcto = await vscode.window.showInputBox({
        prompt: 'Escribe la forma CORRECTA',
        placeHolder: 'Ejemplo: tecnología',
    });

    if (!correcto) { return; }

    motor.agregarPalabra(error, correcto);
    guardarDatos();

    vscode.window.showInformationMessage(
        `Corrector: "${error}" → "${correcto}" añadido al diccionario personal`
    );
}

async function comandoVerDiccionario(): Promise<void> {
    const diccionario = motor.obtenerDiccionarioPersonal();

    if (diccionario.size === 0) {
        vscode.window.showInformationMessage(
            'El diccionario personal está vacío. Usa "Corrector: Agregar palabra" para añadir entradas.'
        );
        return;
    }

    const items: vscode.QuickPickItem[] = [];
    for (const [error, correcto] of diccionario) {
        items.push({
            label: `${error} → ${correcto}`,
            description: 'Pulsa para eliminar',
        });
    }

    const seleccion = await vscode.window.showQuickPick(items, {
        placeHolder: 'Diccionario personal — Selecciona una entrada para eliminarla',
        canPickMany: true,
    });

    if (seleccion && seleccion.length > 0) {
        for (const item of seleccion) {
            const error = item.label.split(' → ')[0];
            motor.eliminarPalabra(error);
        }
        guardarDatos();
        vscode.window.showInformationMessage(
            `Corrector: ${seleccion.length} entrada(s) eliminada(s) del diccionario personal`
        );
    }
}

async function comandoEstadisticas(): Promise<void> {
    const stats = motor.obtenerEstadisticas();

    const mensaje = [
        `📊 Corrector — Estadísticas`,
        `Mensajes corregidos: ${stats.mensajesCorregidos}`,
        `Total correcciones: ${stats.totalCorrecciones}`,
        `Reglas activas: ${motor.obtenerTotalReglas()}`,
    ].join('\n');

    const accion = await vscode.window.showInformationMessage(
        mensaje,
        'Reiniciar estadísticas'
    );

    if (accion === 'Reiniciar estadísticas') {
        motor.reiniciarEstadisticas();
        guardarDatos();
        vscode.window.showInformationMessage('Corrector: Estadísticas reiniciadas');
    }
}

// ─── PERSISTENCIA ───────────────────────────────────────────────────────────

function guardarDatos(): void {
    contextoGlobal.globalState.update('diccionarioPersonal', motor.serializarDiccionarioPersonal());
    contextoGlobal.globalState.update('palabrasIgnoradas', motor.serializarPalabrasIgnoradas());

    const stats = motor.obtenerEstadisticas();
    contextoGlobal.globalState.update('estadisticas', {
        mensajesCorregidos: stats.mensajesCorregidos,
        totalCorrecciones: stats.totalCorrecciones,
    });
}

function cargarDatosGuardados(): void {
    // Diccionario personal
    const diccionario = contextoGlobal.globalState.get<Record<string, string>>('diccionarioPersonal');
    if (diccionario) {
        motor.cargarDiccionarioPersonal(diccionario);
    }

    // Palabras ignoradas
    const ignoradas = contextoGlobal.globalState.get<string[]>('palabrasIgnoradas');
    if (ignoradas) {
        motor.cargarPalabrasIgnoradas(ignoradas);
    }

    // Estadísticas acumuladas
    const stats = contextoGlobal.globalState.get<{ mensajesCorregidos: number; totalCorrecciones: number }>('estadisticas');
    if (stats) {
        motor.cargarEstadisticas(stats.mensajesCorregidos, stats.totalCorrecciones);
    }

    console.log('[Corrector] Datos cargados — Diccionario personal: ' +
        (diccionario ? Object.keys(diccionario).length : 0) + ' entradas');
}

export function deactivate() {
    // Guardar antes de desactivar
    if (motor && contextoGlobal) {
        guardarDatos();
    }
    if (diagnosticos) {
        diagnosticos.clear();
    }
    if (debounceTimer) {
        clearTimeout(debounceTimer);
    }
    console.log('[Corrector] Extensión desactivada');
}

// ─── DIAGNÓSTICOS EN EL EDITOR ─────────────────────────────────────────────

/**
 * Idiomas de archivo donde tiene sentido buscar errores en comentarios y strings.
 */
const LENGUAJES_SOPORTADOS = new Set([
    'javascript', 'typescript', 'javascriptreact', 'typescriptreact',
    'python', 'java', 'csharp', 'c', 'cpp', 'go', 'rust', 'php', 'ruby',
    'swift', 'kotlin', 'dart', 'scala', 'r', 'lua', 'perl', 'shell',
    'shellscript', 'bash', 'zsh', 'powershell',
    'html', 'css', 'scss', 'less', 'vue', 'svelte', 'astro',
    'json', 'jsonc', 'yaml', 'toml', 'xml',
    'markdown', 'plaintext', 'restructuredtext', 'latex', 'tex',
    'gitcommit', 'properties', 'ini', 'dockerfile',
]);

/**
 * Extrae los fragmentos de texto corregible de un documento:
 * - En archivos de código: comentarios y strings
 * - En markdown/plaintext: todo el contenido
 */
function extraerFragmentosCorregibles(
    document: vscode.TextDocument
): Array<{ texto: string; rango: vscode.Range }> {
    const fragmentos: Array<{ texto: string; rango: vscode.Range }> = [];
    const langId = document.languageId;
    const texto = document.getText();

    // Para markdown, plaintext, gitcommit: analizar todo
    if (['markdown', 'plaintext', 'restructuredtext', 'gitcommit'].includes(langId)) {
        for (let i = 0; i < document.lineCount; i++) {
            const linea = document.lineAt(i);
            if (linea.text.trim().length > 0) {
                fragmentos.push({ texto: linea.text, rango: linea.range });
            }
        }
        return fragmentos;
    }

    // Para archivos de código: extraer comentarios y strings
    // Regex que captura comentarios de línea, bloque y strings
    const patrones = [
        // Comentarios // ...
        /\/\/\s*(.+)$/gm,
        // Comentarios # ... (Python, Ruby, Shell)
        /^\s*#\s*(.+)$/gm,
        // Comentarios de bloque /* ... */ (multilínea)
        /\/\*([\s\S]*?)\*\//g,
        // Strings entre comillas simples (multiletter)
        /'([^']{3,})'/g,
        // Strings entre comillas dobles (multiletter)
        /"([^"]{3,})"/g,
        // Template literals
        /`([^`]{3,})`/g,
        // Docstrings Python """..."""
        /"""([\s\S]*?)"""/g,
        // Comentarios HTML/XML <!-- ... -->
        /<!--([\s\S]*?)-->/g,
    ];

    for (const patron of patrones) {
        let match;
        while ((match = patron.exec(texto)) !== null) {
            const contenido = match[1] || match[0];
            const startPos = document.positionAt(match.index);
            const endPos = document.positionAt(match.index + match[0].length);

            // Solo añadir si tiene al menos una letra
            if (/[a-záéíóúüñ]/i.test(contenido)) {
                fragmentos.push({
                    texto: contenido,
                    rango: new vscode.Range(startPos, endPos),
                });
            }
        }
    }

    return fragmentos;
}

/**
 * Analiza un documento buscando errores ortográficos
 * y los muestra como diagnósticos (subrayados) en el editor.
 */
function analizarDocumento(document: vscode.TextDocument): void {
    if (!LENGUAJES_SOPORTADOS.has(document.languageId)) {
        diagnosticos.delete(document.uri);
        return;
    }

    const fragmentos = extraerFragmentosCorregibles(document);
    const nuevos: vscode.Diagnostic[] = [];

    for (const fragmento of fragmentos) {
        const resultado = motor.corregir(fragmento.texto);

        for (const correccion of resultado.correcciones) {
            // Buscar la posición exacta de la palabra original en el fragmento
            const textoFragmento = fragmento.texto;
            const offsetEnFragmento = textoFragmento.toLowerCase().indexOf(
                correccion.original.toLowerCase()
            );
            if (offsetEnFragmento === -1) { continue; }

            // Calcular la posición absoluta en el documento
            const fragmentoOffset = document.offsetAt(fragmento.rango.start);
            const absStart = fragmentoOffset + offsetEnFragmento;
            const absEnd = absStart + correccion.original.length;

            const range = new vscode.Range(
                document.positionAt(absStart),
                document.positionAt(absEnd)
            );

            const diag = new vscode.Diagnostic(
                range,
                `¿Quisiste decir "${correccion.corregido}"? (${correccion.regla})`,
                vscode.DiagnosticSeverity.Information
            );
            diag.source = 'Corrector';
            diag.code = 'corrector-ortografia';
            nuevos.push(diag);
        }
    }

    diagnosticos.set(document.uri, nuevos);
}
