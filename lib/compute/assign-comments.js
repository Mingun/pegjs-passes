'use strict';

let visitor = require('pegjs/lib/compiler/visitor');

/// Определяет, могут ли два комментария быть сгруппированы. Комментарии группируются,
/// если они:
/// 1) однострочные (//)
/// 2) начинаются на одном столбце
/// 3) первый идет на одну строчку выше второго
function canGroup(comment1, comment2) {
  return !comment1.multiline && !comment2.multiline
      && comment1.location.start.column === comment2.location.start.column
      && comment1.location.end.line === comment2.location.start.line - 1
}
class Group {
  constructor(comment1, comment2) {
    this.comments = [comment1, comment2];
    this.location = { start: comment1.location.start, end: comment2.location.end };
  }
  /// Добавляет комментарий в указанную группу и обновляет конец группы
  push(comment) {
    this.comments.push(comment);
    this.location.end = comment.location.end;
  }

  get text() {
    if (!this._text) {
      this._text = this.comments.map(c => c.text).join('\n');
    }
    return this._text;
  }
}
/// Преобразует поток несгруппированных комментариев в поток объединенных в группы
/// по необходимости. Каждое возвращаемое значение -- или исходный объект из `iterable`,
/// или объект класса `Group`, содержащий все комментарии группы.
function* grouped(iterable) {
  let first = iterable.next();
  if (first.done) {
    return;
  }

  let last = first.value;
  let group;
  for (let val of iterable) {
    // В случае, если комментарии можно сгруппировать, группируем их
    if (canGroup(last, val)) {
      // Если группа уже существует, то добавляем комментарий в нее,
      // иначе создаем новую из двух последних комментариев
      if (group) {
        group.push(val);
      } else {
        group = new Group(last, val);
      }
    } else {
      yield group ? group : last;
      group = null;
    }
    last = val;
  }
  yield group ? group : last;
}

/// Преобразует комментарии из AST грамматики, объединяя однострочные комментарии в группы.
/// @return {Array} Массив с комментариями и группами комментариев
function groupComments(comments) {
  // Получаем из объекта массив
  let arr = Object.keys(comments).map(k => comments[k]);
  let it = arr[Symbol.iterator]();

  return [...grouped(it)];
}

/// Проверяет, может ли указанный комментарий или группа комментариев быть привязана к
/// указанному узлу грамматики.
function canAssign(node, comment) {
  // Комментарий заканчивается на одну строку выше начала определения узла,
  // т.е. расположен непосредственно над узлом:
  // ```
  // // comment
  // // block
  // node = ...
  //
  //              // comment
  //              // block
  // node = ...
  // ```
  return node.location.start.line === comment.location.end.line - 1
  // Комментарий начинается на той же строчке, что и узел:
  // ```
  // node   // comment
  //   = ...// block
  //
  // /* comment */node = ...
  // ```
      || node.location.start.line === comment.location.start.line
  ;
}

function assignComments(ast, options) {
  // Вычисление комментариев может быть отключено, поэтому выходим, если это так
  if (ast.comments === null) {
    options.collector.emitInfo(
      'Comments not enabled for parser. Add `extractComments: true` to options when you generate parser'
    );
    return;
  }

  // Объединяем однострочные комментарии в группы
  ast.comments = groupComments(ast.comments);

  let assign = visitor.build({
    rule(node) {
      node.comments = ast.comments.filter(c => canAssign(node, c));
    }
  });

  assign(ast);
}

// Данный файл может сразу использоваться, как плагин
assignComments.use = function(config) {
  config.passes.transform.push(assignComments);
};
module.exports = assignComments;