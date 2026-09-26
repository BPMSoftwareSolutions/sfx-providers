import {Slide,C,sources} from './redesign-lib.mjs';

const src=id=>sources.find(s=>s.id===id);
function rail(s,x1,x2,y,color=C.violet){s.route([[x1,y],[x2,y]],color,{width:1.25,dash:true,glow:false});for(const x of [x1,x2])s.port(x,y,color,3);}
function tag(s,text,x,y,w=140,color=C.muted){s.t(text,x,y,w,27,11,color,true);}

function vocabulary(){
 const s=new Slide(21,'Capability vocabulary','Zoom from the operable estate into a circuit, a binding, a provider and its evidence.');
 s.region(42,137,874,303,'CAPABILITY ESTATE',C.amber);
 s.region(72,182,252,213,'CAPABILITY A',C.green);
 s.region(342,182,302,213,'CAPABILITY B · EXPANDED SCENARIO CIRCUIT',C.blue);
 s.chip(104,224,174,64,'Input → Event\n→ Outcome',C.green,{size:16});
 s.route([[191,295],[191,334],[300,334],[300,266],[350,266]],C.green,{arrow:true});
 s.terminal(376,266,'IN',C.blue,{r:20,size:11});
 s.route([[397,266],[425,266]],C.blue,{arrow:true});
 s.chip(433,235,119,63,'Event',C.blue,{size:19});
 s.route([[559,266],[588,266]],C.green,{arrow:true});
 s.terminal(610,266,'OUT',C.green,{r:20,size:10});
 s.route([[493,235],[493,210],[695,210],[695,264]],C.green,{arrow:true});
 s.socket(695,285,{color:C.green,height:44});
 s.route([[711,285],[750,285]],C.green,{arrow:true});
 s.chip(759,250,124,71,'Provider',C.violet,{size:16});
 s.route([[821,321],[821,349],[514,349],[514,298]],C.blue,{arrow:true});
 tag(s,'Candidate result',618,349,154,C.blue);
 s.route([[822,327],[822,418],[192,418]],C.violet,{dash:true,width:1.2});
 s.route([[490,365],[490,418]],C.violet,{dash:true,width:1.2});
 s.junction(490,418,C.violet,3);s.junction(822,418,C.violet,3);
 tag(s,'Evidence · addressed observations',430,413,242,C.violet);
 s.label('A capability can compose\nother capability circuits.',95,354,200,C.muted,12);
 s.label('Binding',655,308,85,C.green,12);
 s.label('Physical realization',738,219,151,C.violet,12);
 s.foot('Illustrative composition. A business capability is not automatically an unforgeable security token.');
 s.source(['S03']);return s;
}

function retainedTraces(){
 const s=new Slide(22,'Two retained traces, two selected paths','A shared simplified lane drawing. These are separate dated runs with different configurations.');
 const lane=(y,date,refused)=>{
  const color=refused?C.red:C.green;
  s.region(40,y,878,145,date,C.muted);
  s.terminal(79,y+76,'IN',C.blue,{r:17,size:10});
  s.chip(123,y+50,113,51,'Inference',C.blue,{size:13});
  s.route([[96,y+76],[116,y+76]],C.blue,{arrow:true});
  s.route([[243,y+76],[325,y+76]],C.blue,{arrow:true});
  s.label(refused?'buy_stock / AVGO':'Model response',250,y+34,160,C.blue,11);
  s.gate(351,y+76,'ROUTE',C.amber,24);
  s.route([[351,y+23],[351,y+49]],C.amber,{dash:true,width:1.5});
  tag(s,'Declared resolution',390,y+12,171,C.amber);
  s.route([[379,y+76],[420,y+76],[420,y+49],[533,y+49]],refused?C.grid:C.green,{arrow:true,glow:!refused});
  s.chip(541,y+28,129,43,refused?'Unentered child':'Price circuit',refused?C.muted:C.green,{size:12,pins:2});
  s.socket(704,y+49,{color:refused?C.muted:C.green,height:30});
  s.route([[677,y+49],[688,y+49]],refused?C.grid:C.green,{glow:!refused});
  s.route([[720,y+49],[756,y+49]],refused?C.grid:C.green,{arrow:true,glow:!refused});
  s.terminal(778,y+49,'P',refused?C.muted:C.green,{r:17,size:12});
  s.label(refused?'No business dispatch':'Price evidence returned',684,y+78,220,refused?C.muted:C.green,12);
  s.route([[351,y+102],[351,y+118],[534,y+118]],refused?C.red:C.grid,{arrow:true,glow:refused});
  s.terminal(555,y+118,'R',refused?C.red:C.muted,{r:15,size:10});
  s.t(refused?'REFUSED · CAPABILITY_NOT_FOUND':'ADMITTED · price route selected',589,y+105,316,32,12,color,true);
  tag(s,refused?'declared: false':'Existing capability',235,y+105,175,C.amber);
  if(!refused)s.route([[804,y+49],[868,y+49],[868,y+128]],C.muted,{dash:true,width:1,glow:false});
  if(refused)s.stop(467,y+49,C.red);
 };
 lane(132,'E02 · 18 SEPTEMBER 2026 · OBSERVED',false);
 lane(301,'E03 · 19 SEPTEMBER 2026 · OBSERVED',true);
 s.foot('Inference and refusal processing did run. CAPABILITY_NOT_FOUND is refusal evidence; no trade child ran.');
 s.source([]);return s;
}

