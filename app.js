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
function charDiffPair(a,b){
  if(a===b)return{left:escapeHtml(a),right:escapeHtml(b)};
  if(a.length>700||b.length>700)return{left:'<mark class="inline-del">'+escapeHtml(a)+'</mark>',right:'<mark class="inline-add">'+escapeHtml(b)+'</mark>'};
  const n=a.length,m=b.length,dp=Array.from({length:n+1},()=>new Uint16Array(m+1));
  for(let i=n-1;i>=0;i--)for(let j=m-1;j>=0;j--)dp[i][j]=a[i]===b[j]?dp[i+1][j+1]+1:Math.max(dp[i+1][j],dp[i][j+1]);
  const L=[],R=[];let i=0,j=0;
  const push=(arr,cls,ch)=>{const last=arr[arr.length-1];if(last&&last.cls===cls)last.text+=ch;else arr.push({cls,text:ch});};
  while(i<n&&j<m){
    if(a[i]===b[j]){push(L,"",a[i]);push(R,"",b[j]);i++;j++;}
    else if(dp[i+1][j]>=dp[i][j+1]){push(L,"inline-del",a[i++]);}
    else{push(R,"inline-add",b[j++]);}
  }
  while(i<n)push(L,"inline-del",a[i++]);
  while(j<m)push(R,"inline-add",b[j++]);
  const render=arr=>arr.map(x=>x.cls?'<mark class="'+x.cls+'">'+escapeHtml(x.text)+'</mark>':escapeHtml(x.text)).join("");
  return{left:render(L),right:render(R)};
}
function renderUnifiedDiff(rows){
  let html="",index=0;
  for(let i=0;i<rows.length;i++){
    const row=rows[i];
    if(row.type==="del"&&rows[i+1]?.type==="add"){
      const pair=charDiffPair(row.text,rows[i+1].text);
      html+="<div class=\"diff-line del\" data-diff-index=\""+index+"\"><span class=\"ln\">"+row.left+"</span><span class=\"code\"><span class=\"mark\">−</span>"+pair.left+"</span></div>";
      html+="<div class=\"diff-line add\" data-diff-index=\""+index+"\"><span class=\"ln\">"+rows[i+1].right+"</span><span class=\"code\"><span class=\"mark\">+</span>"+pair.right+"</span></div>";
      i++;index++;continue;
    }
    const number=row.type==="add"?row.right:row.left,mark=row.type==="add"?"+":row.type==="del"?"−":" ";
    const code=row.type==="ctx"?escapeHtml(row.text):"<mark class=\""+(row.type==="add"?"inline-add":"inline-del")+"\">"+escapeHtml(row.text)+"</mark>";
    html+="<div class=\"diff-line "+row.type+"\" data-diff-index=\""+index+"\"><span class=\"ln\">"+(number||"")+"</span><span class=\"code\"><span class=\"mark\">"+mark+"</span>"+code+"</span></div>";
    if(row.type!=="ctx")index++;
  }
  return html;
}

function renderSideBySideDiff(rows){
  let index=0,html="";
  for(let i=0;i<rows.length;i++){
    const row=rows[i];
    if(row.type==="del"&&rows[i+1]?.type==="add"){
      const right=rows[i+1],pair=charDiffPair(row.text,right.text);
      html+="<div class=\"side-row change\" data-diff-index=\""+index+"\"><div class=\"side-cell del\"><span class=\"side-ln\">"+row.left+"</span><code>"+pair.left+"</code></div><div class=\"side-cell add\"><span class=\"side-ln\">"+right.right+"</span><code>"+pair.right+"</code></div></div>";
      i++;index++;continue;
    }
    if(row.type==="add"||row.type==="del"){
      const cls=row.type==="add"?"add":"del";
      html+="<div class=\"side-row "+cls+"\" data-diff-index=\""+index+"\"><div class=\"side-cell "+cls+"\"><span class=\"side-ln\">"+(row.left||row.right||"")+"</span><code>"+(row.type==="add"?'<mark class=\"inline-add\">'+escapeHtml(row.text)+"</mark>":'<mark class=\"inline-del\">'+escapeHtml(row.text)+"</mark>")+"</code></div><div class=\"side-cell\"><span class=\"side-ln\"></span><code></code></div></div>";
      index++;continue;
    }
    html+="<div class=\"side-row ctx\"><div class=\"side-cell ctx\"><span class=\"side-ln\">"+row.left+"</span><code>"+escapeHtml(row.text)+"</code></div><div class=\"side-cell ctx\"><span class=\"side-ln\">"+row.right+"</span><code>"+escapeHtml(row.text)+"</code></div></div>";
  }
  return html;
}

