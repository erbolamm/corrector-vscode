/**
 * Motor de corrección ortográfica para español e inglés.
 * Detecta el idioma automáticamente y aplica las reglas correspondientes.
 * Diseñado específicamente para patrones de dislexia.
 * Sin dependencias externas — funciona 100% offline.
 *
 * Autor: Javier Mateo (ApliArte)
 */

export type Idioma = 'es' | 'en';

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
    idioma: Idioma;
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
    // NOTA: 'ay' se maneja con corrección contextual (ver aplicarCorreccionesContextuales)
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

    ['enpesar', { corregido: 'empezar', regla: 's→z + n→m: empezar' }],
    ['empesar', { corregido: 'empezar', regla: 's→z: empezar' }],
    ['utilisar', { corregido: 'utilizar', regla: 's→z: utilizar' }],

    // ── G / Q confusión (teclas adyacentes) ──
    ['gue', { corregido: 'que', regla: 'g→q: que (tecla adyacente)' }],
    ['guiero', { corregido: 'quiero', regla: 'g→q: quiero' }],
    ['guieres', { corregido: 'quieres', regla: 'g→q: quieres' }],
    ['guiere', { corregido: 'quiere', regla: 'g→q: quiere' }],

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
    ['yegar', { corregido: 'llegar', regla: 'y→ll: llegar' }],
    ['yamada', { corregido: 'llamada', regla: 'y→ll: llamada' }],
    ['yamar', { corregido: 'llamar', regla: 'y→ll: llamar' }],
    ['yave', { corregido: 'llave', regla: 'y→ll: llave' }],
    ['yeno', { corregido: 'lleno', regla: 'y→ll: lleno' }],
    ['yena', { corregido: 'llena', regla: 'y→ll: llena' }],
    ['yover', { corregido: 'llover', regla: 'y→ll: llover' }],

    // ── Transposiciones comunes ──
    ['ertas', { corregido: 'estas', regla: 'transposición: e-r-t-a-s → e-s-t-a-s' }],
    ['hayga', { corregido: 'haya', regla: 'ultracorrección: haya' }],

    // ── B / V adicionales ──
    ['biene', { corregido: 'viene', regla: 'b→v: viene' }],
    ['bienen', { corregido: 'vienen', regla: 'b→v: vienen' }],
    ['abeces', { corregido: 'a veces', regla: 'b→v + separación: a veces' }],
    ['estava', { corregido: 'estaba', regla: 'v→b: estaba' }],
    ['estavamos', { corregido: 'estábamos', regla: 'v→b + tilde: estábamos' }],

    // ── Tildes omitidas (palabras más comunes) ──
    ['dias', { corregido: 'días', regla: 'tilde: días' }],
    ['tambien', { corregido: 'también', regla: 'tilde: también' }],
    ['aqui', { corregido: 'aquí', regla: 'tilde: aquí' }],
    ['ahi', { corregido: 'ahí', regla: 'tilde: ahí' }],
    ['asi', { corregido: 'así', regla: 'tilde: así' }],
    // NOTA: 'mas' y 'ay' se manejan con corrección contextual (ver aplicarCorreccionesContextuales)
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

    // ── Tecla repetida / doble letra incorrecta ──
    ['estroo', { corregido: 'esto', regla: 'doble letra + r extra: esto' }],
    ['estoo', { corregido: 'esto', regla: 'doble letra: esto' }],
    ['esoo', { corregido: 'eso', regla: 'doble letra: eso' }],
    ['estee', { corregido: 'este', regla: 'doble letra: este' }],
    ['estaa', { corregido: 'esta', regla: 'doble letra: esta' }],

    // ── Q pegada a la siguiente palabra (error de espacio) ──
    ['qcomo', { corregido: 'cómo', regla: 'q pegada + tilde: cómo' }],
    ['qtal', { corregido: 'qué tal', regla: 'q pegada: qué tal' }],
    ['qpasa', { corregido: 'qué pasa', regla: 'q pegada: qué pasa' }],
    ['qhaces', { corregido: 'qué haces', regla: 'q pegada: qué haces' }],
    ['qdices', { corregido: 'qué dices', regla: 'q pegada: qué dices' }],
    ['qhago', { corregido: 'qué hago', regla: 'q pegada: qué hago' }],

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

// ─── DICCIONARIO INGLÉS ───────────────────────────────────────────────────────
// Errores más comunes en inglés para personas con dislexia.

