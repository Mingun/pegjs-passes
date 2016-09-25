'use strict';

let visitor = require('pegjs/lib/compiler/visitor');

/// Определяет метки, видимые для действий и предикатов, и помещает их в свойство
/// |labels| этих узлов. Данное свойство содержит отображение имени видимой метки
/// на соответсвующий узел AST.
function computeLabels(ast) {
  function scope(node, labeledNodes) {
    compute(node.expression, Object.assign({}, labeledNodes), false);
  }

  function predicate(node, labeledNodes) {
    // Предикаты видят только те метки, которые были объявлены до них.
    // Так как labeledNodes еще может пополнятся последующими выражениями, то делаем
    // себе копию.
    node.labels = Object.assign({}, labeledNodes);
  }

  var compute = visitor.build({
    /// @node Обрабатываемый узел AST.
    /// @labeledNodes Отображение меток узлов на сами узлы в текущей области видимости.
    labeled: function(node, labeledNodes) {
      // Начинаем новую область видимости,, чтобы выражение внутри него не имело
      // доступа к самому себе.
      scope(node, labeledNodes);
      labeledNodes[node.label] = node;
    },
    /// @labeledNodes Видимые действию метки из внешних областей видимости.
    action: function(node, labeledNodes) {
      // Действие видит все метки, которые встретились до него на более высоких уровнях
      // иерархии плюс те метки, которые объявлены в его выражении (причем последние имеют
      // приоритет в случае совпадения имен меток).
      // Пополняем копию (чтобы извне не видили то, что принадлежит действию) метками из
      // своего выражения.
      let shallowCopy = Object.assign({}, labeledNodes);
      // Если в действие сложена последовательность, то она не должна создавать собственную
      // область видимости, а должна воспользоваться областью видимости действия.
      compute(node.expression, shallowCopy, true);
      node.labels = shallowCopy;
    },
    semantic_and: predicate,
    semantic_not: predicate,

    rule: scope,

    simple_and: scope,
    simple_not: scope,

    zero_or_more: scope,
    one_or_more: scope,
    range: function(node, labeledNodes) {
      scope(node, labeledNodes);
      if (node.delimiter) {
        compute(node.delimiter, Object.assign({}, labeledNodes), false);
      }
    },
    group: scope,

    optional: scope,
    text: scope,
    /// @useParentScope Должна ли последовательность создать новую область видимости
    /// или использовать область видимости родительского узла. Используется для пополнения
    /// областей видимости действий.
    sequence: function(node, labeledNodes, useParentScope) {
      // Пополняем метки всеми элементами последовательности
      node.elements.map(n => {
        compute(n, useParentScope ? labeledNodes : Object.assign({}, labeledNodes), false)
      });
    },
    choice: function(node, labeledNodes) {
      // Каждая альтернатива имеет собственную область видимости
      node.alternatives.map(n => compute(n, Object.assign({}, labeledNodes), false));
    },
  });

  compute(ast);
}
// Данный файл может сразу использоваться, как плагин
computeLabels.use = function(config) {
  config.passes.transform.push(computeLabels);
};
module.exports = computeLabels;
