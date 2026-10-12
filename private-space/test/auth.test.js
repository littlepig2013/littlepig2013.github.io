import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createAuthenticator } from '../src/auth.js';

const keys = await crypto.subtle.generateKey({ name:'RSASSA-PKCS1-v1_5',modulusLength:2048,publicExponent:new Uint8Array([1,0,1]),hash:'SHA-256' },true,['sign','verify']);
const jwk = { ...await crypto.subtle.exportKey('jwk',keys.publicKey),kid:'test-key' };
const env = { ACCESS_TEAM_DOMAIN:'example.cloudflareaccess.com',ACCESS_AUD:'test-audience',OWNER_EMAIL:'owner@example.com' };
const now = 2000000000000;
const encode = value => Buffer.from(JSON.stringify(value)).toString('base64url');
async function token(claims = {}, header = {}) {
  const unsigned = `${encode({alg:'RS256',kid:'test-key',...header})}.${encode({iss:'https://example.cloudflareaccess.com',aud:['test-audience'],exp:now/1000+3600,email:'friend@example.com',...claims})}`;
  const signature = await crypto.subtle.sign('RSASSA-PKCS1-v1_5',keys.privateKey,new TextEncoder().encode(unsigned));
  return `${unsigned}.${Buffer.from(signature).toString('base64url')}`;
}
const request = jwt => new Request('https://friends.example.com/',{headers:jwt?{'Cf-Access-Jwt-Assertion':jwt}:{}});
const auth = () => createAuthenticator({ now:()=>now,fetchFn:async()=>Response.json({keys:[jwk]}) });
test('accepts a correctly signed application token and normalizes email',async()=>{
  assert.equal(await auth()(request(await token({email:'Friend@Example.com'})),env),'friend@example.com');
});
test('unsigned identity header is not authentication',async()=>{
  const req=new Request('https://friends.example.com/',{headers:{'Cf-Access-Authenticated-User-Email':'owner@example.com'}});
  await assert.rejects(auth()(req,env),e=>e.status===401);
});
for (const [name,claims,header] of [
  ['expired',{exp:now/1000},{}],['wrong audience',{aud:['other']},{}],
  ['wrong issuer',{iss:'https://attacker.example.com'},{}],['future nbf',{nbf:now/1000+10},{}],
  ['missing email',{email:null},{}],['unsigned algorithm',{}, {alg:'none'}],['unknown key',{}, {kid:'unknown'}]
]) test(`rejects ${name}`,async()=>{
  await assert.rejects(auth()(request(await token(claims,header)),env),e=>e.status===401);
});
test('rejects altered signed email',async()=>{
  const parts=(await token()).split('.');
  const payload=JSON.parse(Buffer.from(parts[1],'base64url').toString());payload.email='owner@example.com';parts[1]=encode(payload);
  await assert.rejects(auth()(request(parts.join('.')),env),e=>e.status===401);
});
test('fails closed if key verification service fails',async()=>{
  const verify=createAuthenticator({now:()=>now,fetchFn:async()=>{throw new Error('offline');}});
  await assert.rejects(verify(request(await token()),env),e=>e.status===503);
});
test('fails closed with missing authentication configuration',async()=>{
  await assert.rejects(auth()(request(await token()),{}),e=>e.status===503);
});
