/**
 * Tests del motor de corrección ortográfica.
 * Usa el test runner integrado de Node.js (node:test) — sin dependencias externas.
 *
 * Ejecutar: npm test
 *
 * Estructura similar a Flutter:
 *   test/corrector.test.ts  ←→  test/widget_test.dart
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { MotorCorrector } from '../src/corrector';

// ─── UTILIDAD ────────────────────────────────────────────────────────────────

function corregir(texto: string): string {
    const motor = new MotorCorrector();
    return motor.corregir(texto).textoCorregido;
}

// ─── SUITE: H omitida ────────────────────────────────────────────────────────

describe('H omitida', () => {
    it('ola → hola', () => {
        assert.equal(corregir('ola'), 'hola');
    });
    it('ola gue tal ertas → hola que tal estas', () => {
        assert.equal(corregir('ola gue tal ertas'), 'hola que tal estas');
    });
    it('asta → hasta', () => {
        assert.equal(corregir('asta'), 'hasta');
    });
    it('acer → hacer', () => {
        assert.equal(corregir('acer'), 'hacer');
    });
    it('amos a acer → hamos a hacer (hemos)', () => {
        // 'emos' → 'hemos'
        assert.equal(corregir('emos llegado'), 'hemos llegado');
    });
});

// ─── SUITE: G → Q (teclas adyacentes) ────────────────────────────────────────

describe('G → Q (tecla adyacente, error típico dislexia)', () => {
    it('gue → que', () => {
        assert.equal(corregir('gue'), 'que');
    });
    it('gue tal → que tal', () => {
        assert.equal(corregir('gue tal'), 'que tal');
    });
    it('guiero → quiero', () => {
        assert.equal(corregir('guiero'), 'quiero');
    });
    it('guieres → quieres', () => {
        assert.equal(corregir('guieres'), 'quieres');
    });
});

// ─── SUITE: Transposiciones ───────────────────────────────────────────────────

describe('Transposiciones de letras', () => {
    it('ertas → estas', () => {
        assert.equal(corregir('ertas'), 'estas');
    });
    it('carperta → carpeta', () => {
        assert.equal(corregir('carperta'), 'carpeta');
    });
    it('progama → programa', () => {
        assert.equal(corregir('progama'), 'programa');
    });
    it('peudo → puedo', () => {
        assert.equal(corregir('peudo'), 'puedo');
    });
});

// ─── SUITE: B / V ────────────────────────────────────────────────────────────

describe('Confusión B / V', () => {
    it('vueno → bueno', () => {
        assert.equal(corregir('vueno'), 'bueno');
    });
    it('bale → vale', () => {
        assert.equal(corregir('bale'), 'vale');
    });
    it('berdad → verdad', () => {
        assert.equal(corregir('berdad'), 'verdad');
    });
    it('biene → viene', () => {
        assert.equal(corregir('biene'), 'viene');
    });
    it('bienen → vienen', () => {
        assert.equal(corregir('bienen'), 'vienen');
    });
    it('estava → estaba', () => {
        assert.equal(corregir('estava'), 'estaba');
    });
    it('estavamos → estábamos', () => {
        assert.equal(corregir('estavamos'), 'estábamos');
    });
    it('abeces → a veces', () => {
        assert.equal(corregir('abeces'), 'a veces');
    });
});

// ─── SUITE: C / S / Z ────────────────────────────────────────────────────────

describe('Confusión C / S / Z', () => {
    it('desir → decir', () => {
        assert.equal(corregir('desir'), 'decir');
    });
    it('dise → dice', () => {
        assert.equal(corregir('dise'), 'dice');
    });
    it('nesesito → necesito', () => {
        assert.equal(corregir('nesesito'), 'necesito');
    });
    it('grasias → gracias', () => {
        assert.equal(corregir('grasias'), 'gracias');
    });
});

// ─── SUITE: Patrones fonéticos (abreviaturas) ─────────────────────────────────

describe('Patrones fonéticos y abreviaturas', () => {
    it('ke → que', () => {
        assert.equal(corregir('ke'), 'que');
    });
    it('xq → porque', () => {
        assert.equal(corregir('xq'), 'porque');
    });
    it('tb → también', () => {
        assert.equal(corregir('tb'), 'también');
    });
    it('porfa → por favor', () => {
        assert.equal(corregir('porfa'), 'por favor');
    });
    it('kiero → quiero', () => {
        assert.equal(corregir('kiero'), 'quiero');
    });
});

// ─── SUITE: Tildes ────────────────────────────────────────────────────────────

describe('Tildes omitidas', () => {
    it('tambien → también', () => {
        assert.equal(corregir('tambien'), 'también');
    });
    it('aqui → aquí', () => {
        assert.equal(corregir('aqui'), 'aquí');
    });
    it('aplicacion → aplicación', () => {
        assert.equal(corregir('aplicacion'), 'aplicación');
    });
    it('codigo → código', () => {
        assert.equal(corregir('codigo'), 'código');
    });
    it('numero → número', () => {
        assert.equal(corregir('numero'), 'número');
    });
});

// ─── SUITE: Capitalización preservada ────────────────────────────────────────

describe('Preservar capitalización', () => {
    it('OLA → HOLA (mayúsculas)', () => {
        assert.equal(corregir('OLA'), 'HOLA');
    });
    it('Ola → Hola (primera letra)', () => {
        assert.equal(corregir('Ola'), 'Hola');
    });
    it('ola → hola (minúsculas)', () => {
        assert.equal(corregir('ola'), 'hola');
    });
});

// ─── SUITE: Diccionario personal ─────────────────────────────────────────────

describe('Diccionario personal', () => {
    it('añadir y aplicar regla personalizada', () => {
        const motor = new MotorCorrector();
        motor.agregarPalabra('tegnologia', 'tecnología');
        const resultado = motor.corregir('me gusta la tegnologia');
        assert.equal(resultado.textoCorregido, 'me gusta la tecnología');
    });

    it('ignorar una palabra no la corrige', () => {
        const motor = new MotorCorrector();
        motor.ignorarPalabra('ola'); // el usuario decide que "ola" es correcta para él
        const resultado = motor.corregir('ola');
        assert.equal(resultado.textoCorregido, 'ola');
    });

    it('eliminar regla del diccionario personal', () => {
        const motor = new MotorCorrector();
        motor.agregarPalabra('wifiiii', 'wifi');
        motor.eliminarPalabra('wifiiii');
        const resultado = motor.corregir('wifiiii');
        assert.equal(resultado.textoCorregido, 'wifiiii'); // ya no se corrige
    });
});

// ─── SUITE: Palabras que NO deben corregirse ─────────────────────────────────

describe('Sin false positives en palabras correctas', () => {
    it('hola no se toca', () => {
        assert.equal(corregir('hola'), 'hola');
    });
    it('hacer no se toca', () => {
        assert.equal(corregir('hacer'), 'hacer');
    });
    it('vamos no se toca', () => {
        assert.equal(corregir('vamos'), 'vamos');
    });
    it('también no se toca (ya tiene tilde)', () => {
        assert.equal(corregir('también'), 'también');
    });
    it('código no se toca (ya tiene tilde)', () => {
        assert.equal(corregir('código'), 'código');
    });
});

// ─── SUITE: Estadísticas ─────────────────────────────────────────────────────

describe('Estadísticas', () => {
    it('cuenta correcciones correctamente', () => {
        const motor = new MotorCorrector();
        motor.corregir('ola gue tal'); // 2 correcciones: ola→hola, gue→que
        const stats = motor.obtenerEstadisticas();
        assert.equal(stats.mensajesCorregidos, 1);
        assert.ok(stats.totalCorrecciones >= 2);
    });

    it('no cuenta si no hay correcciones', () => {
        const motor = new MotorCorrector();
        motor.corregir('hola que tal');
        const stats = motor.obtenerEstadisticas();
        assert.equal(stats.mensajesCorregidos, 0);
        assert.equal(stats.totalCorrecciones, 0);
    });

    it('cargarEstadisticas restaura los valores', () => {
        const motor = new MotorCorrector();
        motor.cargarEstadisticas(42, 100);
        const stats = motor.obtenerEstadisticas();
        assert.equal(stats.mensajesCorregidos, 42);
        assert.equal(stats.totalCorrecciones, 100);
    });

    it('reiniciarEstadisticas vuelve a cero', () => {
        const motor = new MotorCorrector();
        motor.corregir('ola gue');
        motor.reiniciarEstadisticas();
        const stats = motor.obtenerEstadisticas();
        assert.equal(stats.mensajesCorregidos, 0);
        assert.equal(stats.totalCorrecciones, 0);
    });
});

// ─── SUITE: Detección de idioma ────────────────────────────────────────────────

describe('Detección automática de idioma', () => {
    it('texto español detecta es', () => {
        const motor = new MotorCorrector();
        const r = motor.corregir('hola que tal estás');
        assert.equal(r.idioma, 'es');
    });
    it('texto inglés detecta en', () => {
        const motor = new MotorCorrector();
        const r = motor.corregir('the quick brown fox');
        assert.equal(r.idioma, 'en');
    });
    it('texto corto ambiguo devuelve es por defecto', () => {
        const motor = new MotorCorrector();
        const r = motor.corregir('ola gue');
        assert.equal(r.idioma, 'es');
    });
});

// ─── SUITE: Correcciones en inglés ────────────────────────────────────────────

describe('Inglés — Transposiciones', () => {
    it('teh → the', () => { assert.equal(corregir('I like teh sun'), 'I like the sun'); });
    it('adn → and', () => { assert.equal(corregir('cats adn dogs are pets'), 'cats and dogs are pets'); });
    it('becuase → because', () => { assert.equal(corregir('I did it becuase of you'), 'I did it because of you'); });
    it('waht → what', () => { assert.equal(corregir('waht is this'), 'what is this'); });
    it('peopel → people', () => { assert.equal(corregir('the peopel are here'), 'the people are here'); });
    it('frist → first', () => { assert.equal(corregir('the frist step is'), 'the first step is'); });
});

describe('Inglés — Confusión ie/ei', () => {
    it('recieve → receive', () => { assert.equal(corregir('I will recieve it'), 'I will receive it'); });
    it('beleive → believe', () => { assert.equal(corregir('I beleive you'), 'I believe you'); });
    it('freind → friend', () => { assert.equal(corregir('my freind is here'), 'my friend is here'); });
    it('wierd → weird', () => { assert.equal(corregir('that is wierd'), 'that is weird'); });
    it('thier → their', () => { assert.equal(corregir('thier house is big'), 'their house is big'); });
});

describe('Inglés — Doble letra', () => {
    it('realy → really', () => { assert.equal(corregir('I realy like it'), 'I really like it'); });
    it('begining → beginning', () => { assert.equal(corregir('the begining of the story'), 'the beginning of the story'); });
    it('diferent → different', () => { assert.equal(corregir('that is diferent'), 'that is different'); });
    it('occured → occurred', () => { assert.equal(corregir('it occured yesterday'), 'it occurred yesterday'); });
    it('untill → until', () => { assert.equal(corregir('you should wait untill tomorrow'), 'you should wait until tomorrow'); });
});

describe('Inglés — Ortografía común', () => {
    it('definately → definitely', () => { assert.equal(corregir('I definately agree'), 'I definitely agree'); });
    it('seperate → separate', () => { assert.equal(corregir('you should keep them seperate'), 'you should keep them separate'); });
    it('enviroment → environment', () => { assert.equal(corregir('the enviroment is'), 'the environment is'); });
    it('alot → a lot', () => { assert.equal(corregir('I like it alot'), 'I like it a lot'); });
    it('wich → which', () => { assert.equal(corregir('wich one do you want'), 'which one do you want'); });
    it('buisness → business', () => { assert.equal(corregir('my buisness is growing'), 'my business is growing'); });
});

describe('Inglés — Fonético', () => {
    it('nite → night', () => { assert.equal(corregir('good nite, see you tomorrow'), 'good night, see you tomorrow'); });
    it('enuf → enough', () => { assert.equal(corregir('that is enuf for me'), 'that is enough for me'); });
    it('fone → phone', () => { assert.equal(corregir('call my fone'), 'call my phone'); });
    it('wud → would', () => { assert.equal(corregir('I wud like that'), 'I would like that'); });
    it('thru → through', () => { assert.equal(corregir('go thru the door'), 'go through the door'); });
});

describe('Inglés — Palabras correctas no se tocan', () => {
    it('hello no se toca', () => { assert.equal(corregir('hello world'), 'hello world'); });
    it('because no se toca', () => { assert.equal(corregir('because of this'), 'because of this'); });
    it('different no se toca', () => { assert.equal(corregir('that is different'), 'that is different'); });
});
