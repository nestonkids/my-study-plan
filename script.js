// ======================= タイマー機能 =======================

// --- HTML内の要素を取得 ---
const startBtn = document.getElementById('start-btn');        // スタートボタン
const studyInput = document.getElementById('study-time');     // 勉強時間の入力欄（分）
const breakInput = document.getElementById('break-time');     // 休憩時間の入力欄（分）
const timerScreen = document.getElementById('timer-screen');  // タイマー表示画面
const inputScreen = document.getElementById('input-screen');  // 入力画面
const countdownEl = document.getElementById('countdown');     // 残り時間表示
const alarmSound = document.getElementById('alarm-sound');    // アラーム音
const currentPhaseDisplay = document.getElementById('current-phase-display'); // 現在のフェーズ表示
const body = document.body; // body要素への参照

let timer;             // setInterval のIDを保存（途中で止めるため必要）
let totalTime = 0;     // 合計時間を保存するための変数（今回は未使用）
let resumedState = null; // 一時停止したタイマーの状態を保持する変数

/**
 * タイマーを開始する関数
 * @param {number} duration - カウントダウンする秒数
 * @param {string} nextPhase - 'break'なら休憩フェーズへ, 'end'なら完全終了
 */
function startTimer(duration, nextPhase) {
  let time = duration;             // 残り時間（秒）
  updateDisplay(time);             // 初期表示を更新

  // 1秒ごとにカウントダウン処理を実行
  timer = setInterval(() => {
    time--;                        // 残り時間を減らす
    updateDisplay(time);           // 画面を更新

    // 残り時間が0以下になった場合
    if (time <= 0) {
      clearInterval(timer);        // タイマーを止める
      alarmSound.play();           // アラーム音を鳴らす

      // --- 勉強フェーズ終了 → 休憩へ移行 ---
      if (nextPhase === 'break') {
        const studyTime = Number(studyInput.value); // 勉強時間（分）
        saveStudyMinutes(studyTime);                // 累積勉強時間に加算
        saveDailyMinutes(studyTime);                // デイリー記録にも保存
        currentPhaseDisplay.textContent = '休憩時間'; // フェーズ表示を更新
        body.classList.remove('study-mode');        // study-mode を削除
        body.classList.add('break-mode');           // break-mode を追加
        startTimer(Number(breakInput.value) * 60, 'end'); // 休憩タイマー開始

      // --- 休憩フェーズ終了 → 完全終了 ---
      } else if (nextPhase === 'end') {
        countdownEl.textContent = '00:00';          // 表示をリセット
        inputScreen.style.display = 'block';        // 入力画面を表示
        timerScreen.style.display = 'none';         // タイマー画面を非表示
        currentPhaseDisplay.textContent = '';       // フェーズ表示をクリア
        body.classList.remove('break-mode');        // break-mode を削除
        startBtn.style.display = 'block';           // ボタンを再表示する
      }
    }
  }, 1000); // 1000msごとに実行（＝1秒）
}

/**
 * 累積勉強時間を保存（分単位）
 */
function saveStudyMinutes(minutes) {
  const previous = Number(localStorage.getItem('totalStudyMinutes')) || 0;
  localStorage.setItem('totalStudyMinutes', previous + minutes);
}

/**
 * 週ごとの勉強時間を保存（分単位）
 * - 月曜になったらリセットする仕組み
 */
function saveWeeklyMinutes(minutes) {
  const today = new Date();
  const currentDay = today.getDay(); // 0=日曜,1=月曜,...
  const lastSaved = localStorage.getItem('weeklyLastSaved');
  const weeklyMinutes = Number(localStorage.getItem('weeklyStudyMinutes')) || 0;

  const lastDate = lastSaved ? new Date(lastSaved) : null;
  const lastDay = lastDate ? lastDate.getDay() : null;

  // 月曜になったらリセット、それ以外は累積
  if (currentDay === 1 && lastSaved && lastDay !== 1) {
    localStorage.setItem('weeklyStudyMinutes', minutes);
  } else {
    localStorage.setItem('weeklyStudyMinutes', weeklyMinutes + minutes);
  }
  localStorage.setItem('weeklyLastSaved', today.toISOString());
}

