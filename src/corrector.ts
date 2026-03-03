/**
 * Motor de corrección ortográfica para español.
 * Diseñado específicamente para patrones de dislexia.
 * Sin dependencias externas — funciona 100% offline.
 *
 * Autor: Javier Mateo (ApliArte)
 */

export interface Correccion {
    original: string;
    corregido: string;
    regla: string;
    posicion: number;
}

export interface ResultadoCorreccion {
    textoOriginal: string;
    textoCorregido: string;
    correcciones: Correccion[];
    totalCorrecciones: number;
}

/**
 * Reglas de sustitución basadas en patrones comunes de dislexia en español.
 * Cada regla tiene: patrón regex, reemplazo, y descripción.
 */
interface ReglaPatron {
    patron: RegExp;
    reemplazo: string;
    descripcion: string;
}

// ─── REGLAS DE PATRONES FONÉTICOS ───────────────────────────────────────────
// Estos patrones capturan errores comunes donde se escribe "como suena"

const REGLAS_FONETICAS: ReglaPatron[] = [
    // k → qu (antes de e, i)
    { patron: /\bke\b/gi, reemplazo: 'que', descripcion: 'k→qu antes de e' },
    { patron: /\bki/gi, reemplazo: 'qui', descripcion: 'k→qu antes de i' },
    { patron: /\bkiero/gi, reemplazo: 'quiero', descripcion: 'k→qu: quiero' },
    { patron: /\bkieres/gi, reemplazo: 'quieres', descripcion: 'k→qu: quieres' },
    { patron: /\bkiere/gi, reemplazo: 'quiere', descripcion: 'k→qu: quiere' },
    { patron: /\bkieremos/gi, reemplazo: 'queremos', descripcion: 'k→qu: queremos' },

    // x → por/para
    { patron: /\bxq\b/gi, reemplazo: 'porque', descripcion: 'abreviatura: xq→porque' },
    { patron: /\bxk\b/gi, reemplazo: 'porque', descripcion: 'abreviatura: xk→porque' },
    { patron: /\bx\s+q\b/gi, reemplazo: 'por que', descripcion: 'abreviatura: x q→por que' },

    // Abreviaturas comunes tipo chat
    { patron: /\btb\b/gi, reemplazo: 'también', descripcion: 'abreviatura: tb→también' },
    { patron: /\btbn\b/gi, reemplazo: 'también', descripcion: 'abreviatura: tbn→también' },
    { patron: /\bq\b(?!\w)/gi, reemplazo: 'que', descripcion: 'abreviatura: q→que' },
    { patron: /\bd\b(?=\s+[a-záéíóú])/gi, reemplazo: 'de', descripcion: 'abreviatura: d→de' },
    { patron: /\bpa\b(?=\s)/gi, reemplazo: 'para', descripcion: 'abreviatura: pa→para' },
    { patron: /\bpq\b/gi, reemplazo: 'porque', descripcion: 'abreviatura: pq→porque' },
];

// ─── MAPA DE PALABRAS MAL ESCRITAS → CORRECTAS ─────────────────────────────
// Diccionario directo de las faltas más comunes en español con dislexia

