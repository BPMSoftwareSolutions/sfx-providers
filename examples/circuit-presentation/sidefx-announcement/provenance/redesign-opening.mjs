import {Slide,C} from './redesign-lib.mjs';
export async function buildOpening(){const out=[];let s;
// The cover itself carries the signal grammar.
s=new Slide(1,'SideFX','Capability-governed AI architecture');
s.t('Accelerating\nAI safety',34,168,400,140,45,C.white,true);
s.t('Engineering the boundary\nbetween inference and effect',38,337,385,80,22,C.muted);
s.region(490,176,284,255,'DECLARED CAPABILITY CIRCUIT',C.amber);
s.chip(548,117,169,44,'Capability estate',C.amber,{size:14,pins:2});
s.route([[632,161],[632,205],[624,205],[624,264]],C.amber,{arrow:true});
s.terminal(448,294,'AI',C.blue,{r:27,sub:'Inference provider'});
s.route([[475,294],[597,294]],C.blue,{arrow:true});s.gate(624,294,'',C.violet,26);
s.route([[650,294],[699,294],[699,238],[808,238]],C.green,{arrow:true});s.junction(699,294,C.green);
s.route([[699,294],[699,359],[808,359]],C.green,{arrow:true});
s.socket(805,238,{label:'Binding',height:40});s.socket(805,359,{label:'Binding',height:40});s.route([[821,238],[834,238]],C.green);s.route([[821,359],[834,359]],C.green);
s.chip(841,212,78,51,'Data',C.green,{size:15,pins:3});s.chip(841,333,78,51,'Effect',C.green,{size:15,pins:3});
s.route([[624,320],[624,387],[566,387]],C.red,{arrow:true});s.stop(557,387);s.label('Undeclared route',498,399,158,C.red,11);
s.route([[880,386],[880,445],[510,445]],C.muted,{dash:true,arrow:true,glow:false});s.label('Execution evidence',723,447,170,C.muted,11);
s.legend([['Inference',C.blue],['Authority',C.amber],['Admission',C.violet],['Effect',C.green],['Refusal',C.red]],488);
s.source([]);out.push(s);

s=new Slide(2,'The engineering result','A model proposal resolves against independently declared operational authority');
s.chip(377,123,198,52,'Declared capability',C.amber,{size:17,pins:3});
s.route([[476,175],[476,244]],C.amber,{arrow:true});s.label('Authority',489,192,100,C.amber,13);
s.terminal(106,294,'AI',C.blue,{r:31,sub:'Inference provider',size:17});
s.route([[137,294],[424,294]],C.blue,{arrow:true});s.label('Capability + input',173,254,200,C.blue,18);
s.shape('ROUND_RECTANGLE',263,278,51,33,{fill:C.panel,stroke:C.blue,sw:1});s.line(276,288,300,288,C.blue,1);s.line(276,298,292,298,C.blue,1);
s.gate(476,294,'',C.violet,48);s.t('Resolve',430,281,94,31,17,C.white,true,'center');
s.route([[524,294],[616,294],[616,234],[785,234]],C.green,{arrow:true});s.junction(616,294,C.green);
s.socket(763,234,{label:'Declared binding'});s.route([[785,234],[817,234]],C.green);s.chip(824,205,97,59,'Provider',C.green,{size:15});
s.route([[476,342],[476,409],[694,409]],C.red,{arrow:true});s.stop(705,409);s.t('No declared route',728,388,205,45,16,C.red,true);
s.label('Admitted path',572,200,171,C.green,15);s.label('Refusal outcome',504,421,193,C.red,13);
s.foot('Implemented and demonstrated in retained SideFX runs. Independent evaluation remains the next step.');s.source();out.push(s);

s=new Slide(3,'The traditional effect-control problem','Representative risk pattern: model-selected actions reach a runner with operational authority');
s.region(543,140,359,307,'OPERATIONAL RESOURCES',C.muted);
s.terminal(91,285,'AI',C.blue,{r:31,sub:'Model output',size:18});
s.chip(270,250,151,70,'Tool\nrunner',C.blue,{size:17});
s.route([[122,285],[263,285]],C.blue,{arrow:true});
s.route([[428,285],[514,285],[514,205],[620,205]],C.blue,{arrow:true});
s.route([[514,285],[620,285]],C.blue,{arrow:true});s.junction(514,285,C.blue);
s.route([[514,285],[514,375],[620,375]],C.blue,{arrow:true});
s.chip(653,175,184,60,'Files and state',C.muted,{size:17});s.chip(653,255,184,60,'Network access',C.muted,{size:17});s.chip(653,345,184,60,'Operational service',C.muted,{size:16});
s.socket(615,205,{color:C.blue});s.socket(615,285,{color:C.blue});s.socket(615,375,{color:C.blue});for(const y of [205,285,375])s.route([[631,y],[646,y]],C.blue);
s.route([[177,166],[343,166],[343,240]],C.red,{arrow:true});s.label('Manipulated instructions',140,129,250,C.red,16);
s.route([[435,300],[494,300],[494,390],[605,390]],C.red,{arrow:true,width:1.5});
s.t('Which component owns\nthe authority to act?',44,364,379,71,24,C.white,true);
s.foot('A failure pattern, not a description of every agent. Consequences need controls outside model behavior.');s.source(['S10','S11']);out.push(s);

s=new Slide(4,'A shared engineering direction','Current systems already constrain consequences outside probabilistic model behavior');
const centers=[175,481,787];
s.t('OpenAI',74,130,220,33,21,C.blue,true,'center');s.t('Anthropic',372,130,220,33,21,C.violet,true,'center');s.t('SideFX',677,130,220,33,21,C.amber,true,'center');
// Three distinct small mechanism topologies, with neutral comparison scope.
s.terminal(85,235,'AI',C.blue,{r:20});s.route([[105,235],[153,235]],C.blue,{arrow:true});s.gate(175,235,'',C.violet,20);s.route([[195,235],[249,235],[249,310]],C.green,{arrow:true});s.socket(249,318,{height:33});s.route([[175,255],[175,352],[123,352]],C.red);s.stop(114,352);
s.region(375,196,213,181,'CONTAINMENT BOUNDARY',C.violet);s.terminal(423,273,'AI',C.blue,{r:21});s.route([[444,273],[489,273]],C.blue);s.gate(507,273,'',C.violet,18);s.route([[525,273],[576,273]],C.green,{arrow:true});s.socket(578,273,{height:38});s.route([[507,291],[507,344]],C.red);s.stop(507,352);
s.chip(716,185,143,42,'Declared estate',C.amber,{size:12,pins:2});s.route([[787,227],[787,270]],C.amber,{arrow:true});s.gate(787,294,'',C.violet,22);s.route([[691,294],[765,294]],C.blue,{arrow:true});s.route([[809,294],[880,294],[880,360]],C.green,{arrow:true});s.socket(880,360,{height:33});s.route([[787,316],[787,365],[727,365]],C.red);s.stop(718,365);
s.t('Consequence controls',63,403,240,35,18,C.white,true,'center');s.t('Process containment',361,403,240,35,18,C.white,true,'center');s.t('Declared effect paths',667,403,240,35,18,C.white,true,'center');
s.foot('Mechanism-level context. These schematic summaries do not rank complete products or establish novelty.');s.source(['S10','S11']);out.push(s);

s=new Slide(5,'The SideFX capability circuit','Recorded agent lane: inference returns proposal data to independently declared resolution');
s.region(119,202,638,234,'AGENT SCENARIO',C.violet);
s.chip(451,123,208,48,'Capability estate',C.amber,{size:17,pins:3});
s.route([[555,171],[555,191],[324,191],[324,249]],C.amber,{arrow:true,width:1.4});
s.route([[555,191],[512,191],[512,246]],C.amber,{arrow:true,width:1.4});s.junction(555,191,C.amber,3);
s.route([[555,191],[790,191],[790,227]],C.amber,{arrow:true,width:1.4});s.label('Declarations and bindings',671,148,249,C.amber,12);
s.terminal(64,273,'IN',C.blue,{r:20,sub:'Objective',size:12});
s.chip(139,244,120,58,'Build request',C.violet,{size:14,pins:2});s.route([[84,273],[132,273]],C.blue,{arrow:true});s.route([[266,273],[324,273]],C.blue,{arrow:true});
s.socket(324,273,{color:C.blue,height:41});s.route([[324,293],[324,351]],C.blue,{arrow:true});
s.chip(263,353,126,52,'Inference\nprovider',C.blue,{size:14,pins:2});
s.route([[396,379],[435,379],[435,273],[486,273]],C.blue,{arrow:true});s.label('Proposal',393,310,94,C.blue,11);
s.gate(512,273,'',C.violet,25);s.t('Resolve',473,304,83,26,13,C.violet,true,'center');
s.route([[537,273],[588,273],[588,247],[617,247]],C.green,{arrow:true});
s.chip(624,218,111,58,'Market-price\ncapability',C.green,{size:13,pins:2});s.route([[742,247],[827,247]],C.green,{arrow:true});s.socket(790,247,{height:38});s.chip(835,218,87,58,'Market\ndata',C.green,{size:13,pins:2});
s.route([[879,276],[879,302],[712,302],[712,276]],C.green,{arrow:true,width:1.5});s.route([[665,276],[665,308]],C.green,{arrow:true});s.terminal(665,335,'OUT',C.green,{r:23,size:11});s.label('Price evidence',704,340,181,C.green,12);
s.route([[512,298],[512,411],[672,411]],C.red,{arrow:true});s.terminal(699,411,'OUT',C.red,{r:23,size:11});s.label('CAPABILITY_NOT_FOUND',730,399,212,C.red,12);
s.label('ADMITTED',562,278,132,C.green,11);s.label('REFUSED',524,374,117,C.red,11);
s.route([[91,453],[902,453]],C.muted,{dash:true,glow:false});s.route([[450,273],[450,453]],C.muted,{dash:true,glow:false,width:1});s.route([[759,335],[759,453]],C.muted,{dash:true,glow:false,width:1});s.label('Addressed execution testimony',92,428,290,C.muted,11);
s.foot('Semantic projection of the retained lane. Admission and refusal traces come from different dated configurations.');s.source();out.push(s);

s=new Slide(6,'Two requests, different declared paths','The visible difference is the effect path that the estate can resolve');
s.label('18 SEPTEMBER 2026',43,124,250,C.muted,12);s.t('Resolve a market price',44,148,424,39,24,C.white,true);
s.label('19 SEPTEMBER 2026',521,124,250,C.muted,12);s.t('Buy $1,000 of Broadcom',522,148,424,39,24,C.white,true);
s.line(487,135,487,438,C.grid,1);
for(const [x,ok] of [[55,true],[533,false]]){s.terminal(x+28,272,'AI',C.blue,{r:22});s.route([[x+50,272],[x+159,272]],C.blue,{arrow:true});s.gate(x+181,272,'',C.violet,23);s.chip(x+127,202,111,35,'Estate',C.amber,{size:12,pins:2});s.route([[x+182,237],[x+182,249]],C.amber,{arrow:true});if(ok){s.route([[x+204,272],[x+269,272],[x+269,228],[x+346,228]],C.green,{arrow:true});s.socket(x+292,228,{height:34});s.chip(x+355,203,61,50,'Data',C.green,{size:12,pins:2});s.route([[x+386,253],[x+386,355],[x+198,355]],C.green,{arrow:true});s.terminal(x+175,355,'OUT',C.green,{r:23,sub:'Price evidence',size:11});s.label('ADMITTED',x+219,296,150,C.green,13);}else{s.route([[x+181,295],[x+181,355],[x+323,355]],C.red,{arrow:true});s.stop(x+334,355);s.label('REFUSED',x+214,293,155,C.red,13);s.label('Trade path never entered',x+91,390,345,C.red,17);}}
s.foot('Separate retained runs and host configurations, not a matched comparison.');s.source();out.push(s);

s=new Slide(7,'A proposal cannot create its own route','Observed refusal: buy_stock reached capability resolution, then the trade path stopped');
s.terminal(85,274,'AI',C.blue,{r:27});s.route([[112,274],[415,274]],C.blue,{arrow:true});
s.t('capability: buy_stock\ninput: AVGO',147,211,257,60,19,C.blue,true);
s.chip(367,135,181,52,'Capability estate',C.amber,{size:16});s.route([[458,187],[458,230]],C.amber,{arrow:true});
s.gate(458,274,'',C.violet,43);s.t('declared?',414,261,89,34,15,C.white,true,'center');
s.route([[501,274],[669,274]],C.red,{arrow:true});s.stop(683,274);s.t('No declared\ntrade path',718,238,200,65,22,C.red,true);
s.route([[458,317],[458,379],[595,379]],C.red,{arrow:true});s.terminal(621,379,'OUT',C.red,{r:26,size:11});
s.t('declared: false',326,400,210,35,17,C.red,true);s.t('CAPABILITY_NOT_FOUND',667,364,265,48,17,C.white,true);
s.label('Inference and refusal processing still execute',72,383,284,C.muted,13);
s.foot('Retained trace, 19 September 2026. Refusal code: CAPABILITY_NOT_FOUND. Outer outcome variant: TERMINAL.');s.source();out.push(s);

s=new Slide(8,'Inside a declared capability','Input and Outcome remain explicit while Event resolves into a deeper execution circuit');
s.region(171,154,624,291,'EVENT: EXECUTION AUTHORITY',C.violet);
s.terminal(71,278,'IN',C.blue,{r:25,sub:'Input',size:12});s.terminal(883,278,'OUT',C.green,{r:25,sub:'Outcome',size:11});
s.route([[96,278],[190,278]],C.blue,{arrow:true});s.gate(213,278,'',C.violet,23);s.label('Admit input',163,306,134,C.violet,12);
s.route([[236,278],[310,278]],C.green,{arrow:true});s.gate(333,278,'',C.amber,23);s.label('Resolve authority',270,306,166,C.amber,12);
s.route([[356,278],[405,278]],C.green,{arrow:true});s.gate(424,278,'',C.violet,19);
s.route([[424,259],[424,212],[519,212]],C.green,{arrow:true});s.chip(526,190,124,44,'Nested scenario',C.green,{size:12,pins:2});
s.route([[424,297],[424,375],[519,375]],C.green,{arrow:true,dash:true});s.socket(493,375,{height:35});s.chip(526,350,124,50,'Provider',C.green,{size:14,pins:2});
s.route([[657,212],[692,212],[692,278]],C.green,{arrow:true});s.route([[657,375],[692,375],[692,278]],C.green,{arrow:true});s.junction(692,278,C.green);
s.route([[692,278],[727,278]],C.green,{arrow:true});s.gate(750,278,'',C.violet,23);s.route([[773,278],[858,278]],C.green,{arrow:true});s.label('Admit outcome',706,306,158,C.violet,12);
s.route([[213,301],[213,392]],C.red,{arrow:true});s.stop(213,403);s.label('Input rejected',157,414,148,C.red,11);
s.route([[333,301],[333,392]],C.red,{arrow:true});s.stop(333,403);s.label('No authority',279,414,139,C.red,11);
s.label('Variant A',433,183,96,C.green,11);s.label('Variant B',428,400,104,C.green,11);s.label('Selected result',657,236,168,C.muted,11);
s.foot('Illustrative Event decomposition using supported constructs. The depicted branches are alternatives, not parallel work.');s.source();out.push(s);

s=new Slide(9,'Provider bindings make effects explicit','The binding joins declared circuit meaning to a specific physical implementation');
s.region(42,185,270,235,'CAPABILITY CIRCUIT',C.violet);s.chip(87,258,171,66,'Provider operation',C.violet,{size:17,pins:4});
s.region(661,185,258,235,'PHYSICAL REALIZATION',C.green);s.chip(699,258,181,66,'HTTP provider',C.green,{size:17,pins:4});
// Large keyed connector with independent contract lanes.
s.shape('ROUND_RECTANGLE',416,177,121,270,{fill:C.plane,stroke:C.amber,sw:1.4});s.t('BINDING',417,187,118,31,15,C.amber,true,'center');
const pinRows=[239,287,335,383],names=['Endpoint + method','Credential reference','Request constraints','Response bounds'];
pinRows.forEach((y,i)=>{s.shape('RECTANGLE',398,y-6,36,12,{fill:C.bg,stroke:C.amber,sw:1});s.shape('RECTANGLE',521,y-6,36,12,{fill:C.bg,stroke:C.amber,sw:1});s.route([[434,y],[521,y]],C.amber,{width:1.4,dash:true});s.junction(477,y,C.amber,3);s.t(names[i],312,y-31,316,28,13,C.white,true,'center');});
s.route([[172,258],[172,153],[790,153],[790,258]],C.green,{width:2.5,arrow:true});s.route([[477,177],[477,153]],C.amber,{width:1.5,dash:true});s.junction(477,153,C.green,4);s.label('Bounded dispatch',632,118,223,C.green,13);
s.route([[790,324],[790,445],[172,445],[172,324]],C.muted,{width:1.3,dash:true,glow:false,arrow:true});
s.label('Request',65,217,97,C.violet,14);s.label('Candidate response',679,357,227,C.green,14);
s.foot('The provider response still needs outcome admission. Provider implementation and credentials remain trusted boundaries.');s.source();out.push(s);

s=new Slide(20,'An open engineering challenge','A concrete architecture and retained evidence for independent scrutiny');
s.region(310,141,364,284,'SIDEFX CAPABILITY CIRCUIT',C.amber);
s.chip(411,165,164,45,'Declared authority',C.amber,{size:14});s.route([[493,210],[493,255]],C.amber,{arrow:true});
s.gate(493,281,'',C.violet,26);s.route([[354,281],[467,281]],C.blue,{arrow:true});s.terminal(330,281,'IN',C.blue,{r:23,size:11});
s.route([[519,281],[598,281],[598,232],[680,232]],C.green,{arrow:true});s.socket(668,232,{height:38});s.route([[598,281],[598,355],[680,355]],C.green,{arrow:true});s.socket(668,355,{height:38});s.junction(598,281,C.green);
s.route([[493,307],[493,375],[401,375]],C.red,{arrow:true});s.stop(390,375);
s.route([[204,183],[287,183],[287,281],[307,281]],C.blue,{dash:true,arrow:true});s.label('Challenge\nthe boundary',36,143,234,C.white,23);
s.route([[684,232],[790,232],[790,182]],C.green,{dash:true,arrow:true});s.label('Reproduce\nthe evidence',730,119,216,C.white,23);
s.route([[684,355],[790,355],[790,413]],C.amber,{dash:true,arrow:true});s.label('Extend\nthe architecture',730,416,219,C.white,21);
s.t('Proposed first step:\njoint reproduction and adversarial evaluation',37,376,267,77,18,C.muted);
s.foot('An invitation to OpenAI, Anthropic, public institutions and independent researchers.');s.source();out.push(s);
return out;}
