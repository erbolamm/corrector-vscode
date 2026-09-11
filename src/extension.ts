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
import {
    setDepsDirectory,
    detectarBackends,
    refinarConIA,
    instalarDepsTransformers,
    cargarModeloLocal,
    isModelLoaded,
    IAConfig,
    IABackend,
} from './iaLocal';
import { IAPanelProvider } from './iaLocalPanel';

let motor: MotorCorrector;
let contextoGlobal: vscode.ExtensionContext;
let diagnosticos: vscode.DiagnosticCollection;
let diagnosticosActivos = false;
let debounceTimer: ReturnType<typeof setTimeout> | undefined;
let barraEstado: vscode.StatusBarItem;
let ultimoNumErrores = 0;

type AccionMenuPrincipal =
    | 'toggle-editor'
    | 'ver-correcciones'
    | 'corregir-todo'
    | 'toggle-fuente'
    | 'agregar-palabra'
    | 'ver-diccionario'
    | 'estadisticas'
    | 'enviar-sugerencias'
    | 'abrir-ajustes';

interface ItemMenuPrincipal extends vscode.QuickPickItem {
    accion?: AccionMenuPrincipal;
}

/**
 * Mapa que almacena los datos de corrección por cada diagnóstico.
 * Clave: "uri:lineaInicio:colInicio:lineaFin:colFin"
 */
const correccionesDiagnostico = new Map<string, { original: string; corregido: string; regla: string }>();

function generarIdDiagnostico(uri: string, range: vscode.Range): string {
    return `${uri}:${range.start.line}:${range.start.character}:${range.end.line}:${range.end.character}`;
}

// ─── CODE ACTION PROVIDER (QUICK FIXES) ─────────────────────────────────────

/**
 * Proveedor de Quick Fixes para los diagnósticos del Corrector.
 * Muestra acciones como "Cambiar", "Añadir al diccionario", "Sugerir palabra".
 */
class CorrectorCodeActionProvider implements vscode.CodeActionProvider {
    public static readonly providedCodeActionKinds = [
        vscode.CodeActionKind.QuickFix,
    ];

    provideCodeActions(
        document: vscode.TextDocument,
        _range: vscode.Range | vscode.Selection,
        context: vscode.CodeActionContext,
        _token: vscode.CancellationToken
    ): vscode.CodeAction[] {
        const acciones: vscode.CodeAction[] = [];

        for (const diagnostic of context.diagnostics) {
            if (diagnostic.source !== 'Corrector') { continue; }

            const id = generarIdDiagnostico(document.uri.toString(), diagnostic.range);
            const datos = correccionesDiagnostico.get(id);
            if (!datos) { continue; }

            // Acción 1: Cambiar la palabra (preferida — se aplica con Cmd+.)
            const cambiar = new vscode.CodeAction(
                `✏️ Cambiar "${datos.original}" → "${datos.corregido}"`,
                vscode.CodeActionKind.QuickFix
            );
            cambiar.diagnostics = [diagnostic];
            cambiar.isPreferred = true;
            const edit = new vscode.WorkspaceEdit();
            edit.replace(document.uri, diagnostic.range, datos.corregido);
            cambiar.edit = edit;
            acciones.push(cambiar);

            // Acción 2: Añadir al diccionario personal (ignorar siempre)
            const ignorar = new vscode.CodeAction(
                `📖 Añadir "${datos.original}" al diccionario personal`,
                vscode.CodeActionKind.QuickFix
            );
            ignorar.diagnostics = [diagnostic];
            ignorar.command = {
                command: 'corrector.ignorarDesdeEditor',
                title: 'Ignorar palabra',
                arguments: [datos.original, document.uri]
            };
            acciones.push(ignorar);

            // Acción 3: Sugerir palabra al desarrollador
            const sugerir = new vscode.CodeAction(
                `💡 Sugerir "${datos.original}" para el diccionario oficial`,
                vscode.CodeActionKind.QuickFix
            );
            sugerir.diagnostics = [diagnostic];
            sugerir.command = {
                command: 'corrector.sugerirPalabra',
                title: 'Sugerir palabra',
                arguments: [datos.original, datos.corregido, datos.regla]
            };
            acciones.push(sugerir);
        }

        return acciones;
    }
}

