import test from 'node:test';
import assert from 'node:assert/strict';
import { validateProfile } from '../shared/profile.mjs';
import { resolvePage } from '../shared/navigation.mjs';

test('profile input normalizes usernames and rejects invalid or unexpected data', () => {
  const data = {username:'  Sql_Learner ', fullName:'  Test   Learner ', age:22, profession:' Data   analyst '};
  assert.deepEqual(validateProfile(data), {username:'sql_learner', fullName:'Test Learner', age:22, profession:'Data analyst'});
  for (const patch of [{username:'ab'},{username:'1learner'},{username:'sql learner'},{username:'admin'}, {fullName:''}, {profession:''}, {age:0}, {age:121}, {age:20.5}, {age:'22'}, {email:'not-editable@example.com'}, {profileComplete:true}]) assert.throws(()=>validateProfile({...data,...patch}));
});

test('login, guest routes and onboarding enforce the intended navigation flow', () => {
  const fresh={profileComplete:false}, ready={profileComplete:true};
  assert.equal(resolvePage('/',null),'login');
  assert.equal(resolvePage('/login',null),'login');
  assert.equal(resolvePage('/dashboard',null),'dashboard');
  assert.equal(resolvePage('/practice',null),'practice');
  assert.equal(resolvePage('/',null,true),'practice');
  assert.equal(resolvePage('/profile',null),'login');
  assert.equal(resolvePage('/onboarding',null),'login');
  for (const path of ['/','/profile','/practice','/dashboard']) assert.equal(resolvePage(path,fresh),'onboarding');
  assert.equal(resolvePage('/login',ready),'dashboard');
  assert.equal(resolvePage('/onboarding',ready),'dashboard');
  assert.equal(resolvePage('/profile',ready),'profile');
});
