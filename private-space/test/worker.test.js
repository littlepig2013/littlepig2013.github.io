import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';
import { createHandler } from '../src/worker.js';
import { HTTPError } from '../src/auth.js';

function database() {
  const sqlite = new DatabaseSync(':memory:');
  sqlite.exec(readFileSync(new URL('../schema.sql',import.meta.url),'utf8'));
  const prepare = sql => {
    const params = []; const statement = sqlite.prepare(sql);
    return { bind(...values){params.splice(0,params.length,...values);return this;},
      async first(){return statement.get(...params)||null;},
      async all(){return {results:statement.all(...params)};},
      async run(){return statement.run(...params);} };
  };
  return { prepare,async batch(statements){sqlite.exec('BEGIN');try{const result=[];for(const s of statements)result.push(await s.run());sqlite.exec('COMMIT');return result;}catch(e){sqlite.exec('ROLLBACK');throw e;}} };
}
function fixture() {
  const env = { OWNER_EMAIL:'owner@example.com',DB:database(),ASSETS:{fetch:async()=>new Response('private shell')},MEDIA:{
    reads:0,async head(){return {size:10};},async get(key,options){this.reads++;return {body:new Uint8Array(options.range?.length||10),httpMetadata:{contentType:'video/mp4'}};},async put(){}
  }};
  const handler = createHandler(async request=>{
    const email=request.headers.get('Test-Identity');if(!email)throw new HTTPError(401,'Sign in required');return email;
  }); // Test injection only; production uses signed Access JWTs.
  const call = async (path,email='owner@example.com',body,extra={}) => handler(new Request(`https://friends.example.com${path}`,{
    method:body===undefined?'GET':'PUT',headers:{...(email?{'Test-Identity':email}:{}),...(body===undefined?{}:{'Origin':'https://friends.example.com','Content-Type':'application/json'}),...extra},...(body===undefined?{}:{body:JSON.stringify(body)})
  }),env);
  return {env,call};
}
async function seed(f) {
  for(const [email,journal] of [['a@example.com',false],['b@example.com',true]]){
    assert.equal((await f.call('/api/admin/friends','owner@example.com',{email,name:email,active:true,music:true,dance:true,journal})).status,200);
  }
  for(const [id,section,visibility,readers] of [
    ['self','journal','self',[]],['circle','journal','circle',[]],['selected','journal','selected',['a@example.com']],['song','music','section',[]],['dance','dance','section',[]]
  ]) assert.equal((await f.call(`/api/admin/posts/${id}`,'owner@example.com',{section,visibility,variants:{zh:{title:id,body:'private '+id},en:{title:'English '+id,body:'English private '+id}},readers})).status,200);
}
const ids = response => response.json().then(x=>x.posts.map(p=>p.id).sort());
test('owner sees all; ordinary friend sees only designated Journal; circle sees only circle Journal',async()=>{
  const f=fixture();await seed(f);
  assert.deepEqual(await ids(await f.call('/api/posts')),['circle','dance','selected','self','song']);
  assert.deepEqual(await ids(await f.call('/api/posts','a@example.com')),['dance','selected','song']);
  assert.deepEqual(await ids(await f.call('/api/posts','b@example.com')),['circle','dance','song']);
});
test('denied titles, text, and translations do not leak in listings or direct requests',async()=>{
  const f=fixture();await seed(f);
  const listing=await (await f.call('/api/posts','a@example.com')).json();
  assert.ok(listing.posts.every(p=>Object.values(p.variants).every(v=>!('body' in v))));
  assert.ok(!JSON.stringify(listing).includes('circle'));
  const denied=await f.call('/api/posts/self','a@example.com');assert.equal(denied.status,404);
  assert.deepEqual(await denied.json(),{error:'Article not found'});
  const allowed=await (await f.call('/api/posts/selected','a@example.com')).json();assert.equal(allowed.variants.en.body,'English private selected');
});
test('anonymous and uninvited identities cannot reach private shell or API',async()=>{
  const f=fixture();await seed(f);
  for(const path of ['/','/app.js','/api/posts','/api/admin/friends']) {
    assert.equal((await f.call(path,null)).status,401);
    assert.equal((await f.call(path,'stranger@example.com')).status,403);
  }
});
test('friends cannot enumerate people, edit articles, or impersonate another viewer',async()=>{
  const f=fixture();await seed(f);
  assert.equal((await f.call('/api/admin/friends','a@example.com')).status,403);
  assert.equal((await f.call('/api/admin/posts','a@example.com')).status,403);
  assert.equal((await f.call('/api/posts?as=owner@example.com','a@example.com')).status,403);
  assert.equal((await f.call('/api/admin/posts/self','a@example.com',{})).status,403);
});
test('revocation takes effect on the next request, including original media URLs',async()=>{
  const f=fixture();await seed(f);
  await f.env.DB.prepare('UPDATE posts SET media = ? WHERE id = ?').bind('[{"file":"video.mp4","type":"video/mp4"}]','selected').run();
  assert.equal((await f.call('/api/media/selected/video.mp4','a@example.com')).status,200);
  await f.call('/api/admin/friends','owner@example.com',{email:'a@example.com',name:'A',active:false,music:true,dance:true,journal:false});
  for(const path of ['/','/api/posts/selected','/api/media/selected/video.mp4'])assert.equal((await f.call(path,'a@example.com')).status,403);
  assert.deepEqual(await ids(await f.call('/api/posts?as=a@example.com')),[]);
});
test('removed section permission does not grant access via a remembered article ID',async()=>{
  const f=fixture();await seed(f);
  await f.call('/api/admin/friends','owner@example.com',{email:'a@example.com',name:'A',active:true,music:false,dance:true,journal:false});
  assert.equal((await f.call('/api/posts/song','a@example.com')).status,404);
  assert.deepEqual(await ids(await f.call('/api/posts','a@example.com')),['dance','selected']);
});
test('private media authorizes first and supports seeking only after authorization',async()=>{
  const f=fixture();await seed(f);
  await f.env.DB.prepare('UPDATE posts SET media = ? WHERE id = ?').bind('[{"file":"video.mp4","type":"video/mp4"}]','self').run();
  assert.equal((await f.call('/api/media/self/video.mp4','a@example.com',undefined,{Range:'bytes=0-3'})).status,404);
  assert.equal(f.env.MEDIA.reads,0);
  const response=await f.call('/api/media/self/video.mp4','owner@example.com',undefined,{Range:'bytes=2-5'});
  assert.equal(response.status,206);assert.equal(response.headers.get('Content-Range'),'bytes 2-5/10');assert.equal((await response.arrayBuffer()).byteLength,4);
  assert.equal((await f.call('/api/media/self/video.mp4','owner@example.com',undefined,{Range:'bytes=99-100'})).status,416);
  assert.equal((await f.call('/api/media/self/unlisted.mp4')).status,404);
});
test('cross-origin writes are rejected and cannot change grants',async()=>{
  const f=fixture();await seed(f);
  assert.equal((await f.call('/api/admin/friends','owner@example.com',{email:'a@example.com',name:'A',active:true,music:true,dance:true,journal:true},{Origin:'https://attacker.example.com'})).status,403);
  const a=await f.env.DB.prepare('SELECT journal FROM friends WHERE email = ?').bind('a@example.com').first();assert.equal(a.journal,0);
});
test('new articles default to self and invalid reader changes preserve the existing article',async()=>{
  const f=fixture();await seed(f);
  assert.equal((await f.call('/api/admin/posts/new','owner@example.com',{section:'journal',variants:{zh:{title:'new',body:'secret'}}})).status,200);
  assert.equal((await f.call('/api/posts/new','b@example.com')).status,404);
  const invalid=await f.call('/api/admin/posts/selected','owner@example.com',{section:'journal',visibility:'selected',variants:{zh:{title:'changed',body:'changed'}},readers:['missing@example.com']});
  assert.equal(invalid.status,400);
  assert.equal((await (await f.call('/api/posts/selected','a@example.com')).json()).variants.zh.title,'selected');
});
test('all responses, including errors, are private and cannot be cached',async()=>{
  const f=fixture();await seed(f);
  for(const response of [await f.call('/'),await f.call('/api/posts'),await f.call('/api/posts/self','a@example.com')]){
    assert.equal(response.headers.get('Cache-Control'),'private, no-store');assert.equal(response.headers.get('X-Robots-Tag'),'noindex, nofollow, noarchive');
  }
});
test('owner cannot accidentally revoke their own access',async()=>{
  const f=fixture();assert.equal((await f.call('/api/admin/friends','owner@example.com',{email:'owner@example.com',name:'owner',active:false,music:false,dance:false,journal:false})).status,400);
});