function boundaries(){
 const s=new Slide(23,'Trust and enforcement boundaries','Conditions for the claim: inspect the authority, every effect path, the provider and the input scope.');
 s.region(228,173,530,230,'SIDEFX-CONTROLLED EXECUTION PATH',C.blue);
 s.chip(388,130,183,50,'Authority estate',C.amber,{size:15,pins:2});
 s.route([[478,180],[478,222]],C.amber,{dash:true,arrow:true});
 s.gate(292,286,'INPUT',C.blue,24);
 s.chip(395,256,166,65,'Circuit +\nresolution',C.green,{size:16});
 s.socket(632,289,{color:C.green,height:44});
 s.chip(777,259,124,62,'Provider',C.violet,{size:15});
 s.terminal(179,285,'IN',C.blue,{r:20,size:11});
 s.route([[199,285],[266,285]],C.blue,{arrow:true});
 s.route([[317,286],[388,286]],C.green,{arrow:true});
 s.route([[568,289],[615,289]],C.green,{arrow:true});
 s.route([[648,289],[770,289]],C.green,{arrow:true});
 s.route([[838,321],[838,371],[478,371],[478,321]],C.blue,{arrow:true});
 s.route([[200,285],[208,413],[850,413],[850,341]],C.red,{dash:true,width:1.3,glow:false});
 s.gate(686,413,'?',C.red,17);tag(s,'Bypass analysis',511,416,145,C.red);
 s.label('01  Protect authority',36,132,229,C.amber,16);
 s.label('Who can change declarations?',39,160,237,C.muted,12);
 s.route([[244,153],[367,153]],C.amber,{dash:true,width:1,glow:false});
 s.label('02  Mediate every path',610,131,292,C.blue,16);
 s.label('No unexamined route to an effect',610,159,290,C.muted,12);
 s.label('04  Input scope',35,344,168,C.blue,15);
 s.label('Caller, input\nand resource',35,375,147,C.muted,12);
 s.route([[225,364],[261,364],[292,311]],C.blue,{dash:true,width:1,glow:false});
 s.label('03  Assess provider behavior',591,212,320,C.violet,15);
 s.foot('Conditions to evaluate, not completed assurances. The dotted bypass is a test target, not an observed exploit.');
 s.source(['S01','S02']);return s;
}

