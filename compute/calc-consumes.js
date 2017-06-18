'use strict';

let asts    = require('pegjs/lib/compiler/asts');
let visitor = require('pegjs/lib/compiler/visitor');

class Result {
  /// @param {Number} chunk Количество символов в разбираемом потоке, которое требуется парсеру для
  ///                       продолжения его работы. Без наличия соответствующего количества символов
  ///                       парсер не может однозначно определить, есть соответствие или нет
  /// @param {Number?} min Количество символов в разбираемом потоке, которое парсер непременно
  ///                      поглотит, если данное правило будет сопоставлено
  /// @param {Number?} max Количество символов в разбираемом потоке, которое парсер может поглотить
  ///                      в предельном случае. Если null - то неограничено
  constructor(chunk, min, max) {
    if (chunk && chunk < 0) {
      throw new Error('`chunk` must be null be >= 0: '+chunk);
    }
    if (min && min < 0) {
      throw new Error('`min` must be null or >= 0: '+min);
    }
    if (max && (max < 0 || min && max < min)) {
      throw new Error('`max` must be null or >= min or >= 0: '+max);
    }
    this.chunk = chunk;
    this.min = min;
    this.max = max !== undefined ? max : min;
  }
}
function combineChoice(r1, r2) {
  return new Result(
    Math.max(r1.chunk, r2.chunk),
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
    r1.chunk,// подходит только при вызова reduce, reduceRight требует взять r2.chunk
    r1.min === null || r2.min === null ? null : r1.min + r2.min,
    r1.max === null || r2.max === null ? null : r1.max + r2.max
  );
}
/// Вычисляет максимальное и минимальное количество символов, которое может поглотить каждый узел
/// парсера при успешном сопоставлении, а также минималное количество символов, требуемое для
/// продвижения сопоставления по узлам грамматики. Результат возвращается в виде объекта
///`{ chunk: Number, min: Number?, max: Number? }`.
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

  function unit() { return new Result(1, 1, 1); }
  function unknown(node) { return new Result(maxLookahead, 0, maxLookahead); }
  function minIs0(node) { let r = calc(node.expression); return new Result(r.chunk, 0, r.max); }

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
      return new Result(0, 0, 0);
    },
    sequence:     function(node) {
      if (node.elements.length > 0) {
        return node.elements.map(calc).reduce(combineSequence);
      }
      return new Result(0, 0, 0);
    },
    // Максимальное значение lookahead равно максимому выражения, т.к. ему нужно будет поглотить
    // все то, что потребует выражение, хоть потом он и вернет позицию на место.
    simple_and:   minIs0,
    simple_not:   minIs0,
    optional:     minIs0,
    zero_or_more: function(node) {
      let r = calc(node.expression);
      return new Result(r.chunk, 0, r.max === 0 ? 0 : null);
    },
    one_or_more:  function(node) {
      let r = calc(node.expression);
      return new Result(r.chunk, r.min, r.max === 0 ? 0 : null);
    },
    range:        function(node) {
      let d = node.delimiter ? calc(node.delimiter) : new Result(0, 0, 0);
      let r = calc(node.expression);

      let min = null;
      let max = null;

      // Если количество повторений ограничено константой и у выражения имеется определенный
      // минимум, а также если разделитель имеет смысл и у него также имеется определенный
      // минимум, то вычисляем минимум всего выражения, в противном случае он неизвестен.
      if (node.min.constant && r.min !== null && (d.min !== null || node.min.value <= 1)) {
        min = node.min.value * r.min + Math.max(0, node.min.value-1) * d.min;
      }
      // Если количество повторений ограничено константой и она определенная; у выражения имеется
      // определенный максимум, а также если разделитель имеет смысл и у него также имеется
      // определенный максимум, то вычисляем максимум всего выражения, в противном случае он
      // неизвестен.
      if (node.max.constant && node.max.value !== null && r.max !== null && (d.max !== null || node.max.value <= 1)) {
        max = node.max.value * r.max + Math.max(0, node.max.value-1) * d.max;
      }
      return new Result(r.chunk, min, max);
    },
    semantic_and: unknown,
    semantic_not: unknown,
    rule_ref:     function(node) {
      if (visitedRules.indexOf(node.name) >= 0) {
        // Если правило рекурсивное, то оно может неограниченно поглощать вход
        //TODO: Если в узлах кешировать результат, то chunk можно определить в некоторых случаях
        return new Result(null, null, null);
      }
      let rule = asts.findRule(ast, node.name);
      if (rule) {
        return calc(rule);
      }
      emitInfo('Rule '+node.name+' is unknown, consume result is `{ chunk: null, min: null, max: null }`');
      return new Result(null, null, null);
    },
    literal:      function(node) { return new Result(node.value.length, node.value.length, node.value.length); },
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