function renderDiff(){const uiLang=document.documentElement.lang==="en"?"en":"ja",rows=diffLines(beforeEl.value,afterEl.value),groups=groupChanges(rows),added=rows.filter(row=>row.type==="add").length,removed=rows.filter(row=>row.type==="del").length,changed=groups.filter(group=>group.hasAdd&&group.hasDel).length;document.getElementById("addedStat").textContent=added;document.getElementById("removedStat").textContent=removed;document.getElementById("changedStat").textContent=changed;document.getElementById("diffSummary").textContent=uiLang==="en"?(added===0&&removed===0?"No changes":"Added "+added+" · Removed "+removed+" · Changed "+changed):(added===0&&removed===0?"変更なし":"追加 "+added+"行 · 削除 "+removed+"行 · 変更 "+changed+"箇所");const output=document.getElementById("diffOutput");if(!rows.some(row=>row.type!=="ctx")){output.innerHTML="<div class=\"no-diff\">"+(uiLang==="en"?"No changes.":"変更はありません。")+"</div>";return;}output.classList.toggle("side-by-side",diffViewMode==="side");output.innerHTML=diffViewMode==="side"?renderSideBySideDiff(rows):renderUnifiedDiff(rows);}

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
function errorFromNode(code,node,message="構文エラーを検出しました。"){const p=locationFromIndex(code,node.from);return{message,line:p.line,column:p.column,index:node.from};}
let babelParserPromise=null;
async function loadBabelParser(){if(!babelParserPromise)babelParserPromise=import("https://esm.sh/@babel/parser@7.28.4?bundle");const mod=await babelParserPromise;return mod.parse||mod.default?.parse;}
const lezerPromises={};
async function loadLezerPackage(name){if(!lezerPromises[name])lezerPromises[name]=import("https://esm.sh/@lezer/"+name+"@latest?bundle");const mod=await lezerPromises[name];return mod.parser||mod.default?.parser;}
async function parseLezer(code,grammar,name){const parser=await loadLezerPackage(grammar);if(!parser)throw new Error(name+" parser unavailable");const tree=parser.parse(code),errors=[];tree.iterate({enter(node){if(node.type?.isError)errors.push(errorFromNode(code,node,name+"の構文エラー"));}});return errors;}
async function checkJavaScript(code,language="javascript"){
  if(!code.trim())return{ok:true,message:"チェックするコードがありません。",errors:[]};
  try{
    const parse=await loadBabelParser();
    const plugins=language==="typescript"?["typescript","jsx"]:["jsx"];
    const ast=parse(code,{sourceType:"unambiguous",plugins,errorRecovery:true,sourceFilename:language==="typescript"?"input.tsx":"input.js"});
    const errors=(ast.errors||[]).map(e=>({message:e.message,line:e.loc?.line||null,column:e.loc?.column!=null?e.loc.column+1:null,index:e.pos??null}));
    if(!errors.length)return{ok:true,message:language==="typescript"?"TypeScriptの構文エラーは見つかりませんでした。":"JavaScriptの構文エラーは見つかりませんでした。",errors:[]};
    return{ok:false,message:errors[0].message,line:errors[0].line,column:errors[0].column,errors};
  }catch(error){
    const location=error?.loc?.line?{line:Number(error.loc.line),column:error.loc.column!=null?Number(error.loc.column)+1:null}:getSyntaxErrorLocation(error);
    const structural=findStructuralError(code),fallback=structural?indexToLocation(code,structural.index):{line:null,column:null};
    const e={message:error.message||"構文エラーです。",line:location.line||fallback.line,column:location.column||fallback.column,index:structural?.index??null};
    return{ok:false,message:e.message,line:e.line,column:e.column,errors:[e]};
  }
}
function checkHTMLTags(code){
  const stack=[],voidTags=new Set(["area","base","br","col","embed","hr","img","input","link","meta","param","source","track","wbr"]);
  const tagPattern=/<!--[\s\S]*?-->|<![^>]*>|<\s*(\/?)\s*([A-Za-z][A-Za-z0-9:-]*)([^>]*)>/g;let match;
  while((match=tagPattern.exec(code))){const full=match[0];if(full.startsWith("<!--")||full.startsWith("<!"))continue;const closing=Boolean(match[1]),name=match[2].toLowerCase(),attrs=match[3]||"",selfClosing=/\/\s*$/.test(attrs)||voidTags.has(name);
    if(closing){const top=stack[stack.length-1];if(!top||top.name!==name){const p=indexToLocation(code,match.index);return{message:top?"閉じタグ </"+name+"> が <"+top.name+"> と対応していません。":"閉じタグ </"+name+"> に対応する開始タグがありません。",line:p.line,column:p.column,index:match.index};}stack.pop();}
    else if(!selfClosing)stack.push({name,index:match.index});
  }
  const unclosed=stack[stack.length-1];if(unclosed){const p=indexToLocation(code,unclosed.index);return{message:"開始タグ <"+unclosed.name+"> が閉じられていません。",line:p.line,column:p.column,index:unclosed.index};}
  return null;
}
function checkHTML(code){
  if(!code.trim())return{ok:true,message:"チェックするコードがありません。",errors:[]};
  const errors=[];
  const tagPattern=/<!--(?:[\s\S]*?)-->|<![^>]*>|<\s*(\/?)\s*([A-Za-z][A-Za-z0-9:-]*)([^>]*)>/g;
  const stack=[];
  const voidTags=new Set(["area","base","br","col","embed","hr","img","input","link","meta","param","source","track","wbr"]);
  let match,lastEnd=0;
  while((match=tagPattern.exec(code))){
    const full=match[0];
    if(full.startsWith("<!--")){lastEnd=tagPattern.lastIndex;continue;}
    if(full.startsWith("<!")){
      if(!/^<!doctype\s+html\s*>$/i.test(full.trim())){
        const p=indexToLocation(code,match.index);
        errors.push({message:"DOCTYPEの形式を確認してください。",line:p.line,column:p.column,index:match.index});
      }
      lastEnd=tagPattern.lastIndex;continue;
    }
    const closing=Boolean(match[1]),name=match[2].toLowerCase(),attrs=match[3]||"";
    const p=indexToLocation(code,match.index);
    // Attribute quote check: report the actual tag position instead of 1:0.
    let q=null,escaped=false;
    for(let k=0;k<attrs.length;k++){
      const ch=attrs[k];
      if(escaped){escaped=false;continue;}
      if(ch==="\\"){escaped=true;continue;}
      if(q){if(ch===q)q=null;}
      else if(ch==="\""||ch==="'")q=ch;
    }
    if(q){
      errors.push({message:"属性値の引用符が閉じられていません。",line:p.line,column:p.column,index:match.index});
      lastEnd=tagPattern.lastIndex;continue;
    }
    const selfClosing=/\/\s*$/.test(attrs)||voidTags.has(name);
    if(closing){
      const top=stack[stack.length-1];
      if(!top||top.name!==name){
        errors.push({message:top?"閉じタグ </"+name+"> が <"+top.name+"> と対応していません。":"閉じタグ </"+name+"> に対応する開始タグがありません。",line:p.line,column:p.column,index:match.index});
      }else stack.pop();
    }else if(!selfClosing){
      stack.push({name,index:match.index});
    }
    lastEnd=tagPattern.lastIndex;
  }

  // A '<tag' with no closing '>' is invisible to tagPattern. Find it and report its real line.
  const remainder=code.slice(lastEnd);
  const badLt=remainder.search(/<\s*\/?\s*[A-Za-z][A-Za-z0-9:-]*(?:\s|$)/);
  if(badLt>=0){
    const index=lastEnd+badLt,p=indexToLocation(code,index);
    errors.push({message:"HTMLタグの '>' が見つかりません。",line:p.line,column:p.column,index});
  }

  const unclosed=stack[stack.length-1];
  if(unclosed){
    const p=indexToLocation(code,unclosed.index);
    errors.push({message:"開始タグ <"+unclosed.name+"> が閉じられていません。",line:p.line,column:p.column,index:unclosed.index});
  }
  errors.sort((a,b)=>a.index-b.index);
  if(errors.length)return{ok:false,message:errors[0].message,line:errors[0].line,column:errors[0].column,errors};
  return{ok:true,message:"HTMLのタグ対応・基本構文に問題は見つかりませんでした。",errors:[]};
}
function checkCSS(code){if(!code.trim())return{ok:true,message:"チェックするコードがありません。",errors:[]};try{const sheet=new CSSStyleSheet();sheet.replaceSync(code);return{ok:true,message:"CSSの構文エラーは見つかりませんでした。",errors:[]};}catch(error){const structural=findStructuralError(code),location=structural?indexToLocation(code,structural.index):getSyntaxErrorLocation(error),e={message:error.message||"CSS構文エラーです。",line:location.line,column:location.column,index:structural?.index??null};return{ok:false,message:e.message,line:e.line,column:e.column,errors:[e]};}}
function checkPythonFallback(code){const lines=splitLines(code),errors=[];for(let i=0;i<lines.length;i++){const raw=lines[i],trimmed=raw.trim();if(!trimmed||trimmed.startsWith("#"))continue;const leading=raw.match(/^[ \t]*/)?.[0]||"";if(leading.includes("\t")&&leading.includes(" "))errors.push({message:"タブとスペースが混在したインデントです。",line:i+1,column:1,index:0});if(/^(if|elif|else|for|while|try|except|finally|with|def|class)\b/.test(trimmed)&&!trimmed.endsWith(":"))errors.push({message:"ブロック文の末尾に ':' がありません。",line:i+1,column:raw.length,index:0});}return errors;}
async function checkPython(code){if(!code.trim())return{ok:true,message:"チェックするコードがありません。",errors:[]};try{const errors=await parseLezer(code,"python","Python");return errors.length?{ok:false,message:errors[0].message,line:errors[0].line,column:errors[0].column,errors}:{ok:true,message:"Pythonの構文エラーは見つかりませんでした。",errors:[]};}catch(error){const errors=checkPythonFallback(code);return errors.length?{ok:false,message:errors[0].message,line:errors[0].line,column:errors[0].column,errors}:{ok:true,message:"Pythonの基本構文に問題は見つかりませんでした。",errors:[]};}}
async function checkLezerLanguage(code,grammar,label){if(!code.trim())return{ok:true,message:"チェックするコードがありません。",errors:[]};try{const errors=await parseLezer(code,grammar,label);return errors.length?{ok:false,message:errors[0].message,line:errors[0].line,column:errors[0].column,errors}:{ok:true,message:label+"の構文エラーは見つかりませんでした。",errors:[]};}catch(error){const structural=findStructuralError(code),p=structural?indexToLocation(code,structural.index):{line:null,column:null},e={message:label+"の構文チェックを完了できませんでした。基本構造のみ確認してください。",line:p.line,column:p.column,index:structural?.index??null};return{ok:false,message:e.message,line:e.line,column:e.column,errors:[e],heuristic:true};}}
function checkCSharpRubyC(code,label){
  if(!code.trim())return{ok:true,message:"チェックするコードがありません。",errors:[]};
  const lines=splitLines(code),errors=[];
  const stack=findStructuralError(code);
  if(stack){const p=indexToLocation(code,stack.index);errors.push({message:label+"の括弧・ブロック構造に問題があります。",line:p.line,column:p.column,index:stack.index});}
  for(let i=0;i<lines.length;i++){
    const t=lines[i].trim();
    if(label==="Ruby"&&/^(def|class|module|if|unless|case|begin|do|while|until|for)\\b/.test(t)&&!/\\b(end|do)$/.test(t)&&!/[{}]$/.test(t))errors.push({message:"Rubyのブロック終端を確認してください。",line:i+1,column:1,index:0});
    if(label==="C#"&&/^using\\s+[^;]+$/.test(t))errors.push({message:"using文の末尾に ';' がありません。",line:i+1,column:lines[i].length,index:0});
    if(label==="C"&&/^(int|char|float|double|void|long|short)\\s+\\w+\\s*\\([^)]*\\)\\s*$/.test(t))errors.push({message:"C関数定義の末尾に '{' がありません。",line:i+1,column:t.length,index:0});
  }
  return errors.length?{ok:false,message:errors[0].message,line:errors[0].line,column:errors[0].column,errors}:{ok:true,message:label+"の基本構造に問題は見つかりませんでした。",errors:[],heuristic:true};
}
async function currentCheck(code){
  const lang=(document.getElementById("languageSelect")?.value||"javascript").toLowerCase();
  if(lang==="html")return checkHTML(code);
  if(lang==="css")return checkCSS(code);
  if(lang==="python")return checkPython(code);
  if(lang==="php")return checkLezerLanguage(code,"php","PHP");
  if(lang==="cpp")return checkLezerLanguage(code,"cpp","C++");
  if(lang==="c")return checkLezerLanguage(code,"cpp","C"); // C++ grammar as a C-like structural parser
  if(lang==="java")return checkLezerLanguage(code,"java","Java");
  if(lang==="go")return checkLezerLanguage(code,"go","Go");
  if(lang==="rust")return checkLezerLanguage(code,"rust","Rust");
  if(lang==="json")return checkLezerLanguage(code,"json","JSON");
  if(lang==="ruby")return checkCSharpRubyC(code,"Ruby");
  if(lang==="csharp")return checkCSharpRubyC(code,"C#");
  return checkJavaScript(code,lang);
}

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



