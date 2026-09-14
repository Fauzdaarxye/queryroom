export function checkStatement(sql, engine = 'sqlite') {
  // Ignore quoted values and comments while finding the first statement and its terminator.
  const pattern = /(\$[A-Za-z_][A-Za-z_0-9]*\$|\$\$)[\s\S]*?\1|--[^\n]*|\/\*[\s\S]*?\*\/|'(?:''|\\.|[^'\\])*'|"(?:""|[^"\n])*"|`(?:``|[^`])*`|;|[A-Za-z_][A-Za-z_0-9]*|[^\s]/g;
  const text = engine === 'mysql' ? sql.replace(/#[^\n]*(?=(?:[^']*'[^']*')*[^']*$)/g, '') : sql;
  const tokens = (text.match(pattern) || []).filter(t=>!t.startsWith('--')&&!t.startsWith('/*'));
  if (!tokens.length) throw new Error('Write a SELECT query, then run it to see your results.');
  if (!['SELECT','WITH'].includes(tokens[0].toUpperCase())) throw new Error('Use a SELECT query or a WITH … SELECT query. Test tables are read-only.');
  const semicolon = tokens.indexOf(';');
  if (semicolon !== -1 && semicolon !== tokens.length-1) throw new Error('Run one SQL statement at a time.');
  if (tokens.some(t=>/^(attach|detach|pragma|vacuum|load_extension)$/i.test(t))) throw new Error('This statement is not available in the practice runner.');
}
