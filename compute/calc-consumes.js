'use strict';

let asts    = require('pegjs/lib/compiler/asts');
let visitor = require('pegjs/lib/compiler/visitor');

class Result {
  constructor(min, max) {
    if (min && min < 0) {
      throw new Error('`min` must be null or >= 0: '+min);
    }
    if (max && (max < 0 || min && max < min)) {
      throw new Error('`max` must be null or >= min or >= 0: '+max);
    }
    this.min = min;
    this.max = max !== undefined ? max : min;
  }
}
function combineChoice(r1, r2) {
  return new Result(
    // Если обе нижних границы неограничены, то у результата нет ограничений; если только одна, то
    // результат определяется другой границей; в противном случае берем минимум из существующих
    r1.min === null ? r2.min : (r2.min === null ? null : Math.min(r1.min, r2.min)),
    // Если хотя бы одна верхняя граница неограничена, то и у результата нет ограничений,
    // в противном случае берем максимум
    r1.max === null || r2.max === null ? null : Math.max(r1.max, r2.max)
  );
}
function combineSequence(r1, r2) {
  return new Result(
    r1.min === null || r2.min === null ? null : r1.min + r2.min,
    r1.max === null || r2.max === null ? null : r1.max + r2.max
  );
}
/// Вычисляет максимальное и минимальное количество символов, которое может поглотить каждый узел
/// парсера при успешном сопоставлении. Результат возвращается в виде объекта `{ min: Number?, max: Number? }`.
///
/// `min` показывает, сколько символов входа парсер непременно поглотит после того, как сопоставление
/// данного узла будет успешно.
/// `max` показывает, сколько символов входа может быть поглощено в процессе сопоставления данного
/// узла. Итоговая позиция в потоке разбора при этом может вообще не двигаться (например, в случае
/// lookahead).
///
/// `null` в значениях обоих свойств означает, что количество поглощаемого входа неизвестно, в том
/// числе оно может быть неограниченным.
function calcConsumes(ast, options) {
  let emitInfo = options.collector.emitInfo;
  // По умолчанию считаем, что пользовательский код не заглядывает вперед, почти всегда это так
  let maxLookahead = "maxUserLookaheadConsume" in options ? options.maxUserLookaheadConsume : 0;

  function unit() { return new Result(1); }
  function unknown(node) { return new Result(0, maxLookahead); }
  function max(node) { return new Result(0, calc(node.expression).max); }

  let visitedRules = [];
  let calc = visitor.build({
    grammar: function(node) { return node.rules.map(calc); },
    rule:         function(node) {
      visitedRules.push(node.name);
      let result = calc(node.expression);
      visitedRules.pop();
      return result;
    },
    choice:       function(node) {
      if (node.alternatives.length > 0) {
        return node.alternatives.map(calc).reduce(combineChoice);
      }
      return new Result(0);
    },
    sequence:     function(node) {
      if (node.elements.length > 0) {
        return node.elements.map(calc).reduce(combineSequence);
      }
      return new Result(0);
    },
    // Максимальное значение lookahead равно максимому выражения, т.к. ему нужно будет поглотить
    // все то, что потребует выражение, хоть потом он и вернет позицию на место.
    simple_and:   max,
    simple_not:   max,
    optional:     max,
    zero_or_more: function(node) {
      let r = calc(node.expression);
      return new Result(0, r.max === 0 ? 0 : null);
    },
    one_or_more:  function(node) {
      let r = calc(node.expression);
      return new Result(r.min, r.max === 0 ? 0 : null);
    },
    range:        function(node) {
      let d = node.delimiter ? calc(node.delimiter) : new Result(0);
      let r = calc(node.expression);

      let min = null;
      let max = null;

      if (node.min.constant && r.min !== null) {
        min = node.min.value * r.min + Math.max(0, node.min.value-1) * d.min;
      }
      if (node.max.constant && node.max.value !== null && r.max !== null) {
        max = node.max.value * r.max + Math.max(0, node.max.value-1) * d.max;
      }
      return new Result(min, max);
    },
    semantic_and: unknown,
    semantic_not: unknown,
    rule_ref:     function(node) {
      if (visitedRules.indexOf(node.name) >= 0) {
        // Если правило рекурсивное, то оно может неограниченно поглощать вход
        return new Result(null);
      }
      let rule = asts.findRule(ast, node.name);
      if (rule) {
        return calc(rule);
      }
      emitInfo('Rule '+node.name+' is unknown, consume result is `{ min: null, max: null }`');
      return new Result(null);
    },
    literal:      function(node) { return new Result(node.value.length); },
    class:        unit,
    any:          unit,
  });

  return calc(ast);
}

// Данный файл может сразу использоваться, как плагин
calcConsumes.Result = Result;
calcConsumes.use = function(config) {
  config.passes.transform.push(calcConsumes);
};
module.exports = calcConsumes;