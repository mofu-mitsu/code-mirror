const beforeEl=document.getElementById("beforeCode");
const afterEl=document.getElementById("afterCode");
const beforeLines=document.getElementById("beforeLines");
const afterLines=document.getElementById("afterLines");
const result=document.getElementById("result");
const syntaxSection=document.getElementById("syntaxSection");

const sampleBefore=`function greet(name) {
  const message = "Hello, " + name;
  console.log(message);
}

greet("Mitsuki");`;

const sampleAfter=`function greet(name) {
  const message = "Hello, " + name;
  const emoji = " 🐛";
  console.log(message + emoji);
}

greet("Mitsuki");`;

function lineCount(text){return text ? text.split("\n").length : 0}
function updateLineNumbers(textarea, el){
  const n=Math.max(1,lineCount(textarea.value));
  el.textContent=Array.from({length:n},(_,i)=>i+1).join("\n");
}
function syncScroll(textarea, lineEl){lineEl.style.transform=`translateY(-${textarea.scrollTop}px)`}

function updateCounts(){
  document.getElementById("beforeCount").textContent=lineCount(beforeEl.value);
  document.getElementById("afterCount").textContent=lineCount(afterEl.value);
  updateLineNumbers(beforeEl,beforeLines); updateLineNumbers(afterEl,afterLines);
}
[beforeEl,afterEl].forEach(el=>{
  el.addEventListener("input",updateCounts);
  el.addEventListener("scroll",()=>syncScroll(el,el===beforeEl?beforeLines:afterLines));
  el.addEventListener("keydown",e=>{
    if(e.key==="Tab"){
      e.preventDefault();
      const s=el.selectionStart,end=el.selectionEnd;
      el.value=el.value.slice(0,s)+"  "+el.value.slice(end);
      el.selectionStart=el.selectionEnd=s+2;
      updateCounts();
    }
  });
});

function diffLines(a,b){
  const A=a.split("\n"),B=b.split("\n");
  const n=A.length,m=B.length;
  const dp=Array.from({length:n+1},()=>new Array(m+1).fill(0));
  for(let i=n-1;i>=0;i--)for(let j=m-1;j>=0;j--)dp[i][j]=A[i]===B[j]?dp[i+1][j+1]+1:Math.max(dp[i+1][j],dp[i][j+1]);
  const out=[];let i=0,j=0;
  while(i<n&&j<m){
    if(A[i]===B[j]){out.push({type:"ctx",left:i+1,right:j+1,text:A[i]});i++;j++}
    else if(dp[i+1][j]>=dp[i][j+1]){out.push({type:"del",left:i+1,right:"",text:A[i]});i++}
    else{out.push({type:"add",left:"",right:j+1,text:B[j]});j++}
  }
  while(i<n)out.push({type:"del",left:i+1,right:"",text:A[i++]});
  while(j<m)out.push({type:"add",left:"",right:j+1,text:B[j++]});
  return out;
}

function renderDiff(){
  const rows=diffLines(beforeEl.value,afterEl.value);
  let added=0,removed=0,changed=0,previous=null;
  rows.forEach(r=>{if(r.type==="add")added++;if(r.type==="del")removed++;if(previous==="del"&&r.type==="add"){changed++}if(previous==="add"&&r.type==="del"){changed++}if(r.type!=="ctx")previous=r.type;else previous=null});
  document.getElementById("addedStat").textContent=added;
  document.getElementById("removedStat").textContent=removed;
  document.getElementById("changedStat").textContent=changed;
  document.getElementById("diffSummary").textContent=`${added} added · ${removed} removed`;
  document.getElementById("diffOutput").innerHTML=rows.map(r=>{
    const num=r.type==="add"?r.right:r.type==="del"?r.left:r.left;
    const mark=r.type==="add"?"+":r.type==="del"?"−":" ";
    return `<div class="diff-line ${r.type}"><span class="ln">${num||""}</span><span class="code"><span class="mark">${mark}</span>${escapeHtml(r.text)}</span></div>`;
  }).join("")||'<div style="padding:22px;color:#8b94a6">No differences.</div>';
}

function escapeHtml(s){return s.replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;").replaceAll('"',"&quot;")}

function syntaxCheck(code){
  if(!code.trim())return {ok:true,message:"Nothing to check."};
  try{
    new Function(code);
    return {ok:true,message:"No JavaScript syntax errors detected."};
  }catch(error){
    const match=String(error.message).match(/(?:line |at line )?(\d+)/i);
    return {ok:false,message:error.message||"Syntax error",line:match?match[1]:null};
  }
}

function renderSyntax(){
  const check=syntaxCheck(afterEl.value);
  const card=document.getElementById("syntaxCard");
  if(check.ok){
    card.innerHTML=`<div class="syntax-ok"><span class="syntax-icon">✓</span><div><strong>Syntax looks good.</strong><small>${escapeHtml(check.message)}</small></div></div>`;
  }else{
    card.innerHTML=`<div class="syntax-error"><span class="syntax-icon">!</span><div><strong>Syntax error detected.</strong><small>${escapeHtml(check.message)}</small></div></div>${check.line?`<ul class="error-list"><li>Possible location: line ${escapeHtml(check.line)}</li></ul>`:""}`;
  }
}

document.getElementById("compareBtn").addEventListener("click",()=>{
  result.classList.remove("hidden");syntaxSection.classList.remove("hidden");
  renderDiff();renderSyntax();
  result.scrollIntoView({behavior:"smooth",block:"start"});
});
document.getElementById("sampleBtn").addEventListener("click",()=>{
  beforeEl.value=sampleBefore;afterEl.value=sampleAfter;updateCounts();
});
document.getElementById("clearBtn").addEventListener("click",()=>{
  beforeEl.value="";afterEl.value="";updateCounts();result.classList.add("hidden");syntaxSection.classList.add("hidden");
  beforeEl.focus();
});
updateCounts();
