'use strict';

let chai   = require('chai');
let pass   = require('../../../lib/compute/expected');
let merge  = require('../../../lib/compute/expected/merge-literal');
let PEG    = require('pegjs');

let expect = chai.expect;

chai.use(function(chai, utils) {
  let Assertion = chai.Assertion;

  Assertion.addMethod("mergeTo", function(expected, not) {
    let literals = utils.flag(this, "object");
    let result = merge(literals[0], literals[1], not);

    this.assert(
      utils.eql(result, expected),
      "expected #{this} to be simplified to #{exp} but got #{act}",
      null,
      expected,
      result
    );

    // Проверяем, что ожидаемые значения действительно принимаются парсером.
    // Если ничего не ожидается, или указанное значение НЕ ожидается, то проверку осуществить
    // в общем случае нельзя, поэтому не делаем
    if (expected.type !== 'nothing' && expected.not !== true) {
      new Assertion(literals).to.parsed(expected, not);
    }
  });

  Assertion.addMethod("parsed", function(expected, not) {
    if (not !== true) not = false;

    let literals = utils.flag(this, "object");
    let input = expected.value;

    if (!not) {
      // В случае, если у нас вход должен соответствовать обоим литералам, гарантируем это, т.к.
      // ожидаемое значение может соответствовать только одному из них, при этом ожидаемое значение
      // все равно технически не противоречит обоим литералам, однако пратически парсер потребует
      // дополнительных данных. Предоставляем их ему.
      let len0 = literals[0].value.length;
      let len1 = literals[1].value.length;
      let greatest = len0 > len1 ? literals[0].value : literals[1].value;
      input += greatest.substr(input.length);
    }

    let grammar = [
      'start = ',
      not ? '!' : '&',
      '"',
      literals[1].value,
      '"',
      literals[1].ignoreCase ? 'i' : '',
      ' "',
      literals[0].value,
      '"',
      literals[0].ignoreCase ? 'i' : '',
      ' .*'
    ].join('');

    let parser = PEG.generate(grammar);
    new Assertion(
      () => parser.parse(input),
      "Grammar '" + grammar + "' parse '" + input + "'"
    ).to.not.throw();
  });
});

