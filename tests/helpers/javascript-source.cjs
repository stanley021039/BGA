const { parsers } = require('prettier/plugins/babel');
exports.functionSource = (source, name) => {
  const ast = parsers.babel.parse(source, {});
  let found;
  function walk(node) {
    if (!node || typeof node !== 'object' || found) return;
    if (node.type === 'FunctionDeclaration' && node.id?.name === name) {
      found = source.slice(node.start, node.end);
      return;
    }
    for (const value of Object.values(node)) {
      if (Array.isArray(value)) value.forEach(walk);
      else if (value && typeof value === 'object') walk(value);
    }
  }
  walk(ast);
  return found;
};
