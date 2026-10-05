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

greet("Mitsuki");`;

const sampleAfter = `function greet(name) {
  const message = "Hello, " + name;
  const emoji = " 🐛";
  console.log(message + emoji);
}

greet("Mitsuki");`;

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
  const check = syntaxCheck(afterEl.value);
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
