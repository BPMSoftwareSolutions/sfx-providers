import { Slide, C } from './redesign-lib.mjs';

// Native diagram objects only. Each topology names a mechanism or an evidence relationship.
const device=(s,x,y,w,h,text,color=C.green,size=15)=>s.chip(x,y,w,h,text,color,{size,pins:1});
const txt=(s,text,x,y,w,size=14,color=C.muted,bold=false)=>s.t(text,x,y,w,48,size,color,bold);
const wire=(s,p,color=C.green,opts={})=>s.route(p,color,{arrow:true,...opts});
const track=(s,p,color=C.green,opts={})=>s.route(p,color,{arrow:false,...opts});
const dot=(s,x,y,color=C.green)=>s.junction(x,y,color,4);

export async function buildMiddle(){
  const out=[];

  // 10. One graph viewed through declaration, realization and actual observation.
  {
    const s=new Slide(10,'An effect has an inspectable history','Declared meaning, physical realization and observed execution remain separately addressable');
    s.region(222,130,478,89,'DECLARED GRAPH',C.amber);
    s.region(245,237,455,100,'REALIZED GRAPH',C.green);
    s.region(268,365,432,84,'OBSERVED PATH',C.muted);
    txt(s,'What the\nestate declares',38,149,170,18,C.amber,true);
    txt(s,'Which runtime\nand providers',38,264,190,18,C.green,true);
    txt(s,'What actually\nran and returned',38,380,205,18,C.white,true);
    // Top declaration has alternative branches. Their existence does not assert their execution.
    track(s,[[252,183],[367,183],[467,183]],C.amber);
    track(s,[[467,183],[467,162],[624,162]],C.amber);
    track(s,[[467,183],[467,200],[624,200]],C.amber);
    [252,367,467].forEach(x=>dot(s,x,183,C.amber));
    s.port(624,162,C.amber);s.port(624,200,C.amber);
    device(s,285,268,113,48,'Runtime',C.green,14);
    s.socket(470,292,{color:C.green,height:34});
    device(s,550,268,119,48,'Provider',C.green,14);
    wire(s,[[398,292],[454,292]],C.green);
    wire(s,[[486,292],[543,292]],C.green);
    track(s,[[367,208],[367,240],[342,240],[342,268]],C.amber,{dash:true,glow:false,width:1.2});
    track(s,[[624,207],[624,240],[609,240],[609,268]],C.amber,{dash:true,glow:false,width:1.2});
    track(s,[[300,406],[390,406],[470,406],[590,406],[672,406]],C.muted);
    [300,390,470,590,672].forEach(x=>s.port(x,406,C.muted,4));
    wire(s,[[342,316],[342,347],[390,347],[390,398]],C.muted,{dash:true,glow:false,width:1.2});
    wire(s,[[609,316],[609,347],[590,347],[590,398]],C.muted,{dash:true,glow:false,width:1.2});
    // Addressed observations arrive at a distinct evidence artifact.
    s.shape('RECTANGLE',752,235,163,162,{fill:C.panel,stroke:C.muted,sw:1.2});
    s.shape('RECTANGLE',764,247,139,4,{fill:C.muted,alpha:.55});
    txt(s,'Execution\nevidence',765,260,138,18,C.white,true);
    txt(s,'Graph identity\nProvider exchange\nOutcome + disposition',765,312,141,12,C.muted);
    wire(s,[[680,406],[724,406],[724,350],[752,350]],C.muted);
    s.foot('Schematic overlay. The retained 18 September price execution contains 716 observed cells.');
    s.source();out.push(s);
  }

  // 11. Four declared record classes converge on generic execution, then fan out to bindings.
  {
    const s=new Slide(11,'The estate is operational data','The executor reads declarations before it resolves the provider path');
    s.region(45,140,288,294,'CAPABILITY ESTATE',C.amber);
    const rows=[['Contracts',187],['Scenarios + routing',244],['Execution authority',301],['Provider bindings',358]];
    for(const [name,y] of rows){
      s.shape('RECTANGLE',67,y,239,40,{fill:C.plane,stroke:C.amber,sw:.7});
      s.t(name,78,y+7,222,30,15,C.white);
      s.port(306,y+20,C.amber,3);
      track(s,[[309,y+20],[363,y+20],[363,290]],C.amber,{width:1.5,glow:false});
    }
    dot(s,363,290,C.amber);
    s.gate(414,290,'READ',C.amber,24);
    wire(s,[[363,290],[390,290]],C.amber);
    wire(s,[[438,290],[466,290]],C.amber);
    device(s,473,248,150,84,'Generic\nexecutor',C.green,19);
    txt(s,'Reads declared\nmeaning',451,360,195,15,C.amber);
    track(s,[[630,290],[678,290]],C.green);dot(s,678,290);
    const providers=[['Inference',171,C.blue],['Data',283,C.green],['Other effect',395,C.green]];
    for(const [label,y,color] of providers){
      track(s,[[678,290],[678,y],[724,y]],color,{width:1.8});
      s.socket(732,y,{color,height:34});
      wire(s,[[748,y],[776,y]],color,{width:1.8});
      device(s,783,y-26,125,52,label,color,15);
    }
    txt(s,'Bound providers',731,125,180,14,C.green,true);
    s.foot('Capability meaning remains independent of any one model. Hosts and providers still execute.');
    s.source();out.push(s);
  }

  // 12. Allowed provider seam and denied host paths are separate exits from a host boundary.
  {
    const s=new Slide(12,'The circuit and host boundary work together','Circuit resolution selects a path. Runtime isolation and provider constraints bound its reach');
    s.region(173,143,477,287,'RUNTIME ISOLATION BOUNDARY',C.violet);
    s.region(200,185,421,134,'DECLARED CIRCUIT',C.amber);
    device(s,230,226,110,55,'Input',C.blue,17);
    s.gate(412,254,'PATH',C.amber,23);
    device(s,483,226,108,55,'Executor',C.green,16);
    wire(s,[[340,254],[389,254]],C.blue);
    wire(s,[[435,254],[476,254]],C.green);
    s.socket(663,254,{color:C.green,height:50});
    wire(s,[[598,254],[647,254]],C.green);
    wire(s,[[679,254],[759,254]],C.green);
    device(s,766,217,145,74,'Bound\nprovider',C.green,17);
    txt(s,'Provider constraints',701,148,218,17,C.green,true);
    txt(s,'Endpoint, credentials\nand response bounds',707,178,205,13,C.muted);
    // The blocked path is an actual isolation responsibility, not an absent business capability.
    track(s,[[537,288],[537,378],[638,378]],C.red,{width:2.2});
    s.stop(650,378,C.red);
    track(s,[[666,378],[789,378]],C.red,{dash:true,width:1.2,glow:false});
    s.terminal(828,378,'HOST',C.red,{r:28,size:12});
    txt(s,'Host-write and\nchild-process denial',206,343,280,17,C.violet,true);
    txt(s,'Tested Windows\nAppContainer boundary',205,393,325,12,C.muted);
    s.foot('Retained acceptance: 19 September 2026. Other platforms and deployment forms require evidence.');
    s.source();out.push(s);
  }

  // 13. Familiar principles point to a precise location in one circuit.
  {
    const s=new Slide(13,'Established engineering principles','The principles become visible at the places where proposals enter, paths resolve and effects leave');
    txt(s,'Least privilege',40,129,224,20,C.blue,true);
    txt(s,'Limit the inference provider’s\noperational authority',40,159,230,13,C.muted);
    device(s,65,239,127,65,'Inference\nprovider',C.blue,16);
    wire(s,[[199,272],[274,272]],C.blue);
    s.gate(299,272,'ID',C.amber,24);
    wire(s,[[323,272],[394,272]],C.green);
    s.region(376,222,230,125,'CAPABILITY CIRCUIT',C.amber);
    track(s,[[394,274],[457,274],[492,274]],C.green);dot(s,457,274);
    track(s,[[457,274],[457,318],[563,318]],C.green);
    s.port(492,274,C.green);s.port(563,318,C.green);
    wire(s,[[563,318],[587,318],[587,274],[644,274]],C.green);
    s.gate(667,274,'REQ',C.violet,21);
    s.socket(725,274,{color:C.green,height:42});
    wire(s,[[688,274],[709,274]],C.green);
    wire(s,[[741,274],[774,274]],C.green);
    device(s,781,242,133,65,'Provider',C.green,17);
    txt(s,'Complete mediation',374,130,310,20,C.amber,true);
    txt(s,'Circuit and binding resolve\nbefore provider dispatch',374,160,310,13,C.muted);
    track(s,[[489,205],[489,221]],C.amber,{glow:false,width:1.2});
    // Default refusal is a physical end to the depicted route.
    track(s,[[299,296],[299,349]],C.red);s.stop(299,360,C.red);
    txt(s,'Fail-safe defaults',64,385,300,20,C.red,true);
    txt(s,'Absent capability: no selected business path',64,418,396,13,C.muted);
    txt(s,'Design by contract',565,385,322,20,C.violet,true);
    txt(s,'Input, state and outcome obligations',565,418,350,13,C.muted);
    track(s,[[667,296],[667,365]],C.violet,{glow:false,width:1.2});
    s.foot('Design correspondences. Implementation evidence and adversarial testing establish their strength.');
    s.source();out.push(s);
  }

  // 14. A single compact topology fans into different physical placement configurations.
  {
    const s=new Slide(14,'One capability meaning, multiple realizations','Physical placement changes. The declared capability and its circuit retain their meaning');
    s.region(266,126,427,119,'CAPABILITY MEANING + CIRCUIT',C.amber);
    s.port(295,184,C.blue);wire(s,[[300,184],[342,184]],C.blue);
    s.gate(362,184,'IN',C.violet,18);
    track(s,[[380,184],[447,184]],C.green);dot(s,447,184);
    track(s,[[447,184],[447,159],[543,159]],C.green);
    track(s,[[447,184],[447,214],[543,214]],C.green);
    s.socket(551,159,{height:26,color:C.blue});s.socket(551,214,{height:26,color:C.green});
    track(s,[[567,159],[639,159],[639,184]],C.blue);
    track(s,[[567,214],[639,214],[639,184]],C.green);
    s.terminal(661,184,'OUT',C.green,{r:18,size:10});
    track(s,[[480,245],[480,280]],C.amber);dot(s,480,280,C.amber);
    const places=[{x:46,label:'LOCAL RUNTIME',center:179},{x:351,label:'API SERVICE',center:484},{x:656,label:'REMOTE PROVIDERS',center:789}];
    for(const p of places){
      wire(s,[[480,280],[p.center,280],[p.center,326]],C.amber,{dash:true,width:1.5,glow:false});
      s.region(p.x,326,260,121,p.label,C.muted);
    }
    // Local: the circuit and its provider share a physical boundary.
    device(s,65,365,93,47,'Runtime',C.green,13);s.socket(185,389,{height:29});
    wire(s,[[158,389],[169,389]],C.green,{width:1.7});wire(s,[[201,389],[229,389]],C.green,{width:1.7});
    s.terminal(256,389,'P',C.green,{r:18,size:13});
    // API: the request surface precedes the same circuit.
    s.terminal(383,389,'API',C.blue,{r:19,size:10});wire(s,[[402,389],[426,389]],C.blue,{width:1.7});
    device(s,433,365,89,47,'Circuit',C.green,13);s.socket(553,389,{height:29});
    wire(s,[[529,389],[537,389]],C.green,{width:1.7});wire(s,[[569,389],[587,389]],C.green,{width:1.7});
    s.port(593,389,C.green);
    // Remote: a binding crosses the placement boundary.
    device(s,674,365,83,47,'Circuit',C.green,13);s.socket(786,389,{height:29});
    wire(s,[[764,389],[770,389]],C.green,{width:1.7});wire(s,[[802,389],[838,389]],C.green,{width:1.7});
    s.terminal(871,389,'P',C.green,{r:20,size:14});
    s.foot('Realization options. Implementation and deployment acceptance must be established for each configuration.');
    s.source();out.push(s);
  }

  // 15. Authoring has its own repair and admission loop; it does not bypass runtime authority.
  {
    const s=new Slide(15,'Inference expands the capability estate','Useful discoveries become reusable capabilities through a separate validation and admission process');
    s.region(40,129,877,166,'CANDIDATE / AUTHORING PATH',C.blue);
    device(s,70,178,126,68,'Inference\nproposal',C.blue,16);
    device(s,263,185,128,56,'Candidate\ncapability',C.blue,15);
    wire(s,[[203,212],[256,212]],C.blue);
    s.gate(477,212,'TEST',C.violet,25);wire(s,[[398,212],[452,212]],C.blue);
    s.gate(625,212,'ADMIT',C.amber,25);wire(s,[[502,212],[600,212]],C.violet);
    device(s,758,171,131,82,'Capability\nestate',C.amber,17);
    wire(s,[[650,212],[751,212]],C.amber);
    txt(s,'Validation',434,251,104,13,C.violet);
    txt(s,'Declared change',565,251,155,13,C.amber);
    // Repair feeds the candidate. It cannot write the estate directly.
    track(s,[[477,237],[477,322],[327,322],[327,248]],C.red,{width:1.8});
    s.junction(477,322,C.red,3);
    txt(s,'Revise candidate',351,330,178,12,C.red);
    s.region(65,379,802,69,'OPERATIONAL PATH',C.green);
    s.port(177,421,C.blue);wire(s,[[182,421],[279,421]],C.blue,{width:1.8});
    s.gate(299,421,'IN',C.violet,17);wire(s,[[316,421],[389,421]],C.green,{width:1.8});
    s.t('Declared circuit',392,405,176,30,16,C.white,true);
    track(s,[[566,421],[628,421]],C.green,{width:1.8});dot(s,628,421,C.green);
    s.socket(709,421,{height:27});wire(s,[[628,421],[693,421]],C.green,{width:1.8});
    wire(s,[[725,421],[793,421]],C.green,{width:1.8});s.terminal(816,421,'P',C.green,{r:17,size:12});
    wire(s,[[823,253],[823,354],[628,354],[628,412]],C.amber,{width:1.8});
    txt(s,'Admitted authority',663,321,184,13,C.amber);
    s.foot('Architecture direction. Durable capability may still use an inference provider where uncertainty remains.');
    s.source();out.push(s);
  }

  // 16. Verification is a provider with a stated property and several legitimate return classes.
  {
    const s=new Slide(16,'Formal verification needs a stated property','Candidate invariant: every provider dispatch has a matching admitted circuit and binding');
    s.region(307,151,303,270,'PROPOSED VERIFICATION CIRCUIT',C.violet);
    device(s,50,241,154,82,'Stated property\n+ model',C.amber,17);
    s.socket(262,282,{color:C.violet,height:48});
    wire(s,[[211,282],[246,282]],C.amber);
    wire(s,[[278,282],[344,282]],C.violet);
    device(s,351,227,209,108,'Verification\nprovider',C.violet,21);
    txt(s,'Property, assumptions\nand proof obligations',350,365,242,13,C.muted);
    track(s,[[567,282],[648,282]],C.violet);dot(s,648,282,C.violet);
    const returns=[['Proof',167,C.green],['Counterexample',282,C.red],['Inconclusive',397,C.violet]];
    for(const [label,y,color] of returns){
      wire(s,[[648,282],[648,y],[737,y]],color,{width:2});
      device(s,744,y-27,167,55,label,color,label==='Counterexample'?14:17);
    }
    txt(s,'Declared result classes',663,119,250,13,C.muted);
    s.foot('Proposed extension. Runtime tests, schema checks and hashes are not whole-system formal proofs.');
    s.source();out.push(s);
  }

  // 17. Evidence attaches to mechanisms; the open evaluation branch is visibly different.
  {
    const s=new Slide(17,'What the evidence establishes today','Retained executions and reviewed implementation provide a concrete starting point for independent evaluation');
    device(s,373,137,194,63,'Database authority',C.amber,17);
    wire(s,[[470,200],[470,229]],C.amber);
    s.region(319,229,307,126,'REVIEWED IMPLEMENTATION',C.green);
    s.gate(358,293,'ID',C.violet,19);
    device(s,403,267,116,52,'Resolver',C.green,14);
    wire(s,[[377,293],[396,293]],C.green,{width:1.8});
    track(s,[[526,293],[554,293]],C.green);dot(s,554,293,C.green);
    // Concrete retained results are attached to the observed exit paths.
    wire(s,[[554,293],[639,293],[639,188],[748,188]],C.green);s.socket(667,188,{height:34});
    device(s,755,156,164,65,'Price evidence\nreturned',C.green,15);
    wire(s,[[554,293],[554,335],[714,335],[714,316],[748,316]],C.red);
    device(s,755,284,164,65,'Undeclared\npurchase refused',C.red,14);
    txt(s,'Retained runs',746,122,172,15,C.white,true);
    s.gate(225,294,'HOST',C.violet,28);
    track(s,[[253,294],[318,294]],C.violet,{width:1.8});
    txt(s,'Windows acceptance',41,219,251,17,C.violet,true);
    txt(s,'Configuration-specific\nisolation evidence',42,253,159,13,C.muted);
    // The physical runtime and receipt are reviewed artifacts, not independent certification.
    s.shape('RECTANGLE',57,351,226,91,{fill:C.panel,stroke:C.muted,sw:1});
    txt(s,'Execution testimony',69,362,207,16,C.white,true);
    txt(s,'Addressed observations\nof the provider path',69,394,207,12,C.muted);
    wire(s,[[460,355],[460,393],[290,393]],C.muted,{width:1.8});
    dot(s,460,393,C.muted);
    wire(s,[[460,393],[597,393],[597,436],[681,436]],C.muted,{dash:true,glow:false,width:1.5});
    txt(s,'Independent validation',684,382,232,17,C.amber,true);
    txt(s,'Bypass + misuse\nFormal guarantees + scale',684,414,241,13,C.muted);
    s.foot('Reviewed 26 September 2026. Retained demonstrations do not establish every deployment or safety property.');
    s.source();out.push(s);
  }

  // 18. A test bench makes perturbation points and observable returns explicit.
  {
    const s=new Slide(18,'The next step is a reproducible engineering test','A joint protocol can exercise the circuit, challenge the boundary and retain every observable result');
    s.region(183,233,531,133,'PINNED CAPABILITY CIRCUIT',C.amber);
    device(s,220,274,111,56,'Resolve',C.green,15);
    s.gate(414,302,'CHECK',C.violet,23);
    wire(s,[[338,302],[391,302]],C.green);
    s.socket(511,302,{height:39});wire(s,[[437,302],[495,302]],C.green);
    device(s,572,274,114,56,'Provider',C.green,15);
    wire(s,[[527,302],[565,302]],C.green);
    // Reproduction enters through the same input. Attack and fault probes hit distinct seams.
    s.terminal(74,302,'RUN',C.blue,{r:26,size:12});wire(s,[[100,302],[213,302]],C.blue);
    txt(s,'Reproduce\ndeclared paths',34,355,151,16,C.blue,true);
    s.terminal(276,164,'INPUT',C.red,{r:23,size:10});
    wire(s,[[276,187],[276,266]],C.red,{dash:true,width:1.7,glow:false});
    txt(s,'Bypass + misuse',182,112,226,14,C.red,true);
    s.terminal(414,164,'AUTH',C.red,{r:23,size:10});
    wire(s,[[414,187],[414,273]],C.red,{dash:true,width:1.7,glow:false});
    txt(s,'Authority change',388,112,219,14,C.red,true);
    s.terminal(629,164,'FAULT',C.red,{r:23,size:10});
    wire(s,[[629,187],[629,266]],C.red,{dash:true,width:1.7,glow:false});
    txt(s,'Provider failure',613,112,220,14,C.red,true);
    // Success, rejection and uncertain provider responses all become observable evidence.
    device(s,749,270,158,68,'Outcome +\nclassification',C.green,16);
    wire(s,[[693,302],[742,302]],C.green);
    device(s,397,411,209,43,'Execution evidence',C.muted,16);
    wire(s,[[828,338],[828,433],[613,433]],C.muted,{width:1.8});
    wire(s,[[414,325],[414,387],[501,387],[501,411]],C.muted,{width:1.8});
    txt(s,'Reachability',749,354,166,13,C.muted);
    txt(s,'Continuity, revocation,\nretry and recovery',633,381,257,13,C.muted);
    s.foot('Publish the protocol and results as a joint evaluation. Include misuse of already admitted capabilities.');
    s.source();out.push(s);
  }

  // 19. Dashed contributions converge on a shared, inspectable evaluation artifact.
  {
    const s=new Slide(19,'A collaboration agenda','Proposed contributors connect to one reproducible evaluation and evidence program');
    s.region(341,225,278,122,'SHARED EVALUATION',C.amber);
    s.port(365,287,C.blue,5);track(s,[[370,287],[410,287]],C.blue,{width:1.8});
    s.gate(430,287,'TEST',C.violet,20);
    track(s,[[450,287],[502,287]],C.green,{width:1.8});
    s.socket(519,287,{height:34});track(s,[[535,287],[591,287]],C.green,{width:1.8});
    s.port(597,287,C.green,5);
    txt(s,'Pinned circuits + retained evidence',354,316,261,12,C.muted);
    device(s,56,140,231,64,'OpenAI + Anthropic',C.blue,18);
    txt(s,'Model diversity, adversarial tests\nand provider integration',57,213,245,13,C.muted);
    device(s,674,140,234,64,'U.S. evaluators',C.amber,18);
    txt(s,'Domain assurance requirements\nand independent trials',674,213,245,13,C.muted);
    device(s,56,362,231,66,'Independent engineers\nand researchers',C.violet,16);
    txt(s,'Reproduction + formal methods',57,433,260,12,C.muted);
    device(s,674,362,234,66,'UN scientific and\npolicy communities',C.muted,16);
    txt(s,'International evidence exchange',674,433,245,12,C.muted);
    // Use dashed paths exclusively: these are invitations, not established partnerships.
    wire(s,[[287,172],[314,172],[314,253],[341,253]],C.blue,{dash:true,glow:false,width:1.8});
    wire(s,[[674,172],[645,172],[645,253],[619,253]],C.amber,{dash:true,glow:false,width:1.8});
    wire(s,[[287,395],[315,395],[315,319],[341,319]],C.violet,{dash:true,glow:false,width:1.8});
    wire(s,[[674,395],[645,395],[645,319],[619,319]],C.muted,{dash:true,glow:false,width:1.8});
    s.port(341,253,C.blue);s.port(619,253,C.amber);s.port(341,319,C.violet);s.port(619,319,C.muted);
    s.foot('Proposed collaborators and workstreams. No partnership or endorsement is implied.');
    s.source();out.push(s);
  }
  return out;
}