/**
 * 残り秒数を「mm:ss」に整形して画面に表示
 */
function updateDisplay(seconds) {
  const min = String(Math.floor(seconds / 60)).padStart(2, '0');
  const sec = String(seconds % 60).padStart(2, '0');
  countdownEl.textContent = `${min}:${sec}`;
}

// ---------------------- スタートボタンの処理 ----------------------
if (startBtn) {
  // --- ページ離脱時にタイマーの状態を保存する ---
  window.addEventListener('beforeunload', () => {
    // タイマーが動作中（タイマー画面が表示されている）かつ、一時停止状態でない場合
    if (timerScreen.style.display === 'block' && !resumedState) {
      clearInterval(timer); // 有効なタイマーを停止

      const timeParts = countdownEl.textContent.split(':');
      const remainingSeconds = parseInt(timeParts[0], 10) * 60 + parseInt(timeParts[1], 10);

      if (remainingSeconds > 0) {
        const pausedTimerState = {
          remainingTime: remainingSeconds,
          phase: body.classList.contains('study-mode') ? 'study' : 'break',
          studyDuration: studyInput.value,
          breakDuration: breakInput.value,
        };
        localStorage.setItem('pausedTimerState', JSON.stringify(pausedTimerState));
      }
    }
  });

  // --- ページ読み込み時に一時停止状態を復元する ---
  const pausedStateJSON = localStorage.getItem('pausedTimerState');
  if (pausedStateJSON) {
    const pausedState = JSON.parse(pausedStateJSON);
    resumedState = pausedState; // クリックハンドラで使えるように保存

    // UIを復元
    studyInput.value = pausedState.studyDuration;
    breakInput.value = pausedState.breakDuration;
    inputScreen.style.display = 'none';
    timerScreen.style.display = 'block';
    updateDisplay(pausedState.remainingTime);

    if (pausedState.phase === 'study') {
      currentPhaseDisplay.textContent = '勉強時間 (一時停止中)';
      body.classList.add('study-mode');
    } else {
      currentPhaseDisplay.textContent = '休憩時間 (一時停止中)';
      body.classList.add('break-mode');
    }
    startBtn.textContent = '再開'; // ボタンのテキストを変更
  }

  // --- スタート・再開ボタンの処理 ---
  startBtn.addEventListener('click', () => {
    // --- 音声再生のロックを解除 ---
    alarmSound.play();
    alarmSound.pause();
    // --------------------------

    if (resumedState) {
      // --- 再開処理 ---
      const duration = resumedState.remainingTime;
      const nextPhase = resumedState.phase === 'study' ? 'break' : 'end';
      
      currentPhaseDisplay.textContent = resumedState.phase === 'study' ? '勉強時間' : '休憩時間';
      startBtn.textContent = 'スタート'; // ボタンのテキストを元に戻す

      // bodyのクラスを正しく設定
      body.classList.toggle('study-mode', resumedState.phase === 'study');
      body.classList.toggle('break-mode', resumedState.phase === 'break');

      startTimer(duration, nextPhase);
      localStorage.removeItem('pausedTimerState'); // 使用済みの状態を削除
      resumedState = null; // 再開後は状態をクリア
      startBtn.style.display = 'none'; // ボタンを非表示にする
    } else {
      // --- 新規スタート処理 ---
      const studyTime = Number(studyInput.value);
      const breakTime = Number(breakInput.value);

      if (studyTime > 0 && breakTime > 0) {
        inputScreen.style.display = 'none';
        timerScreen.style.display = 'block';
        currentPhaseDisplay.textContent = '勉強時間';
        body.classList.remove('break-mode');
        body.classList.add('study-mode');
        startTimer(studyTime * 60, 'break');
        startBtn.style.display = 'none'; // ボタンを非表示にする
      }
    }
  });
}

