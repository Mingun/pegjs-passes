'use strict';

let Type    = require('./inference-types').Result;
let asts    = require('pegjs/lib/compiler/asts');
let visitor = require('pegjs/lib/compiler/visitor');

/// Задает типы всем узлам действий грамматики, помеченных аннотациями @Return или @Type,
/// либо задает тип результата по умолчанию, если таковой есть.
function initTypes(ast, options) {
  let emitError = options.collector.emitError;
  let emitInfo  = options.collector.emitInfo;
  let defType   = options.defaultType;

  let init = visitor.build({
    action: function(node) {
      init(node.expression);

      let r = asts.findAnnotation(node, 'Return');
      let t = asts.findAnnotation(node, 'Type');

      if (r && t) {
        emitError("Action can't have both annotations @Return and @Type at the same time; use one of them", node.location);
        return;
      }

      if (r) {
        node.result.type = new Type('user', r.value);
        emitInfo("Action type determined from @Return annotation: '" + r.value + "'", node.location);
        return;
      }

      if (t) {
        let n = node.labels[t.value];
        if (!n) {
          emitError("Label '" + t.value + "' not visible from this action", node.location);
        }
        node.result.type = function() { return n.result.type; };
        emitInfo("Action type determined from @Type annotation: same as at expression with label '" + t.value + "'", node.location);
        return;
      }
      // Если нет ни одной из аннотаций, то смотрим, есть ли тип по-умолчанию.
      if (defType) {
        node.result.type = defType;
        emitInfo("Action type use default supplied type: '" + defType + "'", node.location);
      } else {
        emitError("Action type isn't specified: there is no neither annotation @Return or @Type and there is no default type", node.location);
      }
    },
  });

  init(ast);
}

// Данный файл может сразу использоваться, как плагин
initTypes.use = function(config) {
  config.passes.transform.push(initTypes);
};
module.exports = initTypes;