const CORRECCIONES_EN: Map<string, { corregido: string; regla: string }> = new Map([
    // ── Transposiciones (teh, adn pattern) ──
    ['teh', { corregido: 'the', regla: 'transposition: teh→the' }],
    ['hte', { corregido: 'the', regla: 'transposition: hte→the' }],
    ['adn', { corregido: 'and', regla: 'transposition: adn→and' }],
    ['nad', { corregido: 'and', regla: 'transposition: nad→and' }],
    ['waht', { corregido: 'what', regla: 'transposition: waht→what' }],
    ['taht', { corregido: 'that', regla: 'transposition: taht→that' }],
    ['thsi', { corregido: 'this', regla: 'transposition: thsi→this' }],
    ['siad', { corregido: 'said', regla: 'transposition: siad→said' }],
    ['frist', { corregido: 'first', regla: 'transposition: frist→first' }],
    ['woudl', { corregido: 'would', regla: 'transposition: woudl→would' }],
    ['coudl', { corregido: 'could', regla: 'transposition: coudl→could' }],
    ['shoudl', { corregido: 'should', regla: 'transposition: shoudl→should' }],
    ['peopel', { corregido: 'people', regla: 'transposition: peopel→people' }],
    ['hwo', { corregido: 'how', regla: 'transposition: hwo→how' }],
    ['whas', { corregido: 'was', regla: 'transposition: whas→was' }],
    ['becuase', { corregido: 'because', regla: 'transposition: becuase→because' }],
    ['becasue', { corregido: 'because', regla: 'transposition: becasue→because' }],
    ['alos', { corregido: 'also', regla: 'transposition: alos→also' }],
    ['aslo', { corregido: 'also', regla: 'transposition: aslo→also' }],
    ['langauge', { corregido: 'language', regla: 'transposition: langauge→language' }],
    ['lanaguage', { corregido: 'language', regla: 'transposition: lanaguage→language' }],
    ['knowlegde', { corregido: 'knowledge', regla: 'transposition: knowlegde→knowledge' }],
    ['databse', { corregido: 'database', regla: 'transposition: databse→database' }],
    ['paramaeter', { corregido: 'parameter', regla: 'transposition: paramaeter→parameter' }],
    ['functoin', { corregido: 'function', regla: 'transposition: functoin→function' }],
    ['funciton', { corregido: 'function', regla: 'transposition: funciton→function' }],
    ['initialze', { corregido: 'initialize', regla: 'transposition: initialze→initialize' }],

    // ── Confusión ie/ei ("I before E except after C") ──
    ['recieve', { corregido: 'receive', regla: 'ie/ei: recieve→receive' }],
    ['recieved', { corregido: 'received', regla: 'ie/ei: recieved→received' }],
    ['beleive', { corregido: 'believe', regla: 'ie/ei: beleive→believe' }],
    ['beleived', { corregido: 'believed', regla: 'ie/ei: beleived→believed' }],
    ['beleif', { corregido: 'belief', regla: 'ie/ei: beleif→belief' }],
    ['freind', { corregido: 'friend', regla: 'ie/ei: freind→friend' }],
    ['wierd', { corregido: 'weird', regla: 'ie/ei: wierd→weird' }],
    ['peice', { corregido: 'piece', regla: 'ie/ei: peice→piece' }],
    ['acheive', { corregido: 'achieve', regla: 'ie/ei: acheive→achieve' }],
    ['achievment', { corregido: 'achievement', regla: 'ie/ei: achievment→achievement' }],
    ['cheif', { corregido: 'chief', regla: 'ie/ei: cheif→chief' }],
    ['feild', { corregido: 'field', regla: 'ie/ei: feild→field' }],
    ['yeild', { corregido: 'yield', regla: 'ie/ei: yeild→yield' }],
    ['breif', { corregido: 'brief', regla: 'ie/ei: breif→brief' }],
    ['releive', { corregido: 'relieve', regla: 'ie/ei: releive→relieve' }],
    ['greif', { corregido: 'grief', regla: 'ie/ei: greif→grief' }],
    ['thier', { corregido: 'their', regla: 'ie/ei: thier→their' }],

    // ── Doble letra incorrecta (falta o sobra) ──
    ['realy', { corregido: 'really', regla: 'double letter: realy→really' }],
    ['biger', { corregido: 'bigger', regla: 'double letter: biger→bigger' }],
    ['begining', { corregido: 'beginning', regla: 'double letter: begining→beginning' }],
    ['runing', { corregido: 'running', regla: 'double letter: runing→running' }],
    ['hapening', { corregido: 'happening', regla: 'double letter: hapening→happening' }],
    ['hapened', { corregido: 'happened', regla: 'double letter: hapened→happened' }],
    ['happend', { corregido: 'happened', regla: 'double letter: happend→happened' }],
    ['stoping', { corregido: 'stopping', regla: 'double letter: stoping→stopping' }],
    ['writting', { corregido: 'writing', regla: 'double letter: writting→writing' }],
    ['studing', { corregido: 'studying', regla: 'double letter: studing→studying' }],
    ['comming', { corregido: 'coming', regla: 'double letter: comming→coming' }],
    ['finaly', { corregido: 'finally', regla: 'double letter: finaly→finally' }],
    ['posible', { corregido: 'possible', regla: 'double letter: posible→possible' }],
    ['necesary', { corregido: 'necessary', regla: 'double letter: necesary→necessary' }],
    ['necesarry', { corregido: 'necessary', regla: 'double letter: necesarry→necessary' }],
    ['occured', { corregido: 'occurred', regla: 'double letter: occured→occurred' }],
    ['ocurred', { corregido: 'occurred', regla: 'double letter: ocurred→occurred' }],
    ['succesful', { corregido: 'successful', regla: 'double letter: succesful→successful' }],
    ['accomodate', { corregido: 'accommodate', regla: 'double letter: accomodate→accommodate' }],
    ['acomodate', { corregido: 'accommodate', regla: 'double letter: acomodate→accommodate' }],
    ['recomend', { corregido: 'recommend', regla: 'double letter: recomend→recommend' }],
    ['reccomend', { corregido: 'recommend', regla: 'double letter: reccomend→recommend' }],
    ['grammer', { corregido: 'grammar', regla: 'spelling: grammer→grammar' }],
    ['writen', { corregido: 'written', regla: 'double letter: writen→written' }],
    ['diferent', { corregido: 'different', regla: 'double letter: diferent→different' }],
    ['untill', { corregido: 'until', regla: 'double letter: untill→until' }],
    ['tommorrow', { corregido: 'tomorrow', regla: 'double letter: tommorrow→tomorrow' }],
    ['tomorow', { corregido: 'tomorrow', regla: 'double letter: tomorow→tomorrow' }],
    ['tommorow', { corregido: 'tomorrow', regla: 'double letter: tommorow→tomorrow' }],
    ['accomodation', { corregido: 'accommodation', regla: 'double letter: accomodation→accommodation' }],
    ['acommodation', { corregido: 'accommodation', regla: 'double letter: acommodation→accommodation' }],

    // ── Letras mudas omitidas ──
    ['nite', { corregido: 'night', regla: 'silent letters: nite→night' }],
    ['enuf', { corregido: 'enough', regla: 'phonetic: enuf→enough' }],
    ['rong', { corregido: 'wrong', regla: 'silent letter w: rong→wrong' }],
    ['nife', { corregido: 'knife', regla: 'silent letter k: nife→knife' }],
    ['wich', { corregido: 'which', regla: 'silent h: wich→which' }],
    ['wher', { corregido: 'where', regla: 'spelling: wher→where' }],

    // ── Ortografía fonética ──
    ['fone', { corregido: 'phone', regla: 'phonetic ph→f: fone→phone' }],
    ['foto', { corregido: 'photo', regla: 'phonetic ph→f: foto→photo' }],
    ['luv', { corregido: 'love', regla: 'phonetic: luv→love' }],
    ['wuz', { corregido: 'was', regla: 'phonetic: wuz→was' }],
    ['bcuz', { corregido: 'because', regla: 'phonetic: bcuz→because' }],
    ['thru', { corregido: 'through', regla: 'phonetic: thru→through' }],
    ['wud', { corregido: 'would', regla: 'phonetic: wud→would' }],
    ['cud', { corregido: 'could', regla: 'phonetic: cud→could' }],
    ['shud', { corregido: 'should', regla: 'phonetic: shud→should' }],

    // ── Errores de ortografía comunes ──
    ['defenitely', { corregido: 'definitely', regla: 'spelling: defenitely→definitely' }],
    ['definately', { corregido: 'definitely', regla: 'spelling: definately→definitely' }],
    ['definitly', { corregido: 'definitely', regla: 'spelling: definitly→definitely' }],
    ['definatly', { corregido: 'definitely', regla: 'spelling: definatly→definitely' }],
    ['absolutly', { corregido: 'absolutely', regla: 'spelling: absolutly→absolutely' }],
    ['probaly', { corregido: 'probably', regla: 'spelling: probaly→probably' }],
    ['proably', { corregido: 'probably', regla: 'spelling: proably→probably' }],
    ['seperate', { corregido: 'separate', regla: 'spelling: seperate→separate' }],
    ['seperete', { corregido: 'separate', regla: 'spelling: seperete→separate' }],
    ['alredy', { corregido: 'already', regla: 'spelling: alredy→already' }],
    ['allready', { corregido: 'already', regla: 'spelling: allready→already' }],
    ['intresting', { corregido: 'interesting', regla: 'spelling: intresting→interesting' }],
    ['intrested', { corregido: 'interested', regla: 'spelling: intrested→interested' }],
    ['knowlege', { corregido: 'knowledge', regla: 'spelling: knowlege→knowledge' }],
    ['maintenence', { corregido: 'maintenance', regla: 'spelling: maintenence→maintenance' }],
    ['maintainence', { corregido: 'maintenance', regla: 'spelling: maintainence→maintenance' }],
    ['resourse', { corregido: 'resource', regla: 'spelling: resourse→resource' }],
    ['resouce', { corregido: 'resource', regla: 'spelling: resouce→resource' }],
    ['enviroment', { corregido: 'environment', regla: 'spelling: enviroment→environment' }],
    ['envronment', { corregido: 'environment', regla: 'spelling: envronment→environment' }],
    ['buisness', { corregido: 'business', regla: 'spelling: buisness→business' }],
    ['bussiness', { corregido: 'business', regla: 'double letter: bussiness→business' }],
    ['repositery', { corregido: 'repository', regla: 'spelling: repositery→repository' }],
    ['repositry', { corregido: 'repository', regla: 'spelling: repositry→repository' }],

    // ── Separación incorrecta ──
    ['alot', { corregido: 'a lot', regla: 'spacing: alot→a lot' }],
    ['infact', { corregido: 'in fact', regla: 'spacing: infact→in fact' }],
    ['abit', { corregido: 'a bit', regla: 'spacing: abit→a bit' }],

    // ── Técnico / programación ──
    ['variabel', { corregido: 'variable', regla: 'spelling: variabel→variable' }],
    ['atribute', { corregido: 'attribute', regla: 'double letter: atribute→attribute' }],
    ['paramater', { corregido: 'parameter', regla: 'spelling: paramater→parameter' }],
    ['instence', { corregido: 'instance', regla: 'spelling: instence→instance' }],
    ['inheritence', { corregido: 'inheritance', regla: 'spelling: inheritence→inheritance' }],
    ['implemantation', { corregido: 'implementation', regla: 'spelling: implemantation→implementation' }],
    ['implimentation', { corregido: 'implementation', regla: 'spelling: implimentation→implementation' }],
    ['initalize', { corregido: 'initialize', regla: 'spelling: initalize→initialize' }],
]);

