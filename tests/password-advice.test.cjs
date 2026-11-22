// Sign-up password errors: Supabase refuses leaked and too-short passwords. Its own wording
// ("known to be weak and easy to guess") made a visitor retry 11 times on 21 Nov 2026,
// so the page explains it in plain words (see passwordAdvice in index.html).
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const html=fs.readFileSync(path.join(__dirname,'..','index.html'),'utf8');
const src=/function passwordAdvice\(error\)\{[\s\S]*?\n\}/.exec(html);
assert(src,'passwordAdvice is defined in index.html');
const passwordAdvice=new Function(src[0]+';return passwordAdvice;')();

test('a leaked password gets a plain explanation',()=>{
  const tip=passwordAdvice({code:'weak_password',reasons:['pwned'],message:'Password is known to be weak and easy to guess, please choose a different one.'});
  assert.match(tip,/public data leak/);assert.match(tip,/different one/);
  assert.match(passwordAdvice({message:'Password is known to be weak and easy to guess, please choose a different one.'}),/data leak/,'works without the error code too');
});

test('a short password asks for 6 characters',()=>{
  assert.equal(passwordAdvice({code:'weak_password',reasons:['length'],message:'Password should be at least 6 characters.'}),'Your password needs at least 6 characters.');
  assert.equal(passwordAdvice({message:'Password should be at least 6 characters.'}),'Your password needs at least 6 characters.');
});

test('other errors keep Supabase wording',()=>{
  assert.equal(passwordAdvice({message:'User already registered'}),'');
  assert.equal(passwordAdvice({code:'over_email_send_rate_limit',message:'email rate limit exceeded'}),'');
  assert.equal(passwordAdvice(null),'');
});

test('the sign-up form says 6 characters, not 8',()=>{
  assert.match(html,/id="a-pass" type="password" placeholder="At least 6 characters"/);
  assert.doesNotMatch(html,/At least 8 characters/);
});

test('a refused password is cleared and logged as weak_password',()=>{
  assert.match(html,/const tip=passwordAdvice\(error\);[\s\S]{0,200}p\.value="";\s*p\.focus\(\);[\s\S]{0,120}step:tip\?"weak_password":"signup"/);
});