const CORRECCIONES_DIRECTAS: Map<string, { corregido: string; regla: string }> = new Map([
    // ── H omitida / añadida ──
    ['ola', { corregido: 'hola', regla: 'h omitida: hola' }],
    ['asta', { corregido: 'hasta', regla: 'h omitida: hasta' }],
    ['acer', { corregido: 'hacer', regla: 'h omitida: hacer' }],
    ['aser', { corregido: 'hacer', regla: 'h omitida + c→s: hacer' }],
    ['echo', { corregido: 'hecho', regla: 'h omitida: hecho' }],
    ['emos', { corregido: 'hemos', regla: 'h omitida: hemos' }],
    ['ablar', { corregido: 'hablar', regla: 'h omitida: hablar' }],
    ['abrir', { corregido: 'abrir', regla: 'correcta (no lleva h)' }],
    ['ay', { corregido: 'hay', regla: 'h omitida: hay' }],
    ['oy', { corregido: 'hoy', regla: 'h omitida: hoy' }],
    ['aver', { corregido: 'a ver', regla: 'h omitida + separación: a ver' }],

    // ── B / V confusión ──
    ['vueno', { corregido: 'bueno', regla: 'v→b: bueno' }],
    ['vuenos', { corregido: 'buenos', regla: 'v→b: buenos' }],
    ['vuena', { corregido: 'buena', regla: 'v→b: buena' }],
    ['vuenas', { corregido: 'buenas', regla: 'v→b: buenas' }],
    ['haver', { corregido: 'haber', regla: 'v→b: haber' }],
    ['cavar', { corregido: 'acabar', regla: 'posible: acabar (verificar contexto)' }],
    ['bale', { corregido: 'vale', regla: 'b→v: vale' }],
    ['bamos', { corregido: 'vamos', regla: 'b→v: vamos' }],
    ['berdad', { corregido: 'verdad', regla: 'b→v: verdad' }],
    ['bida', { corregido: 'vida', regla: 'b→v: vida' }],
    ['bolber', { corregido: 'volver', regla: 'b→v: volver' }],
    ['llebar', { corregido: 'llevar', regla: 'b→v: llevar' }],
    ['nuebo', { corregido: 'nuevo', regla: 'b→v: nuevo' }],
    ['nueba', { corregido: 'nueva', regla: 'b→v: nueva' }],
    ['savemos', { corregido: 'sabemos', regla: 'v→b: sabemos' }],
    ['saver', { corregido: 'saber', regla: 'v→b: saber' }],
    ['saves', { corregido: 'sabes', regla: 'v→b: sabes' }],
    ['travajo', { corregido: 'trabajo', regla: 'v→b: trabajo' }],
    ['travajar', { corregido: 'trabajar', regla: 'v→b: trabajar' }],

    // ── C / S / Z confusión (seseo/ceceo) ──
    ['desir', { corregido: 'decir', regla: 's→c: decir' }],
    ['dise', { corregido: 'dice', regla: 's→c: dice' }],
    ['disen', { corregido: 'dicen', regla: 's→c: dicen' }],
    ['conoser', { corregido: 'conocer', regla: 's→c: conocer' }],
    ['parese', { corregido: 'parece', regla: 's→c: parece' }],
    ['nesesito', { corregido: 'necesito', regla: 's→c: necesito' }],
    ['nesesitar', { corregido: 'necesitar', regla: 's→c: necesitar' }],
    ['presio', { corregido: 'precio', regla: 's→c: precio' }],
    ['grasias', { corregido: 'gracias', regla: 's→c: gracias' }],
    ['grasia', { corregido: 'gracia', regla: 's→c: gracia' }],
    ['espesial', { corregido: 'especial', regla: 's→c: especial' }],
    ['consejo', { corregido: 'consejo', regla: 'correcta' }],
    ['enpesar', { corregido: 'empezar', regla: 's→z + n→m: empezar' }],
    ['empesar', { corregido: 'empezar', regla: 's→z: empezar' }],
    ['utilisar', { corregido: 'utilizar', regla: 's→z: utilizar' }],

    // ── G / J confusión ──
    ['jenial', { corregido: 'genial', regla: 'j→g: genial' }],
    ['jente', { corregido: 'gente', regla: 'j→g: gente' }],
    ['jeneral', { corregido: 'general', regla: 'j→g: general' }],
    ['jestion', { corregido: 'gestión', regla: 'j→g: gestión' }],
    ['rejistro', { corregido: 'registro', regla: 'j→g: registro' }],
    ['pajina', { corregido: 'página', regla: 'j→g: página' }],
    ['cojer', { corregido: 'coger', regla: 'j→g: coger' }],
    ['elejir', { corregido: 'elegir', regla: 'j→g: elegir' }],
    ['imajinar', { corregido: 'imaginar', regla: 'j→g: imaginar' }],

    // ── LL / Y confusión ──
    ['llegar', { corregido: 'llegar', regla: 'correcta' }],
    ['yegar', { corregido: 'llegar', regla: 'y→ll: llegar' }],
    ['yamada', { corregido: 'llamada', regla: 'y→ll: llamada' }],
    ['yamar', { corregido: 'llamar', regla: 'y→ll: llamar' }],
    ['yave', { corregido: 'llave', regla: 'y→ll: llave' }],
    ['yeno', { corregido: 'lleno', regla: 'y→ll: lleno' }],
    ['yena', { corregido: 'llena', regla: 'y→ll: llena' }],
    ['yegar', { corregido: 'llegar', regla: 'y→ll: llegar' }],
    ['yover', { corregido: 'llover', regla: 'y→ll: llover' }],

    // ── Tildes omitidas (palabras más comunes) ──
    ['dias', { corregido: 'días', regla: 'tilde: días' }],
    ['tambien', { corregido: 'también', regla: 'tilde: también' }],
    ['aqui', { corregido: 'aquí', regla: 'tilde: aquí' }],
    ['ahi', { corregido: 'ahí', regla: 'tilde: ahí' }],
    ['asi', { corregido: 'así', regla: 'tilde: así' }],
    ['mas', { corregido: 'más', regla: 'tilde: más' }],
    ['ademas', { corregido: 'además', regla: 'tilde: además' }],
    ['despues', { corregido: 'después', regla: 'tilde: después' }],
    ['detras', { corregido: 'detrás', regla: 'tilde: detrás' }],
    ['dificil', { corregido: 'difícil', regla: 'tilde: difícil' }],
    ['facil', { corregido: 'fácil', regla: 'tilde: fácil' }],
    ['rapido', { corregido: 'rápido', regla: 'tilde: rápido' }],
    ['rapida', { corregido: 'rápida', regla: 'tilde: rápida' }],
    ['musica', { corregido: 'música', regla: 'tilde: música' }],
    ['ultimo', { corregido: 'último', regla: 'tilde: último' }],
    ['ultima', { corregido: 'última', regla: 'tilde: última' }],
    ['publico', { corregido: 'público', regla: 'tilde: público' }],
    ['telefono', { corregido: 'teléfono', regla: 'tilde: teléfono' }],
    ['numero', { corregido: 'número', regla: 'tilde: número' }],
    ['pagina', { corregido: 'página', regla: 'tilde: página' }],
    ['codigo', { corregido: 'código', regla: 'tilde: código' }],
    ['metodo', { corregido: 'método', regla: 'tilde: método' }],
    ['tecnica', { corregido: 'técnica', regla: 'tilde: técnica' }],
    ['tecnico', { corregido: 'técnico', regla: 'tilde: técnico' }],
    ['automatico', { corregido: 'automático', regla: 'tilde: automático' }],
    ['informatica', { corregido: 'informática', regla: 'tilde: informática' }],
    ['aplicacion', { corregido: 'aplicación', regla: 'tilde: aplicación' }],
    ['configuracion', { corregido: 'configuración', regla: 'tilde: configuración' }],
    ['extension', { corregido: 'extensión', regla: 'tilde: extensión' }],
    ['funcion', { corregido: 'función', regla: 'tilde: función' }],
    ['informacion', { corregido: 'información', regla: 'tilde: información' }],
    ['conexion', { corregido: 'conexión', regla: 'tilde: conexión' }],
    ['solucion', { corregido: 'solución', regla: 'tilde: solución' }],
    ['version', { corregido: 'versión', regla: 'tilde: versión' }],
    ['opcion', { corregido: 'opción', regla: 'tilde: opción' }],
    ['direccion', { corregido: 'dirección', regla: 'tilde: dirección' }],
    ['seccion', { corregido: 'sección', regla: 'tilde: sección' }],
    ['sesion', { corregido: 'sesión', regla: 'tilde: sesión' }],

    // ── N / M antes de B/P ──
    ['enpezar', { corregido: 'empezar', regla: 'n→m antes de p: empezar' }],
    ['enbidia', { corregido: 'envidia', regla: 'n→m + b→v: envidia' }],
    ['conprar', { corregido: 'comprar', regla: 'n→m antes de p: comprar' }],
    ['tanpoco', { corregido: 'tampoco', regla: 'n→m antes de p: tampoco' }],
    ['tanvien', { corregido: 'también', regla: 'n→m + v→b: también' }],
    ['inposible', { corregido: 'imposible', regla: 'n→m antes de p: imposible' }],
    ['tienpo', { corregido: 'tiempo', regla: 'n→m antes de p: tiempo' }],
    ['sienpre', { corregido: 'siempre', regla: 'n→m antes de p: siempre' }],

    // ── Palabras técnicas mal escritas ──
    ['extesion', { corregido: 'extensión', regla: 'falta n + tilde: extensión' }],
    ['estension', { corregido: 'extensión', regla: 'est→ext + tilde: extensión' }],
    ['progama', { corregido: 'programa', regla: 'falta r: programa' }],
    ['porgrama', { corregido: 'programa', regla: 'transposición: programa' }],
    ['progarma', { corregido: 'programa', regla: 'transposición: programa' }],
    ['proyeto', { corregido: 'proyecto', regla: 'falta c: proyecto' }],
    ['proyesto', { corregido: 'proyecto', regla: 'transposición: proyecto' }],
    ['archibo', { corregido: 'archivo', regla: 'b→v: archivo' }],
    ['bariable', { corregido: 'variable', regla: 'b→v: variable' }],
    ['seridor', { corregido: 'servidor', regla: 'falta v: servidor' }],
    ['serbidor', { corregido: 'servidor', regla: 'b→v: servidor' }],
    ['carperta', { corregido: 'carpeta', regla: 'transposición: carpeta' }],
    ['comadno', { corregido: 'comando', regla: 'transposición: comando' }],
    ['comadndo', { corregido: 'comando', regla: 'transposición: comando' }],

    // ── Verbos comunes mal escritos ──
    ['aganmos', { corregido: 'hagamos', regla: 'transposición + h: hagamos' }],
    ['agamos', { corregido: 'hagamos', regla: 'h omitida: hagamos' }],
    ['emos', { corregido: 'hemos', regla: 'h omitida: hemos' }],
    ['ise', { corregido: 'hice', regla: 'h omitida + s→c: hice' }],
    ['ize', { corregido: 'hice', regla: 'h omitida + z→c: hice' }],
    ['pueso', { corregido: 'puedo', regla: 's→d: puedo' }],
    ['peudo', { corregido: 'puedo', regla: 'transposición: puedo' }],
    ['tnego', { corregido: 'tengo', regla: 'transposición: tengo' }],
    ['haser', { corregido: 'hacer', regla: 's→c: hacer' }],
    ['hascer', { corregido: 'hacer', regla: 'extra sc: hacer' }],

    // ── Saludos y expresiones comunes ──
    ['wenas', { corregido: 'buenas', regla: 'informal: buenas' }],
    ['wenos', { corregido: 'buenos', regla: 'informal: buenos' }],
    ['wena', { corregido: 'buena', regla: 'informal: buena' }],
    ['weno', { corregido: 'bueno', regla: 'informal: bueno' }],
    ['porfa', { corregido: 'por favor', regla: 'abreviatura: por favor' }],
    ['porfavor', { corregido: 'por favor', regla: 'separación: por favor' }],
    ['porfabor', { corregido: 'por favor', regla: 'separación + b→v: por favor' }],
    ['perfeto', { corregido: 'perfecto', regla: 'falta c: perfecto' }],
    ['perfekto', { corregido: 'perfecto', regla: 'k→c: perfecto' }],
]);

