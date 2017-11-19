'use strict';

function VarStack(varName, type) {
  function s(i) {
    if (i < 0) {
      throw Error("Var stack underflow: attempt to use let '" + varName + "<x>' at index " + i);
    }
    return varName + i;
  }

  let sp    = -1;///< Last used variable in stack
  let maxSp = -1;///< Maximum stack size

  this.push = function(exprCode) {
    let code = s(++sp) + ' = ' + exprCode + ';';

    if (sp > maxSp) { maxSp = sp; }

    return code;
  };

  this.pop = function(n) {
    if (arguments.length === 0) {
      return s(sp--);
    } else {
      sp -= n;
      return Array.from({ length: n }, (v, k) => s(sp + 1 + k));
    }
  };
  /// Replaces value at top of stack with specified value
  this.replace = function(exprCode) {
    this.pop();
    return this.push(exprCode);
  };
  /// Returns name of the first free variable
  this.top = function() { return s(sp); };
  /// Returns name of the variable at index `i`
  this.index = function(i) { return s(sp - i); };
  /// Returns variable name that contains result
  this.result = function() { return s(0); };
  /// Returns list of variable names from specified index to last used variable
  this.range = function(fromSp) {
    if (fromSp < 0) {
      throw Error('`fromSp < 0`: (fromSp, sp) == (' + fromSp + ', ' + sp + ')');
    }
    return Array.from({ length: sp + 1 - fromSp }, (v, k) => s(fromSp + k));
  };
  /// Returns defines of all used variables
  this.defines = function() {
    if (maxSp < 0) {
      return '';
    }
    return type + ' ' + Array.from({ length: maxSp + 1 }, (v, k) => s(k)).join(', ') + ';';
  };
  /// Возвращает массив с именами переменных для вызова функции
  /// @env Отображение имен меток результатов на позицию в стеке, где он хранится.
  /// @return Список имен и типов переменных этого стека (в формате `{ name: ..., type: ... }`).
  this.args = function(env) {
    return Object.values(env).map(sp => { name: s(sp), type: type });
  };
  this.checked = function(f) {
    let before = sp;
    let result = f();
    if (before !== sp) {
      throw new Error('Stack pointer changed (before=' + before + ', after=' + sp + ')');
    }
    return result;
  };
}

module.exports = VarStack;