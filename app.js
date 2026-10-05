const beforeEl = document.getElementById("beforeCode");
const afterEl = document.getElementById("afterCode");
const beforeLines = document.getElementById("beforeLines");
const afterLines = document.getElementById("afterLines");
const result = document.getElementById("result");
const syntaxSection = document.getElementById("syntaxSection");

const sampleBefore = `function greet(name) {
  const message = "Hello, " + name;
  console.log(message);
}

greet("いもむし");`;

const sampleAfter = `function greet(name) {
  const message = "Hello, " + name;
  const emoji = " 🐛";
  console.log(message + emoji);
}

greet("いもむし");`;

function splitLines(text) {
  return text.replace(/\r\n?/g, "\n").split("\n");
}

function lineCount(text) {
  return text ? splitLines(text).length : 0;
}

function updateLineNumbers(textarea, el) {
  const n = Math.max(1, lineCount(textarea.value));
  el.textContent = Array.from({ length: n }, (_, i) => i + 1).join("\n");
}

function syncScroll(textarea, lineEl) {
  lineEl.style.transform = `translateY(-${textarea.scrollTop}px)`;
}

function updateCounts() {
  document.getElementById("beforeCount").textContent = lineCount(beforeEl.value);
  document.getElementById("afterCount").textContent = lineCount(afterEl.value);
  updateLineNumbers(beforeEl, beforeLines);
  updateLineNumbers(afterEl, afterLines);
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function diffLines(beforeText, afterText) {
  const A = splitLines(beforeText);
  const B = splitLines(afterText);
  const n = A.length;
  const m = B.length;

  // LCSで「同じ行」を最大限残し、挿入・削除位置を特定する。
  const dp = Array.from({ length: n + 1 }, () => new Uint32Array(m + 1));

  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      dp[i][j] = A[i] === B[j]
        ? dp[i + 1][j + 1] + 1
        : Math.max(dp[i + 1][j], dp[i][j + 1]);
    }
  }

  const rows = [];
  let i = 0;
  let j = 0;

  while (i < n && j < m) {
    if (A[i] === B[j]) {
      rows.push({ type: "ctx", left: i + 1, right: j + 1, text: A[i] });
      i++;
      j++;
      continue;
    }

    if (dp[i + 1][j] >= dp[i][j + 1]) {
      rows.push({ type: "del", left: i + 1, right: "", text: A[i] });
      i++;
    } else {
      rows.push({ type: "add", left: "", right: j + 1, text: B[j] });
      j++;
    }
  }

  while (i < n) {
    rows.push({ type: "del", left: i + 1, right: "", text: A[i++] });
  }

  while (j < m) {
    rows.push({ type: "add", left: "", right: j + 1, text: B[j++] });
  }

  return rows;
}

function groupChanges(rows) {
  const groups = [];
  let current = null;

  for (const row of rows) {
    if (row.type === "ctx") {
      current = null;
      continue;
    }

    if (!current) {
      current = { rows: [], hasAdd: false, hasDel: false };
      groups.push(current);
    }

    current.rows.push(row);
    current.hasAdd ||= row.type === "add";
    current.hasDel ||= row.type === "del";
  }

  return groups;
}