export class MotorCorrector {
    private diccionarioPersonal: Map<string, string> = new Map();
    private palabrasIgnoradas: Set<string> = new Set();
    private estadisticas = {
        mensajesCorregidos: 0,
        totalCorrecciones: 0,
        palabrasMasCorregidas: new Map<string, number>(),
    };

    /**
     * Corrige un texto completo aplicando todas las reglas.
     */
    corregir(texto: string): ResultadoCorreccion {
        const correcciones: Correccion[] = [];
        let textoCorregido = texto;

        // PASO 1: Correcciones directas (diccionario de palabras)
        textoCorregido = this.aplicarCorreccionesDirectas(textoCorregido, correcciones);

        // PASO 2: Diccionario personal
        textoCorregido = this.aplicarDiccionarioPersonal(textoCorregido, correcciones);

        // PASO 3: Reglas de patrones fonéticos
        textoCorregido = this.aplicarReglasPatron(textoCorregido, correcciones);

        // PASO 4: Reglas de tildes por patrón
        textoCorregido = this.aplicarReglasTildes(textoCorregido, correcciones);

        // Actualizar estadísticas
        if (correcciones.length > 0) {
            this.estadisticas.mensajesCorregidos++;
            this.estadisticas.totalCorrecciones += correcciones.length;
            for (const c of correcciones) {
                const count = this.estadisticas.palabrasMasCorregidas.get(c.original) || 0;
                this.estadisticas.palabrasMasCorregidas.set(c.original, count + 1);
            }
        }

        return {
            textoOriginal: texto,
            textoCorregido,
            correcciones,
            totalCorrecciones: correcciones.length,
        };
    }