function recovery(){
 const s=new Slide(24,'Remote effect and lost response','A remote provider and the runtime can disagree about what is known after a lost response.');
 s.region(43,135,362,272,'RUNTIME',C.blue);s.region(555,135,362,272,'REMOTE PROVIDER',C.violet);
 s.chip(85,186,181,67,'Request\nissued',C.blue,{size:18});
 s.chip(659,184,174,72,'Effect\nperformed',C.green,{size:18});
 s.socket(483,219,{color:C.green,height:44});
 s.route([[273,219],[467,219]],C.green,{arrow:true});
 s.route([[499,219],[652,219]],C.green,{arrow:true});
 s.label('Request',375,186,102,C.green,13);
 s.route([[746,256],[746,301],[564,301]],C.blue,{arrow:true});
 s.route([[521,301],[467,301]],C.red,{dash:true,width:2,glow:false});
 s.stop(539,301,C.red);
 s.label('Lost reply',501,320,128,C.red,13);
 s.route([[436,301],[331,301]],C.blue,{dash:true,arrow:true,glow:false});
 s.gate(309,301,'?',C.amber,24);
 s.label('State: unknown',94,283,189,C.amber,18);
 s.route([[309,326],[309,355],[160,355]],C.amber,{arrow:true});
 s.chip(80,336,99,45,'Reconcile',C.amber,{size:12,pins:2});
 s.route([[128,336],[128,270],[483,270],[483,163],[745,163],[745,184]],C.amber,{dash:true,arrow:true,width:1.5});
 s.label('Query provider state',295,139,202,C.amber,12);
 s.terminal(605,351,'ID',C.violet,{r:17,size:11});
 s.label('Idempotency',630,337,128,C.violet,12);
 s.label('Retry / compensation\nrequires declared semantics',725,335,177,C.muted,11);
 s.route([[128,381],[128,432],[841,432]],C.violet,{dash:true,width:1.2,glow:false});
 s.route([[746,381],[746,432]],C.violet,{dash:true,width:1.2,glow:false});
 tag(s,'Evidence records the uncertainty',377,414,280,C.violet);
 s.foot('Illustrative recovery obligations. A database rollback cannot automatically reverse a remote effect.');
 s.source(['S08','S09']);return s;
}

function adjacent(){
 const s=new Slide(25,'Adjacent engineering mechanisms','Two architectural compositions with explicit enforcement outside the model.');
 s.region(41,131,876,151,'CaMeL · RESEARCH ARCHITECTURE',C.blue);
 s.terminal(88,215,'Q',C.blue,{r:19,size:13});
 s.label('Trusted query',44,241,116,C.muted,11);
 s.chip(165,190,126,52,'Generated\nplan',C.blue,{size:14,pins:2});
 s.route([[108,215],[158,215]],C.blue,{arrow:true});
 s.chip(428,191,148,52,'Interpreter',C.green,{size:15,pins:2});
 s.route([[298,215],[421,215]],C.blue,{arrow:true});
 s.chip(324,146,100,38,'Data tags',C.amber,{size:11,pins:2});
 s.route([[374,184],[374,265],[502,265],[502,243]],C.amber,{dash:true,arrow:true,width:1.3});
 s.gate(651,216,'POLICY',C.amber,25);
 s.route([[583,216],[625,216]],C.green,{arrow:true});
 s.route([[677,216],[739,216]],C.green,{arrow:true});
 s.chip(747,191,124,52,'Tool',C.violet,{size:16,pins:2});
 s.label('Provenance + allowed readers',550,252,269,C.amber,11);
 s.region(41,304,876,145,'SIDEFX · CAPABILITY ESTATE COMPOSITION',C.green);
 s.terminal(88,381,'P',C.blue,{r:19,size:13});s.label('Proposal',54,406,109,C.muted,11);
 s.chip(169,356,151,54,'Declared\ncircuit',C.green,{size:15,pins:2});
 s.route([[108,381],[162,381]],C.blue,{arrow:true});
 s.chip(390,328,134,45,'Estate',C.amber,{size:14,pins:2});
 s.route([[457,373],[457,422],[245,422],[245,410]],C.amber,{dash:true,width:1.5,arrow:true});
 s.socket(577,382,{color:C.green,height:42});
 s.route([[327,382],[562,382]],C.green,{arrow:true});
 s.route([[593,382],[739,382]],C.green,{arrow:true});
 s.chip(747,357,124,52,'Provider',C.violet,{size:15,pins:2});
 s.label('Binding',536,410,105,C.green,11);
 s.route([[809,409],[809,435],[245,435]],C.violet,{dash:true,width:1.2,glow:false});
 s.foot('Compare stated assumptions and attack coverage. Differences in terminology are not a novelty finding.');
 s.source(['S15','S10']);return s;
}

