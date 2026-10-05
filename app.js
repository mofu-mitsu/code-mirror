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

function renderDiff() {
  const rows = diffLines(beforeEl.value, afterEl.value);
  const groups = groupChanges(rows);
  const added = rows.filter(row => row.type === "add").length;
  const removed = rows.filter(row => row.type === "del").length;
  const changed = groups.filter(group => group.hasAdd && group.hasDel).length;

  document.getElementById("addedStat").textContent = added;
  document.getElementById("removedStat").textContent = removed;
  document.getElementById("changedStat").textContent = changed;

  const summary = added === 0 && removed === 0
    ? "変更なし"
    : `追加 ${added}行 · 削除 ${removed}行 · 変更 ${changed}箇所`;
  document.getElementById("diffSummary").textContent = summary;

  const output = document.getElementById("diffOutput");

  if (!rows.some(row => row.type !== "ctx")) {
    output.innerHTML = '<div class="no-diff">変更はありません。</div>';
    return;
  }

  output.innerHTML = rows.map(row => {
    const number = row.type === "add" ? row.right : row.left;
    const mark = row.type === "add" ? "+" : row.type === "del" ? "−" : " ";
    return `
      <div class="diff-line ${row.type}">
        <span class="ln">${number || ""}</span>
        <span class="code"><span class="mark">${mark}</span>${escapeHtml(row.text)}</span>
      </div>`;
  }).join("");
}

