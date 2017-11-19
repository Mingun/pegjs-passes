'use strict';

let Segment = require('./Segment');

/// Представляет любой символ в некотором диапазоне или диапазонах точек юникода
/// @param {Number|Array} min
/// @param {Number?} max
function Char(min, max) {
  // segments содержит список массивов из 2-х элементов, каждый из которых представляет
  // закрытый диапазон символов в кодировке UTF-32. Диапазоны не содержат общих точек
  if (max) {
    this.segments = [new Segment(min, max)];
  } else
  if (min) {
    this.segments = Segment.normalize(min);
  } else {
    this.segments = [];
  }
}
/// Представляет метасимвол, представляющий все возможные символы юникода
Char.ALL  = new Char(0, 0x10FFFF);
/// Представляет метасимвол, не представляющий ни одного символа
Char.NONE = new Char();

Char.prototype.toString = function() {
  // return this.segments.join('');
  return this.toRegExp().toString();
}

/// Добавляет к списку допустимых значений указанные
/// @param {Char} value
/// @return {Char} Новое значение, являющееся объединением данного с аргументом
Char.prototype.or = function(value) {
  return new Char(this.segments.concat(value.segments));
}
/// Возвращает новое значение, которое представляет только те символы, которых нет
/// в исходном значении. Исходное значение не меняется
/// @return {Char}
Char.prototype.invert = function() {
  // [-A==B---c=d--E=====F]
  // [=A--B===c-d==E-----F]
  if (this.isEmpty()) {
    return Char.ALL;
  } else {
    let inverted = [];
    let segment = this.segments[0];
    let min = Char.ALL.min;
    for (let i = 1; i < this.segments.length; ++i) {
      inverted.push(new Segment(min, segment.min));

      min = segment.max;
      segment = this.segments[i];
    }
    inverted.push(new Segment(segment.max, Char.ALL.max));

    return new Char(inverted);
  }
}
Char.prototype.isEmpty = function() {
  this.segments.length === 0;
}
/// Возвращает регулярное выражение, которое сопоставляется со всеми символами,
/// представляющими данный метасимвол и не сопостовляется ни с какими другими.
/// @return {RegExp}
Char.prototype.toRegExp = function() {
  return new RegExp('[' + this.segments.map(r => r.toRegExp()).join('') + ']');
}
/// @param {Segment} segment Диапазон символов, который проверяется на полное включение в
///                          данное значение
/// @return {bool} true, если указанный диапазон символов целиком содержится в этом
///                значении, иначе false
Char.prototype.contains = function(segment) {
  return this.segments.some(r => r.contains(segment.min) && r.contains(segment.max));
}
/// Определяет, является ли данный символ частью указанного.
/// @param {Char} value
/// @return {bool} true, если любой символ, представимый данным значением, представим и в value
Char.prototype.isSubset = function(value) {
  // Каждый диапазон этого значения содержится внутри какого-то диапазона того
  return this.segments.every(s => value.contains(s));
}

module.exports = Char;