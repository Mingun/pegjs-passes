'use strict';

let visitor = require('pegjs/lib/compiler/visitor');

/// Проверяет, что на все правила кто-то ссылается, кроме заданных в качестве стартовых.
function reportUnusedRules(ast, options) {
  let emitWarning = options.collector.emitWarning;

  let used = {};

  let check = visitor.build({
    grammar:  function(node) {
      node.rules.forEach(rule => {
        // Начинаем с достижимых из корня правил. Уже помеченные правила не анализируем вновь
        if (options.allowedStartRules.indexOf(rule.name) >= 0 && used[node.name] !== true) {
          used[rule.name] = true;
          check(rule);
        }
      });

      node.rules.forEach(function(rule) {
        if (!used[rule.name]) {
          emitWarning(
            'Rule "' + rule.name + '" not used.',
            rule.location
          );
        }
      });
    },
    rule_ref: function(node) { used[node.name] = true; }
  });

  check(ast);
};

// Данный файл может сразу использоваться, как плагин
reportUnusedRules.use = function(config) {
  config.passes.check.push(reportUnusedRules);
};
module.exports = reportUnusedRules;