    /**
     * Aplica correcciones directas del diccionario principal.
     */
    private aplicarCorreccionesDirectas(texto: string, correcciones: Correccion[]): string {
        return texto.replace(/\b[\wáéíóúüñ]+\b/gi, (palabra, offset) => {
            const lower = palabra.toLowerCase();

            // No corregir si está en la lista de ignoradas
            if (this.palabrasIgnoradas.has(lower)) {
                return palabra;
            }

            const correccion = CORRECCIONES_DIRECTAS.get(lower);
            if (correccion && correccion.corregido !== lower) {
                // Preservar capitalización original
                const resultado = this.preservarCapitalizacion(palabra, correccion.corregido);
                correcciones.push({
                    original: palabra,
                    corregido: resultado,
                    regla: correccion.regla,
                    posicion: offset,
                });
                return resultado;
            }
            return palabra;
        });
    }

    /**
     * Aplica el diccionario personal del usuario.
     */
    private aplicarDiccionarioPersonal(texto: string, correcciones: Correccion[]): string {
        for (const [error, correcto] of this.diccionarioPersonal) {
            const regex = new RegExp(`\\b${this.escaparRegex(error)}\\b`, 'gi');
            texto = texto.replace(regex, (match, offset) => {
                const resultado = this.preservarCapitalizacion(match, correcto);
                correcciones.push({
                    original: match,
                    corregido: resultado,
                    regla: 'diccionario personal',
                    posicion: offset,
                });
                return resultado;
            });
        }
        return texto;
    }