let currentDiffTargets=[],currentDiffIndex=-1,currentErrors=[],currentErrorIndex=0;
function scrollToLine(line){
  if(!line)return;
  const lineHeight=parseFloat(getComputedStyle(afterEl).lineHeight)||19.8;
  afterEl.scrollTop=Math.max(0,(line-1)*lineHeight);
  beforeEl.scrollTop=Math.max(0,(line-1)*lineHeight);
}
function clearDiffActive(){
  document.querySelectorAll("#diffOutput [data-diff-index]").forEach(node=>node.classList.remove("is-active-diff"));
}
function setDiffTarget(index){
  if(!currentDiffTargets.length)return;
  currentDiffIndex=(index+currentDiffTargets.length)%currentDiffTargets.length;
  const target=currentDiffTargets[currentDiffIndex];
  scrollToLine(target.line);
  clearDiffActive();
  const nodes=document.querySelectorAll("#diffOutput [data-diff-index=\""+currentDiffIndex+"\"]");
  nodes.forEach(node=>node.classList.add("is-active-diff"));
  nodes[0]?.scrollIntoView({behavior:"smooth",block:"center"});
  document.getElementById("diffNavCount").textContent=(currentDiffIndex+1)+" / "+currentDiffTargets.length;
}
function prepareDiffNavigation(rows){
  currentDiffTargets=[];
  let index=0;
  for(const row of rows){
    if(row.type!=="ctx"){
      currentDiffTargets.push({line:row.right||row.left,index});
      index++;
    }
  }
  currentDiffIndex=-1;
  document.getElementById("diffNavCount").textContent=currentDiffTargets.length?"0 / "+currentDiffTargets.length:"0 / 0";
}