let diffViewMode="unified";
function buildSideRows(rows){const result=[];for(let i=0;i<rows.length;i++){const row=rows[i];if(row.type==="del"&&rows[i+1]?.type==="add"){result.push({left:row,right:rows[i+1],type:"change"});i++;}else if(row.type==="add"&&rows[i+1]?.type==="del"){result.push({left:rows[i+1],right:row,type:"change"});i++;}else if(row.type==="del")result.push({left:row,right:null,type:"del"});else if(row.type==="add")result.push({left:null,right:row,type:"add"});else result.push({left:row,right:row,type:"ctx"});}return result;}
function renderUnifiedDiff(rows){return rows.map(row=>{const number=row.type==="add"?row.right:row.left,mark=row.type==="add"?"+":row.type==="del"?"−":" ";return"<div class=\"diff-line "+row.type+"\"><span class=\"ln\">"+(number||"")+"</span><span class=\"code\"><span class=\"mark\">"+mark+"</span>"+escapeHtml(row.text)+"</span></div>";}).join("");}
function renderSideBySideDiff(rows){return buildSideRows(rows).map(pair=>{const left=pair.left,right=pair.right;return"<div class=\"side-row "+pair.type+"\"><div class=\"side-cell "+(left?.type||"")+"\"><span class=\"side-ln\">"+(left?.left||"")+"</span><code>"+(left?escapeHtml(left.text):"")+"</code></div><div class=\"side-cell "+(right?.type||"")+"\"><span class=\"side-ln\">"+(right?.right||"")+"</span><code>"+(right?escapeHtml(right.text):"")+"</code></div></div>";}).join("");}
function renderDiff(){const rows=diffLines(beforeEl.value,afterEl.value),groups=groupChanges(rows),added=rows.filter(row=>row.type==="add").length,removed=rows.filter(row=>row.type==="del").length,changed=groups.filter(group=>group.hasAdd&&group.hasDel).length;document.getElementById("addedStat").textContent=added;document.getElementById("removedStat").textContent=removed;document.getElementById("changedStat").textContent=changed;document.getElementById("diffSummary").textContent=added===0&&removed===0?"変更なし":"追加 "+added+"行 · 削除 "+removed+"行 · 変更 "+changed+"箇所";const output=document.getElementById("diffOutput");if(!rows.some(row=>row.type!=="ctx")){output.innerHTML="<div class=\"no-diff\">変更はありません。</div>";return;}output.classList.toggle("side-by-side",diffViewMode==="side");output.innerHTML=diffViewMode==="side"?renderSideBySideDiff(rows):renderUnifiedDiff(rows);}
function findStructuralError(code) {
  const stack=[]; let quote=null,escaped=false,lineComment=false,blockComment=false;
  for(let i=0;i<code.length;i++){
    const ch=code[i],next=code[i+1];
    if(lineComment){if(ch==="\n")lineComment=false;continue;}
    if(blockComment){if(ch==="*"&&next==="/"){blockComment=false;i++;}continue;}
    if(quote){if(escaped)escaped=false;else if(ch==="\\")escaped=true;else if(ch===quote)quote=null;continue;}
    if(ch==="/"&&next==="/"){lineComment=true;i++;continue;}
    if(ch==="/"&&next==="*"){blockComment=true;i++;continue;}
    if(ch==="\""||ch==="'"||ch===String.fromCharCode(96)){quote=ch;continue;}
    if("({[".includes(ch)){stack.push({ch,index:i});continue;}
    if(")}]".includes(ch)){const expected={")":"(","}":"{","]":"["}[ch],top=stack[stack.length-1];if(!top||top.ch!==expected)return{index:i,message:"Unexpected "+ch};stack.pop();}
  }
  if(quote)return{index:Math.max(0,code.length-1),message:"Unclosed string"};
  if(blockComment)return{index:Math.max(0,code.length-1),message:"Unclosed block comment"};
  if(stack.length)return{index:Math.max(0,code.length-1),message:"Unclosed "+stack[stack.length-1].ch};
  return null;
}
function indexToLocation(code,index){const lines=code.slice(0,Math.max(0,index)).split("\n"),last=lines[lines.length-1];return{line:lines.length,column:last.length+1};}
function locationFromIndex(code,index){if(typeof index!=="number"||index<0)return{line:null,column:null};return indexToLocation(code,index);}
let babelParserPromise=null;
async function loadBabelParser(){if(!babelParserPromise)babelParserPromise=import("https://esm.sh/@babel/parser@7.28.4?bundle");const mod=await babelParserPromise;return mod.parse||mod.default?.parse;}
let pythonParserPromise=null;
async function loadPythonParser(){if(!pythonParserPromise)pythonParserPromise=import("https://esm.sh/@lezer/python@1.1.19?bundle");const mod=await pythonParserPromise;return mod.parser||mod.default?.parser;}
function diagnosticLocation(error,code){if(error?.loc?.line)return{line:Number(error.loc.line),column:Number(error.loc.column)+1};if(error?.pos?.start!=null)return locationFromIndex(code,error.pos.start);return getSyntaxErrorLocation(error);}
async function checkJavaScript(code,language="javascript"){
  if(!code.trim())return{ok:true,message:"チェックするコードがありません。"};
  try{const parse=await loadBabelParser(),plugins=language==="typescript"?["typescript","jsx"]:["jsx"];parse(code,{sourceType:"unambiguous",plugins,errorRecovery:false,sourceFilename:language==="typescript"?"input.tsx":"input.js"});return{ok:true,message:language==="typescript"?"TypeScriptの構文エラーは見つかりませんでした。":"JavaScriptの構文エラーは見つかりませんでした。"};}
  catch(error){const location=diagnosticLocation(error,code),structural=findStructuralError(code),fallback=structural?indexToLocation(code,structural.index):{line:null,column:null};return{ok:false,message:error.message||(language==="typescript"?"TypeScriptの構文エラーです。":"JavaScriptの構文エラーです。"),line:location.line||fallback.line,column:location.column||fallback.column,structuralMessage:structural?structural.message:null};}
}
function checkHTMLTags(code){
  const stack=[],voidTags=new Set(["area","base","br","col","embed","hr","img","input","link","meta","param","source","track","wbr"]),commentOpen=code.indexOf("<!--");
  if(commentOpen>=0&&code.indexOf("-->",commentOpen+4)<0){const p=indexToLocation(code,commentOpen);return{ok:false,message:"閉じられていないHTMLコメントです。",line:p.line,column:p.column};}
  const tagPattern=/<!--[\s\S]*?-->|<![^>]*>|<\s*(\/?)\s*([A-Za-z][A-Za-z0-9:-]*)([^>]*)>/g;let match;
  while((match=tagPattern.exec(code))){const full=match[0];if(full.startsWith("<!--")||full.startsWith("<!"))continue;const closing=Boolean(match[1]),name=match[2].toLowerCase(),attrs=match[3]||"",selfClosing=/\/\s*$/.test(attrs)||voidTags.has(name);
    if(closing){const top=stack[stack.length-1];if(!top||top.name!==name){const p=indexToLocation(code,match.index);return{ok:false,message:top?"閉じタグ </"+name+"> が <"+top.name+"> と対応していません。":"閉じタグ </"+name+"> に対応する開始タグがありません。",line:p.line,column:p.column};}stack.pop();}
    else if(!selfClosing&&!voidTags.has(name))stack.push({name,index:match.index});
  }
  const unclosed=stack[stack.length-1];if(unclosed){const p=indexToLocation(code,unclosed.index);return{ok:false,message:"開始タグ <"+unclosed.name+"> が閉じられていません。",line:p.line,column:p.column};}return null;
}
function checkHTML(code){if(!code.trim())return{ok:true,message:"チェックするコードがありません。"};const tagError=checkHTMLTags(code);if(tagError)return tagError;const doc=new DOMParser().parseFromString(code,"text/html"),parserError=doc.querySelector("parsererror");return parserError?{ok:false,message:parserError.textContent.trim(),line:null,column:null}:{ok:true,message:"HTMLのタグ対応・基本構文に問題は見つかりませんでした。"};}
function checkCSS(code){if(!code.trim())return{ok:true,message:"チェックするコードがありません。"};try{const sheet=new CSSStyleSheet();sheet.replaceSync(code);return{ok:true,message:"CSSの構文エラーは見つかりませんでした。"};}catch(error){const structural=findStructuralError(code),location=structural?indexToLocation(code,structural.index):getSyntaxErrorLocation(error);return{ok:false,message:error.message||"CSS構文エラーです。",line:location.line,column:location.column};}}
function checkPythonFallback(code){const lines=splitLines(code);let triple=null;for(let i=0;i<lines.length;i++){const raw=lines[i],trimmed=raw.trim();if(!trimmed||trimmed.startsWith("#"))continue;const leading=raw.match(/^[ \t]*/)?.[0]||"";if(leading.includes("\t")&&leading.includes(" "))return{ok:false,message:"タブとスペースが混在したインデントです。",line:i+1,column:1};if(/^(if|elif|else|for|while|try|except|finally|with|def|class)\b/.test(trimmed)&&!trimmed.endsWith(":"))return{ok:false,message:"ブロック文の末尾に ':' がありません。",line:i+1,column:raw.length};const structural=findStructuralError(raw);if(structural){const p=indexToLocation(raw,structural.index);return{ok:false,message:structural.message,line:i+1,column:p.column};}if((raw.match(/'''/g)||[]).length%2||(raw.match(/"""/g)||[]).length%2)triple=triple?null:"triple";}if(triple)return{ok:false,message:"閉じられていない三重引用符があります。",line:lines.length,column:lines[lines.length-1].length+1};return{ok:true,message:"Pythonの基本構文に問題は見つかりませんでした。",heuristic:true};}
async function checkPython(code){if(!code.trim())return{ok:true,message:"チェックするコードがありません。"};try{const parser=await loadPythonParser(),tree=parser.parse(code);let errorNode=null;tree.iterate({enter(node){if(!errorNode&&node.type?.isError)errorNode={from:node.from};}});if(errorNode){const p=locationFromIndex(code,errorNode.from);return{ok:false,message:"Pythonの構文エラーを検出しました。",line:p.line,column:p.column};}return{ok:true,message:"Pythonの構文エラーは見つかりませんでした。"};}catch(error){return checkPythonFallback(code);}}
async function currentCheck(code){const lang=document.getElementById("languageSelect")?.value||"javascript";if(lang==="html")return checkHTML(code);if(lang==="css")return checkCSS(code);if(lang==="python")return checkPython(code);return checkJavaScript(code,lang);}

function getSyntaxErrorLocation(error) {
  const message = String(error?.message || "");
  const stack = String(error?.stack || "");
  const source = `${message}\n${stack}`;

  // Chrome系では「line 3」、Firefox系では「line:column」などが出るため複数形式を拾う。
  const patterns = [
    /line\s+(\d+)/i,
    /<anonymous>:(\d+):(\d+)/i,
    /<anonymous>:(\d+)/i
  ];

  for (const pattern of patterns) {
    const match = source.match(pattern);
    if (match) {
      return { line: Number(match[1]), column: match[2] ? Number(match[2]) : null };
    }
  }

  return { line: null, column: null };
}


async function renderSyntax(){const check=await currentCheck(afterEl.value),card=document.getElementById("syntaxCard");if(check.ok){card.innerHTML="<div class=\"syntax-ok\"><span class=\"syntax-icon\">✓</span><div><strong>構文は問題なさそうです。</strong><small>"+escapeHtml(check.message)+"</small></div></div>";return check;}const locationText=check.line?"変更後コードの "+check.line+"行目付近"+(check.column?"（"+check.column+"列目）":""):"エラー位置を特定できませんでした。";card.innerHTML="<div class=\"syntax-error\"><span class=\"syntax-icon\">!</span><div><strong>構文エラーを検出しました。</strong><small>"+escapeHtml(check.message)+"</small></div></div><ul class=\"error-list\"><li>推定位置："+escapeHtml(locationText)+"</li></ul>";return check;}
function scrollToFirstDiff(rows){const first=rows.find(row=>row.type!=="ctx");if(!first)return;const scrollEditor=(textarea,line)=>{if(!line)return;const lineHeight=parseFloat(getComputedStyle(textarea).lineHeight)||19.8;textarea.scrollTop=Math.max(0,(line-1)*lineHeight);};scrollEditor(beforeEl,first.left);scrollEditor(afterEl,first.right);const output=document.getElementById("diffOutput"),changedEl=output?.querySelector(".diff-line.add,.diff-line.del,.side-row.add,.side-row.del,.side-row.change");if(changedEl)changedEl.scrollIntoView({behavior:"smooth",block:"center"});}
async function compare(){result.classList.remove("hidden");syntaxSection.classList.remove("hidden");renderDiff();const check=await renderSyntax();const suspectRows=diffLines(beforeEl.value,afterEl.value);renderSuspects(suspectRows,groupChanges(suspectRows),check);scrollToFirstDiff(suspectRows);}

[beforeEl, afterEl].forEach(textarea => {
  textarea.addEventListener("input", updateCounts);
  textarea.addEventListener("scroll", () => {
    syncScroll(textarea, textarea === beforeEl ? beforeLines : afterLines);
  });

  textarea.addEventListener("keydown", event => {
    if (event.key !== "Tab") return;

    event.preventDefault();
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    textarea.value =
      textarea.value.slice(0, start) +
      "  " +
      textarea.value.slice(end);
    textarea.selectionStart = textarea.selectionEnd = start + 2;
    updateCounts();
  });
});

document.getElementById("compareBtn").addEventListener("click", async () => {
  await compare();
  result.scrollIntoView({ behavior: "smooth", block: "start" });
});


document.getElementById("unifiedViewBtn")?.addEventListener("click",()=>{diffViewMode="unified";document.getElementById("unifiedViewBtn").classList.add("active");document.getElementById("sideViewBtn").classList.remove("active");renderDiff();scrollToFirstDiff(diffLines(beforeEl.value,afterEl.value));});
document.getElementById("sideViewBtn")?.addEventListener("click",()=>{diffViewMode="side";document.getElementById("sideViewBtn").classList.add("active");document.getElementById("unifiedViewBtn").classList.remove("active");renderDiff();scrollToFirstDiff(diffLines(beforeEl.value,afterEl.value));});

document.getElementById("sampleBtn").addEventListener("click", async () => {
  beforeEl.value = sampleBefore;
  afterEl.value = sampleAfter;
  updateCounts();
  await compare();
});

document.getElementById("clearBtn").addEventListener("click", () => {
  beforeEl.value = "";
  afterEl.value = "";
  updateCounts();
  result.classList.add("hidden");
  syntaxSection.classList.add("hidden");
  beforeEl.focus();
});

updateCounts();


document.getElementById("languageSelect")?.addEventListener("change",async()=>{applyLocale();if(!result.classList.contains("hidden"))await compare();});
document.getElementById("langBtn")?.addEventListener("click",()=>{const next=document.documentElement.lang==="ja"?"en":"ja";document.documentElement.lang=next;localStorage.setItem("codeMirrorLocale",next);applyLocale();});
(function(){const saved=localStorage.getItem("codeMirrorLocale");const ja=saved?saved==="ja":((navigator.language||"").toLowerCase().startsWith("ja")||Intl.DateTimeFormat().resolvedOptions().timeZone==="Asia/Tokyo");document.documentElement.lang=ja?"ja":"en";applyLocale();})();
