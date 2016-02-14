'use strict';

var Type    = require('./inference-types').Type;
var asts    = require('pegjs/lib/compiler/asts');
var visitor = require('pegjs/lib/compiler/visitor');

/// Задает типы всем узлам действий грамматики, помеченных аннотациями @Return или @Type,
/// либо задает тип результата по умолчанию, если таковой есть.
function initTypes(ast, options) {
  var emitError = options.collector.emitError;
  var emitInfo  = options.collector.emitInfo;
  var defType   = options.defaultType;

  var init = visitor.build({
    action: function(node) {
      init(node.expression);

      var r = asts.findAnnotation(node, 'Return');
      var t = asts.findAnnotation(node, 'Type');

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
        var n = node.labels[t.value];
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
module.exports = {
  use: function(config) {
    config.passes.transform.push(initTypes);
  },
  pass: initTypes
};
