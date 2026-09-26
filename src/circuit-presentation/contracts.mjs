export const REQUEST_ID = 'circuit-presentation-request.v1';
export const OUTPUT_ID = 'circuit-presentation-output.v1';
export const MAX_REQUEST_BYTES = 512 * 1024;
export const MAX_OUTPUT_BYTES = 8 * 1024 * 1024;
const number = { type: 'number', minimum: 0, maximum: 2000 };
const text = { type: 'string', maxLength: 5000 };
const color = { type: 'string', pattern: '^#[0-9a-fA-F]{6}$' };
const paint = { type: 'string', pattern: '^(#[0-9a-fA-F]{6}|none)$' };
const enumOf = (...values) => ({ enum: values });
const object = (properties, required = []) => ({ type: 'object', properties, required, additionalProperties: false });
const options = keys => object(Object.fromEntries(keys.map(k => [k, {
  fill: paint, stroke: paint, color, sw: number, width: number, alpha: { ...number, maximum: 1 },
  sa: { ...number, maximum: 1 }, dash: { type: 'boolean' }, arrow: { type: 'boolean' },
  glow: { type: 'boolean' }, size: number, sub: text, label: text, height: number,
  pins: { type: 'integer', minimum: 1, maximum: 12 }, r: number,
  routing: { enum: ['orthogonal', 'forward'] },
}[k]])));
const point = { type: 'array', prefixItems: [number, number], minItems: 2, maxItems: 2 };
const array = (items, maxItems = 128) => ({ type: 'array', items, maxItems });
// Positional arguments match the public Slide methods. No dynamic member access.
export const operations = {
  shape: [5, [enumOf('RECTANGLE','ROUND_RECTANGLE','ELLIPSE','DIAMOND','HEXAGON'),number,number,number,number,options(['fill','stroke','sw','alpha','sa'])]],
  t: [5, [text,number,number,number,number,number,color,{type:'boolean'},enumOf('left','center','right'),{oneOf:[{type:'string',format:'http-url'},object({slideIndex:{type:'integer',minimum:0,maximum:255}},['slideIndex'])]}]],
  line: [4, [number,number,number,number,color,number,options(['dash','alpha','arrow'])]],
  route: [1, [{...array(point),minItems:2},color,options(['width','dash','arrow','glow','routing'])]],
  port: [2, [number,number,color,number]], junction: [2, [number,number,color,number]],
  stop: [2, [number,number,color]], gate: [2, [number,number,text,color,number]],
  chip: [5, [number,number,number,number,text,color,options(['size','sub','pins'])]],
  socket: [2, [number,number,options(['color','label','height'])]],
  terminal: [3, [number,number,text,color,options(['sub','r','size'])]],
  region: [5, [number,number,number,number,text,color]],
  label: [3, [text,number,number,number,color,number]],
  foot: [1, [text]],
  legend: [1, [array({type:'array',prefixItems:[text,color],minItems:2,maxItems:2},8),number]],
  source: [1, [array({type:'string',maxLength:40},8)]],
};
export const commandSchema = { oneOf: Object.entries(operations).map(([op,[min,args]]) => object({op:{const:op},args:{type:'array',prefixItems:args,minItems:min,maxItems:args.length}},['op','args'])) };
export const sourceSchema = object({id:{type:'string',minLength:1,maxLength:40},title:text,shortTitle:text,url:{type:'string',format:'http-url'}},['id','title','url']);
export const deckSchema = object({
  title: {type:'string',minLength:1,maxLength:240},
  startSlideNumber: {type:'integer',minimum:1,maximum:256},
  sources: array(sourceSchema,100),
  slides: {...array(object({title:{type:'string',minLength:1,maxLength:160},subtitle:text,headerLayout:enumOf('standard','custom'),notes:{type:'string',maxLength:20000},commands:array(commandSchema,500)},['title','commands']),64),minItems:1},
},['title','slides']);
export const requestSchema = {
  $schema: 'https://json-schema.org/draft/2020-12/schema', $id: REQUEST_ID,
  ...object({contractId:{const:REQUEST_ID},objectPrefix:{type:'string',pattern:'^[A-Za-z][A-Za-z0-9_]{4,30}$'},preset:{const:'sidefx-announcement'},deck:deckSchema},['contractId']),
  oneOf:[{required:['preset']},{required:['deck']}],
};
export const outputSchema = {
  $schema:'https://json-schema.org/draft/2020-12/schema', $id:OUTPUT_ID,
  ...object({contractId:{const:OUTPUT_ID},title:{type:'string'},pageSize:object({width:{const:960},height:{const:540},unit:{const:'PT'}},['width','height','unit']),
    inputDigest:{type:'string',pattern:'^[a-f0-9]{64}$'}, contentDigest:{type:'string',pattern:'^[a-f0-9]{64}$'},
    slides:{type:'array',minItems:1,maxItems:64,items:object({id:{type:'string'},title:{type:'string'},notes:{type:'string'},svg:{type:'string'},requests:{type:'array'}},['id','title','notes','svg','requests'])},
    requests:{type:'array'},
  },['contractId','title','pageSize','inputDigest','contentDigest','slides','requests']),
};

