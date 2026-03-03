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
        cmdPermitirSiempre
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

    // ── CORRECCIÓN PRINCIPAL ──
    const resultado = motor.corregir(texto);
    const config = vscode.workspace.getConfiguration('corrector');
    const mostrarOriginal = config.get<boolean>('mostrarOriginal', true);
    const mostrarExplicaciones = config.get<boolean>('mostrarExplicaciones', true);

    if (resultado.totalCorrecciones === 0) {
        // Sin errores → informar y ofrecer enviar a Copilot
        // NOTA: La corrección es 100% offline, NO usa IA.
        // El botón "Enviar a Copilot" simplemente abre el chat con el texto.
        stream.markdown('✅ **Sin errores ortográficos.** Tu texto está bien escrito.\n\n');
        stream.markdown('> ' + texto + '\n\n');
        stream.markdown('---\n');
        stream.markdown('💡 _La corrección se ha realizado **sin conexión a internet ni IA**. ' +
            'El motor analiza tu texto con más de 150 reglas de español integradas en la extensión._\n\n');

        // Botón para enviar a Copilot (usa comando interno, NO necesita IA)
        stream.button({
            command: 'corrector.enviarACopilot',
            title: '🚀 Enviar a Copilot',
            arguments: [texto],
        });

        // Botón para copiar
        stream.button({
            command: 'corrector.copiarTexto',
            title: '📋 Copiar',
            arguments: [texto],
        });
    } else {
        // Recoger las palabras originales para el botón "Permitir siempre"
        const palabrasOriginales = resultado.correcciones.map(c => c.original);

        // Mostrar texto corregido
        stream.markdown('📝 **Texto corregido** (' + resultado.totalCorrecciones + ' corrección' + (resultado.totalCorrecciones > 1 ? 'es' : '') + '):\n\n');
        stream.markdown('> ' + resultado.textoCorregido + '\n\n');

        // Mostrar original si está configurado
        if (mostrarOriginal) {
            stream.markdown('---\n');
            stream.markdown('🔍 **Original:** ' + resultado.textoOriginal + '\n\n');
        }

        // Mostrar explicaciones si está configurado
        if (mostrarExplicaciones && resultado.correcciones.length > 0) {
            stream.markdown('📋 **Correcciones aplicadas:**\n\n');
            for (const c of resultado.correcciones) {
                stream.markdown('- ~~' + c.original + '~~ → **' + c.corregido + '** _(' + c.regla + ')_\n');
            }
        }

        stream.markdown('\n');

        stream.markdown('💡 _Corrección 100% offline — sin IA, sin internet. ' +
            'Motor integrado con más de 150 reglas de español._\n\n');

        // Botón 1: Copiar
        stream.button({
            command: 'corrector.copiarTexto',
            title: '📋 Copiar',
            arguments: [resultado.textoCorregido],
        });

        // Botón 2: Enviar a Copilot
        stream.button({
            command: 'corrector.enviarACopilot',
            title: '🚀 Enviar a Copilot',
            arguments: [resultado.textoCorregido],
        });

        // Botón 3: Permitir siempre
        stream.button({
            command: 'corrector.permitirSiempre',
            title: '✅ Permitir siempre',
            arguments: [palabrasOriginales],
        });
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

    console.log('[Corrector] Datos cargados — Diccionario personal: ' +
        (diccionario ? Object.keys(diccionario).length : 0) + ' entradas');
}

export function deactivate() {
    // Guardar antes de desactivar
    if (motor && contextoGlobal) {
        guardarDatos();
    }
    console.log('[Corrector] Extensión desactivada');
}
