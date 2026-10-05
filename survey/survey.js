(function () {
  "use strict";

  const CONFIG = window.SURVEY_CONFIG || {};
  const CHARACTERS = window.CHARACTERS || [];
  const STORAGE_KEY = `asteria-survey:${CONFIG.surveyVersion || "v1"}`;
  const SUBMITTED_KEY = `${STORAGE_KEY}:submitted`;
  const app = document.getElementById("survey-app");
  const progressPart = document.getElementById("progress-part");
  const progressCount = document.getElementById("progress-count");
  const progressBar = document.getElementById("progress-bar");

  const IMPRESSION_ITEMS = [
    ["I1", "このキャラクターは「かわいい」と感じる"],
    ["I2", "このキャラクターは「かっこいい」と感じる"],
    ["I3", "このキャラクターは「落ち着いている」と感じる"],
    ["I4", "このキャラクターは「活発である」と感じる"],
    ["I5", "このキャラクターは「大人っぽい」と感じる"],
    ["I6", "このキャラクターは「親しみやすい」と感じる"]
  ];

  const CHANGE_ITEMS = [
    ["G1", "衣装変更後の姿は、最初に抱いたこのキャラクターの印象と異なると感じた"],
    ["G2", "この衣装変化を意外だと感じた"],
    ["G3", "衣装が変わっても、同じキャラクターらしさが保たれていると感じた"],
    ["G4", "この衣装は、このキャラクターに似合っていると感じた"],
    ["G5", "衣装変更によって、このキャラクターの魅力が増したと感じた"],
    ["G6", "衣装変更後の姿に違和感を感じた"]
  ];

  const PRIMARY_GAP_MOE_ITEM = [["GM1", "この衣装変化にギャップ萌えを感じた"]];
  const AUX_GAP_MOE_ITEMS = [
    ["GM2", "元の印象との違いそのものに魅力を感じた"],
    ["GM3", "このキャラクターの意外な一面に惹かれた"]
  ];

  const GARMENT_FACTORS = [
    ["F1", "色・色調", "明るさ、彩度、寒色・暖色、配色など"],
    ["F2", "服装ジャンル・テイスト", "制服、カジュアル、ストリート、ロリータ、スポーティなど"],
    ["F3", "フォーマル度", "端正・礼装的か、日常的・ラフか"],
    ["F4", "シルエット・形状", "丈、フィット感、ボリューム、輪郭など"],
    ["F5", "装飾・小物", "リボン、フリル、アクセサリー、バッグなど"],
    ["F6", "肌の露出・身体の見せ方", "肌の見える範囲、身体のラインの強調など"],
    ["F7", "柄・素材感", "無地・柄物、柔らかさ、硬さ、光沢感など"]
  ];
  const FACTOR_EFFECT_OPTIONS = [
    [-2, "大きく弱めた"],
    [-1, "少し弱めた"],
    [0, "影響しなかった"],
    [1, "少し高めた"],
    [2, "大きく高めた"]
  ];

  const VARIANTS = ["a", "b", "c"];

  function nowIso() { return new Date().toISOString(); }
  function uuid() {
    if (crypto.randomUUID) return crypto.randomUUID();
    const bytes = crypto.getRandomValues(new Uint8Array(16));
    bytes[6] = (bytes[6] & 0x0f) | 0x40;
    bytes[8] = (bytes[8] & 0x3f) | 0x80;
    return [...bytes].map((b, i) => `${[4,6,8,10].includes(i) ? "-" : ""}${b.toString(16).padStart(2, "0")}`).join("");
  }
  function shuffled(values) {
    const a = [...values];
    for (let i = a.length - 1; i > 0; i -= 1) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }
  function buildAssignment(group) {
    const result = {};
    CHARACTERS.forEach((character, index) => { result[character.id] = VARIANTS[(index + group) % 3]; });
    return result;
  }
  function newState() {
    const participantId = uuid();
    const baselineOrder = shuffled(CHARACTERS.map((c) => c.id));
    let transformOrder = shuffled(CHARACTERS.map((c) => c.id));
    if (transformOrder[0] === baselineOrder[baselineOrder.length - 1] && transformOrder.length > 1) {
      [transformOrder[0], transformOrder[1]] = [transformOrder[1], transformOrder[0]];
    }
    return {
      schema_version: "2.1",
      survey_version: CONFIG.surveyVersion || "v1",
      participant_id: participantId,
      assignment_group: null,
      assignment: {},
      started_at: nowIso(), completed_at: null, submitted_at: null,
      current_screen: "consent", baseline_index: 0, transform_index: 0, transform_subphase: "gm1",
      baseline_order: baselineOrder, transform_order: transformOrder,
      demographics: {}, baseline: {}, transform: {}, open_response: {}, screen_events: []
    };
  }
  function saveState(s) { localStorage.setItem(STORAGE_KEY, JSON.stringify(s)); }
  function submittedState(marker) {
    return {
      schema_version: "2.1", survey_version: marker.survey_version || CONFIG.surveyVersion || "v1",
      participant_id: marker.participant_id || "", submitted_at: marker.submitted_at || null,
      current_screen: "complete", assignment_group: marker.assignment_group ?? null,
      baseline: {}, transform: {}, screen_events: []
    };
  }
  function loadState() {
    try {
      const markerRaw = localStorage.getItem(SUBMITTED_KEY);
      if (markerRaw) return submittedState(JSON.parse(markerRaw));
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) return JSON.parse(raw);
    } catch (_) {}
    const s = newState(); saveState(s); return s;
  }
  function markSubmittedAndClearDetailedState(s) {
    const marker = {
      participant_id: s.participant_id, survey_version: s.survey_version,
      assignment_group: s.assignment_group, submitted_at: s.submitted_at || nowIso()
    };
    localStorage.setItem(SUBMITTED_KEY, JSON.stringify(marker));
    localStorage.removeItem(STORAGE_KEY);
  }

  let state = loadState();
  let screenShownAt = Date.now();
  function recordScreenExit(name) {
    state.screen_events.push({ screen: name, shown_at: new Date(screenShownAt).toISOString(), answered_at: nowIso(), duration_ms: Date.now() - screenShownAt });
    if (state.screen_events.length > 160) state.screen_events = state.screen_events.slice(-160);
    screenShownAt = Date.now();
  }
  function characterById(id) { return CHARACTERS.find((c) => c.id === id); }
  function detailValue(character, label) { return character.details?.find(([key]) => key === label)?.[1] || "—"; }
  function ageValue(character) { return character.stats?.find(([key]) => key === "AGE")?.[1] || "—"; }
  function escapeHtml(value) { return String(value ?? "").replace(/[&<>'"]/g, (ch) => ({"&":"&amp;","<":"&lt;",">":"&gt;","'":"&#39;",'"':"&quot;"}[ch])); }
  function setProgress(part, count, value) { progressPart.textContent = part; progressCount.textContent = count || ""; progressBar.style.width = `${Math.max(0, Math.min(100, value))}%`; }
  let disposeComparisonLayout = () => {};

  function card(inner) {
    disposeComparisonLayout();
    disposeComparisonLayout = () => {};
    app.classList.remove("survey-shell--comparison");
    app.innerHTML = `<section class="survey-card">${inner}</section>`;
    window.scrollTo(0, 0);
  }

  function likertHtml(items, prefix, anchors = ["1 まったくそう思わない", "4 どちらともいえない", "7 非常にそう思う"]) {
    return items.map(([id, text]) => `
      <div class="likert-item">
        <p class="likert-question">${escapeHtml(text)}</p>
        <div class="likert-scale" role="radiogroup" aria-label="${escapeHtml(text)}">
          ${[1,2,3,4,5,6,7].map((value) => `<div class="likert-option"><input type="radio" id="${prefix}-${id}-${value}" name="${prefix}-${id}" value="${value}" /><label for="${prefix}-${id}-${value}">${value}</label></div>`).join("")}
        </div>
        <div class="likert-anchors"><span>${escapeHtml(anchors[0])}</span><span>${escapeHtml(anchors[1])}</span><span>${escapeHtml(anchors[2])}</span></div>
      </div>`).join("");
  }
  function collectLikert(items, prefix) {
    const result = {};
    for (const [id] of items) {
      const checked = document.querySelector(`input[name="${prefix}-${id}"]:checked`);
      if (!checked) return null;
      result[id] = Number(checked.value);
    }
    return result;
  }
  function imageWithFallback(src, alt, missingText, className = "character-visual") {
    return `<div class="${className}" data-image-wrap><img src="${escapeHtml(src)}" alt="${escapeHtml(alt)}" data-fallback-image /><div class="image-missing">${escapeHtml(missingText)}</div></div>`;
  }
  function bindImageFallbacks() {
    const images = [...app.querySelectorAll("[data-fallback-image]")];
    const next = document.getElementById("next");
    if (!next || !images.length) return;

    const nextLabel = next.textContent;
    const controls = [
      ...app.querySelectorAll("input, select, textarea, button")
    ].map((control) => [control, control.disabled]);

    controls.forEach(([control]) => { control.disabled = true; });
    next.textContent = "画像を読み込み中…";
    app.setAttribute("aria-busy", "true");

    Promise.all(images.map(async (img) => {
      try {
        await img.decode();
        if (!img.naturalWidth || !img.naturalHeight) {
          throw new Error("IMAGE_NOT_AVAILABLE");
        }
      } catch (error) {
        if (img.isConnected) {
          img.closest("[data-image-wrap]")?.classList.add("is-missing");
        }
        throw error;
      }
    }))
      .then(() => new Promise((resolve) => {
        requestAnimationFrame(() => requestAnimationFrame(resolve));
      }))
      .then(() => {
        // 古い画面の非同期処理で、新しい画面を変更しない。
        if (!next.isConnected) return;

        screenShownAt = Date.now();
        controls.forEach(([control, wasDisabled]) => {
          control.disabled = wasDisabled;
        });
        next.textContent = nextLabel;
        app.removeAttribute("aria-busy");
      })
      .catch(() => {
        if (!next.isConnected) return;
        next.textContent = "画像を読み込めませんでした。再読み込みしてください";
        app.removeAttribute("aria-busy");
        // 回答欄と次へボタンは無効のままにする。
      });
  }

  function isTrustedGasOrigin(origin) {
    try {
      const url = new URL(origin);
      return url.protocol === "https:" && (
        url.hostname === "script.google.com" ||
        url.hostname === "script.googleusercontent.com" ||
        url.hostname.endsWith(".googleusercontent.com")
      );
    } catch (_) {
      return false;
    }
  }

  function requestAssignmentFromGas(participantId) {
    return new Promise((resolve, reject) => {
      const endpoint = String(CONFIG.gasEndpoint || "").trim();
      if (!endpoint) { reject(new Error("GAS_ENDPOINT_NOT_CONFIGURED")); return; }
      const iframe = document.getElementById("gas-submit-target"), form = document.createElement("form"), nonce = uuid();
      form.method = "GET"; form.action = endpoint; form.target = "gas-submit-target"; form.style.display = "none";
      for (const [name, value] of [["action","assign"],["participant_id",participantId],["nonce",nonce]]) {
        const input = document.createElement("input"); input.type = "hidden"; input.name = name; input.value = value; form.appendChild(input);
      }
      document.body.appendChild(form);
      let done = false;
      const cleanup = () => { window.removeEventListener("message", onMessage); form.remove(); };
      const timeout = setTimeout(() => { if (done) return; done = true; cleanup(); reject(new Error("GAS_ASSIGNMENT_TIMEOUT")); }, 20000);
      const onMessage = (event) => {
        console.log("GAS MESSAGE RECEIVED:", event.origin, event.data);
        const data = event.data;
        if (!isTrustedGasOrigin(event.origin) || !data || data.type !== "asteria-gas-assignment" || data.nonce !== nonce || done) return;
        done = true; clearTimeout(timeout); cleanup();
        if (!data.ok || ![0,1,2].includes(Number(data.assignment_group))) { reject(new Error(data.message || "GAS_ASSIGNMENT_FAILED")); return; }
        resolve(Number(data.assignment_group));
      };
      window.addEventListener("message", onMessage);
      try { form.submit(); } catch (error) { clearTimeout(timeout); cleanup(); reject(error); }
    });
  }
  async function ensureAssignment() {
    if (state.assignment_group !== null && state.assignment_group !== undefined && [0,1,2].includes(Number(state.assignment_group))) {
      state.assignment_group = Number(state.assignment_group);
      state.assignment = buildAssignment(state.assignment_group);
      return;
    }
    const group = await requestAssignmentFromGas(state.participant_id);
    state.assignment_group = group;
    state.assignment = buildAssignment(group);
    saveState(state);
  }

  function renderConsent() {
    state.current_screen = "consent"; saveState(state); setProgress("INTRO", "", 2);
    card(`<p class="survey-kicker">RESEARCH SURVEY / 2026</p><h1 class="survey-title">キャラクター衣装変化に関する<br />印象評価アンケート</h1>
      <p class="survey-lead">本調査では、オリジナルキャラクターの外見や衣装に対して抱く印象について調査します。正解・不正解はありません。ご自身が感じた印象に基づいて回答してください。</p>
      <div class="survey-note">回答時間の目安は25〜35分です。回答は研究目的の分析に使用します。氏名・メールアドレス等の直接個人を特定する情報は収集しません。途中の進捗はこのブラウザに保存されます。</div>
      <label class="consent-row"><input type="checkbox" id="consent" /><span>上記を確認し、研究への参加に同意します。</span></label>
      <div class="survey-actions"><button class="survey-button" id="next" disabled>アンケートを開始</button></div>`);
    const check = document.getElementById("consent"), next = document.getElementById("next");
    check.addEventListener("change", () => next.disabled = !check.checked);
    next.addEventListener("click", async () => {
      next.disabled = true; next.textContent = "割当を準備中…";
      try {
        await ensureAssignment();
        recordScreenExit("consent"); state.current_screen = "demographics"; saveState(state); render();
      } catch (error) {
        next.disabled = false; next.textContent = "アンケートを開始";
        alert("参加条件の割当を取得できませんでした。通信環境を確認して、もう一度お試しください。");
      }
    });
  }

  function renderDemographics() {
    state.current_screen = "demographics"; saveState(state); setProgress("PROFILE", "PARTICIPANT", 6);
    card(`<p class="survey-kicker">PARTICIPANT PROFILE</p><h1 class="survey-title">はじめに、あなたについて</h1><p class="survey-lead">分析のため、以下の項目に回答してください。</p>
      <div class="form-section field-grid"><label class="field"><span>年齢を教えてください</span><input id="age" type="number" min="1" max="100" inputmode="numeric" /></label><label class="field"><span>性別を教えてください</span><select id="gender"><option value="">選択してください</option><option>男性</option><option>女性</option><option>その他</option><option>回答しない</option></select></label></div>
      <div class="form-section"><h2>関心度</h2>${likertHtml([["D3","アニメ・漫画・ゲーム等のキャラクターコンテンツにどの程度関心がありますか"],["D4","キャラクターの衣装や外見デザインにどの程度関心がありますか"],["D5","ファッションにどの程度関心がありますか"]], "demo", ["1 まったく関心がない","4 どちらともいえない","7 非常に関心がある"])}</div>
      <div class="form-section"><h2>「ギャップ萌え」という言葉について</h2><div class="inline-radios">${[[1,"知らない"],[2,"聞いたことはあるが、意味はよく知らない"],[3,"意味を知っている"],[4,"よく知っており、普段から使うことがある"]].map(([v,t])=>`<label><input type="radio" name="gap-familiarity" value="${v}" /><span>${v}. ${t}</span></label>`).join("")}</div></div>
      <div class="survey-actions"><button class="survey-button" id="next">次へ</button></div>`);
    document.getElementById("next").addEventListener("click", () => {
      const age = Number(document.getElementById("age").value), gender = document.getElementById("gender").value;
      const interests = collectLikert([["D3"],["D4"],["D5"]], "demo"), familiarity = document.querySelector('input[name="gap-familiarity"]:checked');
      if (!age || age < 1 || age > 100 || !gender || !interests || !familiarity) { alert("すべての必須項目に回答してください。"); return; }
      state.demographics = { age, gender, character_content_interest: interests.D3, character_design_interest: interests.D4, fashion_interest: interests.D5, gap_moe_familiarity: Number(familiarity.value) };
      recordScreenExit("demographics"); state.current_screen = "part1-intro"; saveState(state); render();
    });
  }

  function renderPart1Intro() {
    state.current_screen = "part1-intro"; saveState(state); setProgress("PART 1", "CHARACTER IMPRESSION", 9);
    card(`<p class="survey-kicker">PART 1 / CHARACTER IMPRESSION</p><h1 class="survey-title">10人のキャラクターを<br />紹介します</h1><p class="survey-lead">画像とプロフィールを確認した後、そのキャラクターから受けた印象について回答してください。</p><div class="survey-note">後から正解を確認する問題ではありません。表示された情報から、現在感じた印象をそのまま回答してください。回答確定後は前のキャラクターへ戻れません。</div><div class="survey-actions"><button class="survey-button" id="next">PART 1 を開始</button></div>`);
    document.getElementById("next").addEventListener("click", () => { recordScreenExit("part1-intro"); state.current_screen = "baseline"; saveState(state); render(); });
  }

  function characterProfileHtml(character) {
    const fields = [
      ["AGE", ageValue(character)],
      ["HOBBY", detailValue(character, "HOBBY")],
      ["SPECIALTY", detailValue(character, "SPECIALTY")],
      ["LIKES", detailValue(character, "LIKES")]
    ];

    return `<div class="character-profile">
      <p>${escapeHtml(character.intro)}</p>
      <div class="profile-tags">
        ${fields.map(([label, value]) => `
          <div>
            <span>${escapeHtml(label)}</span>
            <strong>${escapeHtml(value)}</strong>
          </div>`).join("")}
      </div>
    </div>`;
  }

  function renderBaseline() {
    const index = state.baseline_index;
    if (index >= state.baseline_order.length) { state.current_screen = "part2-intro"; saveState(state); render(); return; }
    const character = characterById(state.baseline_order[index]);
    setProgress("PART 1", `${String(index + 1).padStart(2,"0")} / 10`, 10 + ((index + 1) / 10) * 30);
    card(`<div class="character-stage"><div class="character-panel">${imageWithFallback(`../${character.image}`, `${character.name}の基準画像`, "基準画像が見つかりません。assets/characters/ の画像配置を確認してください。")}
      <div class="character-idline"><span>FILE ${character.number}</span><span>${character.unit}</span></div><h1 class="character-name">${escapeHtml(character.name)}</h1><p class="character-kana">${escapeHtml(character.kana)} / ${escapeHtml(character.roman)}</p>
      ${characterProfileHtml(character)}</div>
      <div><p class="survey-kicker">BASELINE IMPRESSION / ${character.number}</p><div class="question-block"><h2>このキャラクターについて、現在感じている印象を回答してください。</h2><p>1〜7の中から、最も近いものを選択してください。</p>${likertHtml(IMPRESSION_ITEMS, `base-${character.id}`)}</div><div class="survey-actions"><button class="survey-button" id="next">回答を確定して次へ</button></div></div></div>`);
    bindImageFallbacks();
    document.getElementById("next").addEventListener("click", () => {
      const ratings = collectLikert(IMPRESSION_ITEMS, `base-${character.id}`); if (!ratings) { alert("6項目すべてに回答してください。"); return; }
      state.baseline[character.id] = { character_id: character.id, ratings, order_index:index, shown_at:new Date(screenShownAt).toISOString(), answered_at:nowIso(), duration_ms:Date.now()-screenShownAt };
      recordScreenExit(`baseline:${character.id}`); state.baseline_index += 1; saveState(state); render();
    });
  }

  function renderPart2Intro() {
    state.current_screen = "part2-intro"; saveState(state); setProgress("PART 2", "OUTFIT TRANSFORMATION", 43);
    card(`<p class="survey-kicker">PART 2 / OUTFIT TRANSFORMATION</p><h1 class="survey-title">衣装変更後の印象を<br />評価してください</h1><p class="survey-lead">元の姿と衣装変更後の姿を見比べ、衣装変更後のキャラクターから受ける印象と、その変化について回答してください。</p><div class="survey-note"><strong>「ギャップ萌え」について：</strong><br />本調査では、先に抱いたキャラクターの印象とは異なる一面に対して魅力を感じること、という意味で用います。衣装の変化が大きいほどギャップ萌えである、という意味ではありません。</div><div class="survey-actions"><button class="survey-button" id="next">PART 2 を開始</button></div>`);
    document.getElementById("next").addEventListener("click", () => { recordScreenExit("part2-intro"); state.current_screen = "transform"; state.transform_subphase = "gm1"; saveState(state); render(); });
  }

  function compareImagesHtml(character, transformedSrc) {
    return `<p class="survey-kicker">OUTFIT EVALUATION / ${character.number}</p><h1 class="character-name">${escapeHtml(character.name)}</h1><p class="character-kana">${escapeHtml(character.kana)} / ${escapeHtml(character.roman)}</p><div class="compare-stage" style="margin-top:26px"><div><div class="compare-label"><span>REFERENCE</span><span>元の姿</span></div>${imageWithFallback(`../${character.image}`, `${character.name}の元画像`, "元画像が見つかりません。", "compare-image")}</div><div><div class="compare-label"><span>OUTFIT CHANGE</span><span>衣装変更後</span></div>${imageWithFallback(transformedSrc, `${character.name}の衣装変更後画像`, "衣装変更後画像が未配置です。assets/survey/transforms/ を確認してください。", "compare-image")}</div></div>`;
  }

  function compareHeader(character, transformedSrc) {
    return `${compareImagesHtml(character, transformedSrc)}
      ${characterProfileHtml(character)}`;
  }

  function renderComparisonCard(character, transformedSrc, questionsHtml) {
    card(`
      <div class="comparison-layout">
        <section class="comparison-reference"
          aria-label="比較画像とキャラクタープロフィール">
          ${compareHeader(character, transformedSrc)}
        </section>
        <div class="comparison-questions">
          ${questionsHtml}
        </div>
      </div>
    `);
    app.classList.add("survey-shell--comparison");

    const panel = app.querySelector(".comparison-reference");
    const desktop = window.matchMedia("(min-width: 1100px)");

    function updateStickyState() {
      const fitsViewport =
        panel.getBoundingClientRect().height <= window.innerHeight - 40;
      panel.classList.toggle(
        "is-sticky",
        desktop.matches && fitsViewport
      );
    }

    const observer = new ResizeObserver(updateStickyState);
    observer.observe(panel);
    window.addEventListener("resize", updateStickyState);
    updateStickyState();

    disposeComparisonLayout = () => {
      observer.disconnect();
      window.removeEventListener("resize", updateStickyState);
    };
  }

  function renderTransform() {
    const index = state.transform_index;
    if (index >= state.transform_order.length) { state.current_screen = "open-response"; saveState(state); render(); return; }
    const character = characterById(state.transform_order[index]), variant = state.assignment[character.id];
    if (!VARIANTS.includes(variant)) {
      alert("参加条件の割当を確認できません。ページを再読み込みしてください。");
      return;
    }
    const transformedSrc = CONFIG.transformImagePath ? CONFIG.transformImagePath(character.id, variant) : `../assets/survey/transforms/${character.id}/${variant}.png`;
    const baseProgress = 45 + (index / 10) * 43;
    const phaseProgress = state.transform_subphase === "gm1" ? 0 : state.transform_subphase === "core" ? 1.8 : 3.5;
    setProgress("PART 2", `${String(index + 1).padStart(2,"0")} / 10`, baseProgress + phaseProgress);

    if (state.transform_subphase === "factors") { renderFactorPhase(character, variant, transformedSrc, index); return; }
    if (state.transform_subphase === "core") { renderCorePhase(character, variant, transformedSrc, index); return; }
    renderPrimaryGapMoePhase(character, variant, transformedSrc, index);
  }

  function renderPrimaryGapMoePhase(character, variant, transformedSrc, index) {
    renderComparisonCard(character, transformedSrc, `
      <div class="question-block"><p class="survey-kicker">FIRST IMPRESSION</p><h2>まず、この衣装変化を見て感じた「ギャップ萌え」の程度を回答してください。</h2><p>この回答を確定した後、印象や衣装変化について詳しく回答します。</p>${likertHtml(PRIMARY_GAP_MOE_ITEM, `tr-gm1-${character.id}`)}</div>
      <div class="survey-actions"><button class="survey-button" id="next">ギャップ萌え評価を確定して次へ</button></div>`);
    bindImageFallbacks();
    document.getElementById("next").addEventListener("click", () => {
      const gm1 = collectLikert(PRIMARY_GAP_MOE_ITEM, `tr-gm1-${character.id}`);
      if (!gm1) { alert("ギャップ萌えの程度を回答してください。"); return; }
      state.transform[character.id] = {
        character_id: character.id, variant_id: variant, order_index: index,
        impressions: null, changes: null, gap_moe: { GM1: gm1.GM1 },
        gm1_shown_at: new Date(screenShownAt).toISOString(), gm1_answered_at: nowIso(), gm1_duration_ms: Date.now() - screenShownAt,
        core_shown_at: null, core_answered_at: null, core_duration_ms: null, garment_factors: null
      };
      recordScreenExit(`transform-gm1:${character.id}`); state.transform_subphase = "core"; saveState(state); render();
    });
  }

  function renderCorePhase(character, variant, transformedSrc, index) {
    const item = state.transform[character.id];
    if (!item || !item.gap_moe || !Number.isInteger(item.gap_moe.GM1)) {
      state.transform_subphase = "gm1"; saveState(state); render(); return;
    }
    renderComparisonCard(character, transformedSrc, `
      <div class="question-block"><h2>衣装変更後のキャラクターについて回答してください。</h2><p>衣装変更後の姿から現在受ける印象として回答してください。</p>${likertHtml(IMPRESSION_ITEMS, `tr-imp-${character.id}`)}</div>
      <div class="question-block"><h2>衣装の変化について回答してください。</h2>${likertHtml(CHANGE_ITEMS, `tr-change-${character.id}`)}</div>
      <div class="question-block"><h2>この衣装変化から感じた魅力について、補助的な2項目に回答してください。</h2>${likertHtml(AUX_GAP_MOE_ITEMS, `tr-gap-aux-${character.id}`)}</div>
      <div class="survey-actions"><button class="survey-button" id="next">全体評価を確定して次へ</button></div>`);
    bindImageFallbacks();
    document.getElementById("next").addEventListener("click", () => {
      const impressions = collectLikert(IMPRESSION_ITEMS, `tr-imp-${character.id}`);
      const changes = collectLikert(CHANGE_ITEMS, `tr-change-${character.id}`);
      const gapAux = collectLikert(AUX_GAP_MOE_ITEMS, `tr-gap-aux-${character.id}`);
      if (!impressions || !changes || !gapAux) { alert("すべての項目に回答してください。"); return; }
      item.impressions = impressions; item.changes = changes;
      item.gap_moe = { GM1: item.gap_moe.GM1, GM2: gapAux.GM2, GM3: gapAux.GM3 };
      item.core_shown_at = new Date(screenShownAt).toISOString(); item.core_answered_at = nowIso(); item.core_duration_ms = Date.now() - screenShownAt;
      recordScreenExit(`transform-core:${character.id}`); state.transform_subphase = "factors"; saveState(state); render();
    });
  }

  function factorSelectorHtml() {
    return `<div class="factor-grid"><label class="factor-chip none"><input type="checkbox" value="none" id="factor-none" /><span><strong>特に変化を感じた要素はない</strong><small>下の要素に明確な変化を感じなかった場合</small></span></label>${GARMENT_FACTORS.map(([id,label,help])=>`<label class="factor-chip"><input type="checkbox" value="${id}" data-factor /><span><strong>${escapeHtml(label)}</strong><small>${escapeHtml(help)}</small></span></label>`).join("")}</div>`;
  }
  function renderFactorRatings(selected, draftEffects = {}) {
    const host = document.getElementById("factor-ratings");
    if (selected.includes("none")) { host.innerHTML = `<p class="survey-note">「特に変化を感じた要素はない」が選択されています。寄与度の評価はありません。</p>`; return; }
    if (!selected.length) { host.innerHTML = `<p class="survey-note">変化を感じた服装要素を1つ以上選択してください。該当しない場合は「特に変化を感じた要素はない」を選択してください。</p>`; return; }
    host.innerHTML = selected.map((id) => {
      const [,label] = GARMENT_FACTORS.find(([fid]) => fid === id);
      return `<div class="factor-rating"><div class="factor-rating-head"><strong>${escapeHtml(label)}</strong><span>この要素の変化がギャップ萌えに与えた影響</span></div><div class="effect-scale">${FACTOR_EFFECT_OPTIONS.map(([value, text])=>`<div class="effect-option"><input type="radio" id="effect-${id}-${value}" name="effect-${id}" value="${value}" ${draftEffects[id] === value ? "checked" : ""} /><label for="effect-${id}-${value}"><span class="effect-option-value">${value > 0 ? "+" : ""}${value}</span><span class="effect-option-text">${text}</span></label></div>`).join("")}</div></div>`;
    }).join("");
  }
  function selectedFactors() {
    if (document.getElementById("factor-none")?.checked) return ["none"];
    return [...document.querySelectorAll("input[data-factor]:checked")].map((x) => x.value);
  }

  function renderFactorPhase(character, variant, transformedSrc, index) {
    renderComparisonCard(character, transformedSrc, `
      <div class="question-block"><p class="survey-kicker">GARMENT TRANSFORMATION FACTORS</p><h2>具体的に、服装のどの要素が変化したと感じましたか。</h2><p>先ほどの全体的な印象評価は確定済みです。ここでは、元の衣装と比較して変化を感じた服装要素をすべて選択してください。</p>${factorSelectorHtml()}</div>
      <div class="question-block"><h2>選んだ服装の変化は、ギャップ萌えの感じ方にどう関わりましたか？</h2><p>その変化によって魅力を感じやすくなったか、感じにくくなったかを答えてください。<br />例：色が変わって、より魅力的に感じたら「高めた」。色は変わったが魅力の感じ方には関係なければ「影響しなかった」。</p><div id="factor-ratings"></div></div>
      <div class="survey-actions"><button class="survey-button" id="next">服装要因を確定して次のキャラクターへ</button></div>`);
    bindImageFallbacks();
    const none = document.getElementById("factor-none");
    const factors = [...document.querySelectorAll("input[data-factor]")];
    const draftEffects = {};
    function captureEffects() {
      GARMENT_FACTORS.forEach(([id]) => {
        const checked = document.querySelector(`input[name="effect-${id}"]:checked`);
        if (checked) draftEffects[id] = Number(checked.value);
      });
    }
    function update() {
      captureEffects();
      renderFactorRatings(selectedFactors(), draftEffects);
    }
    none.addEventListener("change", () => {
      captureEffects();
      if (none.checked) factors.forEach((x) => { x.checked = false; });
      renderFactorRatings(selectedFactors(), draftEffects);
    });
    factors.forEach((x) => x.addEventListener("change", () => {
      captureEffects();
      if (x.checked) none.checked = false;
      renderFactorRatings(selectedFactors(), draftEffects);
    }));
    update();
    document.getElementById("next").addEventListener("click", () => {
      const selected = selectedFactors();
      if (!selected.length) { alert("変化を感じた要素を選択するか、「特に変化を感じた要素はない」を選択してください。"); return; }
      const effects = {};
      if (!selected.includes("none")) {
        for (const id of selected) {
          const checked = document.querySelector(`input[name="effect-${id}"]:checked`);
          if (!checked) { alert("選択したすべての服装要素について、ギャップ萌えへの影響を回答してください。"); return; }
          effects[id] = Number(checked.value);
        }
      }
      const item = state.transform[character.id];
      if (!item) { alert("全体評価データを確認できません。ページを再読み込みしてください。"); return; }
      item.garment_factors = { selected: selected.includes("none") ? [] : selected, none_selected:selected.includes("none"), effects, factor_shown_at:new Date(screenShownAt).toISOString(), factor_answered_at:nowIso(), factor_duration_ms:Date.now()-screenShownAt };
      item.answered_at = nowIso();
      recordScreenExit(`transform-factors:${character.id}`); state.transform_index += 1; state.transform_subphase = "gm1"; saveState(state); render();
    });
  }

  function characterChoicesHtml(name, selected) {
    return `<div class="character-choice-grid">${CHARACTERS.map((character) => {
      const variant = state.transform[character.id]?.variant_id || state.assignment[character.id];
      const transformedSrc = CONFIG.transformImagePath ? CONFIG.transformImagePath(character.id, variant) : `../assets/survey/transforms/${character.id}/${variant}.png`;
      return `<label class="character-choice"><input type="radio" name="${name}" value="${escapeHtml(character.id)}" ${selected === character.id ? "checked" : ""} />
        <span class="character-choice-body"><strong class="character-choice-name">${escapeHtml(character.name)}</strong>
          <span class="character-choice-images"><span><span class="character-choice-photo character-choice-photo--face"><img src="${escapeHtml(`../${character.image}`)}" alt="${escapeHtml(character.name)}の元の姿" loading="lazy" /></span><small>元の姿（顔）</small></span><span><span class="character-choice-photo"><img src="${escapeHtml(transformedSrc)}" alt="${escapeHtml(character.name)}の衣装変更後の姿" loading="lazy" /></span><small>衣装変更後</small></span></span>
        </span></label>`;
    }).join("")}
      <label class="character-choice character-choice--text"><input type="radio" name="${name}" value="none" ${selected === "none" ? "checked" : ""} /><span class="character-choice-body">特になし</span></label>
      <label class="character-choice character-choice--text"><input type="radio" name="${name}" value="" ${!selected ? "checked" : ""} /><span class="character-choice-body">回答しない</span></label>
    </div>`;
  }
  function renderOpenResponse() {
    state.current_screen = "open-response"; saveState(state); setProgress("FINAL", "FREE RESPONSE", 91);
    card(`<p class="survey-kicker">OPTIONAL / FREE RESPONSE</p><h1 class="survey-title">最後に、感じたことを<br />自由に教えてください</h1><p class="survey-lead">以下は任意回答です。名前と画像を見比べて、当てはまるキャラクターを選んでください。</p>
      <fieldset class="character-choice-section"><legend>最も「ギャップ萌え」を感じたキャラクター</legend>${characterChoicesHtml("strongest", state.open_response.strongest_character)}</fieldset>
      <label class="field open-response-reason" for="strongest-reason"><span>選んだ理由（任意）</span><textarea id="strongest-reason" placeholder="どのような点にギャップ萌えを感じたか、よければ教えてください。">${escapeHtml(state.open_response.strongest_reason||"")}</textarea></label>
      <fieldset class="character-choice-section"><legend>印象の違いは感じたものの、ギャップ萌えにはつながらなかったキャラクター</legend>${characterChoicesHtml("nongap", state.open_response.nongap_character)}</fieldset>
      <label class="field open-response-reason" for="nongap-reason"><span>選んだ理由（任意）</span><textarea id="nongap-reason" placeholder="なぜギャップ萌えにはつながらなかったと感じたか、よければ教えてください。">${escapeHtml(state.open_response.nongap_reason||"")}</textarea></label>
      <div class="survey-actions"><button class="survey-button" id="next">回答内容を確定</button></div>`);
    document.getElementById("next").addEventListener("click", () => {
      state.open_response = { strongest_character:document.querySelector('input[name="strongest"]:checked')?.value||null, strongest_reason:document.getElementById("strongest-reason").value.trim(), nongap_character:document.querySelector('input[name="nongap"]:checked')?.value||null, nongap_reason:document.getElementById("nongap-reason").value.trim() };
      recordScreenExit("open-response"); state.current_screen = "review"; saveState(state); render();
    });
  }

  function buildPayload() {
    return { schema_version:state.schema_version, survey_version:state.survey_version, participant_id:state.participant_id, assignment_group:state.assignment_group, started_at:state.started_at, completed_at:state.completed_at||nowIso(), demographics:state.demographics, baseline_order:state.baseline_order, transform_order:state.transform_order, baseline:state.baseline_order.map((id)=>state.baseline[id]), transform:state.transform_order.map((id)=>state.transform[id]), open_response:state.open_response, screen_events:state.screen_events, user_agent:navigator.userAgent };
  }
  function getSubmissionPayloadJson() {
    if (!state.submission_payload_json) {
      state.completed_at = state.completed_at || nowIso();
      state.submission_payload_json = JSON.stringify(buildPayload());
    }

    // 保存できたことを確認してから、送信に使用する。
    // 再読み込み後も、この文字列をそのまま再利用する。
    saveState(state);
    return state.submission_payload_json;
  }

  function createLocalDownload(payloadJson) {
    const blob = new Blob([payloadJson], {type:"application/json"}), url = URL.createObjectURL(blob), a=document.createElement("a");
    a.href=url; a.download=`asteria-survey-${state.participant_id}.json`; a.textContent="回答JSONをこの端末に保存する"; a.className="download-link"; return a;
  }
  function submitToGas(payloadJson) {
    return new Promise((resolve,reject)=>{
      const endpoint=String(CONFIG.gasEndpoint||"").trim(); if(!endpoint){reject(new Error("GAS_ENDPOINT_NOT_CONFIGURED"));return;}
      const iframe=document.getElementById("gas-submit-target"), form=document.createElement("form"), nonce=uuid();
      form.method="POST"; form.action=endpoint; form.target="gas-submit-target"; form.style.display="none";
      for (const [name,value] of [["payload",payloadJson],["nonce",nonce]]) { const input=document.createElement("input"); input.type="hidden"; input.name=name; input.value=value; form.appendChild(input); }
      document.body.appendChild(form);
      let done=false;
      const cleanup=()=>{window.removeEventListener("message",onMessage);form.remove();};
      const timeout=setTimeout(()=>{if(done)return;done=true;cleanup();reject(new Error("GAS_SUBMIT_TIMEOUT"));},20000);
      const onMessage=(event)=>{const data=event.data;if(!isTrustedGasOrigin(event.origin)||!data||data.type!=="asteria-gas-submit"||data.nonce!==nonce||done)return;done=true;clearTimeout(timeout);cleanup();data.ok?resolve(data.message||"ok"):reject(new Error(data.message||"GAS_SUBMIT_FAILED"));};
      window.addEventListener("message",onMessage); try{form.submit();}catch(error){clearTimeout(timeout);cleanup();reject(error);}
    });
  }
  function renderReview() {
    state.current_screen = "review";
    setProgress("FINAL", "SUBMIT", 96);

    let payloadJson;
    try {
      payloadJson = getSubmissionPayloadJson();
    } catch (error) {
      card(`<h1 class="survey-title">回答を保存できませんでした</h1>
        <p class="survey-lead">
          ブラウザの保存領域を確認してください。
          このサイトの保存データは削除せず、設定を確認してから
          ページを再読み込みしてください。
        </p>`);
      return;
    }

    const endpointReady=Boolean(String(CONFIG.gasEndpoint||"").trim());
    card(`<p class="survey-kicker">FINAL CHECK</p><h1 class="survey-title">回答の送信</h1><p class="survey-lead">すべての必須回答が完了しました。「回答を送信」を押すと回答が確定します。</p>${endpointReady?"":`<p class="submit-warning">GAS送信先URLが未設定です。公開前に <code>survey/survey-config.js</code> を設定してください。</p>`}<div id="fallback-download"></div><div class="survey-actions"><button class="survey-button" id="submit" ${(!endpointReady&&CONFIG.requireGasEndpointForFinalSubmit)?"disabled":""}>回答を送信</button></div>`);
    if(!endpointReady) document.getElementById("fallback-download").appendChild(createLocalDownload(payloadJson));
    document.getElementById("submit").addEventListener("click",async(event)=>{
      const button=event.currentTarget;
      if(Object.keys(state.baseline).length!==10||Object.values(state.transform).filter(x=>x?.garment_factors).length!==10){alert("必須回答が不足しています。");return;}
      button.disabled=true;button.textContent="送信中…";
      try{await submitToGas(payloadJson);state.submitted_at=nowIso();state.current_screen="complete";markSubmittedAndClearDetailedState(state);render();}
      catch(error){button.disabled=false;button.textContent="回答を送信";const holder=document.getElementById("fallback-download");holder.innerHTML=`<p class="submit-warning">送信を確認できませんでした。通信環境またはGAS設定を確認してください。</p>`;holder.appendChild(createLocalDownload(payloadJson));}
    });
  }
  function renderComplete() { setProgress("COMPLETE","THANK YOU",100); card(`<p class="survey-kicker">SURVEY COMPLETE</p><h1 class="survey-title">ご協力<br />ありがとうございました</h1><p class="survey-lead">回答の送信が完了しました。本調査では、キャラクターについて形成された印象、具体的な服装変換要因、衣装変化に対する心理反応とギャップ萌えとの関係を研究します。</p><div class="survey-note">このブラウザには再送防止のため、送信済み状態と参加者IDなど、再送防止に必要な最小限の情報だけが保存されています。</div>`); }

  function render() {
    screenShownAt=Date.now();
    switch(state.current_screen){
      case "consent":renderConsent();break; case "demographics":renderDemographics();break; case "part1-intro":renderPart1Intro();break; case "baseline":renderBaseline();break; case "part2-intro":renderPart2Intro();break; case "transform":renderTransform();break; case "open-response":renderOpenResponse();break; case "review":renderReview();break; case "complete":renderComplete();break;
      default: state=newState();saveState(state);renderConsent();
    }
  }
  render();
})();
