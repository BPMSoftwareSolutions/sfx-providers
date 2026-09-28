import {createHash} from 'node:crypto';

const text=v=>typeof v==='string'?v:'';
const list=v=>Array.isArray(v)?v:[];
export const json=(v,fallback={})=>typeof v==='string'&&v?JSON.parse(v):v??fallback;
const tags=v=>list(v).map(t=>text(t?.name??t));
const cells=v=>list(v?.cells??v).map(c=>text(c?.value??c));

// Keep authored prose, examples and step attachments. These are source evidence,
// not instructions to the renderer and not executable authority.
export function gherkinScenario(value={}) {
  return {keyword:text(value.keyword),name:text(value.name),description:text(value.description),tags:tags(value.tags),
    steps:list(value.steps).map(s=>({keyword:text(s.keyword).trim(),keywordType:text(s.keywordType),text:text(s.text),
      ...(s.docString?{docString:{content:text(s.docString.content),mediaType:text(s.docString.mediaType)}}:{}),
      ...(s.dataTable?{dataTable:list(s.dataTable.rows).map(cells)}:{})})),
    examples:list(value.examples).map(e=>({name:text(e.name),description:text(e.description),tags:tags(e.tags),header:cells(e.tableHeader),rows:list(e.tableBody).map(cells)}))};
}

export function featureContext(f) {
  const declared=json(f.definition_json).semantics??{},source=text(f.source_text);
  const actualDigest=source?createHash('sha256').update(source,'utf8').digest('hex'):'';
  if(source&&f.source_content_digest&&actualDigest!==f.source_content_digest)throw Object.assign(new Error('Feature source digest mismatch.'),{code:'CAPABILITY_FEATURE_SOURCE_DIGEST_MISMATCH'});
  // This extracts only the English header, not executable Gherkin semantics.
  // Non-English sources stay intact and use the normalized declaration title.
  const lines=source.replaceAll('\r\n','\n').split('\n'),at=lines.findIndex(l=>/^\s*Feature\s*:/.test(l));
  const heading=at<0?'':lines[at].replace(/^\s*Feature\s*:\s*/,'').trim();
  const narrative=[];
  if(at>=0)for(const line of lines.slice(at+1)){if(/^\s*(?:@|Rule\s*:|Background\s*:|Scenario(?: Outline| Template)?\s*:)/.test(line))break;if(!/^\s*#/.test(line))narrative.push(line.trim());}
  return {title:text(declared.name)||text(f.name),description:text(declared.description),language:text(declared.language)||(/#\s*language\s*:\s*(\S+)/.exec(source)?.[1]??'en'),tags:tags(declared.tags),
    sourceTitle:heading,sourceNarrative:narrative.join('\n').trim(),sourcePath:text(declared.source_path),sourceText:source,
    sourceContentDigest:text(f.source_content_digest)||text(declared.content_digest),sourceContentRef:f.source_content_pk?`source:content_object/${f.source_content_pk}`:'',
    selectionSource:text(f.selection_source),versionBound:['estate_capability_feature','capability_feature'].includes(f.selection_source),
    scenarios:list(json(f.scenarios_json,[])).map(s=>({id:s.scenario_id,versionPk:String(s.scenario_version_pk),ordinal:s.ordinal,definitionDigest:s.definition_digest,
      ...gherkinScenario(json(s.definition_json).semantics?.scenario),sourceRef:`model:scenario_version/${s.scenario_version_pk}`}))};
}

// Closed schema vocabulary: carry field meaning and constraints, never defaults,
// examples or arbitrary payload values embedded in a schema.
export function schemaContext(schema={}) {
  const fields=[];
  const visit=(v,path,required,depth)=>{
    if(typeof v==='boolean'){fields.push({path,type:v?'any value':'no value permitted',description:v?'Boolean true schema':'Boolean false schema',required,reference:'',booleanSchema:v});return;}
    if(!v||typeof v!=='object'||Array.isArray(v))return;
    if(depth>30||fields.length>=10000)throw Object.assign(new Error('Schema context exceeds its structural bound.'),{code:'CAPABILITY_CONTEXT_TOO_LARGE'});
    const field={path,type:Array.isArray(v.type)?v.type.join(' / '):text(v.type),description:text(v.description),required,reference:text(v.$ref)};
    for(const key of ['minLength','maxLength','minimum','maximum','exclusiveMinimum','exclusiveMaximum','minItems','maxItems','minProperties','maxProperties','uniqueItems','additionalProperties','format','pattern'])
      if(['string','number','boolean'].includes(typeof v[key]))field[key]=v[key];
    if(Array.isArray(v.enum))field.enumCount=v.enum.length;
    if('const'in v)field.constantType=v.const===null?'null':typeof v.const;
    fields.push(field);
    for(const [k,child]of Object.entries(v.properties??{}))visit(child,path+'/'+k.replaceAll('~','~0').replaceAll('/','~1'),list(v.required).includes(k),depth+1);
    if(v.items)visit(v.items,path+'/*',false,depth+1);
    for(const key of ['oneOf','anyOf','allOf'])for(const [i,child]of list(v[key]).entries())visit(child,`${path}/${key}/${i}`,false,depth+1);
    for(const [k,child]of Object.entries(v.$defs??v.definitions??{}))visit(child,path+'/$defs/'+k,false,depth+1);
  };
  visit(schema,'$',false,0);
  return {description:text(schema.description),fields};
}

const selectorKeys=['authoritySource','capabilityIdPath','requestPath','namespacePath','scenarioPath','resultPath','resultMode','lineageMode','inputPath','outputPath','transformationId','overlayId','bindingAuthorityId'];
export function bindingContext(config={}) {
  return {selectors:Object.fromEntries(selectorKeys.filter(k=>typeof config[k]==='string').map(k=>[k,config[k]])),
    inputAdmission:config.inputAdmission?schemaContext(config.inputAdmission):null};
}
export function interfaceContext(i) {
  const c=i.configuration??{};
  return {rootScenarioId:text(i.rootScenarioId),platformCapabilityId:text(i.platformCapabilityId),inputType:text(c.input?.type),
    displaySelect:text(c.display?.select),displayAs:text(c.display?.as)};
}
