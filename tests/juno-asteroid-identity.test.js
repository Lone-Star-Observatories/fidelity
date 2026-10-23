import test from 'node:test';
import assert from 'node:assert/strict';
import {BODY_VISUALS,bodyVisualFor} from '../src/data/bespoke.js';
import {solSystem} from '../src/data/systems.js';
test('asteroid Juno dossier does not select spacecraft Juno by shared name',()=>{
 const asteroid=solSystem().bodies.find(b=>b.id==='juno-3');
 assert.equal(bodyVisualFor(asteroid),BODY_VISUALS['juno-3']);
 for(const name of ['3 Juno','(3) Juno','3 Juno (A804 RA)']) assert.equal(bodyVisualFor({name}),BODY_VISUALS['juno-3']);
 for(const b of [{id:'juno',name:'Juno',kind:'spacecraft'},{name:'Juno'},{id:'juno-3',name:'Juno',kind:'spacecraft'}]) assert.equal(bodyVisualFor(b),null);
});