function principles(){
 const s=new Slide(26,'Established principles become testable obligations','Attach each engineering question to the part of the circuit it examines.');
 s.chip(369,138,221,54,'Formal refinement',C.amber,{size:17,pins:2});
 s.label('Invariant preserved?',515,214,226,C.amber,13);
 s.chip(78,250,181,62,'Least authority',C.blue,{size:16});
 s.label('Minimum required reach?',59,317,234,C.blue,13);
 s.chip(697,250,182,62,'Runtime\nassurance',C.red,{size:16});
 s.label('Unsafe effect rejected?',676,317,244,C.red,13);
 s.chip(388,263,185,66,'Capability\ncircuit',C.green,{size:18});
 s.chip(370,386,221,54,'Provenance',C.violet,{size:18,pins:2});
 s.label('Request → authority → outcome',354,447,268,C.violet,10.5);
 s.route([[481,192],[481,244]],C.amber,{dash:true,arrow:true,width:1.5});
 s.route([[266,282],[313,282]],C.blue,{arrow:true});s.socket(338,282,{color:C.blue,height:40});
 s.route([[354,282],[381,282]],C.blue,{arrow:true});
 s.route([[580,296],[622,296]],C.green,{arrow:true});s.gate(647,296,'CHECK',C.red,23);
 s.route([[671,296],[690,296]],C.green,{arrow:true});
 s.route([[647,320],[647,354],[729,354]],C.red,{arrow:true});s.stop(748,354,C.red);
 s.route([[481,329],[481,386]],C.violet,{dash:true,width:1.5,arrow:true});
 s.route([[171,346],[171,366],[392,366]],C.violet,{dash:true,width:1,glow:false});
 s.route([[789,346],[789,366],[568,366]],C.violet,{dash:true,width:1,glow:false});
 s.foot('Analytical correspondences. Conformance, certification and formal guarantees require their own evidence.');
 s.source(['S03','S04','S06','S09']);return s;
}

function atlasNode(s,id,x,y,w,label,detail,color){
 const item=src(id);s.terminal(x,y,id,color,{r:17,size:10});
 s.t(label,x+24,y-17,w,39,14,C.white,true,'left',item.url);
 s.t(detail,x+24,y+23,w,30,10.5,C.muted);
}

function protectionSources(){
 const s=new Slide(27,'Primary-source atlas: protection and assurance','Click the source names. Full titles, dates and claim limits remain in the speaker notes.');
 s.region(40,134,281,316,'PROTECTION',C.blue);s.region(339,134,279,316,'SPECIFICATION',C.amber);s.region(638,134,280,316,'ASSURANCE',C.violet);
 rail(s,66,886,427,C.muted);
 s.route([[72,179],[72,409],[478,409],[478,428]],C.blue,{width:1.1,glow:false});
 s.route([[370,179],[370,393],[478,393],[478,428]],C.amber,{width:1.1,glow:false});
 s.route([[668,179],[668,409],[478,409]],C.violet,{width:1.1,glow:false});
 atlasNode(s,'S01',72,194,213,'Protection principles','Saltzer & Schroeder · 1975',C.blue);
 atlasNode(s,'S02',72,289,213,'Reference monitor','NIST · definition',C.blue);
 atlasNode(s,'S03',72,384,213,'CHERI capabilities','Cambridge · project FAQ',C.blue);
 atlasNode(s,'S04',370,218,211,'Safety + refinement','Leslie Lamport · 2019',C.amber);
 atlasNode(s,'S05',370,342,211,'Dafny contracts','Dafny · maintained guide',C.amber);
 atlasNode(s,'S06',668,218,211,'Runtime assurance','Hook et al. / NASA · 2016',C.violet);
 atlasNode(s,'S07',668,342,211,'Assurance cases','NASA · 2025',C.violet);
 s.junction(478,427,C.green,5);
 s.foot('Primary sources reviewed 26 Sep 2026. These establish principles, not certification of SideFX.');
 s.source([]);s.refs=['S01','S02','S03','S04','S05','S06','S07'];return s;
}