///       not == false                  not == true        результат изменился?
/// 'ab'  &  'a'    => 'ab'       'ab'  & !'a'    => nothing    +
/// 'ab'  &  'ab'   => 'ab'       'ab'  & !'ab'   => nothing    +
/// 'ab'  &  'ac'   => nothing    'ab'  & !'ac'   => 'ab'       +
/// 'ab'  &  'abc'  => 'abc'      'ab'  & !'abc'  => 'ab'       +
/// 'ab'  &  'acd'  => nothing    'ab'  & !'acd'  => 'ab'       +
///
/// 'ab'  &  'a'i   => 'ab'       'ab'  & !'a'i   => nothing    +
/// 'ab'  &  'ab'i  => 'ab'       'ab'  & !'ab'i  => nothing    +
/// 'ab'  &  'ac'i  => nothing    'ab'  & !'ac'i  => 'ab'       +
/// 'ab'  &  'abc'i => 'ab'       'ab'  & !'abc'i => 'ab'
/// 'ab'  &  'acd'i => nothing    'ab'  & !'acd'i => 'ab'       +
///
/// 'ab'i &  'a'    => 'a'        'ab'i & !'a'    => nothing    +
/// 'ab'i &  'ab'   => 'ab'       'ab'i & !'ab'   => nothing    +
/// 'ab'i &  'ac'   => nothing    'ab'i & !'ac'   => 'ab'i      +
/// 'ab'i &  'abc'  => 'abc'      'ab'i & !'abc'  => !'abc'
/// 'ab'i &  'acd'  => nothing    'ab'i & !'acd'  => 'ab'i      +
///
/// 'ab'i &  'a'i   => 'ab'i      'ab'i & !'a'i   => nothing    +
/// 'ab'i &  'ab'i  => 'ab'i      'ab'i & !'ab'i  => nothing    +
/// 'ab'i &  'ac'i  => nothing    'ab'i & !'ac'i  => 'ab'i      +
/// 'ab'i &  'abc'i => 'abc'i     'ab'i & !'abc'i => 'ab'i      +
/// 'ab'i &  'acd'i => nothing    'ab'i & !'acd'i => 'ab'i      +
describe('Literal merge', function() {
  const A    = { type: 'literal', value:   'a', ignoreCase: false };
  const Ai   = { type: 'literal', value:   'a', ignoreCase: true  };

  const AB   = { type: 'literal', value:  'ab', ignoreCase: false };
  const ABi  = { type: 'literal', value:  'ab', ignoreCase: true  };

  const AC   = { type: 'literal', value:  'ac', ignoreCase: false };
  const ACi  = { type: 'literal', value:  'ac', ignoreCase: true  };

  const ABC  = { type: 'literal', value: 'abc', ignoreCase: false };
  const ABCi = { type: 'literal', value: 'abc', ignoreCase: true  };

  const ACD  = { type: 'literal', value: 'acd', ignoreCase: false };
  const ACDi = { type: 'literal', value: 'acd', ignoreCase: true  };

  const NOTHING = { type: 'nothing' };

  function negate(literal) { return Object.assign({ not: true }, literal); }

  describe('with regular second literal', function() {
    it('merge two case-sensitive literals correctly', function() {
      expect([AB,   A]).mergeTo(AB);
      expect([AB,  AB]).mergeTo(AB);
      expect([AB,  AC]).mergeTo(NOTHING);
      expect([AB, ABC]).mergeTo(ABC);
      expect([AB, ACD]).mergeTo(NOTHING);
    });

    it('merge case-sensitive with case-insensitive literal correctly', function() {
      expect([AB,   Ai]).mergeTo(AB);
      expect([AB,  ABi]).mergeTo(AB);
      expect([AB,  ACi]).mergeTo(NOTHING);
      expect([AB, ABCi]).mergeTo(AB);
      expect([AB, ACDi]).mergeTo(NOTHING);
    });

    it('merge case-insensitive with case-sensitive literal correctly', function() {
      expect([ABi,   A]).mergeTo(A);
      expect([ABi,  AB]).mergeTo(AB);
      expect([ABi,  AC]).mergeTo(NOTHING);
      expect([ABi, ABC]).mergeTo(ABC);
      expect([ABi, ACD]).mergeTo(NOTHING);
    });

    it('merge two case-insensitive literals correctly', function() {
      expect([ABi,   Ai]).mergeTo(ABi);
      expect([ABi,  ABi]).mergeTo(ABi);
      expect([ABi,  ACi]).mergeTo(NOTHING);
      expect([ABi, ABCi]).mergeTo(ABCi);
      expect([ABi, ACDi]).mergeTo(NOTHING);
    });
  });

  describe('with negated second literal', function() {
    it('merge two case-sensitive literals correctly', function() {
      expect([AB,   A]).mergeTo(NOTHING, true);
      expect([AB,  AB]).mergeTo(NOTHING, true);
      expect([AB,  AC]).mergeTo(AB, true);
      expect([AB, ABC]).mergeTo(AB, true);
      expect([AB, ACD]).mergeTo(AB, true);
    });

    it('merge case-sensitive with case-insensitive literal correctly', function() {
      expect([AB,   Ai]).mergeTo(NOTHING, true);
      expect([AB,  ABi]).mergeTo(NOTHING, true);
      expect([AB,  ACi]).mergeTo(AB, true);
      expect([AB, ABCi]).mergeTo(AB, true);
      expect([AB, ACDi]).mergeTo(AB, true);
    });

    it('merge case-insensitive with case-sensitive literal correctly', function() {
      expect([ABi,   A]).mergeTo(NOTHING, true);
      expect([ABi,  AB]).mergeTo(NOTHING, true);
      expect([ABi,  AC]).mergeTo(ABi, true);
      expect([ABi, ABC]).mergeTo(negate(ABC), true);
      expect([ABi, ACD]).mergeTo(ABi, true);
    });

    it('merge two case-insensitive literals correctly', function() {
      expect([ABi,   Ai]).mergeTo(NOTHING, true);
      expect([ABi,  ABi]).mergeTo(NOTHING, true);
      expect([ABi,  ACi]).mergeTo(ABi, true);
      expect([ABi, ABCi]).mergeTo(ABi, true);
      expect([ABi, ACDi]).mergeTo(ABi, true);
    });
  });
});