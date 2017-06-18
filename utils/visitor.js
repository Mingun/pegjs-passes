'use strict';

function buildVisitor(property, functions) {
  function visit(obj) {
    let kind = obj[property];
    if (!kind) {
      throw new Error('Invalid `object`: has no property `' + property + '`');
    }
    let f = functions[kind];
    if (!f) {
      throw new Error('No visitor function for type `' + kind + '`', obj);
    }
    return f.apply(null, arguments);
  }
  return visit;
};

module.export = buildVisitor