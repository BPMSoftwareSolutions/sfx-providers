const isRecord=value=>value!==null&&typeof value==='object'&&!Array.isArray(value);
export function bindViewSelection(declared, selection = {}) {
  if (!isRecord(declared)) return declared;
  const picked = {};
  for (const [key, value] of Object.entries(selection ?? {})) if (key !== 'viewId' && value !== null && value !== undefined && value !== '') picked[key] = value;
  const sources = Array.isArray(declared.sources) ? declared.sources.map(source => isRecord(source)
    ? { ...source, input: { ...(isRecord(source.input) ? source.input : {}), ...picked } }
    : source) : declared.sources;
  const boundSources = Array.isArray(sources) ? sources.filter(isRecord) : [];
  const sourceInput = binding => {
    const id = binding.sourceId ?? binding.reader ?? binding.source;
    const match = boundSources.find(source => source.sourceId === id || source.reader === id);
    return isRecord(match?.input) ? match.input : null;
  };
  const bindReadInput = binding => {
    if (!isRecord(binding)) return binding;
    const read = binding.kind === 'read' || binding.kind === 'source'
      || (binding.kind === undefined && typeof binding.reader === 'string');
    if (!read) return binding;
    const base = sourceInput(binding) ?? (isRecord(binding.input) ? binding.input : {});
    return { ...binding, input: { ...base, ...(isRecord(binding.input) ? binding.input : {}), ...picked } };
  };
  const sections = Array.isArray(declared.sections) ? declared.sections.map(section => {
    if (!isRecord(section)) return section;
    const bindings = isRecord(section.bindings)
      ? Object.fromEntries(Object.entries(section.bindings).map(([role, binding]) => [role, bindReadInput(binding)]))
      : section.bindings;
    const actions = Array.isArray(section.actions) ? section.actions.map(action => isRecord(action) && isRecord(action.input)
      ? { ...action, input: Object.fromEntries(Object.entries(action.input).map(([name, binding]) => [name, bindReadInput(binding)])) }
      : action) : section.actions;
    return { ...section, ...(bindings === undefined ? {} : {bindings}), ...(actions === undefined ? {} : {actions}) };
  }) : declared.sections;
  return { ...declared, ...(sources === undefined ? {} : {sources}), ...(sections === undefined ? {} : {sections}) };
}