// ---------------------- メニューの表示制御 ----------------------
const menuBtn   = document.getElementById('menu-btn');       // メニューボタン
const menuOverlay = document.getElementById('menu-overlay'); // メニュー画面
const menuClose = document.getElementById('menu-close');     // 閉じるボタン

// メニューボタンを押したらオーバーレイ表示
if (menuBtn) {
  menuBtn.addEventListener('click', () => {
    menuOverlay.style.display = 'flex';
  });
}

// 閉じるボタンを押したらオーバーレイ非表示
if (menuClose) {
  menuClose.addEventListener('click', () => {
    menuOverlay.style.display = 'none';
  });
}

/**
 * 月曜になったら dailyStudy_0〜6 をリセット
 * （日ごとの勉強時間を初期化する仕組み）
 */
function resetDailyDataIfNeeded() {
  const today = new Date();
  const dayOfWeek = today.getDay();      // 0=日曜,1=月曜...
  const lastReset = localStorage.getItem('dailyLastReset');
  const lastDate = lastReset ? new Date(lastReset) : null;
  const lastDay = lastDate ? lastDate.getDay() : null;

  // 月曜かつ、前回リセットが別の日 → リセット実行
  if (dayOfWeek === 1 && lastDay !== 1) {
    for (let i = 0; i < 7; i++) {
      localStorage.setItem(`dailyStudy_${i}`, 0);
    }
    localStorage.setItem('dailyLastReset', today.toISOString());
  }
}

/**
 * 今日の勉強時間を dailyStudy_{曜日} に累積保存
 */
function saveDailyMinutes(minutes) {
  resetDailyDataIfNeeded();
  const today = new Date();
  const key = `dailyStudy_${today.getDay()}`;
  const prev = Number(localStorage.getItem(key)) || 0;
  localStorage.setItem(key, prev + minutes);
}

// ======================= 成績管理機能 =======================
// performance.html を開いたときのみ動作する
if (document.getElementById("save-grade")) {
  const STORAGE_KEY = "grades"; // 成績データを保存するキー

  /**
   * 成績を localStorage に保存
   * @param {number} value - 点数や偏差値（小数も可）
   */
  function saveGrade(value) {
    const grades = JSON.parse(localStorage.getItem(STORAGE_KEY)) || [];
    const newGrade = {
      value: parseFloat(value),      // 小数も扱えるようにする
      date: new Date().toISOString() // 保存時刻
    };
    grades.push(newGrade);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(grades));
  }

  /**
   * localStorage から成績一覧を取得
   */
  function getGrades() {
    return JSON.parse(localStorage.getItem(STORAGE_KEY)) || [];
  }

  /**
   * 成績一覧を画面に表示
   */
  function renderGradeList() {
    const gradeList = document.getElementById("grade-list");
    gradeList.innerHTML = "";
    const grades = getGrades();
    grades.forEach(g => {
      const li = document.createElement("li");
      const date = new Date(g.date);
      li.textContent = `${date.toLocaleString()} : ${g.value}`;
      gradeList.appendChild(li);
    });
  }

  /**
   * 成績の折れ線グラフを描画
   */
  function renderGradeChart() {
    const grades = getGrades();
    const ctx = document.getElementById("grade-chart").getContext("2d");
    const labels = grades.map(g => new Date(g.date).toLocaleString());
    const data = grades.map(g => g.value);

    // 既存のグラフがあれば削除して再描画
    if (window.gradeChart) {
      window.gradeChart.destroy();
    }

    window.gradeChart = new Chart(ctx, {
      type: "line",
      data: {
        labels: labels,
        datasets: [{
          label: "成績の変遷",
          data: data,
          borderColor: "blue",
          backgroundColor: "lightblue",
          fill: false,
          tension: 0.1
        }]
      },
      options: {
        responsive: true,
        scales: {
          x: { title: { display: true, text: "日時" } },
          y: { title: { display: true, text: "成績" }, beginAtZero: true }
        }
      }
    });
  }

  // ページ読み込み時の初期処理を直接実行
  renderGradeList();   // 一覧表示
  renderGradeChart();  // グラフ描画

  // 保存ボタンのクリックイベントを直接設定
  document.getElementById("save-grade").addEventListener("click", () => {
    const value = document.getElementById("grade-value").value;
    if (value !== "") {
      saveGrade(value);     // 保存
      renderGradeList();    // 一覧更新
      renderGradeChart();   // グラフ更新
      document.getElementById("grade-value").value = ""; // 入力欄をリセット
    }
  });
}
// =================================
// お気に入りセット管理
// =================================
const STORAGE_KEY_SETS = "favorite_sets"; // localStorageのキー
const SET_LIMIT = 5; // 最大保存件数

