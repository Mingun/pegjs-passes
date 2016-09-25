'use strict';

let asts    = require('pegjs/lib/compiler/asts');
let visitor = require('pegjs/lib/compiler/visitor');

/// Виды типов:
/// Примитивные:
/// - 'none': тип значений, возвращаемых из семантических предикатов, например, 'bool'.
///   Данный тип должно быть возможно использовать в логических выражениях с двоичной логикой.
/// - 'unit': тип одного элемента входной последовательности, например, 'char'.
///   Данный тип имеют результаты разбора одиночного символа и класса символов.
/// - 'range': тип входной последовательности, например, 'std::string'.
///   Данный тип имеет результат разбора литерала и оператор взятия совпавшей части
///   последовательности ($).
/// Составные:
/// - 'enum': тип, способный хранить в себе один из дочерних типов, например, 'boost::variant'.
///   Является результатом обработки узлов выбора альтернативы.
/// - 'list': тип для представления списка элементов дочернего типа, например, 'std::vector'.
///   Является результатом обработки узлов повторений элементов (*, +, range)
/// - 'tuple': тип, хранящий в себе все дочерные типы в указанном порядке, например, 'std::tuple'.
///   Данный тип генерирует только узел последовательности элементов.
/// - 'option': тип, хранящий в себе дочерний тип или признак того, что разбор оказался неуспешен.
///   Данный тип генерирует только узел опционального элемента.
/// - 'ref': тип, описывающий ссылку на свой дочерный тип, например '&'.
///   Данный тип генерирует только узел ссылки на правило.
/// Фантомные:
/// - 'rule': тип, изначально приписываемый какому-то правилу, для возможности вычисления цикличеких
///   ссылок.
/// - 'error': тип, приписываемый узлам действия в случае, если у них не задан собственный тип.
function Type(kind, name, value) {
  this.kind  = kind;
  this.name  = name;
  this.value = value;
}
function buildVisitor(functions) {
  function visit(type) {
    if (!type.kind) {
      throw new Error('Invalid `type`: has no property `kind`');
    }
    let f = functions[type.kind];
    if (!f) {
      throw new Error('No visitor function for type `' + type.kind + '`', type);
    }
    return f.apply(null, arguments);
  }
  return visit;
};

const noneType  = new Type('none');
const unitType  = new Type('unit');
const rangeType = new Type('range');

function none(node)  { return node.result.type = noneType; }
function unit(node)  { return node.result.type = unitType; }
function range(node) { return node.result.type = rangeType; }

/// Выводит типы всех узлов грамматики на основе типов action-узлов.
/// Типы action узлов должны быть предварительно размечены, например, проходом init-types.
function inferenceTypes(ast, options) {
  let emitError = options.collector.emitError;

  let i = 0;
  /// Генератор уникальных имен для типов.
  function gen() {
    ++i;
    return 'T' + i;
  }

  // Устанавливает узлу выходной тип, равный типу списка из элементов одного типа - типа его выражения.
  function list(node)     { return node.result.type = new Type('list', gen(), inference(node.expression)); }
  // Устанавливает узлу выходной тип, равный типу его выражения.
  function delegate(node) { return node.result.type = inference(node.expression); }

  // Сначала инициализируем все правила каким-то типом.
  // Каждое правило всегда имеет какой-то тип, по умолчанию - какой-то пользовательский,
  // структуру которого еще предстоит выяснить.
  ast.rules.forEach(rule => rule.result.type = new Type('rule', rule.name));

  // Список узлов, посещенных до входа в узел `rule_ref`. Помогает находить рекурсивные типы.
  let visitedNodes = [];
  var inference = visitor.build({
    rule:         function(node) {
      visitedNodes.push(node);
      let type = inference(node.expression);
      visitedNodes.pop();
      // На `node.result.type` ссылается множество `rule_ref` узлов. При этом, точный тип данного
      // узла может стать известным позже, чем данные ссылки будут установлены. Чтобы не заменять
      // типы во всех ссылающихся (прямо и косвенно) на данный узел узлов AST, мы храним тип правила
      // в специальном узле, который просто перенаправляет нас на реальный его тип.
      // Когда реальный тип узла правила становится известным, мы просто заменяем внутренний тип.
      return node.result.type.value = type;
    },
    named:        delegate,
    choice:       function(node) {
      return node.result.type = new Type('enum', gen(), node.alternatives.map(inference));
    },
    action:       function(node) {
      inference(node.expression);
      let type = node.result.type;
      if (!type) {
        emitError('Action result type not defined', node.location);
        return node.result.type = new Type('error', gen());
      }
      // Действию извне должны были задать либо конечный тип, либо функцию вывода типа
      // из типа меток, доступных действию.
      if (type instanceof Type) {
        return type;
      }
      if (typeof(type) !== 'function') {
        emitError("Action result type must be 'Type' instance or function, but it type is "+typeof(type), node.location);
        return node.result.type = new Type('error', gen());
      }
      // Возвращаемый тип действия может зависеть от типов помеченных выражений.
      // Наиболее частый случай этого - возврат лишь одного элемента из последовательности.
      type = type();
      if (type instanceof Type) {
        return node.result.type = type;
      }
      emitError("Type generator for action must return instance of 'Type', but returned object has type "+typeof(type), node.location);
      return node.result.type = new Type('error', gen());
    },
    sequence:     function(node) {
      return node.result.type = new Type('tuple', gen(), node.elements.map(inference));
    },
    labeled:      delegate,
    text:         range,
    simple_and:   none,
    simple_not:   none,
    optional:     function(node) {
      return node.result.type = new Type('option', gen(), inference(node.expression));
    },
    zero_or_more: list,
    one_or_more:  list,
    range:        function(node) {
      if (node.delimiter) {
        inference(node.delimiter);
      }
      return list(node);
    },
    group:        delegate,
    semantic_and: none,
    semantic_not: none,
    rule_ref:     function(node) {
      var rule = asts.findRule(ast, node.name);
      var isRecursive = visitedNodes.indexOf(rule) >= 0;
      // У всех правил есть хоть какой-то тип, возможно, еще не вычисленный. Тем не менее, ссылаться
      // на него можно. В случае рекурсивного типа ссылаемся на него через вспомогательный тип ref.
      return node.result.type = isRecursive ? new Type('ref', gen(), rule.result.type) : rule.result.type;
    },
    literal:      range,
    'class':      unit,
    any:          unit,
  });

  inference(ast);
}

// Данный файл может сразу использоваться, как плагин
module.exports = {
  Type: Type,
  buildVisitor: buildVisitor,

  use: function(config) {
    config.passes.transform.push(inferenceTypes);
  },
  pass: inferenceTypes,
};
