'use strict';

function Segment(min, max) {
  min = min|0;
  max = max|0;
  if (min < 0) {
    throw new Error("Invalid segment: min=" + min + " < 0");
  }
  if (min > max) {
    throw new Error("Invalid segment: min=" + min + " > max=" + max);
  }
  this.min = min;
  this.max = max;
}
Segment.prototype.toString = function() {
  return '[0x' + this.min.toString(16).toUpperCase()
       + '-0x' + this.max.toString(16).toUpperCase()
       + ']';
}
/// Отрезок, начинающийся раньше, меньше отрезка, начинающегося позже.
/// Если оба отрезка стартуют из одной точки, то меньше тот, чья длина меньше.
/// @param {Segment} segment
Segment.prototype.compare = function(segment) {
  if (this.min === segment.min) {
    if (this.max < segment.max) return -1;
    if (this.max > segment.max) return 1;
    return 0;
  }
  if (this.min < segment.min) return -1;
  if (this.min > segment.min) return 1;
  return 0;
}
/// Проверяет, содержится ли указанная точка внутри или на границах отрезка
/// @param {Number} point
Segment.prototype.contains = function(point) {
  return this.min <= point && point <= this.max;
}
/// Проверяет, пересекаются ли или касаются ли друг друга указанные отрезки.
/// Отрезки пересекаются, если границы одного из них лежат внутри границ другого
/// или на границе.
/// @param {Segment} segment
Segment.prototype.intersects = function(segment) {
  return this.contains(segment.min) || this.contains(segment.max) // this содержит часть segment
      || segment.contains(this.min) || segment.contains(this.max);// segment содержит часть this
}
/// Расширяет указанный отрезок переданным, если они пересекаются. Если пересечения нет,
/// ничего не делает и возвращает false.
///
/// Возможные ситуации взаимного расположения отрезков:
/// 1.        this
///         /      \
///--c---d-A--------B--
/// segment
/// 2.    this
///     /      \
///--c-A-d------B--
/// segment
/// 3.   this
///    /      \
///-c-A--------B-d-
/// '--segment---'
/// 4.  this
///   /      \
///--A-c------B--d-
///    '-segment-'
/// 5.  this
///   /      \
///--A-c---d--B--
///   segment
/// 6.  this
///   /      \
///--A--------B-c---d-
///            segment
/// @param {Segment} segment отрезок, которым расширяется данный
/// @return {bool} true, если отрезок был расширен и false, если отрезки не
///                пересекаются и расширения не произошло.
Segment.prototype.expand = function(segment) {
  if (!this.intersects(segment)) {// ситуации 1 и 6
    // Касания
    if (this.min !== segment.max + 1 && this.max !== segment.min - 1) {
      return false;
    }
  }
  this.min = Math.min(this.min, segment.min);
  this.max = Math.max(this.max, segment.max);
  return true;
}
Segment.prototype.toRegExp = function() {
  return String.fromCodePoint(this.min)
       + '-'
       + String.fromCodePoint(this.max);
}

/// Нормализует диапазон отрезков, делая в каждом из отрезков уникальные значения
/// и сортируя их по возрастанию (сначала левого конца, потом правого). Ничего не
/// возвращает, меняет текущий объект
function normalize(segments) {
  segments.sort((x, y) => x.compare(y));
  // Отрезом, увеличивающейся на текущем шаге алгоритма.
  let current = segments[0];
  let normalized = [current];
  // Так как отрезки отсортированы по возрастанию начала, то расти размер может только
  // вправо, при этом с каждым разом могут поглощаться отрезки, расположенные правее.
  // Как только очередной отрезок не будет поглощен, то значит есть разрыв, поэтому
  // мы добавляем прежний отрезок в результат (фактически, он уже в нем, поэтому добавляем
  // в результат мы новый отрезок) и начинаем растить новый отрезок.
  for (let i = 1; i < segments.length; ++i) {
    let segment = segments[i];
    if (!current.expand(segment)) {
      current = segment;
      normalized.push(segment);
    }
  }
  return normalized;
}

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
    this.segments = normalize(min);
  } else {
    this.segment = [];
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