    /**
     * Aplica reglas de patrones fonéticos (regex).
     */
    private aplicarReglasPatron(texto: string, correcciones: Correccion[]): string {
        for (const regla of REGLAS_FONETICAS) {
            texto = texto.replace(regla.patron, (match, offset) => {
                // Evitar doble corrección si ya fue corregido
                const yaCorregido = correcciones.some(
                    c => c.posicion === offset || c.corregido === match
                );
                if (yaCorregido) { return match; }

                const resultado = this.preservarCapitalizacion(match, regla.reemplazo);
                correcciones.push({
                    original: match,
                    corregido: resultado,
                    regla: regla.descripcion,
                    posicion: typeof offset === 'number' ? offset : 0,
                });
                return resultado;
            });
        }
        return texto;
    }

    /**
     * Aplica reglas generales de tildes por patrones terminados en -cion, -sion, etc.
     */
    private aplicarReglasTildes(texto: string, correcciones: Correccion[]): string {
        // Palabras terminadas en -cion sin tilde
        texto = texto.replace(/\b(\w+)(cion)\b/gi, (match, inicio, final, offset) => {
            // Solo si no fue ya corregida y no tiene ya tilde
            if (!match.includes('ó')) {
                const yaCorregido = correcciones.some(c => c.posicion === offset);
                if (yaCorregido) { return match; }

                const corregido = inicio + 'ción';
                correcciones.push({
                    original: match,
                    corregido,
                    regla: 'tilde: -ción',
                    posicion: offset,
                });
                return corregido;
            }
            return match;
        });

        // Palabras terminadas en -sion sin tilde
        texto = texto.replace(/\b(\w+)(sion)\b/gi, (match, inicio, _final, offset) => {
            if (!match.includes('ó')) {
                const yaCorregido = correcciones.some(c => c.posicion === offset);
                if (yaCorregido) { return match; }

                const corregido = inicio + 'sión';
                correcciones.push({
                    original: match,
                    corregido,
                    regla: 'tilde: -sión',
                    posicion: offset,
                });
                return corregido;
            }
            return match;
        });

        return texto;
    }

