'use strict';
let op = require('pegjs/lib/compiler/opcodes');

/// @return Array of arrays: [<index in bytecode>, <opcode value>, <opcode name>, <array of opcode args>]
function decompile(bc) {
  let names = [];
  for (let k in op) if (Object.prototype.hasOwnProperty.call(op, k)) { names[op[k]] = k; }

  /// @return Count of arguments for opcode at index `i`.
  function len(i) {
    switch (bc[i]) {
      // Stack Manipulation

      case op.PUSH:             return 1;    // PUSH c
      case op.PUSH_UNDEFINED:   return 0;    // PUSH_UNDEFINED
      case op.PUSH_NULL:        return 0;    // PUSH_NULL
      case op.PUSH_FAILED:      return 0;    // PUSH_FAILED
      case op.PUSH_EMPTY_ARRAY: return 0;    // PUSH_EMPTY_ARRAY
      case op.PUSH_CURR_POS:    return 0;    // PUSH_CURR_POS
      case op.POP:              return 0;    // POP
      case op.POP_CURR_POS:     return 0;    // POP_CURR_POS
      case op.POP_N:            return 1;    // POP_N n
      case op.NIP:              return 0;    // NIP
      case op.APPEND:           return 0;    // APPEND
      case op.WRAP:             return 1;    // WRAP n
      case op.TEXT:             return 0;    // TEXT

      // Conditions and Loops

      case op.IF:               return 2;    // IF t, f
      case op.IF_ERROR:         return 2;    // IF_ERROR t, f
      case op.IF_NOT_ERROR:     return 2;    // IF_NOT_ERROR t, f
      case op.WHILE_NOT_ERROR:  return 1;    // WHILE_NOT_ERROR b
      case op.IF_LT:            return 3;    // IF_LT min, t, f
      case op.IF_GE:            return 3;    // IF_GE max, t, f
      case op.IF_LT_DYNAMIC:    return 3;    // IF_LT_DYNAMIC min, t, f
      case op.IF_GE_DYNAMIC:    return 3;    // IF_GE_DYNAMIC max, t, f

      // Matching

      case op.MATCH_ANY:        return 2;    // MATCH_ANY a, f, ...
      case op.MATCH_STRING:     return 3;    // MATCH_STRING s, a, f, ...
      case op.MATCH_STRING_IC:  return 3;    // MATCH_STRING_IC s, a, f, ...
      case op.MATCH_REGEXP:     return 3;    // MATCH_REGEXP r, a, f, ...
      case op.ACCEPT_N:         return 1;    // ACCEPT_N n
      case op.ACCEPT_STRING:    return 1;    // ACCEPT_STRING s
      case op.FAIL:             return 1;    // FAIL e

      // Calls

      case op.LOAD_SAVED_POS:   return 1;    // LOAD_SAVED_POS p
      case op.UPDATE_SAVED_POS: return 0;    // UPDATE_SAVED_POS
      case op.CALL:             return 3 + bc[i+3];// CALL f, n, pc, p1, p2, ..., pN

      // Rules

      case op.RULE:             return 1;    // RULE r
      case op.PARAM_REF:        return 1;    // PARAM_REF p

      // Failure Reporting

      case op.SILENT_FAILS_ON:  return 0;    // SILENT_FAILS_ON
      case op.SILENT_FAILS_OFF: return 0;    // SILENT_FAILS_OFF

      default: throw new Error('invalid opcode in pos '+i+': '+bc[i]);
    }
  }
  /// @return Mnemonic name of opcode at index `i`.
  function name(i) {
    let result = names[bc[i]];
    if (result !== undefined) { return result; }

    throw new Error('Invalid opcode in pos '+i+': '+bc[i]);
  }

  let result = [];
  for (let i = 0; i < bc.length; ++i) {
    let l = len(i);
    result.push({
      offset:   i,
      opcode:   bc[i],
      mnemonic: name(i),
      args:     bc.slice(i+1, i+1+l),
    });
    i += l;
  }
  return result;
}

module.exports = decompile;