function systemsSources(){
 const s=new Slide(28,'Primary-source atlas: systems and cooperation','Engineering practice, agent research and international risk-management context.');
 s.region(40,134,281,316,'SYSTEMS',C.green);s.region(339,134,279,316,'AGENT ENGINEERING',C.blue);s.region(638,134,280,316,'RISK + COOPERATION',C.amber);
 rail(s,68,884,429,C.muted);
 s.route([[73,182],[73,410],[477,410],[477,429]],C.green,{width:1.1,glow:false});
 s.route([[370,181],[370,410]],C.blue,{width:1.1,glow:false});
 s.route([[668,181],[668,410],[477,410]],C.amber,{width:1.1,glow:false});
 atlasNode(s,'S08',72,218,215,'Transactions','PostgreSQL · documentation',C.green);
 atlasNode(s,'S09',72,343,215,'PROV provenance','W3C · 2013',C.green);
 atlasNode(s,'S10',370,190,211,'Agent security','OpenAI · March 2026',C.blue);
 atlasNode(s,'S11',370,287,211,'Containment','Anthropic · May 2026',C.blue);
 atlasNode(s,'S15',370,384,211,'CaMeL','Debenedetti et al. · 2025 v2',C.blue);
 atlasNode(s,'S12',668,190,213,'AI RMF 1.0','NIST · 2023',C.amber);
 atlasNode(s,'S13',668,287,213,'Global Digital Compact','United Nations · 2024',C.amber);
 atlasNode(s,'S14',668,384,213,'Scientific Panel on AI','United Nations · est. 2025',C.amber);
 s.junction(477,429,C.violet,5);
 s.foot('References, not endorsements. Primary-source links retained; accessed 26 Sep 2026.');
 s.source([]);s.refs=['S08','S09','S10','S11','S12','S13','S14','S15'];return s;
}

function evidenceIndex(){
 const s=new Slide(29,'Open the evidence, inspect the circuit','A retained local evidence package, organized around the mechanisms and runs it records.');
 s.region(44,131,872,313,'EVIDENCE CABINET · SOURCE + OBSERVATION',C.violet);
 s.chip(374,246,209,61,'Reviewed estate\n+ runtime',C.amber,{size:17});
 s.chip(117,167,185,57,'Declared lane',C.blue,{size:16,pins:2});
 s.terminal(79,196,'E01',C.blue,{r:18,size:10});
 s.route([[309,195],[338,195],[338,264],[367,264]],C.amber,{dash:true,arrow:true});
 s.chip(650,167,203,57,'Mediation\n+ testimony',C.violet,{size:15,pins:2});
 tag(s,'E04–E05',706,227,139,C.violet);
 s.route([[591,264],[616,264],[616,195],[643,195]],C.violet,{dash:true,arrow:true});
 s.chip(117,338,185,61,'Price evidence\nresolved',C.green,{size:15});
 s.terminal(79,368,'E02',C.green,{r:18,size:10});
 s.route([[418,307],[418,367],[309,367]],C.green,{arrow:true});
 s.label('18 Sep 2026',130,405,178,C.green,11);
 s.chip(650,338,203,61,'Purchase\nrefused',C.red,{size:15});
 s.terminal(889,368,'E03',C.red,{r:17,size:10});
 s.route([[541,307],[541,367],[643,367]],C.red,{arrow:true});
 s.label('19 Sep 2026',677,405,176,C.red,11);
 s.chip(374,148,209,46,'Isolation + API',C.muted,{size:15,pins:2});
 tag(s,'E06–E08 · receipts + architecture',371,201,264,C.muted);
 s.route([[479,230],[479,246]],C.amber,{dash:true,width:1.3});
 s.route([[209,399],[209,434],[749,434],[749,399]],C.violet,{dash:true,width:1.2,glow:false});
 s.junction(479,434,C.violet,4);tag(s,'Separate histories, exact artifacts',351,408,260,C.violet);
 s.foot('Exact local paths, dates and source baselines are in notes. Independent reproduction remains the next step.');
 s.source([]);return s;
}

export async function buildAppendix(){
 return [vocabulary(),retainedTraces(),boundaries(),recovery(),adjacent(),principles(),protectionSources(),systemsSources(),evidenceIndex()];
}
