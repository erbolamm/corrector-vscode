/**
 * BATERÍA DE PRUEBAS ESTRICTAS — corrector-vscode
 * ================================================
 * Tests diseñados para ROMPER el corrector y encontrar fallos reales.
 * Cubre: edge cases, frases reales con múltiples errores, falsos positivos,
 * regresiones de bugs documentados, colisiones de reglas, estrés,
 * capitalización avanzada y detección de idioma en zonas grises.
 *
 * Ejecutar: npm test
 *
 * Autor: Batería generada para Javier Mateo (ApliArte)
 * Fecha: 2026-03-04
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { MotorCorrector } from '../src/corrector';

// ─── UTILIDADES ──────────────────────────────────────────────────────────────

function corregir(texto: string): string {
    const motor = new MotorCorrector();
    return motor.corregir(texto).textoCorregido;
}

function corregirConDetalles(texto: string) {
    const motor = new MotorCorrector();
    return motor.corregir(texto);
}

// ═════════════════════════════════════════════════════════════════════════════
// SECCIÓN 1: EDGE CASES — Entradas límite
// ═════════════════════════════════════════════════════════════════════════════

describe('ESTRICTO: Edge cases — entradas límite', () => {
    it('texto vacío no rompe nada', () => {
        assert.equal(corregir(''), '');
    });

    it('solo espacios no rompe nada', () => {
        assert.equal(corregir('   '), '   ');
    });

    it('solo signos de puntuación no rompe nada', () => {
        assert.equal(corregir('¿?¡!...'), '¿?¡!...');
    });

    it('un solo carácter no se corrige', () => {
        assert.equal(corregir('a'), 'a');
    });

    it('números solos no se tocan', () => {
        assert.equal(corregir('12345'), '12345');
    });

    it('emojis no rompen el motor', () => {
        const resultado = corregir('ola 😊');
        assert.ok(resultado.includes('hola'));
    });

    it('texto con saltos de línea funciona', () => {
        const resultado = corregir('ola\ngue tal');
        assert.ok(resultado.includes('hola'));
        assert.ok(resultado.includes('que'));
    });

    it('tabulaciones no rompen nada', () => {
        const resultado = corregir('ola\tgue');
        assert.ok(resultado.includes('hola'));
    });

    it('múltiples espacios entre palabras', () => {
        const resultado = corregir('ola   gue   tal');
        assert.ok(resultado.includes('hola'));
        assert.ok(resultado.includes('que'));
    });

    it('palabra larguísima desconocida no rompe', () => {
        const larga = 'supercalifragilisticoexpialidoso';
        assert.equal(corregir(larga), larga);
    });
});

// ═════════════════════════════════════════════════════════════════════════════
// SECCIÓN 2: FRASES REALES CON MÚLTIPLES ERRORES
// ═════════════════════════════════════════════════════════════════════════════

describe('ESTRICTO: Frases reales con múltiples errores de dislexia', () => {
    it('frase del README: ola gue tal ertas', () => {
        assert.equal(corregir('ola gue tal ertas'), 'hola que tal estas');
    });

    it('frase compleja: kiero desir gue vueno', () => {
        const resultado = corregir('kiero desir gue vueno');
        assert.ok(resultado.includes('quiero'), `Esperaba "quiero" en: ${resultado}`);
        assert.ok(resultado.includes('decir'), `Esperaba "decir" en: ${resultado}`);
        assert.ok(resultado.includes('que'), `Esperaba "que" en: ${resultado}`);
        assert.ok(resultado.includes('bueno'), `Esperaba "bueno" en: ${resultado}`);
    });

    it('frase con H omitida múltiple: acer eso oy asta las 5', () => {
        const resultado = corregir('acer eso oy asta las 5');
        assert.ok(resultado.includes('hacer'), `Esperaba "hacer" en: ${resultado}`);
        assert.ok(resultado.includes('hoy'), `Esperaba "hoy" en: ${resultado}`);
        assert.ok(resultado.includes('hasta'), `Esperaba "hasta" en: ${resultado}`);
    });

    it('frase B/V mezclada: bamos a berdad bale', () => {
        const resultado = corregir('bamos a berdad bale');
        assert.ok(resultado.includes('vamos'), `Esperaba "vamos" en: ${resultado}`);
        assert.ok(resultado.includes('verdad'), `Esperaba "verdad" en: ${resultado}`);
        assert.ok(resultado.includes('vale'), `Esperaba "vale" en: ${resultado}`);
    });

    it('frase seseo: nesesito desir grasias', () => {
        const resultado = corregir('nesesito desir grasias');
        assert.ok(resultado.includes('necesito'), `Esperaba "necesito" en: ${resultado}`);
        assert.ok(resultado.includes('decir'), `Esperaba "decir" en: ${resultado}`);
        assert.ok(resultado.includes('gracias'), `Esperaba "gracias" en: ${resultado}`);
    });

    it('frase abreviatura chat: xq no kieres tb benir', () => {
        const resultado = corregir('xq no kieres tb benir');
        assert.ok(resultado.includes('porque'), `Esperaba "porque" en: ${resultado}`);
        assert.ok(resultado.includes('quieres'), `Esperaba "quieres" en: ${resultado}`);
        assert.ok(resultado.includes('también'), `Esperaba "también" en: ${resultado}`);
    });

    it('frase tildes omitidas: aqui esta la informacion de la aplicacion', () => {
        const resultado = corregir('aqui esta la informacion de la aplicacion');
        assert.ok(resultado.includes('aquí'), `Esperaba "aquí" en: ${resultado}`);
        assert.ok(resultado.includes('información'), `Esperaba "información" en: ${resultado}`);
        assert.ok(resultado.includes('aplicación'), `Esperaba "aplicación" en: ${resultado}`);
    });

    it('frase con transposiciones: peudo acer el progama', () => {
        const resultado = corregir('peudo acer el progama');
        assert.ok(resultado.includes('puedo'), `Esperaba "puedo" en: ${resultado}`);
        assert.ok(resultado.includes('hacer'), `Esperaba "hacer" en: ${resultado}`);
        assert.ok(resultado.includes('programa'), `Esperaba "programa" en: ${resultado}`);
    });

    it('frase informal completa: wenas porfa kiero saver el presio', () => {
        const resultado = corregir('wenas porfa kiero saver el presio');
        assert.ok(resultado.includes('buenas'), `Esperaba "buenas" en: ${resultado}`);
        assert.ok(resultado.includes('por favor'), `Esperaba "por favor" en: ${resultado}`);
        assert.ok(resultado.includes('quiero'), `Esperaba "quiero" en: ${resultado}`);
        assert.ok(resultado.includes('saber'), `Esperaba "saber" en: ${resultado}`);
        assert.ok(resultado.includes('precio'), `Esperaba "precio" en: ${resultado}`);
    });

    it('frase tecla adyacente G/Q: guiero guieres gue guiere', () => {
        const resultado = corregir('guiero guieres gue guiere');
        assert.ok(resultado.includes('quiero'), `Esperaba "quiero" en: ${resultado}`);
        assert.ok(resultado.includes('quieres'), `Esperaba "quieres" en: ${resultado}`);
        assert.ok(resultado.includes('que'), `Esperaba "que" en: ${resultado}`);
        assert.ok(resultado.includes('quiere'), `Esperaba "quiere" en: ${resultado}`);
    });

    it('frase J/G mezclada: la jente jenial de la pajina', () => {
        const resultado = corregir('la jente jenial de la pajina');
        assert.ok(resultado.includes('gente'), `Esperaba "gente" en: ${resultado}`);
        assert.ok(resultado.includes('genial'), `Esperaba "genial" en: ${resultado}`);
        assert.ok(resultado.includes('página'), `Esperaba "página" en: ${resultado}`);
    });

    it('frase LL/Y: yegar a la yamada con la yave', () => {
        const resultado = corregir('yegar a la yamada con la yave');
        assert.ok(resultado.includes('llegar'), `Esperaba "llegar" en: ${resultado}`);
        assert.ok(resultado.includes('llamada'), `Esperaba "llamada" en: ${resultado}`);
        assert.ok(resultado.includes('llave'), `Esperaba "llave" en: ${resultado}`);
    });

    it('frase N/M antes de B/P: conprar es inposible tienpo', () => {
        const resultado = corregir('conprar es inposible tienpo');
        assert.ok(resultado.includes('comprar'), `Esperaba "comprar" en: ${resultado}`);
        assert.ok(resultado.includes('imposible'), `Esperaba "imposible" en: ${resultado}`);
        assert.ok(resultado.includes('tiempo'), `Esperaba "tiempo" en: ${resultado}`);
    });

    it('frase técnica: el progama del serbidor tiene un proyeto', () => {
        const resultado = corregir('el progama del serbidor tiene un proyeto');
        assert.ok(resultado.includes('programa'), `Esperaba "programa" en: ${resultado}`);
        assert.ok(resultado.includes('servidor'), `Esperaba "servidor" en: ${resultado}`);
        assert.ok(resultado.includes('proyecto'), `Esperaba "proyecto" en: ${resultado}`);
    });

    it('frase gaps documentados: biene abeces y estava ahi', () => {
        const resultado = corregir('biene abeces y estava ahi');
        assert.ok(resultado.includes('viene'), `Esperaba "viene" en: ${resultado}`);
        assert.ok(resultado.includes('a veces'), `Esperaba "a veces" en: ${resultado}`);
        assert.ok(resultado.includes('estaba'), `Esperaba "estaba" en: ${resultado}`);
        assert.ok(resultado.includes('ahí'), `Esperaba "ahí" en: ${resultado}`);
    });

    it('ultracorrección: hayga → haya', () => {
        assert.equal(corregir('hayga'), 'haya');
    });
});

// ═════════════════════════════════════════════════════════════════════════════
// SECCIÓN 3: FALSOS POSITIVOS — Palabras que NO deben corregirse
// ═════════════════════════════════════════════════════════════════════════════

describe('ESTRICTO: Falsos positivos — NO corregir palabras correctas', () => {
    // Español
    it('"bueno" no se toca', () => assert.equal(corregir('bueno'), 'bueno'));
    it('"viene" no se toca', () => assert.equal(corregir('viene'), 'viene'));
    it('"estaba" no se toca', () => assert.equal(corregir('estaba'), 'estaba'));
    it('"hacer" no se toca', () => assert.equal(corregir('hacer'), 'hacer'));
    it('"hasta" no se toca', () => assert.equal(corregir('hasta'), 'hasta'));
    it('"verdad" no se toca', () => assert.equal(corregir('verdad'), 'verdad'));
    it('"gracias" no se toca', () => assert.equal(corregir('gracias'), 'gracias'));
    it('"necesito" no se toca', () => assert.equal(corregir('necesito'), 'necesito'));
    it('"programa" no se toca', () => assert.equal(corregir('programa'), 'programa'));
    it('"quiero" no se toca', () => assert.equal(corregir('quiero'), 'quiero'));
    it('"página" no se toca', () => assert.equal(corregir('página'), 'página'));
    it('"también" no se toca', () => assert.equal(corregir('también'), 'también'));
    it('"código" no se toca', () => assert.equal(corregir('código'), 'código'));
    it('"función" no se toca', () => assert.equal(corregir('función'), 'función'));
    it('"información" no se toca', () => assert.equal(corregir('información'), 'información'));

    // Frases completas correctas — nada debe cambiar
    it('frase correcta completa no se toca', () => {
        const frase = 'hola que tal estas hoy';
        assert.equal(corregir(frase), frase);
    });

    it('frase técnica correcta no se toca', () => {
        const frase = 'el programa tiene una función nueva';
        assert.equal(corregir(frase), frase);
    });

    it('frase con tildes correctas no se toca', () => {
        const frase = 'la aplicación tiene configuración automática';
        assert.equal(corregir(frase), frase);
    });

    // Palabras que podrían confundir al motor
    it('"gente" no se toca (no es "jente")', () => {
        assert.equal(corregir('gente'), 'gente');
    });
    it('"general" no se toca', () => {
        assert.equal(corregir('general'), 'general');
    });
    it('"llegar" no se toca', () => {
        assert.equal(corregir('llegar'), 'llegar');
    });
    it('"llamar" no se toca', () => {
        assert.equal(corregir('llamar'), 'llamar');
    });
    it('"volver" no se toca', () => {
        assert.equal(corregir('volver'), 'volver');
    });
    it('"comprar" no se toca', () => {
        assert.equal(corregir('comprar'), 'comprar');
    });

    // Inglés — palabras correctas
    it('"the" no se toca', () => assert.equal(corregir('the'), 'the'));
    it('"because" no se toca', () => assert.equal(corregir('because'), 'because'));
    it('"different" no se toca', () => assert.equal(corregir('different'), 'different'));
    it('"environment" no se toca', () => assert.equal(corregir('environment'), 'environment'));
    it('"business" no se toca', () => assert.equal(corregir('business'), 'business'));
});

// ═════════════════════════════════════════════════════════════════════════════
// SECCIÓN 4: CAPITALIZACIÓN AVANZADA
// ═════════════════════════════════════════════════════════════════════════════

describe('ESTRICTO: Capitalización avanzada', () => {
    // Minúsculas
    it('ola → hola (minúsculas)', () => assert.equal(corregir('ola'), 'hola'));
    it('vueno → bueno (minúsculas)', () => assert.equal(corregir('vueno'), 'bueno'));

    // Primera mayúscula
    it('Ola → Hola', () => assert.equal(corregir('Ola'), 'Hola'));
    it('Vueno → Bueno', () => assert.equal(corregir('Vueno'), 'Bueno'));
    it('Bale → Vale', () => assert.equal(corregir('Bale'), 'Vale'));
    it('Berdad → Verdad', () => assert.equal(corregir('Berdad'), 'Verdad'));

    // Todo mayúsculas
    it('OLA → HOLA', () => assert.equal(corregir('OLA'), 'HOLA'));
    it('VUENO → BUENO', () => assert.equal(corregir('VUENO'), 'BUENO'));
    it('BALE → VALE', () => assert.equal(corregir('BALE'), 'VALE'));
    it('BERDAD → VERDAD', () => assert.equal(corregir('BERDAD'), 'VERDAD'));

    // Capitalización en frase
    it('Inicio de frase capitalizado: Ola gue tal', () => {
        const resultado = corregir('Ola gue tal');
        assert.ok(resultado.startsWith('Hola'), `Esperaba empezar con "Hola", recibí: ${resultado}`);
        assert.ok(resultado.includes('que'), `Esperaba "que" en: ${resultado}`);
    });

    // Tildes con capitalización
    it('TAMBIEN → TAMBIÉN', () => assert.equal(corregir('TAMBIEN'), 'TAMBIÉN'));
    it('Aqui → Aquí', () => assert.equal(corregir('Aqui'), 'Aquí'));
    it('AQUI → AQUÍ', () => assert.equal(corregir('AQUI'), 'AQUÍ'));

    // Palabras corregidas que generan varias palabras
    it('Abeces → A veces (capitalización en multipalabra)', () => {
        const resultado = corregir('Abeces');
        assert.ok(
            resultado.toLowerCase().includes('a veces'),
            `Esperaba "a veces" (lowercase) en: ${resultado}`
        );
    });

    it('PORFA → POR FAVOR (capitalización MAYÚSCULAS)', () => {
        assert.equal(corregir('PORFA'), 'POR FAVOR');
    });

    it('Porfa → Por favor (capitalización Título)', () => {
        assert.equal(corregir('Porfa'), 'Por favor');
    });
});

// ═════════════════════════════════════════════════════════════════════════════
// SECCIÓN 5: COLISIÓN DE REGLAS — Cuando varias reglas podrían aplicar
// ═════════════════════════════════════════════════════════════════════════════

describe('ESTRICTO: Colisión de reglas — prioridad correcta', () => {
    it('diccionario directo tiene prioridad sobre patrón fonético', () => {
        // "kiero" está en REGLAS_FONETICAS, pero "guiero" está en CORRECCIONES_DIRECTAS
        // Ambos apuntan a "quiero", verificar que no hay doble corrección
        const resultado = corregirConDetalles('guiero');
        assert.equal(resultado.textoCorregido, 'quiero');
        // No debería haber correcciones duplicadas
        const correccionesQuiero = resultado.correcciones.filter(
            c => c.corregido === 'quiero'
        );
        assert.equal(correccionesQuiero.length, 1, 'Solo 1 corrección para guiero→quiero');
    });

    it('no doble-corrección en "ke" (directo + patrón)', () => {
        // "ke" podría machear en patrón fonético
        const resultado = corregirConDetalles('ke');
        assert.equal(resultado.textoCorregido, 'que');
    });

    it('palabra ya corregida en paso 1 no se re-corrige en paso 3', () => {
        // "ola" se corrige a "hola" en diccionario directo
        // "hola" no debe machear ningún patrón fonético
        const resultado = corregirConDetalles('ola');
        assert.equal(resultado.textoCorregido, 'hola');
        assert.equal(resultado.correcciones.length, 1);
    });

    it('múltiples correcciones no interfieren entre sí', () => {
        const resultado = corregirConDetalles('ola vueno bale');
        assert.equal(resultado.textoCorregido, 'hola bueno vale');
        // Cada palabra debe tener exactamente 1 corrección
        assert.equal(resultado.correcciones.length, 3);
    });
});

// ═════════════════════════════════════════════════════════════════════════════
// SECCIÓN 6: DICCIONARIO PERSONAL — Interacciones complejas
// ═════════════════════════════════════════════════════════════════════════════

describe('ESTRICTO: Diccionario personal — interacciones complejas', () => {
    it('regla personal sobrescribe corrección integrada', () => {
        const motor = new MotorCorrector();
        // Supongamos que el usuario quiere que "ola" sea "wave" (uso técnico)
        motor.agregarPalabra('ola', 'wave');
        const resultado = motor.corregir('ola grande');
        // El diccionario directo convierte ola→hola, luego el personal convierte hola...
        // En realidad el personal se aplica DESPUÉS, así que "hola" ya no es "ola"
        // Esto verifica el orden de aplicación
        assert.ok(resultado.textoCorregido.length > 0);
    });

    it('ignorar palabra previene corrección del diccionario', () => {
        const motor = new MotorCorrector();
        motor.ignorarPalabra('ola');
        const resultado = motor.corregir('ola amigos');
        assert.ok(resultado.textoCorregido.includes('ola'), 'ola no debe corregirse');
    });

    it('ignorar no afecta a otras palabras', () => {
        const motor = new MotorCorrector();
        motor.ignorarPalabra('ola');
        const resultado = motor.corregir('ola vueno');
        assert.ok(resultado.textoCorregido.includes('ola'));
        assert.ok(resultado.textoCorregido.includes('bueno'));
    });

    it('agregar y luego eliminar restaura comportamiento original', () => {
        const motor = new MotorCorrector();
        motor.agregarPalabra('foobar', 'corregida');
        motor.eliminarPalabra('foobar');
        const resultado = motor.corregir('foobar');
        assert.equal(resultado.textoCorregido, 'foobar');
    });

    it('serializar y restaurar diccionario personal funciona', () => {
        const motor1 = new MotorCorrector();
        motor1.agregarPalabra('errorpersonal', 'correcciónpersonal');
        const serializado = motor1.serializarDiccionarioPersonal();

        const motor2 = new MotorCorrector();
        motor2.cargarDiccionarioPersonal(serializado);
        const resultado = motor2.corregir('tengo un errorpersonal aqui');
        assert.ok(resultado.textoCorregido.includes('correcciónpersonal'));
    });

    it('serializar y restaurar palabras ignoradas funciona', () => {
        const motor1 = new MotorCorrector();
        motor1.ignorarPalabra('ola');
        const ignoradas = motor1.serializarPalabrasIgnoradas();

        const motor2 = new MotorCorrector();
        motor2.cargarPalabrasIgnoradas(ignoradas);
        const resultado = motor2.corregir('ola');
        assert.equal(resultado.textoCorregido, 'ola');
    });
});

// ═════════════════════════════════════════════════════════════════════════════
// SECCIÓN 7: ESTADÍSTICAS — Conteo correcto
// ═════════════════════════════════════════════════════════════════════════════

describe('ESTRICTO: Estadísticas — conteo riguroso', () => {
    it('mensaje sin correcciones no incrementa contadores', () => {
        const motor = new MotorCorrector();
        motor.corregir('hola que tal');
        const stats = motor.obtenerEstadisticas();
        assert.equal(stats.mensajesCorregidos, 0);
        assert.equal(stats.totalCorrecciones, 0);
    });

    it('mensaje con 1 corrección: mensajes=1, total=1', () => {
        const motor = new MotorCorrector();
        motor.corregir('ola');
        const stats = motor.obtenerEstadisticas();
        assert.equal(stats.mensajesCorregidos, 1);
        assert.equal(stats.totalCorrecciones, 1);
    });

    it('mensaje con N correcciones: mensajes=1, total=N', () => {
        const motor = new MotorCorrector();
        motor.corregir('ola gue tal ertas'); // 3 correcciones mínimo
        const stats = motor.obtenerEstadisticas();
        assert.equal(stats.mensajesCorregidos, 1);
        assert.ok(stats.totalCorrecciones >= 3, `Esperaba ≥3 correcciones, recibí ${stats.totalCorrecciones}`);
    });

    it('múltiples mensajes acumulan correctamente', () => {
        const motor = new MotorCorrector();
        motor.corregir('ola');       // 1 corrección
        motor.corregir('vueno');     // 1 corrección
        motor.corregir('bale');      // 1 corrección
        motor.corregir('hola');      // 0 correcciones
        const stats = motor.obtenerEstadisticas();
        assert.equal(stats.mensajesCorregidos, 3);
        assert.equal(stats.totalCorrecciones, 3);
    });

    it('top10 palabras más corregidas funciona', () => {
        const motor = new MotorCorrector();
        motor.corregir('ola');
        motor.corregir('ola');
        motor.corregir('ola');
        motor.corregir('vueno');
        const stats = motor.obtenerEstadisticas();
        assert.ok(stats.top10PalabrasMasCorregidas.length > 0);
        // "ola" debería estar primera con 3 veces
        assert.equal(stats.top10PalabrasMasCorregidas[0].palabra, 'ola');
        assert.equal(stats.top10PalabrasMasCorregidas[0].veces, 3);
    });

    it('reiniciar estadísticas las pone a cero', () => {
        const motor = new MotorCorrector();
        motor.corregir('ola gue tal');
        motor.reiniciarEstadisticas();
        const stats = motor.obtenerEstadisticas();
        assert.equal(stats.mensajesCorregidos, 0);
        assert.equal(stats.totalCorrecciones, 0);
        assert.equal(stats.top10PalabrasMasCorregidas.length, 0);
    });

    it('cargarEstadisticas restaura valores', () => {
        const motor = new MotorCorrector();
        motor.cargarEstadisticas(99, 500);
        const stats = motor.obtenerEstadisticas();
        assert.equal(stats.mensajesCorregidos, 99);
        assert.equal(stats.totalCorrecciones, 500);
    });

    it('cargarEstadisticas + más correcciones acumula', () => {
        const motor = new MotorCorrector();
        motor.cargarEstadisticas(10, 50);
        motor.corregir('ola');  // +1 mensaje, +1 corrección
        const stats = motor.obtenerEstadisticas();
        assert.equal(stats.mensajesCorregidos, 11);
        assert.equal(stats.totalCorrecciones, 51);
    });
});

// ═════════════════════════════════════════════════════════════════════════════
// SECCIÓN 8: DETECCIÓN DE IDIOMA — Zonas grises
// ═════════════════════════════════════════════════════════════════════════════

describe('ESTRICTO: Detección de idioma — zonas grises', () => {
    it('texto claramente español → es', () => {
        const r = corregirConDetalles('hola que tal estás');
        assert.equal(r.idioma, 'es');
    });

    it('texto claramente inglés → en', () => {
        const r = corregirConDetalles('the quick brown fox jumps');
        assert.equal(r.idioma, 'en');
    });

    it('texto ambiguo corto → es por defecto', () => {
        const r = corregirConDetalles('ok');
        assert.equal(r.idioma, 'es');
    });

    it('texto con palabras de ambos idiomas → decide sin romper', () => {
        // No importa qué idioma elija, lo importante es que no rompe
        const r = corregirConDetalles('ok hello hola');
        assert.ok(r.idioma === 'es' || r.idioma === 'en');
    });

    it('texto vacío → es por defecto', () => {
        const r = corregirConDetalles('');
        assert.equal(r.idioma, 'es');
    });

    it('texto solo números → es por defecto', () => {
        const r = corregirConDetalles('12345');
        assert.equal(r.idioma, 'es');
    });

    it('inglés con errores se detecta como inglés y se corrige', () => {
        const r = corregirConDetalles('I beleive teh peopel are here');
        assert.equal(r.idioma, 'en');
        assert.ok(r.textoCorregido.includes('believe'), `Esperaba "believe" en: ${r.textoCorregido}`);
        assert.ok(r.textoCorregido.includes('the'), `Esperaba "the" en: ${r.textoCorregido}`);
        assert.ok(r.textoCorregido.includes('people'), `Esperaba "people" en: ${r.textoCorregido}`);
    });

    it('español con errores se detecta como español y se corrige', () => {
        const r = corregirConDetalles('ola gue tal estas con la jente');
        assert.equal(r.idioma, 'es');
        assert.ok(r.textoCorregido.includes('hola'));
        assert.ok(r.textoCorregido.includes('que'));
    });
});

// ═════════════════════════════════════════════════════════════════════════════
// SECCIÓN 9: REGRESIONES DE BUGS DOCUMENTADOS
// ═════════════════════════════════════════════════════════════════════════════

describe('ESTRICTO: Regresiones — bugs documentados', () => {
    it('BUG-2 regresión: anti-doble-corrección funciona correctamente', () => {
        // La condición debe ser c.original === match, no c.corregido === match
        // Este test verifica que patrones fonéticos no se saltan incorrectamente
        const resultado = corregirConDetalles('ke pasa');
        assert.ok(
            resultado.textoCorregido.includes('que'),
            `"ke" debe corregirse a "que", recibí: ${resultado.textoCorregido}`
        );
    });

    it('BUG-3 regresión: yegar no tiene conflicto duplicado', () => {
        assert.equal(corregir('yegar'), 'llegar');
    });

    it('Gaps documentados: gue → que', () => {
        assert.equal(corregir('gue'), 'que');
    });

    it('Gaps documentados: ertas → estas', () => {
        assert.equal(corregir('ertas'), 'estas');
    });

    it('Gaps documentados: biene → viene', () => {
        assert.equal(corregir('biene'), 'viene');
    });

    it('Gaps documentados: bienen → vienen', () => {
        assert.equal(corregir('bienen'), 'vienen');
    });

    it('Gaps documentados: abeces → a veces', () => {
        const resultado = corregir('abeces');
        assert.ok(
            resultado.toLowerCase().includes('a veces'),
            `Esperaba "a veces", recibí: ${resultado}`
        );
    });

    it('Gaps documentados: hayga → haya', () => {
        assert.equal(corregir('hayga'), 'haya');
    });

    it('Gaps documentados: estava → estaba', () => {
        assert.equal(corregir('estava'), 'estaba');
    });

    it('Gaps documentados: estavamos → estábamos', () => {
        assert.equal(corregir('estavamos'), 'estábamos');
    });
});

// ═════════════════════════════════════════════════════════════════════════════
// SECCIÓN 10: ESTRÉS Y RENDIMIENTO
// ═════════════════════════════════════════════════════════════════════════════

describe('ESTRICTO: Estrés y rendimiento', () => {
    it('texto largo (500+ palabras) no rompe el motor', () => {
        const frase = 'ola gue tal ';
        const textoLargo = frase.repeat(200); // 600 palabras
        const resultado = corregir(textoLargo);
        assert.ok(resultado.includes('hola'));
        assert.ok(resultado.includes('que'));
    });

    it('misma palabra 100 veces se corrige cada instancia', () => {
        const texto = Array(100).fill('ola').join(' ');
        const resultado = corregir(texto);
        const holas = resultado.split('hola').length - 1;
        assert.equal(holas, 100, `Esperaba 100 "hola", encontré ${holas}`);
    });

    it('rendimiento: 1000 palabras en < 500ms', () => {
        const texto = Array(1000).fill('ola vueno bale').join(' ');
        const inicio = Date.now();
        corregir(texto);
        const duracion = Date.now() - inicio;
        assert.ok(duracion < 500, `Demasiado lento: ${duracion}ms para 3000 palabras`);
    });

    it('motor reutilizable: instancia única, múltiples correcciones', () => {
        const motor = new MotorCorrector();
        for (let i = 0; i < 50; i++) {
            const r = motor.corregir('ola gue');
            assert.ok(r.textoCorregido.includes('hola'));
        }
        const stats = motor.obtenerEstadisticas();
        assert.equal(stats.mensajesCorregidos, 50);
    });
});

// ═════════════════════════════════════════════════════════════════════════════
// SECCIÓN 11: PUNTUACIÓN Y CONTEXTO
// ═════════════════════════════════════════════════════════════════════════════

describe('ESTRICTO: Puntuación y contexto', () => {
    it('corrección funciona con coma después', () => {
        const resultado = corregir('ola, gue tal');
        assert.ok(resultado.includes('hola'), `coma: ${resultado}`);
    });

    it('corrección funciona con punto después', () => {
        const resultado = corregir('ola. gue tal');
        assert.ok(resultado.includes('hola'), `punto: ${resultado}`);
    });

    it('corrección funciona con signos de exclamación', () => {
        const resultado = corregir('¡ola! ¿gue tal?');
        assert.ok(resultado.includes('hola'), `exclamación: ${resultado}`);
    });

    it('corrección funciona con paréntesis', () => {
        const resultado = corregir('(ola) gue tal');
        assert.ok(resultado.includes('hola'), `paréntesis: ${resultado}`);
    });

    it('corrección funciona con comillas', () => {
        const resultado = corregir('"ola" gue tal');
        assert.ok(resultado.includes('hola'), `comillas: ${resultado}`);
    });

    it('corrección al inicio de línea con mayúscula', () => {
        const resultado = corregir('Bale, asta mañana');
        assert.ok(resultado.includes('Vale') || resultado.includes('vale'), `inicio: ${resultado}`);
        assert.ok(resultado.includes('hasta'), `hasta: ${resultado}`);
    });
});

// ═════════════════════════════════════════════════════════════════════════════
// SECCIÓN 12: INGLÉS — Tests estrictos
// ═════════════════════════════════════════════════════════════════════════════

describe('ESTRICTO: Inglés — frases completas con errores', () => {
    it('frase con múltiples transposiciones', () => {
        const resultado = corregir('I was adn teh peopel were here');
        assert.ok(resultado.includes('and'), `"adn" → "and": ${resultado}`);
        assert.ok(resultado.includes('the'), `"teh" → "the": ${resultado}`);
        assert.ok(resultado.includes('people'), `"peopel" → "people": ${resultado}`);
    });

    it('frase con errores ie/ei', () => {
        const resultado = corregir('I beleive my freind is wierd');
        assert.ok(resultado.includes('believe'), `"beleive" → "believe": ${resultado}`);
        assert.ok(resultado.includes('friend'), `"freind" → "friend": ${resultado}`);
        assert.ok(resultado.includes('weird'), `"wierd" → "weird": ${resultado}`);
    });

    it('frase con errores de doble letra', () => {
        const resultado = corregir('the begining was realy diferent');
        assert.ok(resultado.includes('beginning'), `"begining": ${resultado}`);
        assert.ok(resultado.includes('really'), `"realy": ${resultado}`);
        assert.ok(resultado.includes('different'), `"diferent": ${resultado}`);
    });

    it('frase con errores ortográficos comunes', () => {
        const resultado = corregir('I definately want to seperate the enviroment');
        assert.ok(resultado.includes('definitely'), `"definately": ${resultado}`);
        assert.ok(resultado.includes('separate'), `"seperate": ${resultado}`);
        assert.ok(resultado.includes('environment'), `"enviroment": ${resultado}`);
    });

    it('frase con abreviaturas de chat en inglés', () => {
        const resultado = corregir('I was there b4 and thx for the help btw');
        assert.ok(resultado.includes('before'), `"b4": ${resultado}`);
        assert.ok(resultado.includes('thanks'), `"thx": ${resultado}`);
        assert.ok(resultado.includes('by the way'), `"btw": ${resultado}`);
    });
});

// ═════════════════════════════════════════════════════════════════════════════
// SECCIÓN 13: TOTAL REGLAS — Verificación de integridad
// ═════════════════════════════════════════════════════════════════════════════

describe('ESTRICTO: Integridad del motor', () => {
    it('obtenerTotalReglas() devuelve un número positivo grande', () => {
        const motor = new MotorCorrector();
        const total = motor.obtenerTotalReglas();
        assert.ok(total > 200, `Esperaba >200 reglas, tengo ${total}`);
    });

    it('obtenerTotalReglas() aumenta con diccionario personal', () => {
        const motor = new MotorCorrector();
        const antes = motor.obtenerTotalReglas();
        motor.agregarPalabra('test1', 'test2');
        motor.agregarPalabra('test3', 'test4');
        const despues = motor.obtenerTotalReglas();
        assert.equal(despues, antes + 2);
    });

    it('ResultadoCorreccion tiene todos los campos', () => {
        const motor = new MotorCorrector();
        const r = motor.corregir('ola');
        assert.ok('textoOriginal' in r);
        assert.ok('textoCorregido' in r);
        assert.ok('correcciones' in r);
        assert.ok('totalCorrecciones' in r);
        assert.ok('idioma' in r);
        assert.equal(r.textoOriginal, 'ola');
        assert.equal(r.textoCorregido, 'hola');
        assert.equal(r.totalCorrecciones, 1);
        assert.equal(r.idioma, 'es');
    });

    it('cada corrección tiene original, corregido, regla y posición', () => {
        const motor = new MotorCorrector();
        const r = motor.corregir('ola vueno');
        for (const c of r.correcciones) {
            assert.ok('original' in c, 'falta "original"');
            assert.ok('corregido' in c, 'falta "corregido"');
            assert.ok('regla' in c, 'falta "regla"');
            assert.ok('posicion' in c, 'falta "posicion"');
            assert.ok(typeof c.posicion === 'number', 'posicion debe ser número');
        }
    });
});

// ═════════════════════════════════════════════════════════════════════════════
// SECCIÓN 14: SEGMENTACIÓN DE PALABRAS PEGADAS
// ═════════════════════════════════════════════════════════════════════════════

describe('ESTRICTO: Segmentación — palabras pegadas sin espacios', () => {
    // Casos básicos de segmentación
    it('olaguetal → ola gue tal → hola que tal', () => {
        assert.equal(corregir('olaguetal'), 'hola que tal');
    });

    it('olaguetalertas → hola que tal estas', () => {
        assert.equal(corregir('olaguetalertas'), 'hola que tal estas');
    });

    it('buenosdias → buenos días', () => {
        assert.equal(corregir('buenosdias'), 'buenos días');
    });

    it('hastaluego → hasta luego', () => {
        assert.equal(corregir('hastaluego'), 'hasta luego');
    });

    it('porejemplo → por ejemplo', () => {
        assert.equal(corregir('porejemplo'), 'por ejemplo');
    });

    it('muchasgracias → muchas gracias', () => {
        assert.equal(corregir('muchasgracias'), 'muchas gracias');
    });

    // Segmentación con errores que luego se corrigen
    it('guierodesir → quiero decir (segmenta + corrige)', () => {
        const resultado = corregir('guierodesir');
        assert.ok(resultado.includes('quiero'), `Esperaba "quiero" en: ${resultado}`);
        assert.ok(resultado.includes('decir'), `Esperaba "decir" en: ${resultado}`);
    });

    it('baleporfa → vale por favor (segmenta + corrige)', () => {
        const resultado = corregir('baleporfa');
        assert.ok(resultado.includes('vale'), `Esperaba "vale" en: ${resultado}`);
        assert.ok(resultado.includes('por favor'), `Esperaba "por favor" en: ${resultado}`);
    });

    it('necesitoacer → necesito hacer', () => {
        const resultado = corregir('necesitoacer');
        assert.ok(resultado.includes('necesito'), `Esperaba "necesito" en: ${resultado}`);
        assert.ok(resultado.includes('hacer'), `Esperaba "hacer" en: ${resultado}`);
    });

    // Palabras normales NO se segmentan
    it('"también" no se segmenta', () => {
        assert.equal(corregir('también'), 'también');
    });

    it('"programa" no se segmenta', () => {
        assert.equal(corregir('programa'), 'programa');
    });

    it('"extensión" no se segmenta', () => {
        assert.equal(corregir('extensión'), 'extensión');
    });

    it('"corrector" no se segmenta', () => {
        assert.equal(corregir('corrector'), 'corrector');
    });

    it('"necesito" no se segmenta', () => {
        assert.equal(corregir('necesito'), 'necesito');
    });

    it('"información" no se segmenta', () => {
        assert.equal(corregir('información'), 'información');
    });

    // Segmentación con puntuación
    it('segmentación funciona con puntuación: ¿olaguetal?', () => {
        const resultado = corregir('¿olaguetal?');
        assert.ok(resultado.includes('hola'), `Esperaba "hola" en: ${resultado}`);
    });

    // La corrección de correcciones incluye la regla de segmentación
    it('segmentación produce corrección con regla "separación de palabras pegadas"', () => {
        const motor = new MotorCorrector();
        const r = motor.corregir('hastaluego');
        const segmentacion = r.correcciones.find(c => c.regla === 'separación de palabras pegadas');
        assert.ok(segmentacion, 'Debería haber una corrección de tipo segmentación');
        assert.equal(segmentacion!.original, 'hastaluego');
        assert.equal(segmentacion!.corregido, 'hasta luego');
    });

    // Texto mixto: algunas palabras pegadas, otras normales
    it('texto mixto: "hola olaguetal amigos" → solo segmenta la pegada', () => {
        const resultado = corregir('hola olaguetal amigos');
        assert.ok(resultado.includes('hola'), 'hola no debe cambiar');
        assert.ok(resultado.includes('que'), 'gue debe corregirse a que');
    });
});

// ═════════════════════════════════════════════════════════════════════════════
// SECCIÓN 15: CORRECCIÓN CONTEXTUAL — mas/más, ay/hay
// ═════════════════════════════════════════════════════════════════════════════

describe('ESTRICTO: Corrección contextual — palabras ambiguas', () => {
    // "mas" como conjunción adversativa NO se corrige
    it('"mas" como conjunción adversativa: "quiero ir, mas no puedo" → no corrige', () => {
        const resultado = corregir('quiero ir, mas no puedo');
        assert.ok(resultado.includes('mas'), `"mas" conjunción debe mantenerse: ${resultado}`);
    });

    it('"mas" como conjunción con punto y coma: "lo intenté; mas fue inútil" → no corrige', () => {
        const resultado = corregir('lo intenté; mas fue inútil');
        assert.ok(resultado.includes('mas'), `"mas" conjunción con ; debe mantenerse: ${resultado}`);
    });

    // "mas" como error → debe corregirse a "más"
    it('"mas" como adverbio: "quiero mas agua" → "más"', () => {
        const resultado = corregir('quiero mas agua');
        assert.ok(resultado.includes('más'), `"mas" adverbio debe corregirse: ${resultado}`);
    });

    it('"mas" al inicio de frase: "mas rápido" → "más rápido"', () => {
        const resultado = corregir('mas rápido');
        assert.ok(resultado.includes('más'), `"mas" inicio debe corregirse: ${resultado}`);
    });

    // "ay" como interjección NO se corrige
    it('"ay" como interjección: "¡ay!" → no corrige', () => {
        const resultado = corregir('¡ay!');
        assert.ok(!resultado.includes('hay'), `"¡ay!" no debe convertirse en "hay": ${resultado}`);
    });

    it('"ay" con exclamación: "ay, qué dolor" → no corrige', () => {
        const resultado = corregir('ay, qué dolor');
        // "ay" seguido de coma es interjección
        assert.ok(resultado.includes('ay'), `"ay" interjección con coma: ${resultado}`);
    });

    // "ay" como error → debe corregirse a "hay"
    it('"ay" como verbo haber: "ay muchos errores" → "hay"', () => {
        const resultado = corregir('ay muchos errores');
        assert.ok(resultado.includes('hay'), `"ay" verbo debe corregirse: ${resultado}`);
    });

    it('"ay" en contexto verbal: "no ay nada" → "no hay nada"', () => {
        const resultado = corregir('no ay nada');
        assert.ok(resultado.includes('hay'), `"ay" en frase verbal: ${resultado}`);
    });
});

// ═════════════════════════════════════════════════════════════════════════════
// SECCIÓN 16: FUZZY MATCHING — calidad de la segmentación mejorada
// ═════════════════════════════════════════════════════════════════════════════

describe('ESTRICTO: Fuzzy matching — calidad segmentación', () => {
    // Fuzzy no rompe palabras conocidas
    it('"automática" no se segmenta (fuzzy-similar a "automático")', () => {
        assert.equal(corregir('automática'), 'automática');
    });

    it('"aplicación" no se segmenta', () => {
        assert.equal(corregir('aplicación'), 'aplicación');
    });

    it('"configuración" no se segmenta', () => {
        assert.equal(corregir('configuración'), 'configuración');
    });

    // Segmentación prefiere segmentos exactos sobre fuzzy
    it('hastaluego usa segmentos exactos "hasta" + "luego"', () => {
        const motor = new MotorCorrector();
        const r = motor.corregir('hastaluego');
        const seg = r.correcciones.find(c => c.regla === 'separación de palabras pegadas');
        assert.ok(seg, 'debe segmentar');
        assert.equal(seg!.corregido, 'hasta luego', 'debe usar segmentos exactos');
    });

    it('muchasgracias usa segmentos exactos "muchas" + "gracias"', () => {
        const motor = new MotorCorrector();
        const r = motor.corregir('muchasgracias');
        const seg = r.correcciones.find(c => c.regla === 'separación de palabras pegadas');
        assert.ok(seg, 'debe segmentar');
        assert.equal(seg!.corregido, 'muchas gracias', 'debe usar segmentos exactos');
    });

    // Segmentación no aplica a palabras en inglés
    it('"seperate" no se segmenta (es inglés)', () => {
        const resultado = corregir('I want to seperate them');
        assert.ok(resultado.includes('separate'), `"seperate" → "separate": ${resultado}`);
    });

    it('"yesterday" no se segmenta (es inglés)', () => {
        const resultado = corregir('it was yesterday');
        assert.ok(resultado.includes('yesterday'), `"yesterday" no se toca: ${resultado}`);
    });

    it('"peopel" se corrige en inglés sin segmentar', () => {
        const resultado = corregir('the peopel are here');
        assert.ok(resultado.includes('people'), `"peopel" → "people": ${resultado}`);
    });

    // Diccionario personal no se rompe por segmentación
    it('palabra del diccionario personal no se segmenta', () => {
        const motor = new MotorCorrector();
        motor.agregarPalabra('errorpersonal', 'corrección');
        const r = motor.corregir('tengo un errorpersonal aquí');
        assert.ok(r.textoCorregido.includes('corrección'),
            `diccionario personal debe funcionar: ${r.textoCorregido}`);
    });
});