// ─── PATRONES FONÉTICOS INGLÉS ────────────────────────────────────────────────

const REGLAS_FONETICAS_EN: ReglaPatron[] = [
    // Abreviaturas tipo chat comunes en inglés
    { patron: /\bu\b(?=\s+[a-z])/gi, reemplazo: 'you', descripcion: 'abbrev: u→you' },
    { patron: /\br\b(?=\s+[a-z])/gi, reemplazo: 'are', descripcion: 'abbrev: r→are' },
    { patron: /\bb4\b/gi, reemplazo: 'before', descripcion: 'abbrev: b4→before' },
    { patron: /\bthx\b/gi, reemplazo: 'thanks', descripcion: 'abbrev: thx→thanks' },
    { patron: /\btmr\b/gi, reemplazo: 'tomorrow', descripcion: 'abbrev: tmr→tomorrow' },
    { patron: /\bidk\b/gi, reemplazo: "I don't know", descripcion: 'abbrev: idk' },
    { patron: /\bbtw\b/gi, reemplazo: 'by the way', descripcion: 'abbrev: btw→by the way' },
    { patron: /\bimo\b/gi, reemplazo: 'in my opinion', descripcion: 'abbrev: imo' },
];

// ─── VOCABULARIO PARA SEGMENTACIÓN DE PALABRAS PEGADAS ──────────────────────
// Conjunto de palabras conocidas en español (válidas + errores comunes).
// Se usa para segmentar textos sin espacios tipo "olaguetal" → "ola gue tal".

