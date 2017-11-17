'use strict';
'use asm';

/// Отрезок представляет собой часть числовой прямой, ограниченную двумя числами.
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
  point = point|0;
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
/// возвращает, меняет текущий объект.
/// @param segments {Array<Segment>} Массив отрезков для нормализации
Segment.prototype.normalize = function(segments) {
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

module.exports = Segment;