export function activate(context: vscode.ExtensionContext) {
    contextoGlobal = context;
    motor = new MotorCorrector();

    // Configurar directorio de dependencias para IA local
    setDepsDirectory(context.globalStorageUri.fsPath);
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

    // Barra de estado: muestra estado y abre el menú principal al hacer clic
    barraEstado = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 100);
    barraEstado.command = 'corrector.menuPrincipal';
    barraEstado.tooltip = 'Clic para abrir el menú principal del Corrector';
    barraEstado.show();
    actualizarBarraEstado(0);

    // Comando: menú principal (QuickPick) con acciones del Corrector
    const cmdMenuPrincipal = vscode.commands.registerCommand(
        'corrector.menuPrincipal',
        async () => {
            await mostrarMenuPrincipal();
        }
    );

    // Comando: mostrar diálogo interactivo de correcciones
    const cmdVerCorrecciones = vscode.commands.registerCommand(
        'corrector.verCorrecciones',
        async () => {
            const editor = vscode.window.activeTextEditor;
            if (!editor) {
                vscode.window.showInformationMessage('Corrector: No hay un editor activo');
                return;
            }
            await mostrarDialogoCorrecciones(editor.document);
        }
    );

    // Alias deprecado para compatibilidad con versiones anteriores.
    const cmdMostrarDialogoDeprecated = vscode.commands.registerCommand(
        'corrector.mostrarDialogo',
        async () => {
            await vscode.commands.executeCommand('corrector.verCorrecciones');
        }
    );

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
                    const diagsDoc = diagnosticos.get(vscode.window.activeTextEditor.document.uri);
                    actualizarBarraEstado(diagsDoc ? diagsDoc.length : 0);
                } else {
                    actualizarBarraEstado(0);
                }
            } else {
                diagnosticos.clear();
                actualizarBarraEstado(0);
                vscode.window.showInformationMessage('Corrector: Corrección en editor DESACTIVADA 🔴');
            }
        }
    );

    // Listener: analizar documento al cambiar
    const onDidChange = vscode.workspace.onDidChangeTextDocument(event => {
        if (!diagnosticosActivos) { return; }
        // Debounce: esperar 1.5s después del último cambio para dar tiempo a escribir
        if (debounceTimer) { clearTimeout(debounceTimer); }
        debounceTimer = setTimeout(() => {
            analizarDocumento(event.document);
            // Mostrar notificación automática si hay errores nuevos
            const diagsDoc = diagnosticos.get(event.document.uri);
            const numErrores = diagsDoc ? diagsDoc.length : 0;
            actualizarBarraEstado(numErrores);
            if (numErrores > 0 && numErrores !== ultimoNumErrores) {
                mostrarNotificacionErrores(numErrores, event.document);
            }
            ultimoNumErrores = numErrores;
        }, 1500);
    });

    // Listener: analizar al cambiar de pestaña
    const onDidChangeEditor = vscode.window.onDidChangeActiveTextEditor(editor => {
        if (!diagnosticosActivos || !editor) { return; }
        analizarDocumento(editor.document);
        const diagsDoc = diagnosticos.get(editor.document.uri);
        const numErrores = diagsDoc ? diagsDoc.length : 0;
        actualizarBarraEstado(numErrores);
        ultimoNumErrores = numErrores;
    });

    // Listener: reaccionar a cambios del setting
    const onDidChangeConfig = vscode.workspace.onDidChangeConfiguration(event => {
        if (event.affectsConfiguration('corrector.corregirEnEditor')) {
            diagnosticosActivos = vscode.workspace.getConfiguration('corrector').get<boolean>('corregirEnEditor', false);
            if (!diagnosticosActivos) {
                diagnosticos.clear();
                actualizarBarraEstado(0);
            } else if (vscode.window.activeTextEditor) {
                analizarDocumento(vscode.window.activeTextEditor.document);
                const diagsDoc = diagnosticos.get(vscode.window.activeTextEditor.document.uri);
                actualizarBarraEstado(diagsDoc ? diagsDoc.length : 0);
            } else {
                actualizarBarraEstado(0);
            }
        }
    });

    // Analizar el documento activo al arrancar (si está activo)
    if (diagnosticosActivos && vscode.window.activeTextEditor) {
        analizarDocumento(vscode.window.activeTextEditor.document);
        const diagsDoc = diagnosticos.get(vscode.window.activeTextEditor.document.uri);
        actualizarBarraEstado(diagsDoc ? diagsDoc.length : 0);
    }

    // ─── FUENTE OPENDYSLEXIC ────────────────────────────────────────────
    const cmdToggleFuente = vscode.commands.registerCommand(
        'corrector.toggleFuente',
        async () => {
            // Ya no cambiamos la fuente directamente por seguridad y diseño.
            // Simplemente llevamos al usuario a la configuración para que elija.
            await vscode.commands.executeCommand('workbench.action.openSettings', 'corrector.fuenteDislexia');

            vscode.window.showInformationMessage(
                'Corrector: Configura el uso de OpenDyslexic aquí. ' +
                'Recuerda que debes tener la fuente instalada en tu sistema.',
                'Descargar OpenDyslexic'
            ).then(seleccion => {
                if (seleccion === 'Descargar OpenDyslexic') {
                    vscode.env.openExternal(vscode.Uri.parse('https://opendyslexic.org/'));
                }
            });
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

    // ─── COMANDOS INTERACTIVOS DE CORRECCIÓN ────────────────────────────

    // Comando: ignorar palabra desde el editor (Code Action)
    const cmdIgnorarDesdeEditor = vscode.commands.registerCommand(
        'corrector.ignorarDesdeEditor',
        async (palabra: string, uri: vscode.Uri) => {
            motor.ignorarPalabra(palabra.toLowerCase());
            guardarDatos();
            vscode.window.showInformationMessage(
                `Corrector: "${palabra}" añadida al diccionario personal — no se volverá a marcar`
            );
            // Re-analizar el documento para quitar los diagnósticos de esa palabra
            const doc = vscode.workspace.textDocuments.find(d => d.uri.toString() === uri.toString());
            if (doc) { analizarDocumento(doc); }
        }
    );

    // Comando: sugerir palabra para el diccionario oficial
    const cmdSugerirPalabra = vscode.commands.registerCommand(
        'corrector.sugerirPalabra',
        async (original: string, corregido: string, regla: string) => {
            await guardarSugerencia(original, corregido, regla);
            vscode.window.showInformationMessage(
                `Corrector: Sugerencia guardada en .corrector-sugerencias.md — ` +
                `"${original}" → "${corregido}". ¡Gracias por ayudar a mejorar el diccionario!`
            );
        }
    );

    // Comando: corregir todo el documento de golpe
    const cmdCorregirTodo = vscode.commands.registerCommand(
        'corrector.corregirTodo',
        async () => {
            const editor = vscode.window.activeTextEditor;
            if (!editor) {
                vscode.window.showWarningMessage('Corrector: No hay un editor activo');
                return;
            }

            const doc = editor.document;
            const diagsDoc = diagnosticos.get(doc.uri);
            if (!diagsDoc || diagsDoc.length === 0) {
                vscode.window.showInformationMessage('Corrector: No hay errores que corregir en este documento');
                return;
            }

            // Confirmar antes de aplicar todo
            const confirmar = await vscode.window.showWarningMessage(
                `Corrector: Se van a aplicar ${diagsDoc.length} correcciones. ¿Continuar?`,
                'Sí, corregir todo',
                'Cancelar'
            );
            if (confirmar !== 'Sí, corregir todo') { return; }

            // Aplicar correcciones de abajo hacia arriba (para no desplazar posiciones)
            const editWs = new vscode.WorkspaceEdit();
            const diagsOrdenados = [...diagsDoc].sort((a, b) => {
                if (a.range.start.line !== b.range.start.line) {
                    return b.range.start.line - a.range.start.line;
                }
                return b.range.start.character - a.range.start.character;
            });

            let aplicadas = 0;
            for (const diag of diagsOrdenados) {
                const id = generarIdDiagnostico(doc.uri.toString(), diag.range);
                const datos = correccionesDiagnostico.get(id);
                if (datos) {
                    editWs.replace(doc.uri, diag.range, datos.corregido);
                    aplicadas++;
                }
            }

            if (aplicadas > 0) {
                await vscode.workspace.applyEdit(editWs);
                vscode.window.showInformationMessage(
                    `Corrector: ${aplicadas} correcciones aplicadas ✅`
                );
            }
        }
    );

    // Comando: enviar archivo de sugerencias por email
    const cmdEnviarSugerencias = vscode.commands.registerCommand(
        'corrector.enviarSugerencias',
        async () => {
            const folder = vscode.workspace.workspaceFolders?.[0];
            if (!folder) {
                vscode.window.showWarningMessage('Corrector: Necesitas tener una carpeta abierta');
                return;
            }

            const archivoUri = vscode.Uri.joinPath(folder.uri, '.corrector-sugerencias.md');
            try {
                const contenido = await vscode.workspace.fs.readFile(archivoUri);
                const texto = Buffer.from(contenido).toString('utf-8');

                if (texto.trim().length === 0) {
                    vscode.window.showInformationMessage('Corrector: El archivo de sugerencias está vacío');
                    return;
                }

                // Abrir mailto con el contenido
                const asunto = encodeURIComponent('Sugerencias para Corrector - Diccionario');
                const cuerpo = encodeURIComponent(
                    'Hola Javier,\n\n' +
                    'Estas son mis sugerencias para el diccionario del Corrector:\n\n' +
                    texto + '\n\n' +
                    'Enviado desde la extensión Corrector para VS Code'
                );
                const mailtoUri = vscode.Uri.parse(
                    `mailto:erbolamm@gmail.com?subject=${asunto}&body=${cuerpo}`
                );
                await vscode.env.openExternal(mailtoUri);

                vscode.window.showInformationMessage(
                    'Corrector: Se ha abierto tu cliente de email con las sugerencias. ¡Gracias por la colaboración!'
                );
            } catch {
                vscode.window.showWarningMessage(
                    'Corrector: No se encontró el archivo .corrector-sugerencias.md — ' +
                    'Usa las Quick Fixes (💡) para sugerir palabras primero'
                );
            }
        }
    );

    // ─── COMANDOS DE IA LOCAL ────────────────────────────────────────────
    const cmdInstalarIALocal = vscode.commands.registerCommand(
        'corrector.instalarIALocal',
        async () => {
            await vscode.window.withProgress(
                {
                    location: vscode.ProgressLocation.Notification,
                    title: 'Corrector: Instalando IA local',
                    cancellable: false,
                },
                async (progress) => {
                    try {
                        await instalarDepsTransformers((msg) => {
                            progress.report({ message: msg });
                        });
                        await contextoGlobal.globalState.update('iaLocal_depsInstalled', true);
                        vscode.window.showInformationMessage(
                            'Corrector: transformers.js instalado. Usa "Corrector: Cargar modelo de IA local" para descargar el modelo.'
                        );
                    } catch (err) {
                        vscode.window.showErrorMessage(
                            'Corrector: Error instalando transformers.js — ' + String(err)
                        );
                    }
                }
            );
        }
    );

    const cmdCargarModeloLocal = vscode.commands.registerCommand(
        'corrector.cargarModeloLocal',
        async () => {
            await vscode.window.withProgress(
                {
                    location: vscode.ProgressLocation.Notification,
                    title: 'Corrector: Descargando modelo de IA',
                    cancellable: false,
                },
                async (progress) => {
                    try {
                        await cargarModeloLocal('onnx-community/Qwen2.5-0.5B-Instruct', (info) => {
                            const pct = info.progress != null
                                ? ` (${Math.round(info.progress)}%)`
                                : '';
                            progress.report({
                                message: `${info.status}${pct}${info.file ? ' — ' + info.file : ''}`,
                            });
                        });
                        const modelId = 'onnx-community/Qwen2.5-0.5B-Instruct';
                        await contextoGlobal.globalState.update('iaLocal_currentModel', modelId);
                        vscode.window.showInformationMessage(
                            'Corrector: Modelo de IA local cargado y listo.'
                        );
                    } catch (err) {
                        vscode.window.showErrorMessage(
                            'Corrector: Error cargando modelo — ' + String(err)
                        );
                    }
                }
            );
        }
    );

    // ─── PANEL DE IA LOCAL ─────────────────────────────────────────────────
    const iaPanelProvider = new IAPanelProvider(context.extensionUri, context.globalState);
    context.subscriptions.push(
        vscode.window.registerWebviewViewProvider(IAPanelProvider.viewType, iaPanelProvider),
        vscode.commands.registerCommand('corrector.openIaLocalPanel', () => {
            vscode.commands.executeCommand('corrector.iaLocalPanel.focus');
        })
    );

    // ─── REGISTRAR CODE ACTION PROVIDER ──────────────────────────────────
    const codeActionProvider = vscode.languages.registerCodeActionsProvider(
        { scheme: 'file' },
        new CorrectorCodeActionProvider(),
        { providedCodeActionKinds: CorrectorCodeActionProvider.providedCodeActionKinds }
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
        cmdMenuPrincipal,
        cmdVerCorrecciones,
        cmdMostrarDialogoDeprecated,
        cmdIgnorarDesdeEditor,
        cmdSugerirPalabra,
        cmdCorregirTodo,
        cmdEnviarSugerencias,
        cmdInstalarIALocal,
        cmdCargarModeloLocal,
        codeActionProvider,
        iaPanelProvider,
        barraEstado,
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
    const iaLocalActiva = config.get<boolean>('iaLocal', false);
    const backendPreferido = config.get<string>('iaLocalBackend', 'auto') as IABackend | 'auto';

    // ── CABECERA DE MODO (siempre visible, primera línea) ──
    const idiomaLabel = resultado.idioma === 'en' ? '🇬🇧 English' : '🇪🇸 Español';
    if (iaLocalActiva) {
        stream.markdown('> 🧠 **Modo IA local** · ' + idiomaLabel + ' · offline · reglas + IA\n\n');
    } else if (reenviarIA) {
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

    // ── REFINAMIENTO CON IA LOCAL (después de corrección por reglas) ──
    if (iaLocalActiva && !reenviarIA) {
        const textoBase = resultado.totalCorrecciones > 0
            ? resultado.textoCorregido
            : texto;

        stream.markdown('\n---\n\n');
        stream.markdown('🧠 **Refinando con IA local…**\n\n');

        const iaConfig: IAConfig = {
            backend: backendPreferido === 'auto' ? 'none' : backendPreferido,
            ollamaEndpoint: config.get<string>('ollamaEndpoint', 'http://localhost:11434'),
            lmstudioEndpoint: config.get<string>('lmstudioEndpoint', 'http://localhost:1234/v1'),
            ollamaModel: config.get<string>('ollamaModel', ''),
        };

        try {
            const refinamiento = await refinarConIA(textoBase, iaConfig);
            if (refinamiento) {
                // Only show if the IA actually changed something
                if (refinamiento.textoRefinado !== textoBase) {
                    stream.markdown('### ✨ Texto refinado por IA\n\n');
                    stream.markdown('> ' + refinamiento.textoRefinado + '\n\n');
                    stream.markdown('_Backend: **' + refinamiento.backend + '** · Modelo: **' + refinamiento.modelo + '**_\n\n');

                    stream.button({
                        command: 'corrector.copiarTexto',
                        title: '📋 Copiar texto refinado',
                        arguments: [refinamiento.textoRefinado],
                    });
                } else {
                    stream.markdown('✅ La IA confirma que el texto está bien.\n\n');
                    stream.markdown('_Backend: **' + refinamiento.backend + '** · Modelo: **' + refinamiento.modelo + '**_\n\n');
                }
            } else {
                stream.markdown('⚠️ **No se encontró backend de IA local.** ');
                stream.markdown('Instala [Ollama](https://ollama.com) o [LM Studio](https://lmstudio.ai), ');
                stream.markdown('o usa el comando "Corrector: Instalar IA local" para transformers.js.\n\n');
            }
        } catch (err) {
            stream.markdown('⚠️ _Error al refinar con IA local: ' + String(err) + '_\n\n');
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
    stream.markdown('- ⚠️ El modo IA consume tokens de tu plan\n\n');
    stream.markdown('### 🧠 IA Local (opcional, sin tokens)\n');
    stream.markdown('- Activa `corrector.iaLocal` en Ajustes para refinar con IA local después de las reglas\n');
    stream.markdown('- Compatible con **Ollama**, **LM Studio** o **transformers.js**\n');
    stream.markdown('- Todo corre offline, no consume tokens\n');
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
    stream.markdown('💡 _Consejo: los modelos "mini" o "haiku" son más rápidos y consumen menos tokens._\n\n');

    // IA Local info
    stream.markdown('---\n\n');
    stream.markdown('## 🧠 IA Local (offline, sin tokens)\n\n');

    const iaConfig: IAConfig = {
        backend: 'none',
        ollamaEndpoint: vscode.workspace.getConfiguration('corrector').get<string>('ollamaEndpoint', 'http://localhost:11434'),
        lmstudioEndpoint: vscode.workspace.getConfiguration('corrector').get<string>('lmstudioEndpoint', 'http://localhost:1234/v1'),
        ollamaModel: '',
    };
    const backends = await detectarBackends(iaConfig);

    if (backends.length > 0) {
        stream.markdown('Backends detectados: **' + backends.join(', ') + '**\n\n');
    } else {
        stream.markdown('No se detectaron backends de IA local.\n\n');
    }

    stream.markdown('Opciones disponibles:\n');
    stream.markdown('- **Ollama** — `ollama serve` + modelo (`ollama pull llama3.2`)\n');
    stream.markdown('- **LM Studio** — servidor local con modelos GGUF\n');
    stream.markdown('- **transformers.js** — modelo ONNX integrado (usa "Corrector: Instalar IA local")\n\n');
    stream.markdown('Activa con: `corrector.iaLocal: true` en Ajustes\n');
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

// ─── ARCHIVO DE SUGERENCIAS ────────────────────────────────────────────────

/**
 * Guarda una sugerencia de palabra en el archivo .corrector-sugerencias.md
 * del workspace actual. Si no existe, lo crea con cabecera explicativa.
 */
async function guardarSugerencia(original: string, corregido: string, regla: string): Promise<void> {
    const folder = vscode.workspace.workspaceFolders?.[0];
    if (!folder) { return; }

    const archivoUri = vscode.Uri.joinPath(folder.uri, '.corrector-sugerencias.md');
    const fecha = new Date().toLocaleString('es-ES', {
        year: 'numeric', month: '2-digit', day: '2-digit',
        hour: '2-digit', minute: '2-digit'
    });

    let contenidoExistente = '';
    try {
        const datos = await vscode.workspace.fs.readFile(archivoUri);
        contenidoExistente = Buffer.from(datos).toString('utf-8');
    } catch {
        // No existe, crear con cabecera
        contenidoExistente =
            '# Sugerencias para el diccionario de Corrector\n\n' +
            'Este archivo contiene palabras que podrían añadirse al diccionario\n' +
            'del [Corrector Ortográfico](https://github.com/erbolamm/corrector-vscode).\n\n' +
            'Puedes enviar este archivo al desarrollador para mejorar el diccionario\n' +
            'usando el comando: **Corrector: Enviar sugerencias por email**\n' +
            '(`Cmd+Shift+P` → `Corrector: Enviar sugerencias por email`)\n\n' +
            '---\n\n';
    }

    const nuevaLinea = `- **${original}** → ${corregido} _(${regla})_ — ${fecha}\n`;

    // Evitar duplicados
    if (contenidoExistente.includes(`**${original}**`)) {
        return; // Ya está sugerida
    }

    const contenidoFinal = contenidoExistente + nuevaLinea;
    await vscode.workspace.fs.writeFile(archivoUri, Buffer.from(contenidoFinal, 'utf-8'));
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

// ─── DIÁLOGO INTERACTIVO DE CORRECCIONES ────────────────────────────────────


async function mostrarMenuPrincipal(): Promise<void> {
    const config = vscode.workspace.getConfiguration('corrector');
    const estadoEditor = diagnosticosActivos ? 'Activada' : 'Desactivada';
    const estadoIa = config.get<boolean>('reenviarACopilot', false) ? 'Activado' : 'Desactivado';
    const hayEditorActivo = Boolean(vscode.window.activeTextEditor);

    const items: ItemMenuPrincipal[] = [
        {
            label: `${diagnosticosActivos ? '$(check)' : '$(x)'} Activar/Desactivar corrección en editor`,
            description: estadoEditor,
            detail: 'Pulsa para cambiar el estado',
            accion: 'toggle-editor',
        },
        { label: '', kind: vscode.QuickPickItemKind.Separator },
        {
            label: '$(pencil) Ver correcciones del documento',
            description: hayEditorActivo ? '' : 'Requiere un editor activo',
            accion: 'ver-correcciones',
        },
        {
            label: '$(check-all) Corregir todo el documento',
            description: hayEditorActivo ? '' : 'Requiere un editor activo',
            accion: 'corregir-todo',
        },
        { label: '', kind: vscode.QuickPickItemKind.Separator },
        {
            label: '$(typography) Configurar fuente OpenDyslexic',
            description: 'Abrir ajustes de fuente para dislexia',
            accion: 'toggle-fuente',
        },
        {
            label: '$(hubot) Configuración de Modo IA',
            description: estadoIa,
            detail: 'Abrir ajustes de corrector.reenviarACopilot y corrector.modeloPreferido',
            accion: 'abrir-ajustes',
        },
        { label: '', kind: vscode.QuickPickItemKind.Separator },
        {
            label: '$(add) Agregar palabra al diccionario personal',
            accion: 'agregar-palabra',
        },
        {
            label: '$(book) Ver diccionario personal',
            accion: 'ver-diccionario',
        },
        {
            label: '$(graph) Ver estadísticas de correcciones',
            accion: 'estadisticas',
        },
        {
            label: '$(mail) Enviar sugerencias por email',
            accion: 'enviar-sugerencias',
        },
    ];

    const seleccion = await vscode.window.showQuickPick(items, {
        title: 'Corrector — Menú principal',
        placeHolder: `Corrección en editor: ${estadoEditor} · Modo IA: ${estadoIa}`,
    });

    if (!seleccion?.accion) {
        return;
    }

    switch (seleccion.accion) {
        case 'toggle-editor':
            await vscode.commands.executeCommand('corrector.toggleEditor');
            break;
        case 'ver-correcciones':
            await vscode.commands.executeCommand('corrector.verCorrecciones');
            break;
        case 'corregir-todo':
            await vscode.commands.executeCommand('corrector.corregirTodo');
            break;
        case 'toggle-fuente':
            await vscode.commands.executeCommand('corrector.toggleFuente');
            break;
        case 'agregar-palabra':
            await vscode.commands.executeCommand('corrector.agregarPalabra');
            break;
        case 'ver-diccionario':
            await vscode.commands.executeCommand('corrector.verDiccionario');
            break;
        case 'estadisticas':
            await vscode.commands.executeCommand('corrector.estadisticas');
            break;
        case 'enviar-sugerencias':
            await vscode.commands.executeCommand('corrector.enviarSugerencias');
            break;
        case 'abrir-ajustes':
            await vscode.commands.executeCommand('workbench.action.openSettings', 'corrector');
            break;
        default:
            break;
    }
}

/**
 * Actualiza el texto e icono de la barra de estado.
 */
function actualizarBarraEstado(numErrores: number): void {
    if (!diagnosticosActivos) {
        barraEstado.text = '$(circle-slash) Corrector: OFF';
        barraEstado.backgroundColor = undefined;
        barraEstado.tooltip = 'Corrector desactivado — clic para abrir el menú';
        return;
    }

    if (numErrores > 0) {
        barraEstado.text = `$(pencil) Corrector: ${numErrores} error${numErrores > 1 ? 'es' : ''}`;
        barraEstado.backgroundColor = new vscode.ThemeColor('statusBarItem.warningBackground');
    } else {
        barraEstado.text = '$(check) Corrector: Sin errores';
        barraEstado.backgroundColor = undefined;
    }
    barraEstado.tooltip = 'Corrector activo — clic para abrir el menú';
}

/**
 * Muestra una notificación automática cuando se detectan errores nuevos.
 * El usuario puede abrir el diálogo de correcciones o ignorar.
 */
async function mostrarNotificacionErrores(
    numErrores: number,
    document: vscode.TextDocument
): Promise<void> {
    const accion = await vscode.window.showInformationMessage(
        `🔤 Corrector: ${numErrores} error${numErrores > 1 ? 'es' : ''} encontrado${numErrores > 1 ? 's' : ''} en este archivo`,
        'Ver correcciones',
        'Corregir todo',
        'Ignorar'
    );

    if (accion === 'Ver correcciones') {
        await mostrarDialogoCorrecciones(document);
    } else if (accion === 'Corregir todo') {
        await vscode.commands.executeCommand('corrector.corregirTodo');
    }
}

/**
 * Diálogo interactivo (QuickPick) que muestra cada corrección
 * y permite al usuario aceptar, rechazar o añadir al diccionario una por una.
 */
async function mostrarDialogoCorrecciones(document: vscode.TextDocument): Promise<void> {
    const diagsDoc = diagnosticos.get(document.uri);
    if (!diagsDoc || diagsDoc.length === 0) {
        vscode.window.showInformationMessage('Corrector: No hay errores en este documento ✅');
        return;
    }

    // Preparar items para el QuickPick
    interface ItemCorreccion extends vscode.QuickPickItem {
        tipo: 'correccion' | 'aplicar-todas' | 'diccionario-todas';
        diagIndice?: number;
    }

    const items: ItemCorreccion[] = [];

    // Opciones maestras al principio
    items.push({
        label: '$(check-all) Aplicar TODAS las correcciones',
        description: `${diagsDoc.length} correcciones`,
        tipo: 'aplicar-todas',
        kind: vscode.QuickPickItemKind.Default,
    });
    items.push({
        label: '',
        kind: vscode.QuickPickItemKind.Separator,
        tipo: 'correccion',
    });

    // Una entrada por cada corrección
    for (let i = 0; i < diagsDoc.length; i++) {
        const diag = diagsDoc[i];
        const id = generarIdDiagnostico(document.uri.toString(), diag.range);
        const datos = correccionesDiagnostico.get(id);
        if (!datos) { continue; }

        const linea = diag.range.start.line + 1;
        items.push({
            label: `$(pencil) "${datos.original}" → "${datos.corregido}"`,
            description: `Línea ${linea} · ${datos.regla}`,
            detail: `  Contexto: ...${document.getText(diag.range)}...`,
            tipo: 'correccion',
            diagIndice: i,
        });
    }

    // Mostrar QuickPick (repetir hasta que el usuario cancele o no queden errores)
    let seguir = true;
    while (seguir) {
        // Refrescar diagnósticos
        const diagsActuales = diagnosticos.get(document.uri);
        if (!diagsActuales || diagsActuales.length === 0) {
            vscode.window.showInformationMessage('Corrector: ¡Todas las correcciones aplicadas! ✅');
            break;
        }

        // Reconstruir items con diagnósticos actuales
        const itemsActuales: ItemCorreccion[] = [];
        itemsActuales.push({
            label: `$(check-all) Aplicar TODAS (${diagsActuales.length} restantes)`,
            description: '',
            tipo: 'aplicar-todas',
        });
        itemsActuales.push({
            label: '',
            kind: vscode.QuickPickItemKind.Separator,
            tipo: 'correccion',
        });

        for (let i = 0; i < diagsActuales.length; i++) {
            const diag = diagsActuales[i];
            const id = generarIdDiagnostico(document.uri.toString(), diag.range);
            const datos = correccionesDiagnostico.get(id);
            if (!datos) { continue; }

            const linea = diag.range.start.line + 1;
            itemsActuales.push({
                label: `$(pencil) "${datos.original}" → "${datos.corregido}"`,
                description: `Línea ${linea} · ${datos.regla}`,
                tipo: 'correccion',
                diagIndice: i,
            });
        }

        const seleccion = await vscode.window.showQuickPick(itemsActuales, {
            placeHolder: '¿Qué quieres hacer con cada corrección?',
            title: `🔤 Corrector — ${diagsActuales.length} correcciones pendientes`,
        }) as ItemCorreccion | undefined;

        if (!seleccion) {
            seguir = false;
            break;
        }

        if (seleccion.tipo === 'aplicar-todas') {
            await vscode.commands.executeCommand('corrector.corregirTodo');
            seguir = false;
            break;
        }

        if (seleccion.tipo === 'correccion' && seleccion.diagIndice !== undefined) {
            const diag = diagsActuales[seleccion.diagIndice];
            if (!diag) { continue; }
            const id = generarIdDiagnostico(document.uri.toString(), diag.range);
            const datos = correccionesDiagnostico.get(id);
            if (!datos) { continue; }

            // Sub-menú para esta corrección específica
            const accion = await vscode.window.showQuickPick([
                {
                    label: `$(check) Aceptar: "${datos.original}" → "${datos.corregido}"`,
                    value: 'aceptar'
                },
                {
                    label: `$(book) Añadir "${datos.original}" al diccionario (no corregir nunca)`,
                    value: 'diccionario'
                },
                {
                    label: '$(lightbulb) Sugerir esta palabra al desarrollador',
                    value: 'sugerir'
                },
                {
                    label: '$(arrow-left) Volver a la lista',
                    value: 'volver'
                },
            ], {
                placeHolder: `¿Qué hacer con "${datos.original}"?`,
                title: `✏️ "${datos.original}" → "${datos.corregido}" (${datos.regla})`,
            });

            if (!accion || accion.value === 'volver') {
                continue; // Volver al bucle principal
            }

            if (accion.value === 'aceptar') {
                const edit = new vscode.WorkspaceEdit();
                edit.replace(document.uri, diag.range, datos.corregido);
                await vscode.workspace.applyEdit(edit);
                // Re-analizar
                analizarDocumento(document);
                const diagsNuevos = diagnosticos.get(document.uri);
                actualizarBarraEstado(diagsNuevos ? diagsNuevos.length : 0);
            } else if (accion.value === 'diccionario') {
                await vscode.commands.executeCommand('corrector.ignorarDesdeEditor', datos.original, document.uri);
            } else if (accion.value === 'sugerir') {
                await vscode.commands.executeCommand('corrector.sugerirPalabra', datos.original, datos.corregido, datos.regla);
            }
        }
    }
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

    // Limpiar datos de corrección anteriores para este documento
    const uriStr = document.uri.toString();
    for (const key of correccionesDiagnostico.keys()) {
        if (key.startsWith(uriStr)) {
            correccionesDiagnostico.delete(key);
        }
    }

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

            // Guardar datos de corrección para el CodeActionProvider
            const id = generarIdDiagnostico(uriStr, range);
            correccionesDiagnostico.set(id, {
                original: correccion.original,
                corregido: correccion.corregido,
                regla: correccion.regla
            });
        }
    }

    diagnosticos.set(document.uri, nuevos);
}