const VOCABULARIO_BASE_ES = new Set([
    // === Artículos ===
    'el', 'la', 'los', 'las', 'un', 'una', 'unos', 'unas',
    // === Preposiciones ===
    'a', 'de', 'en', 'con', 'por', 'para', 'sin', 'sobre', 'entre',
    'hasta', 'desde', 'hacia', 'ante', 'bajo', 'tras', 'según', 'contra',
    // === Conjunciones ===
    'y', 'o', 'e', 'u', 'ni', 'que', 'pero', 'sino', 'aunque', 'porque',
    'como', 'cuando', 'donde', 'si', 'pues', 'entonces', 'mientras',
    // === Pronombres ===
    'yo', 'tú', 'él', 'ella', 'nosotros', 'vosotros', 'ellos', 'ellas',
    'me', 'te', 'se', 'nos', 'os', 'le', 'les', 'lo', 'mi', 'mí', 'ti',
    // === Determinantes ===
    'del', 'al', 'su', 'sus', 'tu', 'tus', 'mis',
    'este', 'esta', 'esto', 'estos', 'estas',
    'ese', 'esa', 'eso', 'esos', 'esas',
    // === Adverbios ===
    'no', 'sí', 'muy', 'más', 'ya', 'también', 'aquí', 'ahí', 'allí',
    'bien', 'mal', 'siempre', 'nunca', 'ahora', 'hoy', 'ayer', 'mañana',
    'después', 'antes', 'luego', 'casi', 'solo', 'todavía', 'aún',
    'además', 'bastante', 'demasiado', 'mucho', 'poco', 'todo', 'nada',
    'algo', 'cerca', 'lejos', 'arriba', 'abajo', 'dentro', 'fuera',
    // === Verbo ser ===
    'ser', 'soy', 'eres', 'es', 'somos', 'son', 'era', 'sido', 'siendo',
    // === Verbo estar ===
    'estar', 'estoy', 'estás', 'está', 'estamos', 'están', 'estaba',
    // === Verbo haber ===
    'haber', 'he', 'has', 'ha', 'hemos', 'han', 'había',
    // === Verbo tener ===
    'tener', 'tengo', 'tienes', 'tiene', 'tenemos', 'tienen', 'tenía',
    // === Verbo hacer ===
    'hacer', 'hago', 'haces', 'hace', 'hacemos', 'hacen', 'hecho', 'haciendo',
    // === Verbo ir ===
    'ir', 'voy', 'vas', 'va', 'vamos', 'van', 'iba', 'yendo',
    // === Verbo poder ===
    'poder', 'puedo', 'puedes', 'puede', 'podemos', 'pueden',
    // === Verbo decir ===
    'decir', 'digo', 'dices', 'dice', 'decimos', 'dicen', 'diciendo',
    // === Verbo ver ===
    'ver', 'veo', 'ves', 've', 'vemos', 'ven', 'viendo',
    // === Verbo dar ===
    'dar', 'doy', 'das', 'da', 'damos', 'dan', 'dando',
    // === Verbo saber ===
    'saber', 'sé', 'sabes', 'sabe', 'sabemos', 'saben',
    // === Verbo querer ===
    'querer', 'quiero', 'quieres', 'quiere', 'queremos', 'quieren',
    // === Otros verbos comunes ===
    'poner', 'pongo', 'pone', 'ponen',
    'venir', 'vengo', 'viene', 'vienen',
    'salir', 'salgo', 'sale', 'salen',
    'tomar', 'tomo', 'toma', 'toman',
    'llevar', 'llevo', 'lleva', 'llevan',
    'dejar', 'dejo', 'deja', 'dejan',
    'llamar', 'llamo', 'llama', 'llaman',
    'pasar', 'paso', 'pasa', 'pasan',
    'hablar', 'hablo', 'habla', 'hablan',
    'creer', 'creo', 'cree', 'creen',
    'pensar', 'pienso', 'piensa', 'piensan',
    'sentir', 'siento', 'siente', 'sienten',
    'vivir', 'vivo', 'vive', 'viven',
    'escribir', 'escribo', 'escribe', 'escriben',
    'leer', 'leo', 'lee', 'leen',
    'abrir', 'abro', 'abre', 'abren',
    'comer', 'como', 'come', 'comen',
    'beber', 'bebo', 'bebe', 'beben',
    'dormir', 'duermo', 'duerme', 'duermen',
    'correr', 'corro', 'corre', 'corren',
    'volver', 'vuelvo', 'vuelve', 'vuelven',
    'jugar', 'juego', 'juega', 'juegan',
    'buscar', 'busco', 'busca', 'buscan',
    'mirar', 'miro', 'mira', 'miran',
    'trabajar', 'trabajo', 'trabaja', 'trabajan',
    'necesitar', 'necesito', 'necesita', 'necesitan',
    'esperar', 'espero', 'espera', 'esperan', 'esperando',
    'cambiar', 'cambio', 'cambia', 'cambian',
    'probar', 'pruebo', 'prueba', 'prueban',
    'cerrar', 'cierro', 'cierra', 'cierran',
    'seguir', 'sigo', 'sigue', 'siguen',
    'conocer', 'conozco', 'conoce', 'conocen',
    'parecer', 'parezco', 'parece', 'parecen',
    // === Gerundios comunes ===
    'probando', 'corriendo', 'escribiendo', 'leyendo', 'saliendo',
    'viviendo', 'pensando', 'hablando', 'jugando', 'comiendo',
    'bebiendo', 'durmiendo', 'trabajando', 'estudiando', 'aprendiendo',
    'mirando', 'buscando', 'tomando', 'dejando', 'llevando',
    'entrando', 'pasando', 'abriendo', 'cerrando', 'poniendo',
    'corriendo', 'volviendo', 'llamando', 'esperando',
    // === Participios comunes ===
    'dicho', 'puesto', 'visto', 'roto', 'escrito', 'abierto', 'vuelto',
    'muerto', 'cubierto', 'resuelto', 'hablado', 'comido', 'vivido',
    // === Sustantivos comunes ===
    'cosa', 'casa', 'hombre', 'mujer', 'niño', 'niña', 'vida', 'vez',
    'día', 'mundo', 'tiempo', 'año', 'forma', 'parte', 'lugar', 'caso',
    'punto', 'momento', 'persona', 'historia', 'palabra', 'ejemplo',
    'grupo', 'problema', 'lado', 'cuenta', 'tipo', 'nombre',
    'hijo', 'hija', 'familia', 'libro', 'agua', 'ciudad', 'país',
    'escuela', 'idea', 'paso', 'cambio', 'clase', 'nivel',
    'cuerpo', 'razón', 'centro', 'fin', 'verdad', 'manera',
    'padre', 'madre', 'amigo', 'amiga', 'noche',
    'mano', 'gente', 'calle', 'mesa', 'puerta', 'dinero',
    'hora', 'semana', 'mes', 'horas', 'días', 'años',
    // === Adjetivos comunes ===
    'bueno', 'buena', 'buenos', 'buenas', 'malo', 'mala',
    'grande', 'pequeño', 'pequeña', 'nuevo', 'nueva', 'viejo', 'vieja',
    'largo', 'larga', 'corto', 'corta', 'alto', 'alta', 'bajo', 'baja',
    'mejor', 'peor', 'mayor', 'menor', 'mismo', 'misma',
    'otro', 'otra', 'otros', 'otras', 'mucha', 'muchos', 'muchas',
    'poca', 'pocos', 'pocas', 'claro', 'libre',
    // === Técnico ===
    'código', 'programa', 'función', 'archivo', 'carpeta', 'variable',
    'extensión', 'aplicación', 'corrector', 'servidor', 'proyecto',
    'comando', 'error', 'datos', 'texto', 'modelo', 'sistema', 'web',
    // === Saludos y expresiones ===
    'hola', 'adiós', 'gracias', 'vale', 'perdón', 'favor',
    // === Números ===
    'uno', 'dos', 'tres', 'cuatro', 'cinco', 'seis', 'siete', 'ocho',
    'nueve', 'diez', 'cero', 'cien', 'mil',
    // === Otros útiles ===
    'cada', 'tal', 'así', 'tan', 'hay', 'qué', 'quién', 'eso',
    'estas', 'luego', 'solo', 'después', 'todas', 'todos',
]);

