'use strict';

var visitor = require('pegjs/lib/compiler/visitor');

/// Определяет метки, выдымые для действий и предикатов, и помещает их в свойство
/// |labels| этих узлов. Данное свойство содержит отобразение имени видимой метки
/// на соответсвующий узел AST.
function computeLabels(ast) {
  function scope(node, labeledNodes) {
    compute(node.expression, Object.assign({}, labeledNodes));
  }

  function predicate(node, labeledNodes) {
    compute(node.expression, labeledNodes);

    node.labels = labeledNodes;
  }

  var compute = visitor.build({
    labeled: function(node, labeledNodes) {
      // Копируем объект, чтобы выражение внутри него не имело доступа к самому себе
      var shallowCopy = Object.assign({}, labeledNodes);
      labeledNodes[node.label] = node;
      compute(node.expression, shallowCopy);
    },
    action: function(node, labeledNodes) {
      // Берем существующие элементы и дописываем/перезаписываем метками из своего выражения
      var copy = Object.assign({}, labeledNodes);
      compute(node.expression, copy);
      node.labels = copy;
    },
    semantic_and: predicate,
    semantic_not: predicate,

    rule: scope,

    simple_and: scope,
    simple_not: scope,

    zero_or_more: scope,
    one_or_more: scope,
    range: scope,

    optional: scope,
    text: scope,

    sequence: function(node, labeledNodes) {
      // Если внутри одной последовательности окажется вторая последовательность,
      // то клонируем окружение, в противном случае наполняем старое. Это решает
      // проблему pegjs#396.
      node.elements.map(function(n) {
        var labels = n.type !== 'sequence'
          ? labeledNodes
          : Object.assign({}, labeledNodes);

        compute(n, labels);
      });
    },
    choice: function(node, labeledNodes) {
      node.alternatives.map(n => compute(n, Object.assign({}, labeledNodes)));
    },
  });

  compute(ast);
}

// Данный файл может сразу использоваться, как плагин
module.exports = {
  use: function(config) {
    config.passes.transform.push(computeLabels);
  },
  pass: computeLabels
};