function renderSuspects(rows,groups,check){
  const section=document.getElementById("suspectsSection"),card=document.getElementById("suspectsCard");
  if(!section||!card)return;
  const candidates=[];
  groups.forEach((group,i)=>{const row=group.rows.find(r=>r.type==="add")||group.rows[0];candidates.push({line:row.right||row.left,text:row.text,score:100-i});});
  if(check?.line)candidates.sort((a,b)=>Math.abs(a.line-check.line)-Math.abs(b.line-check.line));
  if(!candidates.length){section.classList.add("hidden");return;}
  const en=document.documentElement.lang==="en";
  section.classList.remove("hidden");
  card.innerHTML=candidates.slice(0,8).map((c,i)=>"<button class=\"suspect-item\" type=\"button\" data-line=\""+c.line+"\"><span class=\"rank\">"+String(i+1).padStart(2,"0")+"</span><span><strong>"+(en?"Change block #":"変更ブロック候補 #")+(i+1)+"</strong><code>"+escapeHtml(String(c.text))+"</code><small>"+(en?"After line ":"変更後 ")+c.line+(en?"":"行目")+"</small></span></button>").join("")+"<p class=\"heuristic-note\">"+(en?"Heuristic estimate based on diffs and error locations. It does not prove the runtime bug cause.":"差分とエラー位置からの推定です。実行時バグを断定するものではありません。")+"</p>";
  card.querySelectorAll(".suspect-item").forEach(btn=>btn.addEventListener("click",()=>scrollToLine(Number(btn.dataset.line))));
}
async function renderSyntax(){
  const check=await currentCheck(afterEl.value),card=document.getElementById("syntaxCard");
  currentErrors=check.errors||[];
  currentErrorIndex=0;
  const en=document.documentElement.lang==="en";
  if(check.ok){
    card.innerHTML="<div class=\"syntax-ok\"><span class=\"syntax-icon\">✓</span><div><strong>"+(en?"No obvious syntax errors.":"構文は問題なさそうです。")+"</strong><small>"+escapeHtml(check.message)+"</small></div></div>";
    return check;
  }
  const nav=currentErrors.length>1?"<div class=\"error-nav\"><button id=\"prevErrorBtn\" type=\"button\">"+(en?"↑ PREVIOUS ERROR":"↑ 前のエラー")+"</button><span id=\"errorNavCount\">1 / "+currentErrors.length+"</span><button id=\"nextErrorBtn\" type=\"button\">"+(en?"NEXT ERROR ↓":"次のエラー ↓")+"</button></div>":"";
  const list=currentErrors.map((e,i)=>"<button class=\"error-item\" type=\"button\" data-error-index=\""+i+"\"><span>"+(i+1)+"</span><strong>"+(e.line?(en?"Line ":"")+" "+e.line+(en?"":"行目"):(en?"Unknown position":"位置不明"))+"</strong><code>"+escapeHtml(e.message||"Syntax error")+"</code></button>").join("");
  const locationText=check.line?(en?"After line "+check.line+(check.column?" (column "+check.column+")":""):"変更後コードの "+check.line+"行目付近"+(check.column?"（"+check.column+"列目）":"")):(en?"Error position could not be determined.":"エラー位置を特定できませんでした。");
  card.innerHTML="<div class=\"syntax-error\"><span class=\"syntax-icon\">!</span><div><strong>"+(en?"Syntax errors detected.":"構文エラーを検出しました。")+"</strong><small>"+escapeHtml(check.message)+"</small></div></div><ul class=\"error-list\"><li>"+(en?"Estimated position: ":"推定位置：")+escapeHtml(locationText)+"</li></ul>"+nav+"<div class=\"error-items\">"+list+"</div>";
  const goError=(idx)=>{if(!currentErrors.length)return;currentErrorIndex=(idx+currentErrors.length)%currentErrors.length;const e=currentErrors[currentErrorIndex];scrollToLine(e.line);card.querySelectorAll(".error-item").forEach((node,i)=>node.classList.toggle("is-active-error",i===currentErrorIndex));const active=card.querySelector(".error-item.is-active-error");active?.scrollIntoView({behavior:"smooth",block:"nearest"});document.getElementById("errorNavCount")&&(document.getElementById("errorNavCount").textContent=(currentErrorIndex+1)+" / "+currentErrors.length);};
  card.querySelectorAll(".error-item").forEach(btn=>btn.addEventListener("click",()=>goError(Number(btn.dataset.errorIndex))));
  document.getElementById("prevErrorBtn")?.addEventListener("click",()=>goError(currentErrorIndex-1));
  document.getElementById("nextErrorBtn")?.addEventListener("click",()=>goError(currentErrorIndex+1));
  return check;
}
function scrollToFirstDiff(rows){prepareDiffNavigation(rows);if(!currentDiffTargets.length)return;setDiffTarget(0);}
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
document.getElementById("prevDiffBtn")?.addEventListener("click",()=>setDiffTarget(currentDiffIndex-1));
document.getElementById("nextDiffBtn")?.addEventListener("click",()=>setDiffTarget(currentDiffIndex+1));

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



