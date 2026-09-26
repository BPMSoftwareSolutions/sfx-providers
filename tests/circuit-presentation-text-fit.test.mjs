import assert from 'node:assert/strict';
import {test} from 'node:test';
import {fitBlueprintText,textWidth} from '../src/circuit-presentation/text-fit.mjs';

test('font metrics distinguish wide glyphs and fit full provider identifiers without ellipses',()=>{
 assert.ok(textWidth('WWW',12)>textWidth('iii',12)*2);
 const label='rapidapi/davethebeast/yahoo-finance166';
 const fit=fitBlueprintText(label,{width:102,height:38,fontSize:15});
 assert.equal(fit.text.replaceAll('\n',''),label);assert.ok(fit.fontSize<15);
 for(const line of fit.text.split('\n'))assert.ok(textWidth(line,fit.fontSize)<=86);
 assert.ok(fit.text.split('\n').length*fit.fontSize*1.24+7.2<=38);
});

test('scaled ordinal badges reserve native insets and stay on one line',()=>{
 const fit=fitBlueprintText('14',{width:29.7,height:15.6,fontSize:7.8});
 assert.equal(fit.text,'14');assert.ok(textWidth(fit.text,fit.fontSize)<=13.7);
});

test('dense execution captions reserve native vertical line boxes',()=>{
 const fit=fitBlueprintText('build finance15bodyproof binding request',{width:98,height:24.75,fontSize:7.2});
 assert.ok(fit.text.split('\n').length*fit.fontSize*1.24+7.2<=24.75);
 assert.equal(fit.text.replaceAll('\n',' ').replace(/\s+/g,' '),'build finance15bodyproof binding request');
});

test('labels that cannot fit are refused instead of clipped or silently omitted',()=>{
 assert.throws(()=>fitBlueprintText('a long label',{width:9,height:5,fontSize:20}),{code:'CAPABILITY_BLUEPRINT_TEXT_OVERFLOW'});
});