/**
 * Construye el vocabulario completo para segmentación:
 * vocabulario base + todas las palabras de los diccionarios de corrección.
 */
function construirVocabularioSegmentacion(): Set<string> {
    const vocab = new Set(VOCABULARIO_BASE_ES);

    // Añadir errores conocidos (para poder segmentar textos con errores)
    for (const key of CORRECCIONES_DIRECTAS.keys()) {
        vocab.add(key);
    }
    // Añadir palabras correctas
    for (const { corregido } of CORRECCIONES_DIRECTAS.values()) {
        for (const palabra of corregido.split(' ')) {
            if (palabra.length >= 1) { vocab.add(palabra.toLowerCase()); }
        }
    }

    return vocab;
}

const VOCABULARIO_SEGMENTACION = construirVocabularioSegmentacion();

// ─── DETECCIÓN AUTOMÁTICA DE IDIOMA ──────────────────────────────────────────

/**
 * Detecta el idioma del texto (español o inglés) comparando palabras indicadoras.
 * Para textos cortos o ambiguos, devuelve español por defecto (idioma principal).
 */
function detectarIdioma(texto: string): Idioma {
    const palabras = texto.toLowerCase().split(/[\s,.!?;:]+/).filter(p => p.length >= 1);

    // Palabras unívocas de inglés (rarísimas o inexistentes en español)
    const indicadoresEN = new Set([
        'i',  // pronombre inglés 'I' (muy distintivo, nunca aparece solo en español)
        'the', 'is', 'are', 'was', 'were', 'and', 'that', 'have', 'has',
        'this', 'they', 'them', 'for', 'with', 'you', 'he', 'she', 'we', 'it',
        'at', 'be', 'from', 'by', 'not', 'but', 'what', 'all', 'can',
        'her', 'him', 'my', 'your', 'their', 'our', 'do', 'did', 'will',
        'would', 'could', 'should', 'may', 'might', 'shall', 'must',
        'been', 'had', 'his', 'its', 'who', 'which', 'than', 'then',
        'when', 'where', 'there', 'here', 'also', 'just', 'more',
        'because', 'however', 'therefore', 'although', 'through',
    ]);

    // Palabras unívocas de español (rarísimas o inexistentes en inglés)
    const indicadoresES = new Set([
        'el', 'la', 'los', 'las', 'que', 'con', 'para', 'por', 'una',
        'pero', 'como', 'también', 'todo', 'muy', 'cuando', 'bien', 'fue',
        'esta', 'este', 'son', 'hay', 'del', 'al', 'se', 'su', 'sus',
        'yo', 'mi', 'tu', 'si', 'más', 'ya', 'así', 'aquí', 'ahí',
        'donde', 'porque', 'estar', 'hace', 'hola', 'gracias', 'esto',
        'está', 'tiene', 'hacer', 'desde', 'hasta', 'entre', 'sobre',
        'algo', 'vez', 'cada',
    ]);

    let puntoEN = 0;
    let puntoES = 0;

    for (const palabra of palabras) {
        if (indicadoresEN.has(palabra)) { puntoEN++; }
        if (indicadoresES.has(palabra)) { puntoES++; }
    }

    // Si el inglés tiene ventaja clara, usar inglés; en empate → español
    return puntoEN > puntoES ? 'en' : 'es';
}

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

        // Detectar idioma automáticamente ANTES de segmentar
        const idioma = detectarIdioma(textoCorregido);

        // PASO 0: Segmentar palabras pegadas (solo español — el segmentador usa vocabulario español)
        if (idioma === 'es') {
            textoCorregido = this.preprocesarSegmentacion(textoCorregido, correcciones);
        }
        const diccionario = idioma === 'en' ? CORRECCIONES_EN : CORRECCIONES_DIRECTAS;
        const reglasPatron = idioma === 'en' ? REGLAS_FONETICAS_EN : REGLAS_FONETICAS;

        // PASO 1: Correcciones directas (diccionario del idioma detectado)
        textoCorregido = this.aplicarCorreccionesDirectas(textoCorregido, correcciones, diccionario);

        // PASO 2: Diccionario personal (siempre, independiente del idioma)
        textoCorregido = this.aplicarDiccionarioPersonal(textoCorregido, correcciones);

        // PASO 3: Patrones fonéticos del idioma detectado
        textoCorregido = this.aplicarReglasPatron(textoCorregido, correcciones, reglasPatron);

        // PASO 4: Tildes automáticas (solo español)
        if (idioma === 'es') {
            textoCorregido = this.aplicarReglasTildes(textoCorregido, correcciones);
        }

        // PASO 5: Correcciones contextuales (palabras ambiguas: mas/más, ay/hay)
        if (idioma === 'es') {
            textoCorregido = this.aplicarCorreccionesContextuales(textoCorregido, correcciones);
        }

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
            idioma,
        };
    }

    /**
     * Aplica correcciones directas del diccionario principal.
     */
    private aplicarCorreccionesDirectas(
        texto: string,
        correcciones: Correccion[],
        diccionario: Map<string, { corregido: string; regla: string }>
    ): string {
        return texto.replace(/\b[\wáéíóúüñ]+\b/gi, (palabra, offset) => {
            const lower = palabra.toLowerCase();

            // No corregir si está en la lista de ignoradas
            if (this.palabrasIgnoradas.has(lower)) {
                return palabra;
            }

            const correccion = diccionario.get(lower);
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
    private aplicarReglasPatron(
        texto: string,
        correcciones: Correccion[],
        reglas: ReglaPatron[]
    ): string {
        for (const regla of reglas) {
            texto = texto.replace(regla.patron, (match, offset) => {
                // Evitar doble corrección si ya fue corregido
                const yaCorregido = correcciones.some(
                    c => c.posicion === offset || c.original === match
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

    // ─── CORRECCIÓN CONTEXTUAL ──────────────────────────────────────────

    /**
     * Aplica correcciones que dependen del contexto (palabras vecinas).
     * Resuelve ambigüedades como:
     *   - "mas" → "más" (adverbio) vs "mas" (conjunción adversativa)
     *   - "ay" → "hay" (verbo) vs "¡Ay!" (interjección)
     *   - "esta" → "está" (verbo) vs "esta" (determinante)
     */
    private aplicarCorreccionesContextuales(texto: string, correcciones: Correccion[]): string {
        const palabras = texto.split(/(\s+|(?=[¿¡.,;:!?])|(?<=[¿¡.,;:!?]))/);

        // Extraer solo las palabras (sin separadores) para análisis de contexto
        const tokens: { texto: string; inicio: number; esPalabra: boolean }[] = [];
        let pos = 0;
        for (const parte of palabras) {
            if (parte.length > 0) {
                tokens.push({
                    texto: parte,
                    inicio: pos,
                    esPalabra: /[a-záéíóúüñ]/i.test(parte),
                });
            }
            pos += parte.length;
        }

        let resultado = texto;
        let offset = 0;

        for (let i = 0; i < tokens.length; i++) {
            const token = tokens[i];
            if (!token.esPalabra) { continue; }

            const lower = token.texto.toLowerCase();
            const prevWord = this.obtenerPalabraContexto(tokens, i, -1);
            const nextWord = this.obtenerPalabraContexto(tokens, i, 1);

            // No corregir si está ignorada
            if (this.palabrasIgnoradas.has(lower)) { continue; }

            let correccion: string | null = null;
            let regla = '';

            // ── "mas" → "más" EXCEPTO cuando es conjunción adversativa ──
            // "mas" es conjunción cuando sigue a coma o punto, o precede a "no", "sin"
            // "mas" sin contexto de conjunción → "más" (el 95% de los usos)
            if (lower === 'mas') {
                const esConjuncion =
                    prevWord === ',' || prevWord === ';' ||
                    nextWord === 'no' || nextWord === 'sin' || nextWord === 'nunca' ||
                    nextWord === 'tampoco' || nextWord === 'nadie' || nextWord === 'nada';

                if (!esConjuncion) {
                    correccion = 'más';
                    regla = 'tilde contextual: más (adverbio)';
                }
            }

            // ── "ay" → "hay" EXCEPTO cuando es interjección ──
            // "¡Ay!" es interjección (tras ¡ o al inicio, sin verbo después)
            // "ay" en medio de frase → "hay" (verbo haber)
            if (lower === 'ay') {
                const esInterjeccion =
                    prevWord === '¡' || prevWord === '!' ||
                    nextWord === '!' || nextWord === ',' ||
                    (i === 0 && (nextWord === '!' || nextWord === ',')) ||
                    nextWord === 'que' && this.obtenerPalabraContexto(tokens, i, 2) === 'dolor';

                if (!esInterjeccion) {
                    correccion = 'hay';
                    regla = 'h omitida contextual: hay (verbo)';
                }
            }

            // Aplicar corrección si se decidió
            if (correccion) {
                const posReal = token.inicio + offset;
                const resultado_texto = this.preservarCapitalizacion(token.texto, correccion);
                correcciones.push({
                    original: token.texto,
                    corregido: resultado_texto,
                    regla,
                    posicion: posReal,
                });
                resultado =
                    resultado.substring(0, posReal) +
                    resultado_texto +
                    resultado.substring(posReal + token.texto.length);
                offset += resultado_texto.length - token.texto.length;
            }
        }

        return resultado;
    }

    /**
     * Obtiene una palabra de contexto relativa a la posición actual.
     * direction: -1 para anterior, +1 para siguiente, -2 para dos antes, etc.
     */
    private obtenerPalabraContexto(
        tokens: { texto: string; inicio: number; esPalabra: boolean }[],
        indice: number,
        direction: number
    ): string {
        let step = direction > 0 ? 1 : -1;
        let count = Math.abs(direction);
        let j = indice + step;

        while (j >= 0 && j < tokens.length && count > 0) {
            if (tokens[j].esPalabra || /[¡!¿?,;.]/.test(tokens[j].texto)) {
                count--;
                if (count === 0) { return tokens[j].texto.toLowerCase(); }
            }
            j += step;
        }
        return '';
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

    // ─── SEGMENTACIÓN DE PALABRAS PEGADAS (CON FUZZY MATCHING) ─────────

    /**
     * Calcula la distancia de Levenshtein entre dos cadenas.
     * Mide cuántas ediciones (insertar, borrar, sustituir) se necesitan
     * para transformar una cadena en otra.
     */
    private static distanciaLevenshtein(a: string, b: string): number {
        const n = a.length;
        const m = b.length;
        if (n === 0) { return m; }
        if (m === 0) { return n; }

        // Optimización: usar solo 2 filas en lugar de matriz completa
        let prev = new Array(m + 1);
        let curr = new Array(m + 1);

        for (let j = 0; j <= m; j++) { prev[j] = j; }

        for (let i = 1; i <= n; i++) {
            curr[0] = i;
            for (let j = 1; j <= m; j++) {
                const cost = a[i - 1] === b[j - 1] ? 0 : 1;
                curr[j] = Math.min(
                    prev[j] + 1,       // borrar
                    curr[j - 1] + 1,   // insertar
                    prev[j - 1] + cost  // sustituir
                );
            }
            [prev, curr] = [curr, prev];
        }
        return prev[m];
    }

    /**
     * Busca la mejor coincidencia fuzzy en el vocabulario para un substring.
     * Devuelve la palabra del vocabulario más cercana si la distancia es aceptable.
     * maxDist: distancia máxima permitida (1 para palabras cortas, 2 para largas).
     */
    private buscarFuzzy(substr: string, maxDist: number): string | null {
        const lower = substr.toLowerCase();
        let mejorPalabra: string | null = null;
        let mejorDist = maxDist + 1;

        for (const vocab of VOCABULARIO_SEGMENTACION) {
            // Optimización: descartar rápido si las longitudes difieren demasiado
            if (Math.abs(vocab.length - lower.length) > maxDist) { continue; }

            const dist = MotorCorrector.distanciaLevenshtein(lower, vocab);
            if (dist > 0 && dist < mejorDist) {
                mejorDist = dist;
                mejorPalabra = vocab;
            }
        }

        return mejorPalabra;
    }

    /**
     * Intenta segmentar una palabra larga sin espacios en palabras conocidas.
     * Usa programación dinámica para encontrar la mejor segmentación.
     * Primero intenta coincidencia exacta; si falla, usa fuzzy matching.
     * Puntuación: suma de cuadrados de longitudes, penalizada por distancia fuzzy.
     * Devuelve la palabra con espacios insertados, o null si no se puede segmentar.
     */
    private segmentarPalabra(palabra: string): string | null {
        const lower = palabra.toLowerCase();
        const n = lower.length;
        if (n <= 5) { return null; }

        // Si la palabra ya es conocida, no segmentar
        if (VOCABULARIO_SEGMENTACION.has(lower)) { return null; }

        // Si la palabra es una clave del diccionario personal, no segmentar
        if (this.diccionarioPersonal.has(lower)) { return null; }

        // Si la palabra completa es fuzzy-similar a una palabra conocida, no segmentar
        // (ej: "automática" es similar a "automático" — no hay que partirla)
        // Usar distancia 2 siempre para la palabra completa (evitar segmentaciones absurdas)
        const distMaxCompleta = 2;
        const fuzzyCompleta = this.buscarFuzzy(lower, distMaxCompleta);
        if (fuzzyCompleta) { return null; }

        // Palabras de un solo carácter válidas en español
        const palabrasUnChar = new Set(['a', 'y', 'o', 'e', 'u']);

        // DP: dp[i] = mejor segmentación de los primeros i caracteres
        const dp: ({ segments: string[]; score: number; segmentosFuzzy: number } | null)[] = new Array(n + 1).fill(null);
        dp[0] = { segments: [], score: 0, segmentosFuzzy: 0 };

        const maxLenSegmento = 20;

        for (let i = 1; i <= n; i++) {
            for (let j = Math.max(0, i - maxLenSegmento); j < i; j++) {
                if (dp[j] === null) { continue; }

                const len = i - j;
                const substr = lower.substring(j, i);

                // Solo permitir segmentos de 1 char si son palabras válidas
                if (len === 1 && !palabrasUnChar.has(substr)) { continue; }

                // Intento 1: coincidencia exacta
                if (VOCABULARIO_SEGMENTACION.has(substr)) {
                    const newScore = dp[j]!.score + len * len;
                    if (dp[i] === null || newScore > dp[i]!.score) {
                        dp[i] = {
                            segments: [...dp[j]!.segments, palabra.substring(j, i)],
                            score: newScore,
                            segmentosFuzzy: dp[j]!.segmentosFuzzy,
                        };
                    }
                }

                // Intento 2: fuzzy matching (solo para segmentos >= 4 caracteres)
                if (len >= 4 && (dp[i] === null || dp[i]!.segmentosFuzzy < 2)) {
                    const maxDist = len >= 7 ? 2 : 1;
                    const fuzzyMatch = this.buscarFuzzy(substr, maxDist);
                    if (fuzzyMatch) {
                        // Penalización: usar longitud de la palabra ENCONTRADA (no del substring)
                        // para evitar que segmentos fuzzy largos inflen el score artificialmente
                        const matchLen = fuzzyMatch.length;
                        const penalty = matchLen >= 7 ? 2 : 4;
                        const newScore = dp[j]!.score + matchLen * matchLen - penalty;
                        const newFuzzy = dp[j]!.segmentosFuzzy + 1;
                        if (newFuzzy <= 2 && (dp[i] === null || newScore > dp[i]!.score)) {
                            dp[i] = {
                                segments: [...dp[j]!.segments, fuzzyMatch],
                                score: newScore,
                                segmentosFuzzy: newFuzzy,
                            };
                        }
                    }
                }
            }
        }

        // Solo devolver si hay al menos 2 segmentos
        if (dp[n] !== null && dp[n]!.segments.length >= 2) {
            return dp[n]!.segments.join(' ');
        }
        return null;
    }

    /**
     * Pre-procesa el texto buscando palabras largas sin espacios y
     * las segmenta en palabras conocidas si es posible.
     */
    private preprocesarSegmentacion(texto: string, correcciones: Correccion[]): string {
        return texto.replace(/[a-záéíóúüñ]{6,}/gi, (match, offset) => {
            const segmentado = this.segmentarPalabra(match);
            if (segmentado) {
                correcciones.push({
                    original: match,
                    corregido: segmentado,
                    regla: 'separación de palabras pegadas',
                    posicion: offset,
                });
                return segmentado;
            }
            return match;
        });
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
     * Carga estadísticas persistidas desde globalState.
     */
    cargarEstadisticas(mensajesCorregidos: number, totalCorrecciones: number): void {
        this.estadisticas.mensajesCorregidos = mensajesCorregidos;
        this.estadisticas.totalCorrecciones = totalCorrecciones;
    }

    /**
     * Devuelve el número total de reglas activas (diccionario + patrones + personal).
     */
    obtenerTotalReglas(): number {
        return CORRECCIONES_DIRECTAS.size + CORRECCIONES_EN.size +
            REGLAS_FONETICAS.length + REGLAS_FONETICAS_EN.length +
            this.diccionarioPersonal.size;
    }
}