function encodeShareData(data){
  const bytes=new TextEncoder().encode(JSON.stringify(data));let binary="";for(const b of bytes)binary+=String.fromCharCode(b);
  return btoa(binary).replaceAll("+","-").replaceAll("/","_").replaceAll("=","");
}
function decodeShareData(value){
  const base=value.replaceAll("-","+").replaceAll("_","/")+"=".repeat((4-(value.length%4))%4);
  const binary=atob(base);const bytes=Uint8Array.from(binary,c=>c.charCodeAt(0));return JSON.parse(new TextDecoder().decode(bytes));
}
function createShareUrl(){
  const url=new URL(location.href);url.hash="share="+encodeShareData({before:beforeEl.value,after:afterEl.value,language:document.getElementById("languageSelect")?.value||"javascript"});return url.toString();
}
async function shareCurrent(){
  const url=createShareUrl();
  try{await navigator.clipboard.writeText(url);showToast(document.documentElement.lang==="en"?"Share URL copied to clipboard.":"共有URLをクリップボードにコピーしました。","success");}
  catch{showToast(document.documentElement.lang==="en"?"Clipboard access was unavailable. The share URL is ready in the address bar.":"クリップボードを利用できませんでした。共有URLをアドレスバーに生成しました。","info");history.replaceState(null,"",url);}
}
function loadSharedState(){
  if(!location.hash.startsWith("#share="))return;
  try{const data=decodeShareData(location.hash.slice(7));beforeEl.value=data.before||"";afterEl.value=data.after||"";if(data.language)document.getElementById("languageSelect").value=data.language;updateCounts();setTimeout(()=>compare(),0);}catch(error){console.warn("Invalid share data",error);}
}


