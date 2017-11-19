'use strict';

let Char    = require('./Char');
let visitor = require('pegjs/lib/compiler/visitor');
let asts    = require('pegjs/lib/compiler/asts');

/// Представляет массив символов известной длины
/// @param {Array<Char>} chars
function Literal(chars) {
  this.chars = chars;
}
Literal.EMPTY = new Literal([]);

Literal.prototype.toString = function() {
  return this.chars.join('');
}
Literal.prototype.isEmpty = function() {
  return this.chars.length === 0;
}
Literal.prototype.append = function(literal) {
  return new Literal([...this.chars, ...literal.chars]);
}
/// Определяет, может ли любая строка символов, описываемая данным литералом, быть
/// также описана указанным
/// @param {Literal} literal
/// @return {bool} true, если данная строка не длинее literal и каждый символ данной
///                строки может стоять в строке literal на соответствующей позиции и
///                false иначе
Literal.prototype.isSubset = function(literal) {
  if (this.chars.length > literal.chars.length) {
    return false;
  }
  for (let i = 0; i < this.chars.length; ++i) {
    let ch1 = this.chars[i];
    let ch2 = literal.chars[i];
    // Если хоть один символ данной строки не является
    if (!ch1.isSubset(ch2)) return false;
  }
  return true;
}

function flatten(acc, val) {
  return [...acc, ...val];
}
/// Генерирует массив последовательностей метасимволов, представляющие вход, который
/// парсер данной грамматики способен разобрать.
/// Символы вычисляются в виде диапазонов допустимых символов.
/// @return {Array<Array<Char>>} Массив последовательностей метасимволов
function computeValues(ast, options) {
  // Каждый узел возвращает массив литералов, на которых разбор данного узла будет успешен.
  // Порядок литералов важен, они проверяются именно в таком порядке.
  let compute = visitor.build({
    grammar: function(node) {
      return node.rules.map(compute);
    },
    optional: function(node) {
      // Необязательный элемент можно переписать, как (expression / )
      let result = compute(node.expression);
      result.push(Literal.EMPTY);
      return result;
    },
    choice: function(node) {
      // Объединяем все списки в один
      return node.alternatives.map(compute).reduce(flatten);
    },
    sequence: function(node) {
      if (node.elements.length === 0) {
        return Literal.EMPTY;
      }
      return node.elements.map(compute).reduceRight(function(acc, val) {
        // Проходим по всем элементам предыдущего элемента последовательности
        // и добавляем его в начало аккумулятора для каждого из вариантов в
        // аккумуляторе, затем превращаем получишийся список списков в один
        // плоский список.
        //
        // В целом весь метод возвращает для узла массив из всех возможных литералов,
        // которые может разобрать выражение. Их количество равно произведению
        // размерностей всех массивов, которые вернул вызов elements.map
        return val.map(v => acc.map(a => v.append(a))).reduce(flatten);
      });
    },
    rule_ref: function(node) {
      let rule = asts.findRule(ast, node.name);
      return compute(rule);
    },
    literal: function(node) {
      let result = [];
      for (let v of node.value) {
        let cp = v.codePointAt(0);
        result.push(new Char(cp, cp));
      }
      return [new Literal(result)];
    },
    class: function(node) {
      let segments = node.parts.map(p => Array.isArray(p)
        ? new Segment(p[0].codePointAt(0), p[1].codePointAt(0))
        : new Segment(p.codePointAt(0), p.codePointAt(0))
      );
      let value = new Char(segments);
      return [new Literal([node.inverted ? value.invert() : value])];
    },
    // Все точки юникода
    any: function() { return [new Literal([Char.ALL])]; },
  });

  return compute(ast);
}

// Данный файл может сразу использоваться, как плагин
computeValues.use = function(config) {
  config.passes.transform.push(computeValues);
};
module.exports = computeValues;