    /**
     * Preserva la capitalización del original en la corrección.
     * "Ola" → "Hola", "OLA" → "HOLA", "ola" → "hola"
     */
    private preservarCapitalizacion(original: string, corregido: string): string {
        if (original === original.toUpperCase() && original.length > 1) {
            return corregido.toUpperCase();
        }
        if (original[0] === original[0].toUpperCase()) {
            return corregido.charAt(0).toUpperCase() + corregido.slice(1);
        }
        return corregido.toLowerCase();
    }

    /**
     * Escapa caracteres especiales de regex.
     */
    private escaparRegex(str: string): string {
        return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    }

    // ─── API PÚBLICA ────────────────────────────────────────────────────────

    /**
     * Añade una palabra al diccionario personal (error → correcto).
     */
    agregarPalabra(error: string, correcto: string): void {
        this.diccionarioPersonal.set(error.toLowerCase(), correcto.toLowerCase());
    }

    /**
     * Elimina una palabra del diccionario personal.
     */
    eliminarPalabra(error: string): boolean {
        return this.diccionarioPersonal.delete(error.toLowerCase());
    }

    /**
     * Marca una palabra para que no sea corregida.
     */
    ignorarPalabra(palabra: string): void {
        this.palabrasIgnoradas.add(palabra.toLowerCase());
    }

    /**
     * Devuelve todas las palabras del diccionario personal.
     */
    obtenerDiccionarioPersonal(): Map<string, string> {
        return new Map(this.diccionarioPersonal);
    }

    /**
     * Carga un diccionario personal desde un objeto serializado.
     */
    cargarDiccionarioPersonal(datos: Record<string, string>): void {
        this.diccionarioPersonal.clear();
        for (const [error, correcto] of Object.entries(datos)) {
            this.diccionarioPersonal.set(error, correcto);
        }
    }

    /**
     * Carga palabras ignoradas desde un array.
     */
    cargarPalabrasIgnoradas(palabras: string[]): void {
        this.palabrasIgnoradas = new Set(palabras);
    }

    /**
     * Serializa el diccionario personal para persistencia.
     */
    serializarDiccionarioPersonal(): Record<string, string> {
        const resultado: Record<string, string> = {};
        for (const [error, correcto] of this.diccionarioPersonal) {
            resultado[error] = correcto;
        }
        return resultado;
    }

    /**
     * Serializa las palabras ignoradas para persistencia.
     */
    serializarPalabrasIgnoradas(): string[] {
        return Array.from(this.palabrasIgnoradas);
    }

    /**
     * Obtiene las estadísticas de uso.
     */
    obtenerEstadisticas(): {
        mensajesCorregidos: number;
        totalCorrecciones: number;
        top10PalabrasMasCorregidas: Array<{ palabra: string; veces: number }>;
    } {
        const top10 = Array.from(this.estadisticas.palabrasMasCorregidas.entries())
            .sort((a, b) => b[1] - a[1])
            .slice(0, 10)
            .map(([palabra, veces]) => ({ palabra, veces }));

        return {
            mensajesCorregidos: this.estadisticas.mensajesCorregidos,
            totalCorrecciones: this.estadisticas.totalCorrecciones,
            top10PalabrasMasCorregidas: top10,
        };
    }

    /**
     * Reinicia las estadísticas.
     */
    reiniciarEstadisticas(): void {
        this.estadisticas.mensajesCorregidos = 0;
        this.estadisticas.totalCorrecciones = 0;
        this.estadisticas.palabrasMasCorregidas.clear();
    }

    /**
     * Devuelve el número total de reglas activas (diccionario + patrones + personal).
     */
    obtenerTotalReglas(): number {
        return CORRECCIONES_DIRECTAS.size + REGLAS_FONETICAS.length + this.diccionarioPersonal.size;
    }
}