// セットを保存（新規または上書き）
function saveSet(name, studyMinutes, breakMinutes, overwriteIndex = null) {
  let sets = JSON.parse(localStorage.getItem(STORAGE_KEY_SETS)) || [];

  // 上書き指定があれば更新
  if (overwriteIndex !== null && sets[overwriteIndex]) {
    sets[overwriteIndex] = { name, study: studyMinutes, rest: breakMinutes };
  } else {
    // 新規追加だが、上限数を超える場合は保存できない
    if (sets.length >= SET_LIMIT) {
      alert(`登録できるセットは最大${SET_LIMIT}件です。`);
      return;
    }
    sets.push({ name, study: studyMinutes, rest: breakMinutes });
  }

  localStorage.setItem(STORAGE_KEY_SETS, JSON.stringify(sets));
  loadSetsToUI(); // 更新後にUIへ反映
}

// セットを削除
function deleteSet(index) {
  let sets = JSON.parse(localStorage.getItem(STORAGE_KEY_SETS)) || [];
  if (sets[index]) {
    sets.splice(index, 1); // index番目を削除
    localStorage.setItem(STORAGE_KEY_SETS, JSON.stringify(sets));
    loadSetsToUI(); // UI更新
  }
}

// セット一覧を読み込む
function loadSets() {
  return JSON.parse(localStorage.getItem(STORAGE_KEY_SETS)) || [];
}

// 保存されたセットを画面に反映
function loadSetsToUI() {
  const list = document.getElementById("set-list");
  if (!list) return;
  list.innerHTML = ""; // 初期化

  const sets = loadSets();
  sets.forEach((set, index) => {
    const li = document.createElement("li");
    li.textContent = `${set.name} (勉強${set.study}分 + 休憩${set.rest}分) `;

    // --- 上書きボタン ---
    const overwriteBtn = document.createElement("button");
    overwriteBtn.textContent = "上書き";
    overwriteBtn.onclick = () => {
      const name = prompt("新しいセット名を入力", set.name);
      const study = prompt("勉強時間(分)", set.study);
      const rest = prompt("休憩時間(分)", set.rest);
      if (name && study && rest) {
        saveSet(name, parseInt(study), parseInt(rest), index);
      }
    };

    // --- 削除ボタン ---
    const deleteBtn = document.createElement("button");
    deleteBtn.textContent = "削除";
    deleteBtn.onclick = () => deleteSet(index);

    // --- 実行ボタン ---
    const runBtn = document.createElement("button");
    runBtn.textContent = "セット";
    runBtn.onclick = () => {
      // メインの入力欄にセットの時間を反映する
      document.getElementById('study-time').value = set.study;
      document.getElementById('break-time').value = set.rest;
    };

    li.appendChild(overwriteBtn);
    li.appendChild(deleteBtn);
    li.appendChild(runBtn);

    list.appendChild(li);
  });
}

// =================================
// 初期化処理
// =================================
document.addEventListener("DOMContentLoaded", () => {
  // index.html のセット一覧機能がもしあれば、一覧を読み込む
  if (document.getElementById("set-list")) {
      loadSetsToUI();
  }
});
