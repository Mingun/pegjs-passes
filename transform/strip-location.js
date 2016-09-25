'use strict';

let visitor = require('pegjs/lib/compiler/visitor');

function stripLocation(ast) {
  function stripLeaf(node) {
    delete node.location;
  }

  function stripExpression(node) {
    delete node.location;

    strip(node.expression);
  }

  function stripAnnotations(node) {
    if (node.annotations) {
      node.annotations.forEach(strip);
    }
    stripExpression(node);
  }

  function stripChildren(property) {
    return function(node) {
      delete node.location;

      let child = node[property];
      if (child) {
        child.forEach(strip);
      }
    };
  }

  var strip = visitor.build({
    grammar: function(node) {
      delete node.location;

      if (node.imports) {
        node.imports.forEach(strip);
      }

      if (node.initializer) {
        strip(node.initializer);
      }
      if (node.initializers) {
        node.initializers.forEach(strip);
      }

      if (node.rules) {
        node.rules.forEach(strip);
      }
    },

    'import':     stripLeaf,
    initializer:  stripChildren('annotations'),
    annotation:   stripLeaf,
    rule:         stripAnnotations,
    named:        stripExpression,
    choice:       stripChildren('alternatives'),
    action:       stripAnnotations,
    sequence:     stripChildren('elements'),
    labeled:      stripExpression,
    text:         stripExpression,
    simple_and:   stripExpression,
    simple_not:   stripExpression,
    optional:     stripExpression,
    zero_or_more: stripExpression,
    one_or_more:  stripExpression,
    range: function(node) {
      delete node.max.location;
      delete node.min.location;

      if (node.delimiter) {
        delete node.delimiter.location;

        strip(node.delimiter);
      }
      stripExpression(node);
    },
    group:        stripExpression,
    semantic_and: stripChildren('annotations'),
    semantic_not: stripChildren('annotations'),
    rule_ref:     stripLeaf,
    literal:      stripLeaf,
    'class':      stripLeaf,
    any:          stripLeaf
  });

  strip(ast);
}

// Данный файл может сразу использоваться, как плагин
stripLocation.use = function(config) {
  config.passes.transform.push(stripLocation);
};
module.exports = stripLocation;