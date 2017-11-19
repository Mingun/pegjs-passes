'use strict';

let js = require('pegjs/lib/compiler/js');

/// @param literal Узел AST с типом `literal` и значением, содержащим как минимум 1 символ
/// @param length {int} Длина другого литерала, которой должна быть ограничена длина строки в
///        регулярном выражении
function literal2RegExp(literal, length) {
  let value = literal.value.substr(0, length);
  return new RegExp('^' + js.regexpClassEscape(value), 'i');
}

/// ```
///       not == false                  not == true        результат изменился?
/// 'ab'  &  'a'    => 'ab'       'ab'  & !'a'    => nothing    +
/// 'ab'  &  'ab'   => 'ab'       'ab'  & !'ab'   => nothing    +
/// 'ab'  &  'ac'   => nothing    'ab'  & !'ac'   => 'ab'       +
/// 'ab'  &  'abc'  => 'abc'      'ab'  & !'abc'  => 'ab'       +
/// 'ab'  &  'acd'  => nothing    'ab'  & !'acd'  => 'ab'       +
///
/// 'ab'  &  'a'i   => 'ab'       'ab'  & !'a'i   => nothing    +
/// 'ab'  &  'ab'i  => 'ab'       'ab'  & !'ab'i  => nothing    +
/// 'ab'  &  'ac'i  => nothing    'ab'  & !'ac'i  => 'ab'       +
/// 'ab'  &  'abc'i => 'ab'       'ab'  & !'abc'i => 'ab'
/// 'ab'  &  'acd'i => nothing    'ab'  & !'acd'i => 'ab'       +
///
/// 'ab'i &  'a'    => 'a'        'ab'i & !'a'    => nothing    +
/// 'ab'i &  'ab'   => 'ab'       'ab'i & !'ab'   => nothing    +
/// 'ab'i &  'ac'   => nothing    'ab'i & !'ac'   => 'ab'i      +
/// 'ab'i &  'abc'  => 'abc'      'ab'i & !'abc'  => !'abc'
/// 'ab'i &  'acd'  => nothing    'ab'i & !'acd'  => 'ab'i      +
///
/// 'ab'i &  'a'i   => 'ab'i      'ab'i & !'a'i   => nothing    +
/// 'ab'i &  'ab'i  => 'ab'i      'ab'i & !'ab'i  => nothing    +
/// 'ab'i &  'ac'i  => nothing    'ab'i & !'ac'i  => 'ab'i      +
/// 'ab'i &  'abc'i => 'abc'i     'ab'i & !'abc'i => 'ab'i      +
/// 'ab'i &  'acd'i => nothing    'ab'i & !'acd'i => 'ab'i      +
/// ```
///
/// @param lit1 Узел AST с типом `literal` и значением, содержащим как минимум 1 символ
/// @param lit2 Узел AST с типом `literal` и значением, содержащим как минимум 1 символ
/// @param not {boolean} Если `true`, то вход, соответсвующий литералу `lit1`, также должен
///        НЕ соответствовать литералу `lit2`, в противном случае должен соответствовать.
/// @return Значение, описывающее ожидаемый символ (или группу символов) в точке, в которой вход
///         соответсвует литералу `lit1`.
function merge(lit1, lit2, not) {
  if (not !== true) not = false;

  let v1 = lit1.value;
  let v2 = lit2.value;
  // 1) Если оба литерала игнорируют регистр, то приводим их к одному регистру и сравниваем
  // 2) Если только один игнорирует регистр, то превращаем его в регулярное выражение и проверяем
  //    им второй литерал. Возвращаем литерал, который учитывает регистр, как более ограничивающий
  // 3) Если оба литерала не игнорируют регистр, то просто сравниваем их, без преобразования
  //    регистра
  // Первую и 3-ю проверки можно объединить, т.к. они отличаются только необходимостью конвертации
  // регистра. При этом, если литералы совместимы, возвращаем наибольший из них, как более ограничивающий
  // Если литералы несовместимы, возвращаем "nothing".
  if (lit1.ignoreCase === lit2.ignoreCase) {
    if (lit1.ignoreCase) {
      v1 = v1.toUpperCase();
      v2 = v2.toUpperCase();
    }
    if (v1.length >= v2.length) {
      return v1.startsWith(v2) === not ? { type: 'nothing' } : lit1;
    } else {
      if (not) {
        return lit1;
      }
      return v2.startsWith(v1) ? lit2 : { type: 'nothing' };
    }
  }

  let l1 = lit1.ignoreCase ? lit1 : lit2;// литерал с игнорированием регистра
  let l2 = lit1.ignoreCase ? lit2 : lit1;// литерал без игнорирования регистра
  if (not) {
    if (v1.length > v2.length) {
      return { type: 'nothing' };
    }
    let re = new RegExp('^' + js.regexpClassEscape(l1.value), 'i');
    if (re.test(l2.value)) {
      return v1.length === v2.length
        ? { type: 'nothing' }
        : (lit1.ignoreCase ? Object.assign({ not: true }, lit2) : lit1);
    }
    return lit1;
  }
  let re = literal2RegExp(l1, l2.value.length);

  return re.test(l2.value) ? l2 : { type: 'nothing' };
}

module.exports = merge;