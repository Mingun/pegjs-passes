'use strict';

function buildVisitor(property, functions) {
  function visit(obj) {
    if (!(property in obj)) {
      throw new TypeError('Visited object has no property `' + property + '`', obj);
    }
    let kind = obj[property];
    let func = functions[kind];
    if (!func) {
      throw new TypeError('No visitor function for type `' + kind + '`', obj);
    }
    if (typeof(func) !== 'function') {
      throw new TypeError("Property `" + kind + "` is not a function: " + func);
    }
    return func.apply(null, arguments);
  }
  return visit;
};

module.exports = buildVisitor;