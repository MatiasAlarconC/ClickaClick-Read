import type { VercelRequest, VercelResponse } from '@vercel/node'

/**
 * Standalone Apple Watch companion page.
 * Served at /watch via vercel.json rewrite.
 * Injects Supabase credentials server-side so no React bundle is needed.
 * Works on watchOS WebKit (very limited JS environment).
 */
export default function handler(_req: VercelRequest, res: VercelResponse) {
  const SUPA_URL  = process.env.VITE_SUPABASE_URL  ?? ''
  const SUPA_ANON = process.env.VITE_SUPABASE_ANON_KEY ?? ''

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no">
<meta name="apple-mobile-web-app-capable" content="yes">
<title>ClickaClick Watch</title>
<style>
*{box-sizing:border-box;margin:0;padding:0;-webkit-tap-highlight-color:transparent}
html,body{height:100%;background:#000;color:#fff;font-family:-apple-system,system-ui,sans-serif;font-size:14px}
body{display:flex;flex-direction:column;align-items:center;justify-content:center;min-height:100dvh;padding:12px}
input{width:100%;padding:9px 10px;background:#1a1a1a;border:1px solid #333;border-radius:10px;font-size:13px;color:#fff;outline:none;margin-bottom:8px;-webkit-appearance:none}
.btn{width:100%;padding:11px;background:#22C55E;color:#000;border:none;border-radius:12px;font-size:14px;font-weight:700;cursor:pointer;margin-bottom:8px}
.btn.red{background:#EF4444;color:#fff}
.btn.ghost{background:none;border:1px solid #333;color:#888;font-weight:400;font-size:12px}
.card{width:100%;background:#111;border:1px solid #222;border-radius:12px;padding:11px 12px;margin-bottom:8px;text-align:left;cursor:pointer}
.card:active{background:#1a1a1a}
.label{font-size:10px;letter-spacing:.8px;text-transform:uppercase;color:#555;margin-bottom:8px}
.title{font-size:15px;font-weight:700;text-align:center;margin-bottom:12px}
.muted{font-size:11px;color:#555;text-align:center;margin-bottom:8px}
.timer{font-size:40px;font-weight:800;letter-spacing:-1px;color:#22C55E;text-align:center;margin:8px 0;font-variant-numeric:tabular-nums}
.err{font-size:11px;color:#EF4444;text-align:center;margin-bottom:8px}
.wrap{width:100%;max-width:190px}
.check{font-size:30px;text-align:center;margin-bottom:8px}
</style>
</head>
<body>
<div class="wrap" id="root"></div>

<script>
var SB_URL="${SUPA_URL}", SB_KEY="${SUPA_ANON}";
var token=null, userId=null, activeBook=null;
var startTs=null, timerHandle=null;

function el(id){return document.getElementById(id)}
function sbFetch(path,opts){
  var headers={'apikey':SB_KEY,'Content-Type':'application/json'};
  if(token)headers['Authorization']='Bearer '+token;
  return fetch(SB_URL+path,Object.assign({headers:headers},opts));
}

function render(html){el('root').innerHTML=html}

function pad(n){return n<10?'0'+n:String(n)}
function fmt(s){var h=Math.floor(s/3600),m=Math.floor((s%3600)/60),ss=s%60;return h>0?pad(h)+':'+pad(m)+':'+pad(ss):pad(m)+':'+pad(ss)}

/* ── Sign in ───────────────────────────────────────────────────────────────── */
function showSignIn(err){
  render('<div class="title">ClickaClick</div>'
    +(err?'<div class="err">'+err+'</div>':'')
    +'<input id="email" type="email" placeholder="Email" autocomplete="username">'
    +'<input id="pass" type="password" placeholder="Password" autocomplete="current-password">'
    +'<button class="btn" onclick="doSignIn()">Sign In</button>');
}

function doSignIn(){
  var e=el('email').value.trim(),p=el('pass').value;
  if(!e||!p)return;
  render('<div class="muted">Signing in…</div>');
  sbFetch('/auth/v1/token?grant_type=password',{
    method:'POST',
    body:JSON.stringify({email:e,password:p})
  }).then(function(r){return r.json()}).then(function(d){
    if(d.error||!d.access_token){showSignIn(d.error_description||d.error||'Sign in failed');return}
    token=d.access_token;
    userId=d.user.id;
    localStorage.setItem('watch_token',token);
    localStorage.setItem('watch_uid',userId);
    showBooks();
  }).catch(function(){showSignIn('Network error')});
}

/* ── Book picker ───────────────────────────────────────────────────────────── */
function showBooks(){
  render('<div class="muted">Loading…</div>');
  sbFetch('/rest/v1/user_books?select=id,book_id,current_page,book:books(title,pages_default)&user_id=eq.'+userId+'&status=eq.reading&limit=5')
  .then(function(r){return r.json()}).then(function(list){
    if(!Array.isArray(list)||list.length===0){
      render('<div class="muted">No books in progress.<br>Add one in the main app.</div>'
        +'<button class="btn ghost" onclick="doSignOut()">Sign out</button>');
      return;
    }
    var items=list.map(function(b){
      return '<div class="card" onclick=\\'selectBook('+JSON.stringify(b)+')\\'>'
        +(b.book?b.book.title:'Book')+'</div>';
    }).join('');
    render('<div class="title">Pick a book</div>'+items
      +'<button class="btn ghost" onclick="doSignOut()">Sign out</button>');
  }).catch(function(){render('<div class="err">Failed to load books</div><button class="btn ghost" onclick="showBooks()">Retry</button>')});
}

function selectBook(b){
  activeBook=b;
  showTimer();
}

/* ── Timer ─────────────────────────────────────────────────────────────────── */
function showTimer(){
  startTs=Date.now();
  render('<div class="label">'+((activeBook.book&&activeBook.book.title)||'Reading')+'</div>'
    +'<div class="timer" id="tmr">00:00</div>'
    +'<button class="btn red" onclick="showEndForm()">End Session</button>');
  timerHandle=setInterval(function(){
    var el2=el('tmr');
    if(el2)el2.textContent=fmt(Math.floor((Date.now()-startTs)/1000));
  },1000);
}

/* ── End form ──────────────────────────────────────────────────────────────── */
function showEndForm(){
  if(timerHandle){clearInterval(timerHandle);timerHandle=null}
  var dur=Math.floor((Date.now()-startTs)/1000);
  var cur=activeBook.current_page||0;
  render('<div class="title">End Session</div>'
    +'<div class="muted">Time: '+fmt(dur)+'</div>'
    +'<div class="label">Finished on page</div>'
    +'<input id="ep" type="number" value="'+cur+'" min="'+cur+'">'
    +'<button class="btn" onclick="saveSession('+dur+','+cur+')">Save &amp; Finish</button>'
    +'<button class="btn ghost" onclick="showTimer2('+dur+')">Back</button>');
}

function showTimer2(elapsed){
  startTs=Date.now()-elapsed*1000;
  showTimer();
}

/* ── Save session ──────────────────────────────────────────────────────────── */
function saveSession(dur,startPage){
  var ep=parseInt(el('ep').value)||startPage;
  var pages=Math.max(0,ep-startPage);
  var now=new Date().toISOString();
  var start=new Date(Date.now()-dur*1000).toISOString();
  render('<div class="muted">Saving…</div>');
  sbFetch('/rest/v1/reading_sessions',{
    method:'POST',
    headers:{'apikey':SB_KEY,'Authorization':'Bearer '+token,'Content-Type':'application/json','Prefer':'return=minimal'},
    body:JSON.stringify({user_id:userId,book_id:activeBook.book_id,started_at:start,ended_at:now,duration_seconds:dur,start_page:startPage,end_page:ep,pages_read:pages})
  }).then(function(r){
    if(r.status>=400){render('<div class="err">Save failed ('+r.status+')</div><button class="btn ghost" onclick="showBooks()">Back</button>');return}
    if(ep>startPage){
      sbFetch('/rest/v1/user_books?id=eq.'+activeBook.id,{
        method:'PATCH',
        headers:{'apikey':SB_KEY,'Authorization':'Bearer '+token,'Content-Type':'application/json','Prefer':'return=minimal'},
        body:JSON.stringify({current_page:ep})
      }).then(function(){showDone()});
    }else{showDone()}
  }).catch(function(){render('<div class="err">Network error</div><button class="btn ghost" onclick="showBooks()">Back</button>')});
}

/* ── Done ──────────────────────────────────────────────────────────────────── */
function showDone(){
  activeBook=null;startTs=null;
  render('<div class="check">&#10003;</div>'
    +'<div class="title">Session saved!</div>'
    +'<button class="btn" onclick="showBooks()">Read again</button>');
}

/* ── Sign out ──────────────────────────────────────────────────────────────── */
function doSignOut(){
  token=null;userId=null;
  localStorage.removeItem('watch_token');
  localStorage.removeItem('watch_uid');
  showSignIn();
}

/* ── Init ──────────────────────────────────────────────────────────────────── */
(function(){
  var t=localStorage.getItem('watch_token');
  var uid=localStorage.getItem('watch_uid');
  if(t&&uid){
    token=t;userId=uid;
    // Validate token is still alive
    sbFetch('/auth/v1/user').then(function(r){
      if(r.status===200)showBooks();
      else{localStorage.removeItem('watch_token');localStorage.removeItem('watch_uid');showSignIn()}
    }).catch(function(){showSignIn()});
  }else{
    showSignIn();
  }
})();
</script>
</body>
</html>`

  res.setHeader('Content-Type', 'text/html; charset=utf-8')
  res.setHeader('Cache-Control', 'no-store')
  res.send(html)
}