// Geometry constraints complement JSON Schema. A forward route is selected only
// for an unobstructed corridor: it cannot spend length on a reversal or a spike.
// Wrapped rows, recurrence and obstacle detours use the orthogonal policy.
export function validateConnectorRoute(points, routing) {
  if (routing == null) return; // Retained hand-authored diagrams predate this policy.
  const reject = message => { throw Object.assign(new Error(message), {code:'CIRCUIT_CONNECTOR_INVALID'}); };
  if (!['orthogonal','forward'].includes(routing) || !Array.isArray(points) || points.length < 2 ||
      points.some(p => !Array.isArray(p) || p.length !== 2 || !p.every(Number.isFinite))) reject('Connector requires finite points and a supported routing policy.');
  const epsilon = 1e-6;
  let length = 0, bends = 0, previousAxis;
  for (let i=1;i<points.length;i++) {
    const dx=points[i][0]-points[i-1][0],dy=points[i][1]-points[i-1][1];
    if ((Math.abs(dx)>epsilon && Math.abs(dy)>epsilon) || (Math.abs(dx)<=epsilon && Math.abs(dy)<=epsilon)) reject('Connector segments must be nonzero and orthogonal.');
    const axis=Math.abs(dx)>epsilon?'x':'y';
    if(previousAxis && previousAxis!==axis)bends++;
    previousAxis=axis;length+=Math.abs(dx)+Math.abs(dy);
  }
  if (routing==='forward') {
    const start=points[0],end=points.at(-1),distance=Math.abs(end[0]-start[0])+Math.abs(end[1]-start[1]);
    if(end[0]<start[0]-epsilon || length>distance+epsilon || bends>2)
      reject('Forward connector has an unnecessary detour: use a straight segment or at most two bends without backtracking.');
  }
}

// Validator for the schema vocabulary used by these contracts (no eval or refs).
export function validate(value, schema, at = '$') {
  const fail = message => { throw Object.assign(new Error(`${at}: ${message}`),{code:'CIRCUIT_REQUEST_INVALID'}); };
  if (schema.oneOf) {
    const matches = schema.oneOf.filter(sub => {try {validate(value,sub,at);return true;}catch{return false;}});
    if(matches.length!==1) fail('expected exactly one supported request/operation variant');
  }
  if ('const' in schema && value !== schema.const) fail('unexpected constant');
  if (schema.enum && !schema.enum.includes(value)) fail('unsupported value');
  if (schema.required && (!value || schema.required.some(k=>!Object.hasOwn(value,k)))) fail('missing required member');
  if (schema.type === 'object') {
    if (!value || typeof value!=='object' || Array.isArray(value)) fail('expected an object');
    if(schema.additionalProperties===false && Object.keys(value).some(k=>!Object.hasOwn(schema.properties,k))) fail('unknown member');
    for(const [k,s] of Object.entries(schema.properties))if(Object.hasOwn(value,k))validate(value[k],s,`${at}.${k}`);
  } else if(schema.type==='array') {
    if(!Array.isArray(value)||value.length<(schema.minItems??0)||value.length>(schema.maxItems??Infinity))fail('invalid array length');
    value.forEach((item,i)=>{const sub=schema.prefixItems?.[i]??schema.items;if(sub)validate(item,sub,`${at}[${i}]`);});
  } else if(schema.type==='string') {
    if(typeof value!=='string'||value.length<(schema.minLength??0)||value.length>(schema.maxLength??Infinity)||/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(value))fail('invalid text');
    if(schema.pattern&&!new RegExp(schema.pattern).test(value))fail('invalid string format');
    if(schema.format==='http-url'){try{const u=new URL(value);if(!['http:','https:'].includes(u.protocol)||u.username||u.password)fail('expected an HTTP(S) URL without credentials');}catch{fail('invalid source URL');}}
  } else if(schema.type==='number'||schema.type==='integer') {
    if(!Number.isFinite(value)||value<(schema.minimum??-Infinity)||value>(schema.maximum??Infinity)||(schema.type==='integer'&&!Number.isInteger(value)))fail('invalid number');
  } else if(schema.type==='boolean'&&typeof value!=='boolean')fail('expected a boolean');
}