function findStructuralError(code) {
  const stack=[];
  for(let i=0;i<code.length;i++){
    const ch=code[i];
    if("({[".includes(ch)) stack.push({ch,index:i});
    if(")}]".includes(ch)){
      const expected={")":"(","}":"{","]":"["}[ch];
      const top=stack[stack.length-1];
      if(!top||top.ch!==expected) return {index:i,message:"Unexpected "+ch};
      stack.pop();
    }
  }
  if(stack.length) return {index:Math.max(0,code.length-1),message:"Unclosed "+stack[stack.length-1].ch};
  return null;
}
function indexToLocation(code,index){
  const lines=code.slice(0,index).split("\n");
  const last=lines[lines.length-1];
  return {line:lines.length,column:last.length+1};
}
function checkHTML(code){
  if(!code.trim()) return {ok:true,message:"チェックするコードがありません。"};
  const doc=new DOMParser().parseFromString(code,"text/html");
  const err=doc.querySelector("parsererror");
  return err?{ok:false,message:err.textContent.trim(),line:null,column:null}:{ok:true,message:"HTMLの構文エラーは見つかりませんでした。"};
}
function checkCSS(code){
  if(!code.trim()) return {ok:true,message:"チェックするコードがありません。"};
  const structural=findStructuralError(code);
  if(structural){const p=indexToLocation(code,structural.index);return {ok:false,message:structural.message,line:p.line,column:p.column};}
  try{const sheet=new CSSStyleSheet();sheet.replaceSync(code);return {ok:true,message:"CSSの構文エラーは見つかりませんでした。"};}
  catch(e){return {ok:false,message:e.message||"CSS構文エラーです。",line:null,column:null};}
}
function currentCheck(code){
  const lang=document.getElementById("languageSelect")?.value||"javascript";
  if(lang==="html") return checkHTML(code);
  if(lang==="css") return checkCSS(code);
  return syntaxCheck(code);
}
function renderSuspects(rows,groups,check){
  const section=document.getElementById("suspectsSection"),card=document.getElementById("suspectsCard");
  if(!section||!card) return;
  const added=rows.filter(r=>r.type==="add");
  const candidates=added.map(row=>{const distance=check.line?Math.abs(row.right-check.line):99;let score=/[{}()[\]=;]|=>|function|const|let|var|return/.test(row.text)?2:0;if(check.line&&distance===0)score+=10;else if(check.line&&distance<=2)score+=5;return {row,distance,score};}).filter(x=>x.score>0).sort((a,b)=>b.score-a.score).slice(0,3);
  if(!check.ok&&candidates.length){
    section.classList.remove("hidden");
    card.innerHTML=candidates.map((c,i)=>"<article class=\"suspect-item\"><span class=\"rank\">0"+(i+1)+"</span><div><strong>"+(c.distance===0?c.row.right+"行目の追加変更がエラー位置と一致しています。":"変更ブロック候補 #"+Math.min(groups.length,i+1))+"</strong><code>+ "+escapeHtml(c.row.text)+"</code></div></article>").join("")+"<p class=\"heuristic-note\">差分とエラー位置からの推定です。実行時バグを断定するものではありません。</p>";
  }else section.classList.add("hidden");
}
const UI_TEXT={
ja:{brand:"コード比較ラボ",status:"ブラウザ内で処理",sample:"サンプル",clear:"クリア",eyebrow:"差分解析",title:"何が変わった？<br><em>壊れた場所を探す。</em>",hero:"変更前と変更後のコードを並べて、追加・削除された行を比較。さらに変更後のコードに構文エラーがないかチェックします。",target:"チェック対象",note:"差分比較はすべてのテキストで利用できます。",before:"変更前",beforeSub:"元のコード",after:"変更後",afterSub:"修正したコード",tab:"でインデント",mode:"行単位比較",compare:"比較して原因候補を探す",map:"変更マップ",add:"追加",remove:"削除",changed:"変更ブロック",check:"エラーチェック",suspect:"バグ原因候補",footer:"CODE MIRROR / 壊れたコードを観測する小さな研究室",local:"入力したコードはブラウザ内だけで処理されます。"},
en:{brand:"CODE COMPARE LAB",status:"Runs in browser",sample:"SAMPLE",clear:"CLEAR",eyebrow:"DIFF ANALYSIS",title:"What changed?<br><em>Find where it broke.</em>",hero:"Compare before and after code, inspect added and removed lines, then check the edited code for syntax errors.",target:"CHECK LANGUAGE",note:"Diff comparison works with any text.",before:"BEFORE",beforeSub:"Original code",after:"AFTER",afterSub:"Edited code",tab:"for indentation",mode:"Line-based diff",compare:"COMPARE & FIND SUSPECTS",map:"CHANGE MAP",add:"ADDED",remove:"REMOVED",changed:"CHANGED BLOCKS",check:"ERROR CHECK",suspect:"LIKELY BUG SUSPECTS",footer:"CODE MIRROR / A small lab for observing broken code",local:"Your code is processed locally in this browser."}
};
function applyLocale(){
  const x=UI_TEXT[document.documentElement.lang==="en"?"en":"ja"];
  const map={brandSub:x.brand,localStatus:x.status,sampleBtn:x.sample,clearBtn:x.clear,eyebrowText:x.eyebrow,heroTitle:x.title,heroText:x.hero,languageLabel:x.target,languageNote:x.note,beforeLabel:x.before,beforeSub:x.beforeSub,afterLabel:x.after,afterSub:x.afterSub,tabHint:x.tab,compareText:x.compare,mapLabel:x.map,addedLabel:x.add,removedLabel:x.remove,changedLabel:x.changed,checkLabel:x.check,suspectLabel:x.suspect,footerTitle:x.footer,footerLocal:x.local};
  Object.keys(map).forEach(id=>{const el=document.getElementById(id);if(el)el.innerHTML=map[id];});
  const lang=document.getElementById("languageSelect")?.value||"javascript";
  const name=lang==="html"?"HTML":lang==="css"?"CSS":"JavaScript";
  const mode=document.getElementById("compareMode");if(mode)mode.textContent=name+" · "+x.mode;
  document.getElementById("langBtn").textContent=document.documentElement.lang==="ja"?"EN":"日本語";
  document.title=document.documentElement.lang==="ja"?"CODE MIRROR — コード比較ラボ":"CODE MIRROR — Code Compare Lab";
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

function syntaxCheck(code) {
  if (!code.trim()) {
    return { ok: true, message: "チェックするコードがありません。" };
  }

  try {
    // new Functionはコードを実行せず、JavaScriptとして構文解析だけを行う。
    new Function(code);
    return { ok: true, message: "構文エラーは見つかりませんでした。" };
  } catch (error) {
    const location = getSyntaxErrorLocation(error);
    return {
      ok: false,
      message: error.message || "JavaScriptの構文エラーです。",
      line: location.line,
      column: location.column
    };
  }
}

function renderSyntax() {
  const check = currentCheck(afterEl.value);
  const card = document.getElementById("syntaxCard");

  if (check.ok) {
    card.innerHTML = `
      <div class="syntax-ok">
        <span class="syntax-icon">✓</span>
        <div>
          <strong>構文は問題なさそうです。</strong>
          <small>${escapeHtml(check.message)}</small>
        </div>
      </div>`;
    return;
  }

  const locationText = check.line
    ? `変更後コードの ${check.line}行目付近${check.column ? `（${check.column}列目）` : ""}`
    : "エラー位置を特定できませんでした。";

  card.innerHTML = `
    <div class="syntax-error">
      <span class="syntax-icon">!</span>
      <div>
        <strong>構文エラーを検出しました。</strong>
        <small>${escapeHtml(check.message)}</small>
      </div>
    </div>
    <ul class="error-list">
      <li>推定位置：${escapeHtml(locationText)}</li>
    </ul>`;
}

function compare() {
  result.classList.remove("hidden");
  syntaxSection.classList.remove("hidden");
  renderDiff();
  renderSyntax();
  const suspectRows=diffLines(beforeEl.value,afterEl.value);
  renderSuspects(suspectRows,groupChanges(suspectRows),currentCheck(afterEl.value));
}

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

document.getElementById("compareBtn").addEventListener("click", () => {
  compare();
  result.scrollIntoView({ behavior: "smooth", block: "start" });
});

document.getElementById("sampleBtn").addEventListener("click", () => {
  beforeEl.value = sampleBefore;
  afterEl.value = sampleAfter;
  updateCounts();
  compare();
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


document.getElementById("languageSelect")?.addEventListener("change",()=>{applyLocale();if(!result.classList.contains("hidden"))compare();});
document.getElementById("langBtn")?.addEventListener("click",()=>{const next=document.documentElement.lang==="ja"?"en":"ja";document.documentElement.lang=next;localStorage.setItem("codeMirrorLocale",next);applyLocale();});
(function(){const saved=localStorage.getItem("codeMirrorLocale");const ja=saved?saved==="ja":((navigator.language||"").toLowerCase().startsWith("ja")||Intl.DateTimeFormat().resolvedOptions().timeZone==="Asia/Tokyo");document.documentElement.lang=ja?"ja":"en";applyLocale();})();