const UI_TEXT={
ja:{
  brand:"コード比較ラボ",status:"ブラウザ内で処理",sample:"サンプル",clear:"クリア",share:"共有",lang:"EN",
  eyebrow:"差分解析",title:"何が変わった？<br><em>壊れた場所を探す。</em>",hero:"変更前と変更後のコードを並べて、追加・削除された行を比較。さらに変更後のコードに構文エラーがないかチェックします。",
  target:"チェック対象",languageNote:"差分比較はすべてのテキストで利用できます。",before:"変更前",beforeSub:"元のコード",after:"変更後",afterSub:"修正したコード",tab:"でインデント",mode:"行単位比較",
  compare:"比較して原因候補を探す",beforeCount:"変更前",afterCount:"変更後",unit:"行",map:"変更マップ",add:"追加",remove:"削除",changed:"変更ブロック",changedUnit:"箇所",
  diff:"差分",unified:"統合表示",side:"左右比較",prevDiff:"↑ 前の変更",nextDiff:"次の変更",suspect:"バグ原因候補",check:"エラーチェック",prevError:"↑ 前のエラー",nextError:"次のエラー",
  feature1Title:"差分を見つける",feature1Text:"追加・削除・変更ブロックを整理して表示します。",feature2Title:"エラーを探す",feature2Text:"対応言語の構文チェックから行・列を確認します。",feature3Title:"犯人候補を絞る",feature3Text:"エラー位置に近い変更を優先して調査できます。",footerTitle:"CODE MIRROR / 壊れたコードを観測する小さな研究室",footerLocal:"入力したコードはブラウザ内だけで処理されます。",targetDescription:"構文チェックする言語を選択",help:"ヘルプ",helpTitle:"CODE MIRRORの使い方",helpIntro:"コードの変更点と、変更後に発生した構文エラーをまとめて調査するためのツールです。",help1t:"01　コードを入れる",help1:"「変更前」に元のコード、「変更後」に修正したコードを貼り付けます。",help2t:"02　言語を選ぶ",help2:"「チェック対象」から構文チェックしたい言語を選択します。差分比較だけなら言語は問いません。",help3t:"03　比較する",help3:"差分を表示し、変更ブロックを確認します。最初の変更箇所へ自動スクロールします。",help4t:"04　エラーを調べる",help4:"構文エラーがあれば行・列と候補を表示。「次のエラー」「次の変更」で順番に移動できます。",helpNote:"入力したコードは基本的にブラウザ内で処理されます。共有機能はコードをURLに埋め込むため、共有URLの取り扱いには注意してください。"
},
en:{
  brand:"CODE COMPARE LAB",status:"Processed in browser",sample:"SAMPLE",clear:"CLEAR",share:"SHARE",lang:"JP",
  eyebrow:"DIFF ANALYSIS",title:"What changed?<br><em>Find where it broke.</em>",hero:"Compare before and after code line by line, then check the changed code for syntax errors.",
  target:"CHECK LANGUAGE",languageNote:"Diff comparison works with any text.",before:"BEFORE",beforeSub:"Original code",after:"AFTER",afterSub:"Modified code",tab:"for indentation",mode:"Line-based comparison",
  compare:"COMPARE & FIND SUSPECTS",beforeCount:"BEFORE",afterCount:"AFTER",unit:"lines",map:"CHANGE MAP",add:"ADDED",remove:"REMOVED",changed:"CHANGED BLOCKS",changedUnit:"blocks",
  diff:"DIFF",unified:"UNIFIED",side:"SIDE BY SIDE",prevDiff:"↑ PREVIOUS CHANGE",nextDiff:"NEXT CHANGE ↓",suspect:"SUSPECTED BUG CAUSES",check:"ERROR CHECK",prevError:"↑ PREVIOUS ERROR",nextError:"NEXT ERROR ↓",
  feature1Title:"Find the diff",feature1Text:"See added, removed, and changed blocks at a glance.",feature2Title:"Find errors",feature2Text:"Check supported languages and jump to error lines and columns.",feature3Title:"Narrow suspects",feature3Text:"Prioritize changes located near syntax errors.",footerTitle:"CODE MIRROR / A small lab for observing broken code",footerLocal:"Your code is processed only in the browser.",targetDescription:"Choose the language to syntax-check",help:"HELP",helpTitle:"How to use CODE MIRROR",helpIntro:"Investigate code changes and syntax errors introduced after a modification.",help1t:"01  Add your code",help1:"Paste the original code into BEFORE and the modified code into AFTER.",help2t:"02  Choose a language",help2:"Select a language for syntax checking. Diff comparison itself works with any text.",help3t:"03  Compare",help3:"Inspect the diff and change blocks. The view jumps to the first change automatically.",help4t:"04  Investigate errors",help4:"When errors are found, jump through their lines with PREVIOUS/NEXT ERROR and PREVIOUS/NEXT CHANGE.",helpNote:"Code is generally processed in your browser. Share URLs contain the code in the URL, so treat shared links accordingly."
}};
function showToast(message,type="info"){
  const el=document.getElementById("toast"); if(!el)return;
  el.textContent=message; el.dataset.type=type; el.classList.add("show");
  clearTimeout(showToast.timer); showToast.timer=setTimeout(()=>el.classList.remove("show"),2600);
}
function openHelp(){const modal=document.getElementById("helpModal");if(!modal)return;modal.classList.remove("hidden");modal.setAttribute("aria-hidden","false");document.body.classList.add("modal-open");document.getElementById("closeHelpBtn")?.focus();}
function closeHelp(){const modal=document.getElementById("helpModal");if(!modal)return;modal.classList.add("hidden");modal.setAttribute("aria-hidden","true");document.body.classList.remove("modal-open");}
function applyLocale(){
  const lang=document.documentElement.lang==="en"?"en":"ja",x=UI_TEXT[lang];
  const map={localStatus:x.status,sampleBtn:x.sample,clearBtn:x.clear,shareBtn:x.share,langBtn:x.lang,eyebrowText:x.eyebrow,heroTitle:x.title,heroText:x.hero,languageNote:x.languageNote,languageSelect:x.target,targetDescription:x.targetDescription,helpBtnText:x.help,shareBtnText:x.share,sampleBtnText:x.sample,clearBtnText:x.clear,feature1Title:x.feature1Title,feature1Text:x.feature1Text,feature2Title:x.feature2Title,feature2Text:x.feature2Text,feature3Title:x.feature3Title,feature3Text:x.feature3Text,helpTitle:x.helpTitle,helpIntro:x.helpIntro,helpIntro:x.helpIntro,helpStep1Title:x.help1t,helpStep1:x.help1,helpStep2Title:x.help2t,helpStep2:x.help2,helpStep3Title:x.help3t,helpStep3:x.help3,helpStep4Title:x.help4t,helpStep4:x.help4,helpNote:x.helpNote,beforeLabel:x.before,beforeSub:x.beforeSub,afterLabel:x.after,afterSub:x.afterSub,tabHint:x.tab,compareMode:x.mode,compareText:x.compare,beforeCountLabel:x.beforeCount,afterCountLabel:x.afterCount,beforeUnit:x.unit,afterUnit:x.unit,mapLabel:x.map,addedLabel:x.add,removedLabel:x.remove,changedLabel:x.changed,addedUnit:x.unit,removedUnit:x.unit,changedUnit:x.changedUnit,diffTitle:x.diff,unifiedViewBtn:x.unified,sideViewBtn:x.side,prevDiffBtn:x.prevDiff,nextDiffBtn:x.nextDiff,suspectLabel:x.suspect,checkLabel:x.check,prevErrorBtn:x.prevError,nextErrorBtn:x.nextError,footerTitle:x.footerTitle,footerLocal:x.footerLocal};
  Object.entries(map).forEach(([id,text])=>{const el=document.getElementById(id);if(!el)return;if(id==="languageSelect")el.setAttribute("aria-label",text);else el.innerHTML=text;});
  document.title=lang==="en"?"CODE MIRROR | Code Diff & Syntax Error Investigator":"CODE MIRROR｜コード差分・構文エラーを調べる開発者向けツール";const desc=lang==="en"?"Compare code changes, inspect diffs, and investigate syntax errors and suspected bug causes.":"変更前・変更後のコードを比較し、差分・構文エラー・バグ原因候補を調査できる開発者向けオンラインツール。";document.querySelector('meta[name="description"]')?.setAttribute("content",desc);document.querySelector('meta[property="og:title"]')?.setAttribute("content",document.title);document.querySelector('meta[property="og:description"]')?.setAttribute("content",desc);document.querySelector('meta[name="twitter:title"]')?.setAttribute("content",document.title);document.querySelector('meta[name="twitter:description"]')?.setAttribute("content",desc);
  document.documentElement.lang=lang;
}

document.getElementById("languageSelect")?.addEventListener("change",async()=>{applyLocale();if(!result.classList.contains("hidden"))await compare();});
document.getElementById("shareBtn")?.addEventListener("click",shareCurrent);document.getElementById("helpBtn")?.addEventListener("click",openHelp);document.getElementById("closeHelpBtn")?.addEventListener("click",closeHelp);document.querySelector("[data-close-help]")?.addEventListener("click",closeHelp);document.addEventListener("keydown",e=>{if(e.key==="Escape")closeHelp();});
document.getElementById("langBtn")?.addEventListener("click",()=>{const next=document.documentElement.lang==="ja"?"en":"ja";document.documentElement.lang=next;localStorage.setItem("codeMirrorLocale",next);applyLocale();});
(function(){const saved=localStorage.getItem("codeMirrorLocale");const ja=saved?saved==="ja":((navigator.language||"").toLowerCase().startsWith("ja")||Intl.DateTimeFormat().resolvedOptions().timeZone==="Asia/Tokyo");document.documentElement.lang=ja?"ja":"en";applyLocale();loadSharedState();})();
