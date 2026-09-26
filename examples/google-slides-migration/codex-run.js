// Execute in Codex functions.exec, with the Google Drive connector available.
// First prepare the job using google-slides-migrate.mjs prepare.
// Adjust these trusted host paths, not the provider's request JSON.
const repo='C:/lab/repos/sfx-providers';
const jobDirectory=repo+'/outputs/google-slides/sda-cli-invoke-context-v2';
const psQuote=value=>"'"+String(value).replaceAll("'","''")+"'";
async function loadModule(name,exports){
 const result=await tools.exec_command({cmd:'Get-Content -Raw '+psQuote(repo+'/src/google-slides-migration/'+name+'.mjs'),max_output_tokens:16000});
 if(result.exit_code!==0)throw new Error('Cannot read retained provider source.');
 // These two modules deliberately have no imports or Node-only dependencies.
 return new Function(result.output.replace(/^export /gm,'')+';return {'+exports+'};')();
}
const workflow=await loadModule('workflow','handle');
const adapter=await loadModule('codex-host','createCodexHost');
const host=await adapter.createCodexHost(tools,{jobDirectory,cliPath:repo+'/google-slides-migrate.mjs'});
const result=await workflow.handle(host.request,host.options);
text(result);
