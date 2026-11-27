/* ============================================================
   행복만빵 마을 - 1단계 (서버 없이 화면만, 가짜 데이터)
   - 마을 지도 / 내 캐릭터 이동 / 시설 카드 / 소품 입기
   ============================================================ */
"use strict";

/* ---------- 기본 설정 ---------- */
const TILE = 40;            // 타일 한 칸 크기(px)
const COLS = 48, ROWS = 42; // 마을 크기(타일 수). 34~35줄 모래, 36줄 데크, 37줄부터 아래쪽 바다
const WORLD_W = COLS * TILE, WORLD_H = ROWS * TILE;
const CHAR_SIZE = 72;       // 캐릭터 그리는 크기(px)
const PLAYER_SPEED = 200;   // 초당 px
const NPC_SPEED = 85;

const OUTLINE = "#4A2E14";  // 진한 테두리 색(초코)

/* ---------- 서버 연결 설정 (2단계) ----------
   Apps Script 웹 앱 주소를 아래 따옴표 안에 붙여 넣는다.
   예: const API_URL = "https://script.google.com/macros/s/XXXX/exec";
   비워 두면 서버 없이 혼자 보는 모드(1단계)로 돌아간다. */
const API_URL = "https://script.google.com/macros/s/AKfycbxFSjzw_LqL6lQYBBmXxOO8lyC2MoQJDNZ9yLiBwG3kBgjwjDQ2-ZS-0kDd6oDp2HMl/exec";
// 주소의 class 값: 반 별명도 받아 준다 (?class=berry → A반)
const RAW_CLASS = new URLSearchParams(location.search).get("class") || "";
const CLASS_ALIAS = { BERRY: "A", GRAPE: "B" };
const CLASS = CLASS_ALIAS[RAW_CLASS.toUpperCase()] || (RAW_CLASS.toUpperCase() === "B" ? "B" : "A");
const ONLINE = () => API_URL.length > 0;
const SAVE_KEY = "happybread_me_" + CLASS; // 반마다 따로 기억한다

/* ---------- 가짜 데이터: 시설 ----------
   roof: 가게마다 다른 차양(천막) 색 */
const FACILITIES = [
  { id: "plaza",   name: "마을 사무소", emoji: "🏠", open: true,
    task: "마을에 온 걸 환영해요!\n오늘의 공지를 확인해요.", link: "",
    roof: "#F77C9A", wall: "#FBEFD7", c0: 21, r0: 8 },
  { id: "cake",    name: "케이크 공방", emoji: "🎂", open: true,
    task: "첫날 선물 케이크를 만들어요.", link: "",
    roof: "#F6C244", wall: "#FBEFD7", c0: 7,  r0: 6 },
  { id: "dessert", name: "디저트 연구소", emoji: "🍮", open: false,
    task: "디저트 레시피를 연구해요.", link: "",
    roof: "#C9A7E6", wall: "#FBEFD7", c0: 5,  r0: 17 },
  { id: "photo",   name: "광고 사진관", emoji: "📷", open: false,
    task: "광고 사진을 만들어요.", link: "",
    roof: "#8FBFE8", wall: "#FBEFD7", c0: 36, r0: 6 },
  { id: "music",   name: "광고음악 제작소", emoji: "🎵", open: false,
    task: "우리 가게 CM송을 만들어요.", link: "",
    roof: "#FFB35C", wall: "#FBEFD7", c0: 12, r0: 24 },
  { id: "studio",  name: "마을 방송국", emoji: "📺", open: false,
    task: "홍보 영상을 만들어요.", link: "",
    roof: "#9FDCC2", wall: "#FBEFD7", c0: 31, r0: 24 },
  { id: "cafe",    name: "만빵 제빵소", emoji: "🥐", open: true,
    task: "진저브레드 쿠키를 구워요.", link: "",
    roof: "#C98A6B", wall: "#FBEFD7", c0: 13, r0: 17 },
  { id: "board",   name: "마을 게시판", emoji: "📌", open: true,
    task: "여기에 중요한 공지를 적어요.", link: "",
    board: true, c0: 27, r0: 9, w: 2, h: 3 },
];
// 시설 건물 크기: 가로 5칸, 세로 4칸. 문 앞 칸 = (c0+2, r0+4)

/* ---------- 가짜 데이터: 빵 캐릭터 / 색 / 소품 ---------- */
const BREADS = [
  { id: "bun",       name: "단팥빵" },
  { id: "loaf",      name: "식빵" },
  { id: "croissant", name: "크루아상" },
  { id: "donut",     name: "도넛" },
  // 아래 둘은 고르기에서는 보이지 않지만, 이미 만든 친구는 그대로 보인다
  { id: "bagel",     name: "베이글",  hidden: true },
  { id: "baguette",  name: "바게트",  hidden: true },
];

const COLORS = [
  { hex: "#F6C244", name: "버터" },
  { hex: "#F77C9A", name: "딸기" },
  { hex: "#B5793F", name: "초코" },
  { hex: "#8FD7BB", name: "민트" },
  { hex: "#F3D9A4", name: "크림" },
  { hex: "#C9A7E6", name: "포도" },
];

// 소품: 1단계에서는 배지 3개를 받은 상태라고 가정(가짜)
const PROPS = [
  { id: "ribbon",    name: "리본",     emoji: "🎀", unlocked: true },
  { id: "chefhat",   name: "셰프 모자", emoji: "✨", unlocked: true },
  { id: "camera",    name: "카메라",   emoji: "📷", unlocked: true },
  { id: "headphone", name: "헤드폰",   emoji: "🎧", unlocked: false },
  { id: "mic",       name: "마이크",   emoji: "🎤", unlocked: false },
  { id: "cape",      name: "별 망토",  emoji: "⭐", unlocked: false },
];

/* ============================================================
   지도 데이터 만들기 (빵나라 섬)
   ground: 0 식빵 들판, 1 쿠키 길, 2 와플 광장, 3 바다, 5 모래사장, 6 나무 선착장
   blocked: 지나갈 수 없는 칸
   ============================================================ */
const ground = [], blocked = [];
for (let r = 0; r < ROWS; r++) {
  ground.push(new Array(COLS).fill(0));
  blocked.push(new Array(COLS).fill(false));
}

function carveH(r, c1, c2) { for (let c = Math.min(c1,c2); c <= Math.max(c1,c2); c++) ground[r][c] = 1; }
function carveV(c, r1, r2) { for (let r = Math.min(r1,r2); r <= Math.max(r1,r2); r++) ground[r][c] = 1; }

// 큰길 (쿠키 조각 타일)
carveH(16, 6, 42);          // 가로 큰길 (바닷가까지)
carveV(24, 13, 28);         // 세로 큰길
carveH(28, 14, 33);         // 아랫길 (음악 제작소 ~ 방송국)
carveH(21, 7, 40);          // 중간 아랫길 (연구소 ~ 사진관)
// 시설 문 앞 길
carveV(23, 12, 16);         // 마을 사무소
carveV(9, 10, 16);          // 케이크 공방
carveV(38, 10, 16);         // 신메뉴 기획단

// 와플 광장(원 모양)
for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) {
  const dx = c - 24, dy = r - 17;
  if (dx * dx / 20 + dy * dy / 13 <= 1) ground[r][c] = 2;
}

// 오른쪽 가장자리: 바다 + 설탕 가루 모래사장 + 나무 선착장
for (let r = 0; r < ROWS; r++) {
  for (let c = 44; c < COLS; c++) { ground[r][c] = 3; blocked[r][c] = true; } // 바다 (못 들어감)
  if (r >= 2 && r < 34) ground[r][43] = 5;                                    // 모래사장 한 줄
}
for (let r = 15; r <= 16; r++) {
  for (let c = 44; c <= 46; c++) { ground[r][c] = 6; blocked[r][c] = false; } // 선착장 (걸을 수 있음)
}

// 아래쪽 바닷가: 모래사장 2줄(34~35) + 데크 줄(36, 8~37열은 나무 데크) + 바다(37줄부터 아래 끝까지)
const SHORE = { sandTop: 34, deckRow: 36, seaTop: 37, deckC0: 8, deckC1: 37 };
for (let r = SHORE.sandTop; r <= SHORE.deckRow; r++) for (let c = 2; c <= 43; c++) ground[r][c] = 5;
for (let c = SHORE.deckC0; c <= SHORE.deckC1; c++) ground[SHORE.deckRow][c] = 6; // 데크 (걸을 수 있음)
for (let r = SHORE.seaTop; r < ROWS; r++) for (let c = 0; c < COLS; c++) { ground[r][c] = 3; blocked[r][c] = true; }

// 가장자리 숲 (위·왼쪽만, 오른쪽과 아래는 바다)
const borderTrees = [];
for (let r = 0; r < ROWS; r++) {
  for (let c = 0; c < COLS; c++) {
    if (ground[r][c] >= 3) continue; // 바다·모래·선착장은 그대로
    if (r < 2 || c < 2) {
      blocked[r][c] = true;
      if ((c * 7 + r * 5) % 2 === 0) borderTrees.push([c, r]);
    }
  }
}
// 오른쪽 모래사장 위쪽 끝은 숲으로 막는다 (아래쪽 끝은 아래 모래사장과 이어진다)
for (const r of [0, 1]) { blocked[r][43] = true; ground[r][43] = 0; }
borderTrees.push([43, 0]);

// 나무 18그루: kind P=프레첼 나무, B=딸기 덤불 / fruit 1=열매 나무
const TREES = [
  { c: 4,  r: 4,  kind: "P", fruit: 1 }, { c: 15, r: 4,  kind: "P", fruit: 0 },
  { c: 28, r: 4,  kind: "P", fruit: 1 }, { c: 3,  r: 12, kind: "P", fruit: 0 },
  { c: 14, r: 12, kind: "P", fruit: 1 }, { c: 31, r: 19, kind: "P", fruit: 1 },
  { c: 4,  r: 24, kind: "P", fruit: 0 }, { c: 29, r: 24, kind: "P", fruit: 1 },
  { c: 10, r: 31, kind: "B", fruit: 1 }, { c: 20, r: 32, kind: "B", fruit: 0 },
  { c: 36, r: 32, kind: "B", fruit: 1 }, { c: 9,  r: 25, kind: "B", fruit: 1 },
  { c: 41, r: 5,  kind: "B", fruit: 0 },
  { c: 5,  r: 31, kind: "P", fruit: 0 }, { c: 27, r: 32, kind: "B", fruit: 1 },
  { c: 16, r: 13, kind: "B", fruit: 0 }, { c: 35, r: 23, kind: "P", fruit: 1 },
  { c: 40, r: 31, kind: "B", fruit: 0 },
];
const treeAt = {};      // "c,r" -> 나무 정보
const fruitSet = new Set(); // 열매 나무 자리
for (const t of TREES) {
  blocked[t.r][t.c] = true;
  treeAt[t.c + "," + t.r] = t;
  if (t.fruit) fruitSet.add(t.c + "," + t.r);
}

// 돌 장애물: 마카롱·도넛 모양 (크게, 지나갈 수 없음)
const ROCKS = [
  { c: 30, r: 12, kind: "macaron" }, { c: 33, r: 14, kind: "donut" },
  { c: 5,  r: 22, kind: "macaron" }, { c: 20, r: 31, kind: "donut" },
  { c: 29, r: 31, kind: "macaron" }, { c: 12, r: 13, kind: "donut" },
];
for (const k of ROCKS) blocked[k.r][k.c] = true;
const MACARON_LIFT = 40; // 마카롱 위에 앉을 때 캐릭터를 올려 그리는 높이(px)

// 모두 모이는 긴 식탁: 가운데 큰 테이블, 위·아래 긴 의자에 7명씩 14명이 앉는다
// 광장에서 떨어진 아래쪽 들판에 둔다 (처음 들어온 화면에는 안 보인다)
const LONG_TABLE = { c0: 13, r0: 30, w: 7 };

// 바게트 벤치: 마을 3개 + 긴 식탁의 긴 의자 2개 + 전망대 선착장 1개 + 아래쪽 데크의 낚시 자리 6개
const BENCHES = [
  { c: 20, r: 22 }, { c: 28, r: 22 }, { c: 8, r: 13 },
  { c: LONG_TABLE.c0, r: LONG_TABLE.r0 - 1, w: LONG_TABLE.w, long: true, exitUp: true },
  // 아래쪽 의자는 식탁을 바라보고 앉아서 뒷모습이 보인다
  { c: LONG_TABLE.c0, r: LONG_TABLE.r0 + 1, w: LONG_TABLE.w, long: true, sitUp: true },
  // 오른쪽 선착장(전망대) 끝 벤치: 바로 아래가 바다라서 일어나면 위쪽 데크로 올라선다
  { c: 46, r: 16, exitUp: true },
];
// 낚시 자리 6개: 데크(36줄) 위, 5칸 간격. 일어나면 위쪽 모래(35줄)로 올라서고, 바로 아래 칸이 바다다
for (const c of [10, 15, 20, 25, 30, 35]) BENCHES.push({ c, r: SHORE.deckRow, fishing: true, exitUp: true });
// 마카롱 돌 3개: 모양은 그대로, 위에 한 사람이 올라앉는 의자로도 쓴다 (도넛은 장애물 그대로)
for (const k of ROCKS) if (k.kind === "macaron") BENCHES.push({ c: k.c, r: k.r, macaron: true });
for (const b of BENCHES) {
  b.w = b.w || 1;
  for (let i = 0; i < b.w; i++) blocked[b.r][b.c + i] = true;
  if (b.fishing) {
    // 낚시 자리: 방석 한 자리
    b.seats = [{ x: (b.c + 0.5) * TILE, y: b.r * TILE + TILE / 2 - 4 }];
  } else if (b.macaron) {
    // 마카롱 의자: 한 자리. 그리는 순서가 마카롱 뒤가 되게 칸 아래쪽에 두고, 그림만 위로 올려 앉힌다
    b.seats = [{ x: (b.c + 0.5) * TILE, y: (b.r + 1) * TILE + 1 }];
  } else if (b.long) {
    // 긴 의자: 칸마다 한 자리씩 (7자리)
    b.seats = [];
    for (let i = 0; i < b.w; i++)
      b.seats.push({ x: (b.c + i + 0.5) * TILE, y: b.r * TILE + TILE / 2 - 4 });
  } else {
    // 앉는 자리 2칸 (왼쪽·오른쪽)
    b.seats = [
      { x: b.c * TILE + TILE / 2 - 9, y: b.r * TILE + TILE / 2 - 4 },
      { x: b.c * TILE + TILE / 2 + 9, y: b.r * TILE + TILE / 2 - 4 },
    ];
  }
}
// 긴 식탁 테이블 자리도 막는다
for (let c = LONG_TABLE.c0; c < LONG_TABLE.c0 + LONG_TABLE.w; c++) blocked[LONG_TABLE.r0][c] = true;

/* ---------- 농장: 울타리 + 젖소·닭 (사진관 아래 들판) ----------
   동물 자리는 시곗바늘(Date.now())만으로 정해지는 사인 곡선이라
   모든 학생 화면에서 같은 동물이 같은 자리에 보인다. */
const FARM = { c0: 36, r0: 17, c1: 42, r1: 20, gate: { c: 39, r: 20 } };
const FARM_FENCE = []; // { c, r, horiz }
for (let c = FARM.c0; c <= FARM.c1; c++) for (const r of [FARM.r0, FARM.r1]) {
  if (c === FARM.gate.c && r === FARM.gate.r) continue; // 출입구는 막지 않는다
  FARM_FENCE.push({ c, r, horiz: true });
}
for (let r = FARM.r0 + 1; r < FARM.r1; r++) {
  FARM_FENCE.push({ c: FARM.c0, r, horiz: false });
  FARM_FENCE.push({ c: FARM.c1, r, horiz: false });
}
for (const f of FARM_FENCE) blocked[f.r][f.c] = true;

// 동물 길: 가운데(cx,cy) + 사인 두 개의 합 (주기 ms, 느리고 작게). 울타리 안에만 머문다
// 젖소는 농장 왼쪽 절반, 닭은 오른쪽 절반에서만 돌아다닌다 (버튼이 안 섞이게)
const ANIMALS = [
  { id: "cow1", kind: "cow", cx: 1524, cy: 744, x: [[18, 46000, 0.3], [6, 29000, 2.0]], y: [[13, 33000, 1.1], [5, 21000, 0.2]] },
  { id: "cow2", kind: "cow", cx: 1548, cy: 782, x: [[16, 52000, 3.4], [6, 31000, 0.9]], y: [[10, 39000, 4.0], [4, 25000, 2.6]] },
  { id: "hen1", kind: "hen", cx: 1632, cy: 784, x: [[14, 17000, 1.0], [5, 9000, 0.0]], y: [[10, 13000, 2.2], [4, 8000, 1.4]] },
  { id: "hen2", kind: "hen", cx: 1646, cy: 736, x: [[12, 19000, 4.2], [5, 11000, 2.8]], y: [[9, 15000, 0.6], [4, 9000, 3.3]] },
  { id: "hen3", kind: "hen", cx: 1654, cy: 762, x: [[10, 21000, 2.4], [4, 12000, 5.1]], y: [[11, 16000, 3.8], [4, 7000, 0.9]] },
];

function animalPosAt(a, t) {
  if (REDUCED) t = 0; // 동작 줄이기: 제자리에 있는다
  const sum = (terms, tt) => terms.reduce((s, [A, P, ph]) => s + A * Math.sin((2 * Math.PI * tt) / P + ph), 0);
  const x = a.cx + sum(a.x, t);
  const y = a.cy + sum(a.y, t);
  // 바라보는 쪽: 가로 속도의 부호 (아주 느리면 조금 앞 시각을 본다 — 깜빡임 방지)
  let dir = "right";
  for (let i = 0; i < 20; i++) {
    const v = a.x.reduce((s, [A, P, ph]) => s + A * (2 * Math.PI / P) * Math.cos((2 * Math.PI * (t - i * 600)) / P + ph), 0) * 1000;
    if (Math.abs(v) > 2) { dir = v >= 0 ? "right" : "left"; break; }
  }
  return { x, y, dir };
}

// 젖소: 크림색 몸 + 초코 얼룩 (30x20을 2배로)
let cowCv = null;
function cowSprite() {
  if (cowCv) return cowCv;
  const W = 30, H = 20;
  const cv = document.createElement("canvas");
  cv.width = W; cv.height = H;
  const x = cv.getContext("2d");
  const g = Array.from({ length: H }, () => new Array(W).fill(0));
  const rect = (c0, r0, w, h) => {
    for (let r = r0; r < r0 + h; r++) for (let c = c0; c < c0 + w; c++)
      if (c >= 0 && r >= 0 && c < W && r < H) g[r][c] = 1;
  };
  rect(4, 6, 20, 9);   // 몸
  rect(22, 3, 6, 8);   // 머리 (오른쪽)
  rect(21, 1, 2, 3);   // 귀
  rect(2, 7, 2, 6);    // 꼬리
  rect(6, 15, 3, 4); rect(12, 15, 3, 4); rect(17, 15, 3, 4); rect(21, 15, 3, 4); // 다리
  for (let r = 0; r < H; r++) for (let c = 0; c < W; c++) {
    if (!g[r][c]) continue;
    x.fillStyle = r === 18 ? "#5B3A1E" : "#FFF6E6"; // 발굽만 어둡게
    x.fillRect(c, r, 1, 1);
  }
  x.fillStyle = "#8A5A33"; // 초코 얼룩
  x.fillRect(8, 8, 5, 4); x.fillRect(16, 10, 4, 3); x.fillRect(12, 6, 3, 2);
  x.fillStyle = "#F7B6C2"; // 분홍 코
  x.fillRect(26, 8, 2, 3);
  x.fillStyle = "#3B2512"; // 눈
  x.fillRect(24, 5, 2, 2);
  x.fillStyle = OUTLINE;
  for (let r = 0; r < H; r++) for (let c = 0; c < W; c++) {
    if (g[r][c]) continue;
    const near = (g[r - 1] || [])[c] || (g[r + 1] || [])[c] || g[r][c - 1] || g[r][c + 1];
    if (near) x.fillRect(c, r, 1, 1);
  }
  cowCv = cv;
  return cv;
}

// 닭: 흰 몸 + 노란 부리 + 볏 (14x14를 2배로)
let henCv = null;
function henSprite() {
  if (henCv) return henCv;
  const W = 14, H = 14;
  const cv = document.createElement("canvas");
  cv.width = W; cv.height = H;
  const x = cv.getContext("2d");
  const g = Array.from({ length: H }, () => new Array(W).fill(0));
  const rect = (c0, r0, w, h) => {
    for (let r = r0; r < r0 + h; r++) for (let c = c0; c < c0 + w; c++)
      if (c >= 0 && r >= 0 && c < W && r < H) g[r][c] = 1;
  };
  rect(2, 6, 8, 6);   // 몸
  rect(1, 4, 3, 4);   // 꼬리
  rect(9, 3, 4, 5);   // 머리 (오른쪽)
  for (let r = 0; r < H; r++) for (let c = 0; c < W; c++) {
    if (!g[r][c]) continue;
    x.fillStyle = "#FFFFFF";
    x.fillRect(c, r, 1, 1);
  }
  x.fillStyle = "#E8453C"; x.fillRect(10, 2, 2, 1);  // 볏
  x.fillStyle = "#F6C244"; x.fillRect(13, 5, 1, 2);  // 부리
  x.fillStyle = "#3B2512"; x.fillRect(10, 4, 1, 1);  // 눈
  x.fillStyle = "#F6A23C"; x.fillRect(4, 12, 1, 2); x.fillRect(7, 12, 1, 2); // 다리
  x.fillStyle = OUTLINE;
  for (let r = 0; r < H; r++) for (let c = 0; c < W; c++) {
    if (g[r][c]) continue;
    const near = (g[r - 1] || [])[c] || (g[r + 1] || [])[c] || g[r][c - 1] || g[r][c + 1];
    if (near) x.fillRect(c, r, 1, 1);
  }
  henCv = cv;
  return cv;
}

// 울타리 한 칸 (나무 말뚝 + 가로장)
function drawFenceCell(f) {
  const x = f.c * TILE - cam.x, y = (f.r + 1) * TILE - cam.y;
  if (x < -50 || x > canvas.width + 50 || y < -60 || y > canvas.height + 60) return;
  ctx.fillStyle = "rgba(60,40,20,0.14)";
  ctx.beginPath(); ctx.ellipse(x + 20, y - 2, 18, 4, 0, 0, Math.PI * 2); ctx.fill();
  const post = (px) => {
    ctx.fillStyle = "#A96A4D"; ctx.fillRect(px, y - 32, 8, 30);
    ctx.fillStyle = "#C98A6B"; ctx.fillRect(px + 1, y - 31, 2, 28);
    ctx.strokeStyle = OUTLINE; ctx.lineWidth = 2; ctx.strokeRect(px, y - 32, 8, 30);
  };
  if (f.horiz) {
    ctx.fillStyle = "#C98A6B";
    ctx.fillRect(x, y - 26, 40, 6); ctx.fillRect(x, y - 14, 40, 6);
    ctx.strokeStyle = OUTLINE; ctx.lineWidth = 2;
    ctx.strokeRect(x, y - 26, 40, 6); ctx.strokeRect(x, y - 14, 40, 6);
    post(x + 4);
  } else {
    ctx.fillStyle = "#C98A6B";
    ctx.fillRect(x + 8, y - 40, 5, 40); ctx.fillRect(x + 24, y - 40, 5, 40);
    ctx.strokeStyle = OUTLINE; ctx.lineWidth = 2;
    ctx.strokeRect(x + 8, y - 40, 5, 40); ctx.strokeRect(x + 24, y - 40, 5, 40);
    post(x + 14);
  }
}

function drawAnimalAt(a, p, now) {
  const x = p.x - cam.x, y = p.y - cam.y;
  const bob = REDUCED ? 0 : Math.sin(now / 420 + a.cx) * 1.2;
  const big = a.kind === "cow";
  ctx.fillStyle = "rgba(60,40,20,0.16)";
  ctx.beginPath(); ctx.ellipse(x, y + 2, big ? 24 : 12, 5, 0, 0, Math.PI * 2); ctx.fill();
  ctx.save();
  if (p.dir === "left") { ctx.translate(x * 2, 0); ctx.scale(-1, 1); }
  if (big) ctx.drawImage(cowSprite(), x - 30, y - 38 + bob, 60, 40);
  else ctx.drawImage(henSprite(), x - 14, y - 26 + bob, 28, 28);
  ctx.restore();
  // 이 종류가 쉬는 중이면 머리 위에 작은 새싹 (나무가 쉴 때와 같은 표시)
  if (VILLAGE_CFG.gatherOpen && coolLeft("a_" + a.kind) > 0) {
    const sy = y - (big ? 52 : 38) + (REDUCED ? 0 : Math.sin(now / 300) * 2);
    ctx.drawImage(uiIcon("sprout"), x - 9, sy - 9, 18, 18);
  }
}

/* ============================================================
   바다 동물 — 상어 "부캉이", 돌고래 한 쌍, 갈매기 4마리
   - 위치는 시곗바늘(Date.now())만으로 정해져서 모든 학생에게 같은 장면이 보인다.
   - 상어·돌고래는 아래쪽 넓은 바다에서 옆으로 길게 헤엄치고, 바라보는 쪽은 가는 방향과 같다.
   - 갈매기는 아래쪽 바다 위 3마리, 오른쪽 바다 위 1마리.
   - 동작 줄이기면 점프·날갯짓·헤엄 모두 멈추고 제자리에 있다.
   ============================================================ */
const SEA_TAU = Math.PI * 2;
const SHARK_NAME = "부캉이";
// [진폭(px), 주기(ms), 위상]. 아래쪽 넓은 바다(37줄~, y 1480~1680)에서 원본처럼 옆으로 길게 헤엄친다.
// 찌가 떨어지는 37줄(y 1480~1520)은 점프 꼭대기까지 넣어도 닿지 않는다.
// 상어: x 160~1760 (꼬리·주둥이 포함 116~1804), y 1631~1659 (등지느러미+점프 꼭대기 ≥ 1561)
const SEA_SHARK = { cx: 960, x: [[650, 220000, 0], [150, 130000, 1.3]], cy: 1645, y: [[10, 70000, 0.7], [4, 41000, 2.1]] };
// 돌고래: x 150~1850, y 1589~1611 (둘째는 2.5초 늦게 같은 길을 따라온다)
const SEA_DOLPHIN = { cx: 1000, x: [[700, 190000, 0], [150, 100000, 0.4]], cy: 1600, y: [[8, 60000, 1.9], [3, 37000, 0]] };
const SEA_GULLS = [
  { cx: 1840, cy: 300,  rx: 44, ry: 22, P: 26000, ph: 0.0, wing: 0.0 },  // 오른쪽 바다 위
  { cx: 380,  cy: 1615, rx: 130, ry: 22, P: 31000, ph: 2.1, wing: 0.5 }, // 아래쪽 바다 위 3마리
  { cx: 980,  cy: 1625, rx: 150, ry: 20, P: 24000, ph: 4.0, wing: 0.25 },
  { cx: 1560, cy: 1612, rx: 130, ry: 24, P: 34000, ph: 5.3, wing: 0.75 },
];
const SHARK_JUMP = { slotMs: 25000, ms: 1200, px: 48 };
const DOLPHIN_JUMP = { slotMs: 18000, ms: 1000, px: 40 };

function seaHash(a, b) {
  let h = Math.imul((a | 0) ^ 0x9e3779b9, 0x85ebca6b) ^ Math.imul((b | 0) + 0x7f4a7c15, 0xc2b2ae35);
  h ^= h >>> 16; h = Math.imul(h, 0x45d9f3b);
  h ^= h >>> 13; h = Math.imul(h, 0x45d9f3b);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}
const seaSines = (terms, t) => terms.reduce((s, [A, P, ph]) => s + A * Math.sin((SEA_TAU * t) / P + ph), 0);
const seaDSines = (terms, t) => terms.reduce((s, [A, P, ph]) => s + A * (SEA_TAU / P) * Math.cos((SEA_TAU * t) / P + ph) * 1000, 0);
// 가로 속도가 애매하면 조금 앞 시각으로 물러나 방향을 찾는다 (방향이 깜빡이지 않는다)
function seaDir(dx, t) {
  for (let i = 0; i < 40; i++) {
    const v = dx(t - i * 700);
    if (Math.abs(v) > 2) return v > 0 ? "right" : "left";
  }
  return "right";
}
function seaJumpAt(t, J, salt, chance) {
  const k = Math.floor(t / J.slotMs);
  if (seaHash(k, salt) < chance) {
    const start = k * J.slotMs + 2000 + seaHash(k, salt + 1) * (J.slotMs - 4000 - J.ms);
    if (t >= start && t < start + J.ms) return { lift: J.px * Math.sin(Math.PI * (t - start) / J.ms), jumping: true };
  }
  return { lift: 0, jumping: false };
}
function seaSwimmer(t, P, J, salt, chance) {
  if (REDUCED) t = 0; // 동작 줄이기: 제자리
  const jump = REDUCED ? { lift: 0, jumping: false } : seaJumpAt(t, J, salt, chance);
  return { x: P.cx + seaSines(P.x, t), y: P.cy + seaSines(P.y, t), dir: seaDir((s) => seaDSines(P.x, s), t), ...jump };
}
function sharkAt(t) { return seaSwimmer(t, SEA_SHARK, SHARK_JUMP, 1, 0.55); }
function dolphinsAt(t) {
  const a = seaSwimmer(t, SEA_DOLPHIN, DOLPHIN_JUMP, 3, 0.6);
  const b = seaSwimmer(t - 2500, SEA_DOLPHIN, DOLPHIN_JUMP, 3, 0.6);
  return [a, b];
}
function gullsAt(t) {
  if (REDUCED) t = 0;
  return SEA_GULLS.map((g) => {
    const a = (SEA_TAU * t) / g.P + g.ph;
    const n = Math.floor(t / 400 + g.wing);
    return {
      x: g.cx + g.rx * Math.cos(a), y: g.cy + g.ry * Math.sin(a),
      dir: seaDir((s) => -g.rx * (SEA_TAU / g.P) * 1000 * Math.sin((SEA_TAU * s) / g.P + g.ph), t),
      wing: REDUCED ? 0 : ((n % 2) + 2) % 2,
    };
  });
}

// ---- 그림 (원본 도트 그림, 2배. 오른쪽을 보는 모양을 그리고 왼쪽이면 뒤집는다) ----
const SEA_U = 2;
const SEA_INK = "#2A3A4A", SEA_MOUTH = "#4A5A6A", SEA_BLUSH = "#F2B8C0", SEA_LINE = "#4E6E85", SEA_DEEP = "#58AFCE";
const seaDot = (c2, x, y, w, h, col, u = SEA_U) => { c2.fillStyle = col; c2.fillRect(x * u, y * u, w * u, h * u); };
const seaRows = (c2, list, col, u = SEA_U) => { c2.fillStyle = col; for (const [y, a, b] of list) c2.fillRect(a * u, y * u, (b - a) * u, u); };
const seaOutline = (c2, list) => {
  const o = [];
  for (const [y, a, b] of list) o.push([y, a - 1, b + 1], [y - 1, a, b], [y + 1, a, b]);
  seaRows(c2, o, SEA_LINE);
};
function seaPlace(sx, sy, dir, draw) {
  ctx.save();
  ctx.translate(Math.round(sx), Math.round(sy));
  if (dir === "left") ctx.scale(-1, 1);
  draw(ctx);
  ctx.restore();
}
function seaSubmerge(c2, bodyRows, extra, x0, x1, line) { // 몸 아래쪽은 물에 잠겨 보인다
  c2.globalAlpha = 0.55;
  seaRows(c2, bodyRows.filter((r) => r[0] >= line), SEA_DEEP);
  for (const [x, y, w, h] of extra) seaDot(c2, x, y, w, h, SEA_DEEP);
  c2.globalAlpha = 1;
  seaDot(c2, x0, line, 3, 1, "#BFE8F5");
  seaDot(c2, x1 - 3, line, 3, 1, "#BFE8F5");
}
const SHARK_ROWS = [
  [-7, -8, 6], [-6, -11, 10], [-5, -13, 12], [-4, -14, 14], [-3, -15, 15], [-2, -15, 16], [-1, -16, 16],
  [0, -16, 16], [1, -16, 16], [2, -15, 15], [3, -14, 14], [4, -13, 12], [5, -11, 10], [6, -8, 6],
];
const SHARK_DORSAL = [[-8, -2, 3], [-9, -1, 2], [-10, -1, 1], [-11, 0, 1]];
const DOLPHIN_ROWS = [
  [-5, -6, 4], [-4, -9, 7], [-3, -11, 8], [-2, -12, 9], [-1, -12, 9], [0, -12, 14], [1, -11, 13],
  [2, -10, 7], [3, -8, 5],
];
const DOLPHIN_DORSAL = [[-7, -1, 1], [-6, -1, 2]];
function drawSeaShark(sx, sy, dir, lift, jumping) {
  seaPlace(sx, sy - Math.round(lift || 0), dir, (c2) => {
    seaOutline(c2, SHARK_ROWS);
    seaOutline(c2, SHARK_DORSAL);
    seaOutline(c2, [[-3, -18, -15], [-7, -21, -18], [-6, -21, -18], [-5, -21, -18], [-4, -21, -18], [-3, -21, -18]]);
    seaDot(c2, -18, -3, 3, 6, "#8FB3C9");
    seaDot(c2, -21, -7, 3, 5, "#7A9DB4");
    seaDot(c2, -21, 2, 3, 4, "#7A9DB4");
    seaRows(c2, SHARK_ROWS, "#8FB3C9");
    seaRows(c2, [[1, -12, 14], [2, -12, 13], [3, -11, 12], [4, -9, 10], [5, -7, 8]], "#F4ECDD");
    seaRows(c2, SHARK_DORSAL, "#7A9DB4");
    seaRows(c2, [[3, -1, 3], [4, 0, 3]], "#7A9DB4");
    seaDot(c2, 8, -3, 2, 2, SEA_INK); seaDot(c2, 8, -3, 1, 1, "#FFFFFF");
    seaDot(c2, 6, 0, 2, 1, SEA_BLUSH);
    seaDot(c2, 9, 1, 1, 1, SEA_MOUTH); seaDot(c2, 10, 2, 3, 1, SEA_MOUTH); seaDot(c2, 13, 1, 1, 1, SEA_MOUTH);
    if (!jumping) seaSubmerge(c2, SHARK_ROWS, [[-21, 3, 3, 3]], -22, 18, 3);
  });
}
function drawSeaDolphin(sx, sy, dir, lift, jumping) {
  seaPlace(sx, sy - Math.round(lift || 0), dir, (c2) => {
    seaOutline(c2, DOLPHIN_ROWS);
    seaOutline(c2, DOLPHIN_DORSAL);
    seaOutline(c2, [[-4, -16, -13], [-3, -16, -13], [-2, -16, -13], [-1, -14, -11], [0, -14, -11]]);
    seaDot(c2, -14, -1, 3, 2, "#9CC8E0");
    seaDot(c2, -16, -4, 3, 3, "#7FAECB");
    seaDot(c2, -16, 1, 3, 3, "#7FAECB");
    seaRows(c2, DOLPHIN_ROWS, "#9CC8E0");
    seaRows(c2, [[1, -9, 8], [2, -8, 6], [3, -6, 4]], "#EAF4F8");
    seaRows(c2, DOLPHIN_DORSAL, "#7FAECB");
    seaDot(c2, 0, 2, 3, 2, "#7FAECB");
    seaDot(c2, 5, -2, 2, 2, SEA_INK); seaDot(c2, 5, -2, 1, 1, "#FFFFFF");
    seaDot(c2, 3, 0, 2, 1, SEA_BLUSH);
    seaDot(c2, 8, 1, 4, 1, SEA_MOUTH); seaDot(c2, 12, 0, 1, 1, SEA_MOUTH);
    if (!jumping) seaSubmerge(c2, DOLPHIN_ROWS, [[-16, 2, 3, 2]], -14, 14, 2);
  });
}
function drawSeaGull(sx, sy, dir, wing) {
  const G = 3;
  seaPlace(sx, sy, dir, (c2) => {
    seaRows(c2, [[-1, -3, 3], [0, -4, 4], [1, -4, 4], [2, -3, 2]], "#FFFFFF", G);
    seaRows(c2, [[3, -3, 2]], "#8C99A6", G);
    seaDot(c2, 3, -2, 3, 3, "#FFFFFF", G);
    seaDot(c2, 6, -1, 2, 1, "#F2C230", G);
    seaDot(c2, 4, -1, 1, 1, SEA_INK, G);
    seaDot(c2, -6, 0, 2, 1, "#9AA6B2", G);
    if (wing === 1) seaRows(c2, [[1, -5, 2], [2, -6, 1], [3, -5, 0], [4, -4, -1]], "#9AA6B2", G);
    else seaRows(c2, [[-4, -2, 1], [-3, -3, 2], [-2, -4, 2], [-1, -3, 1]], "#9AA6B2", G);
  });
}

// 바닥 바로 위에 그린다 (선착장·캐릭터·낚싯대·버튼보다 항상 아래)
let seaShark = null; // 이름표 자리 계산에 쓴다
function drawSeaAnimals() {
  const t = Date.now();
  const onScreen = (wx, wy, m) => wx - cam.x > -m && wx - cam.x < canvas.width + m && wy - cam.y > -m && wy - cam.y < canvas.height + m;
  for (const d of dolphinsAt(t)) if (onScreen(d.x, d.y, 80)) drawSeaDolphin(d.x - cam.x, d.y - cam.y, d.dir, d.lift, d.jumping);
  seaShark = sharkAt(t);
  if (onScreen(seaShark.x, seaShark.y, 100)) drawSeaShark(seaShark.x - cam.x, seaShark.y - cam.y, seaShark.dir, seaShark.lift, seaShark.jumping);
  for (const g of gullsAt(t)) if (onScreen(g.x, g.y, 40)) drawSeaGull(g.x - cam.x, g.y - cam.y, g.dir, g.wing);
}

// 모래사장 꾸밈: 조개와 불가사리
const SHELLS = [
  { c: 43, r: 8,  k: "shell" }, { c: 43, r: 12, k: "star" },
  { c: 43, r: 21, k: "star" }, { c: 43, r: 28, k: "shell" },
  // 아래쪽 모래사장 (장식이라 막지 않는다)
  { c: 6, r: 34, k: "shell" }, { c: 13, r: 35, k: "star" }, { c: 23, r: 34, k: "star" },
  { c: 33, r: 35, k: "shell" }, { c: 40, r: 34, k: "shell" },
];

// 건물 자리 막기 + 문 앞 칸 기록
for (const f of FACILITIES) {
  f.w = f.w || 5; f.h = f.h || 4; // 건물은 5x4칸, 게시판은 2x3칸
  for (let r = f.r0; r < f.r0 + f.h; r++)
    for (let c = f.c0; c < f.c0 + f.w; c++) blocked[r][c] = true;
  // 화면에서 차지하는 영역(클릭 판정용)
  if (f.board) f.rect = { x: f.c0 * TILE - 8, y: (f.r0 + f.h) * TILE - 128, w: 96, h: 128 };
  else f.rect = { x: f.c0 * TILE - 12, y: f.r0 * TILE - 48, w: 224, h: 208 };
  f.doorC = f.c0 + Math.floor(f.w / 2);              // 문 앞 칸
  f.doorR = f.r0 + f.h;
  f.doorX = f.rect.x + f.rect.w / 2;                 // 문 앞 기준점(px)
  f.doorY = (f.doorR + 0.5) * TILE;
  f.baseY = (f.r0 + f.h) * TILE;                     // 그리는 순서 정하기용
}

const isBlocked = (c, r) => (c < 0 || r < 0 || c >= COLS || r >= ROWS) ? true : blocked[r][c];

/* ============================================================
   픽셀 그림 도구 (20x20 격자에 직접 점을 찍어 만든다)
   ============================================================ */
function newGrid(n = 20) { return Array.from({ length: n }, () => new Array(n).fill(0)); }
function gEllipse(g, cx, cy, rx, ry, v = 1) {
  for (let r = 0; r < g.length; r++) for (let c = 0; c < g.length; c++) {
    const dx = (c - cx) / rx, dy = (r - cy) / ry;
    if (dx * dx + dy * dy <= 1) g[r][c] = v;
  }
}
function gRect(g, c0, r0, w, h, v = 1) {
  for (let r = r0; r < r0 + h; r++) for (let c = c0; c < c0 + w; c++)
    if (r >= 0 && c >= 0 && r < g.length && c < g.length) g[r][c] = v;
}

function shadeHex(hex, f) { // f<1 어둡게, f>1 밝게
  const n = parseInt(hex.slice(1), 16);
  let r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
  if (f <= 1) { r *= f; g *= f; b *= f; }
  else { r += (255 - r) * (f - 1); g += (255 - g) * (f - 1); b += (255 - b) * (f - 1); }
  return `rgb(${Math.round(Math.min(255,r))},${Math.round(Math.min(255,g))},${Math.round(Math.min(255,b))})`;
}

/* ---------- 빵 캐릭터 스프라이트 (빵 머리 + 작은 몸) ----------
   - 32픽셀 기준. 머리 2 : 몸 1, 짧은 팔다리.
   - 고른 색은 옷 색이고, 빵 머리는 원래 빵 색이다.
   - dir: down(앞) / up(뒤, 얼굴 없음) / side(옆, 왼쪽은 뒤집어 그림)
   - frame: 0 멈춤, 1·2 걸을 때 다리가 번갈아 움직임
   - blink: 눈 감은 모습 / sit: 벤치에 앉은 모습 */
const BREAD_COLORS = {
  bun:       { main: "#E2A968", light: "#F4C88F", dark: "#BB8146" },
  loaf:      { main: "#F2DBAC", light: "#FBEDCD", dark: "#D9A05F" },
  croissant: { main: "#E8B878", light: "#F6D3A0", dark: "#C08A4A" },
  donut:     { main: "#E8C08A", light: "#F5D8AC", dark: "#C49A5E", glaze: "#F08BA6", glazeDark: "#D86E8C" },
  bagel:     { main: "#DCAB6E", light: "#EEC995", dark: "#B8864C" },
  baguette:  { main: "#E6BE84", light: "#F4DCAE", dark: "#BD9154" },
};

const spriteCache = {};
function charSprite(bread, clothes, dir, frame, blink, sit) {
  const key = [bread, clothes, dir, frame, blink ? 1 : 0, sit ? 1 : 0].join("_");
  if (spriteCache[key]) return spriteCache[key];

  const N = 32;
  const G = Array.from({ length: N }, () => new Array(N).fill(null));
  const bc = BREAD_COLORS[bread] || BREAD_COLORS.bun;
  const clD = shadeHex(clothes, 0.72), clL = shadeHex(clothes, 1.2);
  const side = dir === "side", back = dir === "up";
  const cx = side ? 17 : 16;
  const set = (c, r, col) => { c = Math.round(c); r = Math.round(r); if (c >= 0 && r >= 0 && c < N && r < N) G[r][c] = col; };
  const el = (ecx, ecy, rx, ry, col) => {
    for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) {
      const dx = (c - ecx) / rx, dy = (r - ecy) / ry;
      if (dx * dx + dy * dy <= 1) G[r][c] = col;
    }
  };
  const rc = (c0, r0, w, h, col) => { for (let r = r0; r < r0 + h; r++) for (let c = c0; c < c0 + w; c++) set(c, r, col); };
  const sx = side ? 0.9 : 1; // 옆모습은 머리를 살짝 좁게

  // ---- 다리 (frame: 0 멈춤 / 1·2 번갈아) ----
  const legCol = clD, shoe = "#8A5A33";
  if (sit) {
    if (!back) { // 앞으로 접은 다리 (뒤에서는 몸에 가려 안 보인다)
      rc(12, 23, 3, 3, legCol); rc(17, 23, 3, 3, legCol);
      rc(12, 26, 3, 1, shoe);   rc(17, 26, 3, 1, shoe);
    }
  } else {
    const dl = frame === 1 ? -1 : frame === 2 ? 1 : 0;
    const dr = -dl;
    if (side) {
      rc(13 + dl, 24 + Math.max(0, dl), 3, 5 - Math.abs(dl), legCol);
      rc(17 + dr, 24 + Math.max(0, dr), 3, 5 - Math.abs(dr), legCol);
      rc(13 + dl, 28 + Math.min(1, Math.max(0, dl)), 3, 1, shoe);
      rc(17 + dr, 28 + Math.min(1, Math.max(0, dr)), 3, 1, shoe);
    } else {
      rc(12, 24 + Math.max(0, dl), 3, 5 - Math.abs(dl), legCol);
      rc(17, 24 + Math.max(0, dr), 3, 5 - Math.abs(dr), legCol);
      rc(12, 28 + Math.max(0, dl), 3, 1, shoe);
      rc(17, 28 + Math.max(0, dr), 3, 1, shoe);
    }
  }

  // ---- 몸(옷) + 팔 ----
  if (side) { // 옆모습은 몸통을 좁게
    rc(12, 18, 8, 7, clothes);
    rc(12, 24, 8, 1, clD);       // 옷 아랫단만 살짝 어둡게
    rc(12, 18, 8, 1, clL);       // 어깨선 밝게
    rc(18, 19, 2, 4, clothes);   // 앞팔 하나만 보인다
    set(18, 23, bc.main); set(19, 23, bc.main); // 손
  } else {
    rc(11, 18, 10, 7, clothes);
    rc(11, 24, 10, 1, clD);      // 옷 아랫단만 살짝 어둡게
    rc(11, 18, 10, 1, clL);      // 어깨선 밝게
    rc(9, 19, 2, 4, clothes); rc(21, 19, 2, 4, clothes); // 양팔
    if (!back) {
      set(9, 23, bc.main); set(10, 23, bc.main); set(21, 23, bc.main); set(22, 23, bc.main); // 손
    }
  }

  // ---- 머리 (빵, 몸 위에 겹쳐 그림) ----
  if (bread === "loaf") {
    rc(cx - 11, 2, 4, 4, bc.main); rc(cx + 7, 2, 4, 4, bc.main); // 네모 귀
    el(cx, 6.5, 10 * sx, 4, bc.main);
    rc(Math.round(cx - 10 * sx), 6, Math.round(20 * sx), 11, bc.main);
    el(cx, 5.5, 8 * sx, 2.5, bc.light); // 윗면 밝게
  } else if (bread === "croissant") {
    if (side) { // 옆모습은 둥글게 (끝 조각이 부리처럼 튀어나오지 않게)
      el(cx, 9.5, 9.5 * sx, 7.8, bc.main);
      el(cx, 5.5, 5 * sx, 2.2, bc.light);
    } else {
      el(cx, 9.5, 8 * sx, 7.5, bc.main);          // 가운데가 가장 높고 통통하게
      el(cx - 7.5 * sx, 10.5, 4.8, 5.5, bc.main); // 옆 결은 한 단 낮게 (푸들처럼 둥글게)
      el(cx + 7.5 * sx, 10.5, 4.8, 5.5, bc.main);
      el(cx - 12 * sx, 11, 2.2, 2.6, bc.main);    // 끝은 옆으로 뾰족한 초승달 끝
      el(cx + 12 * sx, 11, 2.2, 2.6, bc.main);
      el(cx, 5.5, 5 * sx, 2.2, bc.light);
    }
  } else if (bread === "bun") {
    el(cx, 9.3, 10 * sx, 7.9, bc.main);        // 동글동글한 단팥빵 (턱선이 보이게)
    el(cx - 3, 4.5, 5 * sx, 2.5, bc.light);
  } else if (bread === "baguette") {
    el(cx, 9.5, 8.5 * sx, 9, bc.main);
    el(cx - 2, 4, 4 * sx, 2.5, bc.light);
  } else { // donut, bagel
    el(cx, 9.5, 11 * sx, 8, bc.main);
    el(cx - 3, 4.5, 5 * sx, 2.5, bc.light);
  }
  if (side) { // 옆모습: 뒤통수를 평평하게 깎아서 프로필답게
    for (let r = 0; r <= 17; r++) for (let c = 0; c < cx - 8; c++) G[r][c] = null;
    for (let r = 3; r <= 15; r++) if (G[r][cx - 8]) G[r][cx - 8] = bc.dark; // 뒤통수 그늘
  }
  // 아래 가장자리 그늘
  for (let c = 0; c < N; c++) for (let r = N - 1; r > 0; r--) {
    if (G[r][c] && !G[r + 1]?.[c] && r >= 12 && r <= 18) { set(c, r, bc.dark); break; }
  }

  // ---- 빵마다 특징 하나 ----
  if (bread === "donut") {
    for (let r = 0; r <= 9; r++) for (let c = 0; c < N; c++) if (G[r][c]) G[r][c] = bc.glaze;
    for (let c = 0; c < N; c++) if (G[10][c] && c % 3 !== 0) G[10][c] = bc.glaze; // 물결 글레이즈
    const sp = ["#FFF4E0", "#9FDCC2", "#F6C244", "#FFFFFF"];
    [[11, 5], [16, 3], [21, 5], [13, 8], [19, 8]].forEach(([c, r], i) => { if (G[r][c]) G[r][c] = sp[i % 4]; });
  } else if (bread === "croissant") {
    if (side) {
      // 옆모습: 뒤쪽에 늘어진 결 하나가 보인다 (앞모습의 푸들 귀와 이어지게)
      el(cx - 8, 12, 3.6, 4.6, bc.main);
      for (let r = 8; r <= 15; r++) { // 결 경계 줄 (얼굴 쪽은 깨끗하게)
        const bow = Math.round((r - 8) * 0.4);
        if (G[r][cx - 3 - bow]) G[r][cx - 3 - bow] = bc.dark;
      }
    } else {
      for (let r = 7; r <= 15; r++) { // 가운데와 옆 결 사이의 줄 (아래로 갈수록 바깥으로)
        const bow = Math.round((r - 7) * 0.5);
        if (G[r][cx - 5 - bow]) G[r][cx - 5 - bow] = bc.dark;
        if (G[r][cx + 5 + bow]) G[r][cx + 5 + bow] = bc.dark;
      }
      for (let r = 11; r <= 15; r++) { // 옆 결과 끝 사이의 짧은 줄
        const c2 = Math.round(10 + (r - 11) * 0.45);
        if (G[r][cx - c2]) G[r][cx - c2] = bc.dark;
        if (G[r][cx + c2]) G[r][cx + c2] = bc.dark;
      }
    }
  } else if (bread === "bagel") {
    el(cx, 8.5, 6 * sx, 4, bc.light); // 가운데 고리
    [[cx - 6, 5], [cx, 3], [cx + 6, 5], [cx - 4, 8], [cx + 4, 8]].forEach(([c, r]) => { if (G[r]?.[c]) G[r][c] = bc.dark; }); // 깨
  } else if (bread === "baguette") {
    for (let i = 0; i < 3; i++) for (let k = 0; k < 4; k++) {
      const c = cx - 5 + k + i * 3, r = 4 + i * 4 + k;
      if (G[r]?.[c]) G[r][c] = bc.light; // 칼집
    }
  } else if (bread === "bun") {
    // 정수리의 깨 다섯 알 (꽃 모양)
    [[cx, 3], [cx - 3, 4], [cx + 3, 4], [cx - 2, 6], [cx + 2, 6]].forEach(([c, r]) => {
      if (G[r]?.[c]) G[r][c] = "#5A3A1E";
    });
  }

  // ---- 얼굴 (뒷모습에는 없음) ----
  if (!back) {
    const dark = "#3B2512", blushC = "#F79FB0";
    const drawEye = (ec) => {
      if (blink) { rc(ec, 10, 3, 1, dark); return; }
      rc(ec, 9, 3, 3, dark);
      set(ec, 9, "#FFFFFF");
    };
    if (side) {
      drawEye(19);                     // 눈은 얼굴 앞쪽 2/3 지점
      rc(16, 12, 2, 2, blushC);        // 볼은 뺨 가운데
      set(22, 13, dark); set(23, 13, dark); // 입은 얼굴 앞 끝
    } else {
      drawEye(11); drawEye(18);
      rc(8, 12, 2, 2, blushC); rc(22, 12, 2, 2, blushC);
      set(15, 14, dark); set(16, 14, dark);
    }
  }

  // ---- 어두운 외곽선 ----
  const cv = document.createElement("canvas");
  cv.width = N; cv.height = N;
  const x = cv.getContext("2d");
  for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) {
    if (G[r][c]) { x.fillStyle = G[r][c]; x.fillRect(c, r, 1, 1); continue; }
    const near = G[r - 1]?.[c] || G[r + 1]?.[c] || G[r][c - 1] || G[r][c + 1];
    if (near) { x.fillStyle = OUTLINE; x.fillRect(c, r, 1, 1); }
  }
  spriteCache[key] = cv;
  return cv;
}

/* ---------- 빵 캐릭터 + 소품 함께 그리기 ----------
   - 소품: 리본·모자·헤드폰은 머리에, 망토는 몸에 붙는다.
   - 뒷모습(up)에서는 뒤에서 보이는 것만 그린다 (머리 소품·망토 O, 카메라·마이크 X). */
const HEAD_PROPS = ["ribbon", "chefhat", "headphone"];
function drawBread(x, breadId, clothesHex, propId, sx, sy, S, dir = "down", frame = 0, blink = false, sit = false) {
  const scale = S / 32;
  const back = dir === "up";
  // 앉으면 몸을 웅크려 조금 낮아진다 (발 위치는 그대로)
  const squash = sit ? 0.86 : 1;
  const draw = (img, dx, dy) => x.drawImage(img, sx + dx * scale, sy + (dy + 32 * (1 - squash)) * scale, S, S * squash);
  if (propId === "cape" && !back) draw(propSprite("cape"), 0, 6); // 앞에서는 망토가 몸 뒤로
  draw(charSprite(breadId, clothesHex, dir, frame, blink, sit), 0, 0);
  if (propId === "scarf") draw(propSprite("scarf"), 0, 0); // 목도리는 앞·뒤 모두 목에 두른다
  else if (propId && propId !== "cape") {
    const headProp = HEAD_PROPS.includes(propId);
    if (!back || headProp) { // 뒤에서는 머리 소품만 보인다
      if (propId === "headphone" && dir === "side") draw(propSprite("headphone_side"), 2, -1); // 옆모습 전용 헤드폰
      else draw(propSprite(propId), headProp && dir === "side" ? 2 : 0, headProp ? -3 : 4);
    }
  }
  if (propId === "cape" && back) draw(propSprite("cape"), 0, 6); // 뒤에서는 망토가 몸을 덮는다
}

/* ---------- 소품 스프라이트 (캐릭터 위에 겹쳐 그림) ---------- */
const propCache = {};
function propSprite(id) {
  if (propCache[id]) return propCache[id];
  const cv = document.createElement("canvas");
  cv.width = 20; cv.height = 20;
  const x = cv.getContext("2d");
  const O = OUTLINE;

  const px = (c, r, col) => { x.fillStyle = col; x.fillRect(c, r, 1, 1); };
  const box = (c, r, w, h, col) => { x.fillStyle = col; x.fillRect(c, r, w, h); };

  if (id === "ribbon") {
    box(6, 2, 3, 3, "#F75E8E"); box(11, 2, 3, 3, "#F75E8E");
    box(9, 3, 2, 2, "#D13A6A");
    px(6, 2, O); px(8, 2, O); px(11, 2, O); px(13, 2, O);
    box(6, 5, 3, 1, O); box(11, 5, 3, 1, O);
  } else if (id === "chefhat") {
    // 하얀 셰프 모자: 위가 둥글게 부푼 모양 + 아래 띠
    const g = newGrid();
    gEllipse(g, 10, 3, 5.6, 2.9);     // 가운데 돔
    gEllipse(g, 5.8, 4.2, 2.7, 2.2);  // 왼쪽 부푼 부분
    gEllipse(g, 14.2, 4.2, 2.7, 2.2); // 오른쪽 부푼 부분
    gRect(g, 6, 5, 9, 2);             // 아래 띠
    for (let r = 0; r < 20; r++) for (let c = 0; c < 20; c++) {
      if (!g[r][c]) continue;
      let col = "#FFFFFF";
      if (r >= 5) col = "#EFE6D6";                     // 띠는 살짝 크림색
      else if (!((g[r + 1] || [])[c])) col = "#E3D9C6"; // 아래쪽 그늘
      px(c, r, col);
    }
    x.fillStyle = O;
    for (let r = 0; r < 20; r++) for (let c = 0; c < 20; c++) {
      if (g[r][c]) continue;
      const near = (g[r - 1] || [])[c] || (g[r + 1] || [])[c] || g[r][c - 1] || g[r][c + 1];
      if (near) x.fillRect(c, r, 1, 1);
    }
  } else if (id === "camera") {
    box(6, 12, 8, 5, "#5A5A6E"); box(6, 12, 8, 1, "#73738C");
    box(9, 13, 3, 3, "#2E2E3C"); px(10, 14, "#9FDCC2");
    box(5, 12, 1, 5, O); box(14, 12, 1, 5, O); box(6, 17, 8, 1, O); box(6, 11, 8, 1, O);
  } else if (id === "headphone") {
    box(5, 1, 10, 1, "#F75E8E"); box(4, 2, 1, 2, "#F75E8E"); box(15, 2, 1, 2, "#F75E8E");
    box(3, 8, 3, 4, "#D13A6A"); box(14, 8, 3, 4, "#D13A6A");
    box(3, 7, 3, 1, O); box(14, 7, 3, 1, O); box(3, 12, 3, 1, O); box(14, 12, 3, 1, O);
    box(2, 8, 1, 4, O); box(17, 8, 1, 4, O);
    box(4, 4, 1, 4, "#F75E8E"); box(15, 4, 1, 4, "#F75E8E");
  } else if (id === "headphone_side") {
    // 옆모습: 머리띠가 정수리에서 내려와 보이는 쪽 귀 하나만 덮는다
    // (머리 뒤쪽 가운데 = 귀 자리, 눈을 가리지 않게 작게)
    box(6, 2, 3, 1, "#F75E8E");                       // 정수리 머리띠
    box(7, 3, 1, 4, "#F75E8E");                       // 귀까지 내려오는 띠
    box(6, 7, 3, 4, "#D13A6A");                       // 귀마개 하나
    box(6, 8, 1, 2, "#F75E8E");                       // 귀마개 하이라이트
    box(6, 1, 3, 1, O); box(5, 2, 1, 1, O); box(9, 2, 1, 1, O);
    box(6, 3, 1, 4, O); box(8, 3, 1, 4, O);
    box(5, 7, 1, 4, O); box(9, 7, 1, 4, O); box(6, 11, 3, 1, O);
  } else if (id === "mic") {
    box(13, 13, 2, 4, "#8C8CA0"); box(12, 10, 4, 3, "#3B3B4A");
    px(13, 10, "#73738C"); box(12, 9, 4, 1, O); box(12, 13, 4, 1, O);
  } else if (isGiftProp(id)) { // 선생님 선물 소품
    drawGiftSprite(x, id);
  } else if (id === "cape") { // 별 망토(몸 뒤에 그림)
    for (let r = 6; r < 17; r++) {
      const half = 4 + Math.floor((r - 6) * 0.55);
      box(10 - half, r, half * 2, 1, "#6C5CE7");
    }
    box(10 - 4, 6, 8, 1, "#4B3FB5");
    [[5, 9], [13, 10], [8, 13], [14, 14], [4, 14]].forEach(([c, r]) => px(c, r, "#FFE066"));
  }
  propCache[id] = cv;
  return cv;
}

/* ---------- 소품 아이콘 (소품함, 이름표용: 그림을 가운데로 모아 그린다) ---------- */
const propIconCache = {};
function propIcon(id) {
  if (propIconCache[id]) return propIconCache[id];
  if (id === "headphone") {
    // 헤드폰은 머리에 쓴 그림이 작아지면 점처럼 보여서, 아이콘 전용 그림을 따로 그린다
    const cv2 = document.createElement("canvas");
    cv2.width = 20; cv2.height = 20;
    const h2 = cv2.getContext("2d");
    const box = (c, r, w, h, col) => { h2.fillStyle = col; h2.fillRect(c, r, w, h); };
    box(5, 3, 10, 2, "#F75E8E");                              // 머리띠
    box(3, 5, 2, 4, "#F75E8E"); box(15, 5, 2, 4, "#F75E8E");  // 띠 양옆
    box(2, 9, 4, 7, "#D13A6A"); box(14, 9, 4, 7, "#D13A6A");  // 귀마개
    box(3, 10, 1, 4, "#F75E8E"); box(15, 10, 1, 4, "#F75E8E");
    const O2 = OUTLINE;
    box(5, 2, 10, 1, O2); box(4, 3, 1, 2, O2); box(15, 3, 1, 2, O2);
    box(2, 5, 1, 4, O2); box(17, 5, 1, 4, O2);
    box(1, 9, 1, 7, O2); box(6, 9, 1, 7, O2); box(13, 9, 1, 7, O2); box(18, 9, 1, 7, O2);
    box(2, 8, 4, 1, O2); box(14, 8, 4, 1, O2); box(2, 16, 4, 1, O2); box(14, 16, 4, 1, O2);
    propIconCache[id] = cv2;
    return cv2;
  }
  const src = propSprite(id);
  const d = src.getContext("2d").getImageData(0, 0, 20, 20).data;
  let minX = 20, minY = 20, maxX = -1, maxY = -1;
  for (let yy = 0; yy < 20; yy++) for (let xx = 0; xx < 20; xx++) {
    if (d[(yy * 20 + xx) * 4 + 3] > 0) {
      if (xx < minX) minX = xx; if (xx > maxX) maxX = xx;
      if (yy < minY) minY = yy; if (yy > maxY) maxY = yy;
    }
  }
  const cv = document.createElement("canvas");
  cv.width = 20; cv.height = 20;
  const x2 = cv.getContext("2d");
  if (maxX >= 0) {
    const dx = Math.floor((20 - (maxX - minX + 1)) / 2) - minX;
    const dy = Math.floor((20 - (maxY - minY + 1)) / 2) - minY;
    x2.drawImage(src, dx, dy);
  }
  propIconCache[id] = cv;
  return cv;
}

/* ============================================================
   선생님 선물 소품 — 시트 마을 탭 "선물소품"에 적은 소품을 학생에게 선물한다
   - 학생이 들어오면 선물 카드가 한 번 뜬다 (공지 → 오늘의 미션 대화 → 선물 카드, 하나씩 차례로)
   - 한 번 받으면 계속 내 소품함에 남는다 (선물소품을 비워도). 받은 목록은 시트 친구들 탭 "선물" 칸 + 이 컴퓨터
   - 시트로 그림을 만들 수는 없어서, 미리 그려 둔 6가지 중에서 골라 쓴다
   ============================================================ */
const GIFTS = [
  { id: "santahat",  name: "산타 모자",     emoji: "🎅", head: true, ko: ["산타모자", "산타"] },
  { id: "antlers",   name: "루돌프 머리띠", emoji: "🦌", head: true, ko: ["루돌프머리띠", "루돌프", "사슴뿔"] },
  { id: "scarf",     name: "목도리",        emoji: "🧣", head: false, ko: ["목도리"] },
  { id: "bdayhat",   name: "생일 고깔모자", emoji: "🎉", head: true, ko: ["생일고깔모자", "고깔모자", "생일모자"] },
  { id: "flowerpin", name: "꽃 머리핀",     emoji: "🌸", head: true, ko: ["꽃머리핀", "머리핀", "꽃핀"] },
  { id: "gradcap",   name: "졸업 학사모",   emoji: "🎓", head: true, ko: ["졸업학사모", "학사모"] },
];
// 소품함·이름표가 함께 쓰도록 기존 소품 목록 뒤에 붙인다 (선물은 시트 O/X로 잠기지 않는다)
for (const g of GIFTS) PROPS.push({ id: g.id, name: g.name, emoji: g.emoji, unlocked: true, gift: true });
for (const g of GIFTS) if (g.head) HEAD_PROPS.push(g.id);
const isGiftProp = (id) => GIFTS.some((g) => g.id === id);

// 시트에 적은 이름 → 선물 (띄어쓰기는 무시). 모르는 이름이면 null
function giftFromName(name) {
  const k = String(name || "").replace(/\s/g, "");
  if (!k) return null;
  return GIFTS.find((g) => g.ko.includes(k) || g.name.replace(/\s/g, "") === k || g.id === k) || null;
}
function parseGifts(text) {
  return new Set(String(text || "").split(",").map((s) => s.trim()).filter(isGiftProp));
}

// 선물 소품 도트 그림 (20x20, 캐릭터 위에 겹쳐 그림. 머리 소품은 -3칸 위로 올려 그려진다)
function drawGiftSprite(x, id) {
  const g = newGrid(), col = Array.from({ length: 20 }, () => new Array(20).fill(null));
  const put = (c, r, w, h, color) => {
    for (let rr = r; rr < r + h; rr++) for (let cc = c; cc < c + w; cc++) {
      if (rr >= 0 && rr < 20 && cc >= 0 && cc < 20) { g[rr][cc] = 1; col[rr][cc] = color; }
    }
  };
  if (id === "santahat") { // 빨간 산타 모자: 오른쪽으로 접힌 끝 + 하얀 방울 + 하얀 털 띠
    put(7, 2, 6, 1, "#D9443F"); put(6, 3, 8, 1, "#E8534C"); put(5, 4, 10, 1, "#E8534C");
    put(9, 1, 5, 1, "#D9443F"); put(13, 2, 2, 1, "#D9443F"); put(15, 3, 1, 1, "#D9443F");
    put(15, 4, 2, 2, "#FFFFFF");                             // 방울
    put(4, 5, 12, 2, "#FFFFFF"); put(5, 5, 4, 1, "#F2EEE8"); // 털 띠
    put(8, 3, 2, 1, "#F2756E");                              // 반짝
  } else if (id === "antlers") { // 루돌프 머리띠: 갈색 띠 + 두 갈래 뿔
    put(5, 5, 10, 1, "#8A5A33");
    put(6, 1, 1, 4, "#B07A45"); put(4, 2, 2, 1, "#B07A45"); put(7, 0, 1, 2, "#B07A45");
    put(13, 1, 1, 4, "#B07A45"); put(14, 2, 2, 1, "#B07A45"); put(12, 0, 1, 2, "#B07A45");
  } else if (id === "scarf") { // 목도리: 빨강·초록 줄무늬, 앞으로 내려온 끝
    put(5, 11, 10, 2, "#D9443F"); for (let c = 6; c < 15; c += 3) put(c, 11, 1, 2, "#58B368");
    put(11, 13, 3, 4, "#D9443F"); put(11, 14, 3, 1, "#58B368");
    put(11, 17, 1, 1, "#F2EEE8"); put(13, 17, 1, 1, "#F2EEE8");  // 술
  } else if (id === "bdayhat") { // 생일 고깔모자: 분홍·노랑 줄 고깔 + 방울
    for (let r = 1; r <= 6; r++) {
      const half = Math.floor((r - 1) * 0.7);
      put(10 - half, r, half * 2 + 1, 1, r % 2 ? "#F7A8C4" : "#FFE08A");
    }
    put(9, 0, 3, 1, "#7FC6E8"); put(10, -1, 1, 1, "#7FC6E8");
    put(6, 7, 9, 1, "#F77C9A");
  } else if (id === "flowerpin") { // 꽃 머리핀: 머리 오른쪽 위 작은 꽃
    put(13, 2, 2, 1, "#F7A8C4"); put(13, 5, 2, 1, "#F7A8C4"); put(12, 3, 1, 2, "#F7A8C4"); put(15, 3, 1, 2, "#F7A8C4");
    put(13, 3, 2, 2, "#FFE08A");
    put(11, 5, 1, 2, "#58B368");                             // 잎
  } else if (id === "gradcap") { // 졸업 학사모: 납작한 판 + 모자 + 노란 술
    put(3, 2, 14, 2, "#3B3B4A"); put(4, 2, 12, 1, "#55556A");
    put(6, 4, 8, 3, "#2E2E3C");
    put(10, 2, 1, 1, "#F6C244"); put(15, 3, 1, 4, "#F6C244"); put(15, 7, 1, 1, "#FFE08A");
  }
  for (let r = 0; r < 20; r++) for (let c = 0; c < 20; c++) {
    if (g[r][c]) { x.fillStyle = col[r][c]; x.fillRect(c, r, 1, 1); }
  }
  x.fillStyle = OUTLINE;
  for (let r = 0; r < 20; r++) for (let c = 0; c < 20; c++) {
    if (g[r][c]) continue;
    const near = (g[r - 1] || [])[c] || (g[r + 1] || [])[c] || g[r][c - 1] || g[r][c + 1];
    if (near) x.fillRect(c, r, 1, 1);
  }
}

/* ---------- 선물 카드: 공지 → 오늘의 미션 대화 → 선물 카드 순서로 하나씩 ----------
   공지 말풍선이 사라지고, 미션 대화·다른 창·칭찬 배너가 없고, 그 뒤 1.5초가 지나야 뜬다 */
let giftOffer = null;       // 지금 시트에 켜진 선물 { gift, text }
let entryBusyAt = 0;        // 마지막으로 무언가(대화·창·배너)가 떠 있던 때
function applyGiftOffer(v) { // v: 서버의 village.gift ({name, text}) — 없거나 이름이 틀리면 선물 없음
  const gift = v ? giftFromName(v.name) : null;
  giftOffer = gift ? { gift, text: String(v.text || "").trim() || "선생님이 소품을 선물했어요!" } : null;
}
function missionDueNearby() {
  let seen = "";
  try { seen = localStorage.getItem(MISSION_SEEN_KEY) || ""; } catch (e) { /* 무시 */ }
  return seen !== todayStr() && Math.hypot(me.x - NPCS[0].x, me.y - NPCS[0].y) < TILE * 2.4;
}
function updateGiftOffer(now) {
  if (villageEl.classList.contains("hidden")) return;
  const busy = !$("notice").classList.contains("fade") || !$("dialog").classList.contains("hidden") || dialog
    || !noModalOpen() || praiseShowing || !$("fishCard").classList.contains("hidden");
  if (busy) { entryBusyAt = now; return; }
  if (!giftOffer || me.gifts.has(giftOffer.gift.id)) return;
  if (now - entryBusyAt < 1500 || missionDueNearby()) return; // 미션 대화가 먼저
  showGiftCard(giftOffer);
}
function showGiftCard(offer) {
  const g = offer.gift;
  // 카드를 보는 순간 받은 것으로 친다 (나중에를 눌러도 소품함에 남는다)
  me.gifts.add(g.id);
  saveGifts();
  buildPropList();
  $("giftText").textContent = offer.text;
  $("giftName").textContent = g.name;
  const cv = $("giftCanvas"), x = cv.getContext("2d");
  x.imageSmoothingEnabled = false;
  x.clearRect(0, 0, cv.width, cv.height);
  x.drawImage(propIcon(g.id), 0, 0, cv.width, cv.height);
  $("giftWear").onclick = () => { $("giftCard").classList.add("hidden"); wearProp(g.id); };
  $("giftLater").onclick = () => { $("giftCard").classList.add("hidden"); showToast("소품함에 넣어 두었어요."); };
  $("giftCard").classList.remove("hidden");
  playTone("dex");
}
function saveGifts() {
  try {
    const saved = JSON.parse(localStorage.getItem(SAVE_KEY) || "{}");
    saved.gifts = [...me.gifts];
    localStorage.setItem(SAVE_KEY, JSON.stringify(saved));
  } catch (e) { /* 무시 */ }
  if (ONLINE() && me.id) api({ action: "gift", class: CLASS, id: me.id, gifts: [...me.gifts].join(",") }); // 받을 때 한 번만
}
// 서버의 선물 목록 + 이 컴퓨터에 남은 같은 학생 기록을 합친다 (새 Code.gs 배포 전에 받은 것도 잃지 않게)
function applyServerGifts(res) {
  let local = new Set();
  try {
    const saved = JSON.parse(localStorage.getItem(SAVE_KEY) || "null");
    if (saved && saved.id === res.id) local = parseGifts((saved.gifts || []).join(","));
  } catch (e) { /* 무시 */ }
  const server = parseGifts(res.gifts);
  me.gifts = new Set([...server, ...local]);
  buildPropList();
  if (local.size && [...local].some((id) => !server.has(id)) && ONLINE() && res.id && res.gifts !== undefined) {
    api({ action: "gift", class: CLASS, id: res.id, gifts: [...me.gifts].join(",") }); // 이 컴퓨터에만 있던 선물을 시트로
  }
}

/* ---------- 화면 아이콘 (이모지 대신 코드로 그린 도트 그림) ---------- */
const uiIconCache = {};
function uiIcon(name) {
  if (uiIconCache[name]) return uiIconCache[name];
  const cv = document.createElement("canvas");
  cv.width = 16; cv.height = 16;
  const x = cv.getContext("2d");
  const O = OUTLINE;
  const box = (c, r, w, h, col) => { x.fillStyle = col; x.fillRect(c, r, w, h); };

  if (name === "door") { // 들어가기
    box(4, 3, 8, 11, "#8A5A33");
    box(5, 2, 6, 1, "#8A5A33");
    box(5, 3, 1, 11, "#A96A4D");
    box(10, 8, 1, 2, "#F6C244"); // 손잡이
    box(3, 3, 1, 11, O); box(12, 3, 1, 11, O); box(4, 2, 1, 1, O); box(11, 2, 1, 1, O);
    box(5, 1, 6, 1, O); box(4, 14, 8, 1, O);
  } else if (name === "pin") { // 게시판 압정
    box(5, 3, 6, 5, "#E8453C"); box(4, 4, 8, 3, "#E8453C");
    box(5, 4, 2, 1, "#F58A7E");
    box(4, 3, 1, 1, O); box(11, 3, 1, 1, O); box(3, 4, 1, 3, O); box(12, 4, 1, 3, O);
    box(5, 2, 6, 1, O); box(5, 8, 6, 1, O);
    box(7, 9, 2, 4, "#8C8CA0"); box(7, 13, 2, 1, O); box(6, 9, 1, 4, O); box(9, 9, 1, 4, O);
  } else if (name === "cone") { // 준비 중 고깔
    for (let r = 3; r < 12; r++) { const half = 1 + Math.floor((r - 3) * 0.55); box(8 - half, r, half * 2, 1, r === 7 || r === 8 ? "#FFFFFF" : "#F2823C"); }
    box(3, 12, 10, 2, "#F2823C");
    box(2, 12, 1, 2, O); box(13, 12, 1, 2, O); box(3, 14, 10, 1, O); box(3, 11, 1, 1, O); box(12, 11, 1, 1, O);
    box(7, 2, 2, 1, O);
  } else if (name === "shake") { // 흔들기(작은 나무)
    box(4, 3, 8, 6, "#79B868"); box(3, 4, 10, 4, "#79B868"); box(4, 3, 4, 2, "#8FCB7C");
    box(7, 9, 2, 5, "#8A5A33");
    box(2, 4, 1, 4, O); box(13, 4, 1, 4, O); box(4, 2, 8, 1, O); box(4, 9, 3, 1, O); box(9, 9, 3, 1, O);
    box(6, 9, 1, 5, O); box(9, 9, 1, 5, O); box(7, 14, 2, 1, O);
  } else if (name === "rod") { // 낚싯대와 찌
    box(3, 10, 2, 2, "#B8864C"); box(5, 8, 2, 2, "#B8864C"); box(7, 6, 2, 2, "#B8864C"); box(9, 4, 2, 2, "#B8864C"); // 비스듬한 낚싯대
    box(2, 11, 1, 2, O); box(11, 3, 1, 2, O);
    box(11, 5, 1, 5, "#FFFFFF"); // 낚싯줄
    box(10, 11, 3, 2, "#F77C9A"); box(10, 13, 3, 2, "#FFFFFF"); // 찌
    box(9, 11, 1, 4, O); box(13, 11, 1, 4, O); box(10, 10, 3, 1, O); box(10, 15, 3, 1, O);
  } else if (name === "scoop") { // 건지기(양동이)
    box(4, 6, 8, 7, "#8C8CA0"); box(4, 6, 8, 2, "#7EC8DF");
    box(5, 8, 1, 4, "#A8A8BC");
    box(3, 6, 1, 7, O); box(12, 6, 1, 7, O); box(4, 13, 8, 1, O); box(4, 5, 8, 1, O);
    box(5, 3, 1, 2, O); box(10, 3, 1, 2, O); box(6, 2, 4, 1, O); // 손잡이
  } else if (name === "bag") { // 소품함
    box(4, 5, 8, 9, "#F75E8E"); box(5, 4, 6, 1, "#F75E8E");
    box(5, 8, 6, 3, "#FFD9E3");
    box(5, 5, 1, 8, "#FA87AC");
    box(3, 5, 1, 9, O); box(12, 5, 1, 9, O); box(4, 14, 8, 1, O); box(4, 4, 1, 1, O); box(11, 4, 1, 1, O); box(5, 3, 6, 1, O);
    box(5, 8, 6, 1, O); box(5, 11, 6, 1, O);
  } else if (name === "book") { // 재료 도감
    box(3, 3, 10, 10, "#A96A4D");
    box(11, 4, 2, 9, "#FFF4E0");
    box(5, 5, 5, 1, "#FFF4E0"); box(5, 7, 5, 1, "#FFF4E0");
    box(2, 3, 1, 10, O); box(13, 3, 1, 10, O); box(3, 2, 10, 1, O); box(3, 13, 10, 1, O);
    box(10, 4, 1, 9, O);
  } else if (name === "megaphone") { // 공지
    for (let r = 4; r < 11; r++) { const half = 1 + Math.floor((r - 4) * 0.7); box(9 - half, r, half + 3, 1, "#F6C244"); }
    box(11, 3, 2, 10, "#F2A33C");
    box(13, 3, 1, 10, O); box(11, 2, 2, 1, O); box(11, 13, 2, 1, O);
    box(3, 9, 3, 4, "#8A5A33"); box(2, 9, 1, 4, O); box(6, 11, 1, 2, O); box(3, 13, 3, 1, O);
  } else if (name === "move") { // 움직이는 법 (방향 십자)
    box(7, 2, 2, 12, "#8A5A33"); box(2, 7, 12, 2, "#8A5A33");
    box(6, 3, 1, 1, O); box(9, 3, 1, 1, O); box(7, 1, 2, 1, O);
    box(6, 12, 1, 1, O); box(9, 12, 1, 1, O); box(7, 14, 2, 1, O);
    box(1, 7, 1, 2, O); box(14, 7, 1, 2, O);
  } else if (name === "camera") { // 사진 찍기
    box(2, 5, 12, 8, "#5A5A6E");
    box(2, 5, 12, 2, "#73738C");
    box(10, 3, 3, 2, "#5A5A6E");
    box(6, 7, 4, 4, "#2E2E3C");
    box(7, 8, 2, 2, "#9FDCC2");
    box(1, 5, 1, 8, O); box(14, 5, 1, 8, O); box(2, 13, 12, 1, O); box(2, 4, 8, 1, O);
    box(10, 2, 3, 1, O); box(13, 3, 1, 2, O);
  } else if (name === "cup") { // 벤치·카페 (김이 나는 컵)
    box(3, 6, 9, 7, "#FFF6E6");
    box(3, 6, 9, 2, "#C98A6B");
    box(2, 6, 1, 7, O); box(12, 6, 1, 7, O); box(3, 13, 9, 1, O); box(3, 5, 9, 1, O);
    box(12, 8, 2, 3, "#FFF6E6"); box(14, 8, 1, 3, O); box(12, 7, 2, 1, O); box(12, 11, 2, 1, O); // 손잡이
    box(5, 2, 1, 2, "#C9B89B"); box(8, 1, 1, 2, "#C9B89B"); // 김
  } else if (name === "spark") { // 반짝이는 재료 줍기
    box(7, 2, 2, 12, "#F6C244");
    box(2, 7, 12, 2, "#F6C244");
    box(5, 5, 6, 6, "#FFD66B");
    box(7, 1, 2, 1, O); box(7, 14, 2, 1, O); box(1, 7, 1, 2, O); box(14, 7, 1, 2, O);
    box(7, 7, 2, 2, "#FFFFFF");
  } else if (name === "sound-on") { // 소리 켜짐 (스피커 + 소리 물결)
    box(2, 6, 3, 4, "#8A5A33");
    box(5, 4, 3, 8, "#A96A4D");
    box(1, 6, 1, 4, O); box(2, 5, 3, 1, O); box(2, 10, 3, 1, O);
    box(5, 3, 1, 1, O); box(7, 2, 1, 2, O); box(8, 3, 1, 10, O); box(7, 12, 1, 2, O); box(5, 12, 1, 1, O);
    box(10, 6, 1, 4, "#F6C244"); box(12, 4, 1, 8, "#F6C244"); box(14, 2, 1, 12, "#F2A33C");
  } else if (name === "sound-off") { // 소리 꺼짐 (스피커 + X)
    box(2, 6, 3, 4, "#B9AE9C");
    box(5, 4, 3, 8, "#CFC6B4");
    box(1, 6, 1, 4, O); box(2, 5, 3, 1, O); box(2, 10, 3, 1, O);
    box(5, 3, 1, 1, O); box(7, 2, 1, 2, O); box(8, 3, 1, 10, O); box(7, 12, 1, 2, O); box(5, 12, 1, 1, O);
    box(10, 5, 2, 2, "#E8453C"); box(13, 5, 2, 2, "#E8453C");
    box(11, 7, 3, 2, "#E8453C");
    box(10, 9, 2, 2, "#E8453C"); box(13, 9, 2, 2, "#E8453C");
  } else if (name === "basket") { // 우리 반 바구니 (손잡이 달린 짚 바구니)
    box(4, 2, 8, 1, O); box(3, 3, 1, 4, O); box(12, 3, 1, 4, O); // 손잡이
    box(4, 3, 1, 4, "#C98A4B"); box(11, 3, 1, 4, "#C98A4B");
    box(1, 7, 14, 1, O);
    box(2, 8, 12, 5, "#D9A060");
    box(2, 8, 12, 1, "#E8C07A");
    box(4, 9, 1, 4, "#B07A3E"); box(7, 9, 1, 4, "#B07A3E"); box(10, 9, 1, 4, "#B07A3E"); // 짚 무늬
    box(2, 11, 12, 1, "#B07A3E");
    box(1, 8, 1, 5, O); box(14, 8, 1, 5, O); box(2, 13, 12, 1, O);
    box(5, 5, 3, 2, "#E8453C"); box(8, 6, 3, 1, "#F6D44C"); // 안에 든 재료
  } else if (name === "sprout") { // 쉬는 중 새싹
    box(7, 8, 2, 5, "#58B368");
    box(3, 6, 4, 3, "#7CC576"); box(9, 6, 4, 3, "#7CC576");
    box(4, 5, 2, 1, "#9BDB8E"); box(10, 5, 2, 1, "#9BDB8E");
    box(2, 6, 1, 3, O); box(13, 6, 1, 3, O); box(3, 5, 4, 1, O); box(9, 5, 4, 1, O);
    box(3, 9, 4, 1, O); box(9, 9, 4, 1, O); box(6, 8, 1, 5, O); box(9, 8, 1, 5, O);
    box(5, 13, 6, 2, "#8A5A33"); box(4, 13, 1, 2, O); box(11, 13, 1, 2, O); box(5, 15, 6, 1, O);
  }
  uiIconCache[name] = cv;
  return cv;
}

// 스프라이트를 화면에 넣을 작은 캔버스로 복사
function mkIcon(src, cls) {
  const c = document.createElement("canvas");
  c.width = src.width; c.height = src.height;
  const x = c.getContext("2d");
  x.imageSmoothingEnabled = false;
  x.drawImage(src, 0, 0);
  c.className = cls || "ui-ico";
  return c;
}

// 버튼 내용을 "도트 아이콘 + 글자"로 채우기
function setBtnIcon(btn, iconName, text) {
  btn.innerHTML = "";
  // 이름(문자)이면 공통 아이콘, 캔버스면 그 그림 그대로
  if (iconName) btn.appendChild(mkIcon(typeof iconName === "string" ? uiIcon(iconName) : iconName));
  btn.appendChild(document.createTextNode(" " + text));
}

/* ---------- 마카롱 버튼 (색 고르기) ----------
   옆에서 본 동그란 마카롱: 위아래 껍질이 그 색,
   가운데 얇은 크림 줄은 연한 색. 색이 버튼 대부분을 차지한다. */
const macaronCache = {};
function macaronIcon(hex) {
  if (macaronCache[hex]) return macaronCache[hex];
  const cv = document.createElement("canvas");
  cv.width = 16; cv.height = 16;
  const x = cv.getContext("2d");
  const dark = shadeHex(hex, 0.75), light = shadeHex(hex, 1.22);
  const cream = shadeHex(hex, 1.55); // 가운데 크림 줄 (연한 색)

  // 1 = 위 껍질, 2 = 크림 줄, 3 = 아래 껍질
  const g = Array.from({ length: 16 }, () => new Array(16).fill(0));
  for (let r = 0; r < 16; r++) {
    for (let c = 0; c < 16; c++) {
      const dxT = (c - 8) / 6.8, dyT = (r - 6.5) / 4.6;
      if (r <= 6 && dxT * dxT + dyT * dyT <= 1) g[r][c] = 1;       // 위 껍질(둥근 돔)
      if ((r === 7 || r === 8) && Math.abs(c - 8) <= 6.4) g[r][c] = 2; // 얇은 크림 줄
      const dxB = (c - 8) / 6.8, dyB = (r - 9.5) / 4.6;
      if (r >= 9 && dxB * dxB + dyB * dyB <= 1) g[r][c] = 3;       // 아래 껍질
    }
  }

  for (let r = 0; r < 16; r++) {
    for (let c = 0; c < 16; c++) {
      if (!g[r][c]) continue;
      let col;
      if (g[r][c] === 2) col = cream;
      else {
        col = hex;
        if (g[r][c] === 1 && r <= 3 && c < 10) col = light;            // 윗면 밝게
        if (g[r][c] === 3 && !((g[r + 1] || [])[c])) col = dark;       // 아래 가장자리 그늘
        if (g[r][c] === 1 && r === 6 && c % 2 === 0) col = dark;       // 마카롱 발(주름)
        if (g[r][c] === 3 && r === 9 && c % 2 === 1) col = dark;
      }
      x.fillStyle = col;
      x.fillRect(c, r, 1, 1);
    }
  }
  // 테두리
  x.fillStyle = OUTLINE;
  for (let r = 0; r < 16; r++) for (let c = 0; c < 16; c++) {
    if (g[r][c]) continue;
    const near = (g[r - 1] || [])[c] || (g[r + 1] || [])[c] || g[r][c - 1] || g[r][c + 1];
    if (near) x.fillRect(c, r, 1, 1);
  }
  macaronCache[hex] = cv;
  return cv;
}

/* ---------- 효과음 (WebAudio, 파일 없이 코드로) ----------
   - 부드러운 둥근 톤, 짧게, 낮은 볼륨
   - 소리 나는 곳: 재료 획득, 미션 도착, 도감 완성 (딱 3곳)
   - 기본값은 시트의 소리기본, 이 기기에서 켜고 끈 기록이 우선 */
let audioCtx = null;
let soundPref = null;
try {
  const sp = localStorage.getItem("happybread_sound_" + CLASS);
  if (sp === "O") soundPref = true;
  else if (sp === "X") soundPref = false;
} catch (e) { /* 무시 */ }

function soundEnabled() {
  return soundPref === null ? VILLAGE_CFG.soundDefault !== false : soundPref;
}

function playTone(kind) {
  if (!soundEnabled()) return;
  try {
    if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    const notes = kind === "mission" ? [659, 880] : kind === "dex" ? [523, 659, 784, 1047] : [523, 784];
    notes.forEach((f, i) => {
      const o = audioCtx.createOscillator();
      const g = audioCtx.createGain();
      o.type = "sine";
      o.frequency.value = f;
      const t = audioCtx.currentTime + i * 0.09;
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(0.11, t + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.35);
      o.connect(g).connect(audioCtx.destination);
      o.start(t);
      o.stop(t + 0.4);
    });
  } catch (e) { /* 소리가 안 나도 기능은 그대로 */ }
}

function updateSoundBtn() {
  const btn = $("soundBtn");
  btn.innerHTML = "";
  btn.appendChild(mkIcon(uiIcon(soundEnabled() ? "sound-on" : "sound-off")));
}

function setupSoundBtn() { // (화면 요소가 준비된 뒤 시작 부분에서 연결)
  $("soundBtn").addEventListener("click", () => {
    soundPref = !soundEnabled();
    try { localStorage.setItem("happybread_sound_" + CLASS, soundPref ? "O" : "X"); } catch (e) { /* 무시 */ }
    updateSoundBtn();
    showToast(soundPref ? "소리를 켰어요." : "소리를 껐어요.");
    if (soundPref) playTone("gather");
  });
  updateSoundBtn();
}

/* ---------- 나무·덤불·밀 이삭 스프라이트 (빵나라 식물) ---------- */
const plantCache = {};
function plantSprite(kind, golden) {
  const key = kind + (golden ? "_g" : "");
  if (plantCache[key]) return plantCache[key];
  const cv = document.createElement("canvas");
  const x = cv.getContext("2d");
  const outlinePass = (g, W, H) => {
    x.fillStyle = OUTLINE;
    for (let r = 0; r < H; r++) for (let c = 0; c < W; c++) {
      if (g[r][c]) continue;
      const near = (g[r - 1] || [])[c] || (g[r + 1] || [])[c] || g[r][c - 1] || g[r][c + 1];
      if (near) x.fillRect(c, r, 1, 1);
    }
  };

  if (kind === "P") { // 프레첼 나무: 꽈배기 줄기 + 둥근 잎
    cv.width = 18; cv.height = 24;
    const g = Array.from({ length: 24 }, () => new Array(18).fill(0));
    const el = (cx, cy, rx, ry) => {
      for (let r = 0; r < 24; r++) for (let c = 0; c < 18; c++) {
        const dx = (c - cx) / rx, dy = (r - cy) / ry;
        if (dx * dx + dy * dy <= 1) g[r][c] = 1;
      }
    };
    el(9, 7, 6, 6); el(5, 11, 4.6, 4.2); el(13, 11, 4.6, 4.2);
    for (let r = 0; r < 24; r++) for (let c = 0; c < 18; c++) {
      if (!g[r][c]) continue;
      x.fillStyle = (r > 10 || (c > 11 && r > 6)) ? "#5E9C4F" : "#79B868";
      if (r < 5 && c < 10) x.fillStyle = "#8FCB7C";
      x.fillRect(c, r, 1, 1);
    }
    // 프레첼 줄기 (꼬인 무늬 + 굵은 소금)
    x.fillStyle = "#A96A4D"; x.fillRect(7, 15, 4, 8);
    x.fillStyle = "#C98A6B";
    x.fillRect(7, 16, 2, 1); x.fillRect(9, 18, 2, 1); x.fillRect(7, 20, 2, 1); x.fillRect(9, 22, 2, 1);
    x.fillStyle = "#FFF6E6";
    x.fillRect(8, 17, 1, 1); x.fillRect(10, 20, 1, 1);
    x.fillStyle = OUTLINE; x.fillRect(6, 15, 1, 8); x.fillRect(11, 15, 1, 8); x.fillRect(7, 23, 4, 1);
    for (let r = 15; r < 24; r++) { g[r][7] = g[r][8] = g[r][9] = g[r][10] = 1; } // 외곽선 계산용
    outlinePass(g, 18, 24);
  } else if (kind === "B") { // 딸기 덤불: 낮고 둥근 수풀 (아래 외곽선까지 보이게 한 줄 여유)
    cv.width = 20; cv.height = 14;
    const g = Array.from({ length: 14 }, () => new Array(20).fill(0));
    const el = (cx, cy, rx, ry) => {
      for (let r = 0; r < 14; r++) for (let c = 0; c < 20; c++) {
        const dx = (c - cx) / rx, dy = (r - cy) / ry;
        if (dx * dx + dy * dy <= 1) g[r][c] = 1;
      }
    };
    el(10, 7, 9, 4.6); el(4.5, 8, 4.4, 3.4); el(15.5, 8, 4.4, 3.4); el(10, 4.5, 5.5, 3.2);
    for (let r = 0; r < 14; r++) for (let c = 0; c < 20; c++) {
      if (!g[r][c]) continue;
      x.fillStyle = r > 7 ? "#58984A" : (r < 4 && c < 12 ? "#8FCB7C" : "#79B868");
      x.fillRect(c, r, 1, 1);
    }
    outlinePass(g, 20, 14);
  } else { // W: 밀 이삭 묶음 (golden이면 잘 익은 황금색)
    cv.width = 16; cv.height = 18;
    const g = Array.from({ length: 18 }, () => new Array(16).fill(0));
    const stalk = golden ? "#C9A850" : "#8FA85C";
    const head = golden ? "#E8C060" : "#AEBE74";
    const headL = golden ? "#F6DC90" : "#C6D492";
    const put = (c, r) => { if (c >= 0 && r >= 0 && c < 16 && r < 18) g[r][c] = 1; };
    const drawStalk = (cx, lean) => {
      for (let r = 7; r < 17; r++) {
        const c = cx + Math.round(lean * (r - 7) / 10);
        put(c, r);
        x.fillStyle = stalk; x.fillRect(c, r, 1, 1);
      }
      for (let r = 1; r < 8; r++) { // 이삭 머리
        const w = r < 3 || r > 6 ? 1 : 2;
        for (let k = 0; k < w; k++) {
          put(cx - (w > 1 ? 1 : 0) + k, r);
          x.fillStyle = (r + k) % 2 === 0 ? head : headL;
          x.fillRect(cx - (w > 1 ? 1 : 0) + k, r, 1, 1);
        }
      }
    };
    drawStalk(4, -1); drawStalk(8, 0); drawStalk(12, 1);
    outlinePass(g, 16, 18);
  }
  plantCache[key] = cv;
  return cv;
}

/* ---------- 마카롱·도넛 돌 장애물 ---------- */
const rockCache = {};
function rockSprite(kind, variant) {
  const key = kind + "_" + variant;
  if (rockCache[key]) return rockCache[key];
  const cv = document.createElement("canvas");
  const x = cv.getContext("2d");
  if (kind === "macaron") {
    cv.width = 22; cv.height = 15;
    const hex = variant % 2 === 0 ? "#F4A8BC" : "#9FDCC2";
    const dark = shadeHex(hex, 0.75), cream = "#FFF6E6";
    const g = Array.from({ length: 15 }, () => new Array(22).fill(0));
    for (let r = 0; r < 15; r++) for (let c = 0; c < 22; c++) {
      const dT = ((c - 11) / 9.6) ** 2 + ((r - 5) / 4.4) ** 2;
      const dB = ((c - 11) / 9.6) ** 2 + ((r - 9.5) / 4.2) ** 2;
      if ((r <= 6 && dT <= 1) || (r >= 8 && dB <= 1)) g[r][c] = 1;
      if ((r === 7) && Math.abs(c - 11) <= 9) g[r][c] = 2;
    }
    for (let r = 0; r < 15; r++) for (let c = 0; c < 22; c++) {
      if (!g[r][c]) continue;
      let col = g[r][c] === 2 ? cream : hex;
      if (g[r][c] === 1 && !((g[r + 1] || [])[c])) col = dark;
      if (g[r][c] === 1 && r <= 2 && c < 12) col = shadeHex(hex, 1.2);
      if (g[r][c] === 1 && (r === 6 || r === 8) && c % 2 === 0) col = dark; // 마카롱 발
      x.fillStyle = col; x.fillRect(c, r, 1, 1);
    }
    x.fillStyle = OUTLINE;
    for (let r = 0; r < 15; r++) for (let c = 0; c < 22; c++) {
      if (g[r][c]) continue;
      const near = (g[r - 1] || [])[c] || (g[r + 1] || [])[c] || g[r][c - 1] || g[r][c + 1];
      if (near) x.fillRect(c, r, 1, 1);
    }
  } else { // donut: 가운데 구멍이 뚫린 도넛
    cv.width = 20; cv.height = 16;
    const g = Array.from({ length: 16 }, () => new Array(20).fill(0));
    for (let r = 0; r < 16; r++) for (let c = 0; c < 20; c++) {
      const dO = ((c - 10) / 9.4) ** 2 + ((r - 8) / 7) ** 2;
      const dI = ((c - 10) / 3.4) ** 2 + ((r - 8) / 2.4) ** 2;
      if (dO <= 1 && dI > 1) g[r][c] = 1;
    }
    for (let r = 0; r < 16; r++) for (let c = 0; c < 20; c++) {
      if (!g[r][c]) continue;
      let col = r <= 8 ? "#F08BA6" : "#D9A05F"; // 위는 글레이즈
      if (r === 9 && c % 3 !== 0) col = "#F08BA6";
      if (!((g[r + 1] || [])[c]) && r > 8) col = "#B5793F";
      x.fillStyle = col; x.fillRect(c, r, 1, 1);
    }
    const sp = ["#FFF4E0", "#9FDCC2", "#F6C244"];
    [[6, 3], [12, 2], [15, 5], [4, 6], [10, 5]].forEach(([c, r], i) => {
      if (g[r][c]) { x.fillStyle = sp[i % 3]; x.fillRect(c, r, 1, 1); }
    });
    x.fillStyle = OUTLINE;
    for (let r = 0; r < 16; r++) for (let c = 0; c < 20; c++) {
      if (g[r][c]) continue;
      const near = (g[r - 1] || [])[c] || (g[r + 1] || [])[c] || g[r][c - 1] || g[r][c + 1];
      if (near) x.fillRect(c, r, 1, 1);
    }
  }
  rockCache[key] = cv;
  return cv;
}

/* ---------- 바게트 벤치 ---------- */
let benchSpriteCv = null;
function benchSprite() {
  if (benchSpriteCv) return benchSpriteCv;
  const cv = document.createElement("canvas");
  cv.width = 26; cv.height = 12;
  const x = cv.getContext("2d");
  const g = Array.from({ length: 12 }, () => new Array(26).fill(0));
  for (let r = 0; r < 12; r++) for (let c = 0; c < 26; c++) {
    if (((c - 13) / 12) ** 2 + ((r - 4) / 3) ** 2 <= 1) g[r][c] = 1;
  }
  for (let r = 0; r < 12; r++) for (let c = 0; c < 26; c++) {
    if (!g[r][c]) continue;
    let col = "#E6BE84";
    if (!((g[r + 1] || [])[c])) col = "#BD9154";
    if (r <= 2) col = "#F4DCAE";
    x.fillStyle = col; x.fillRect(c, r, 1, 1);
  }
  x.fillStyle = "#F4DCAE"; // 바게트 칼집
  [[6, 3], [12, 2], [18, 3]].forEach(([c, r]) => { x.fillRect(c, r, 2, 1); x.fillRect(c + 1, r + 1, 2, 1); });
  // 나무 다리
  x.fillStyle = "#8A5A33"; x.fillRect(4, 7, 3, 4); x.fillRect(19, 7, 3, 4);
  for (let r = 7; r < 11; r++) { g[r][4] = g[r][5] = g[r][6] = 1; g[r][19] = g[r][20] = g[r][21] = 1; }
  x.fillStyle = OUTLINE;
  for (let r = 0; r < 12; r++) for (let c = 0; c < 26; c++) {
    if (g[r][c]) continue;
    const near = (g[r - 1] || [])[c] || (g[r + 1] || [])[c] || g[r][c - 1] || g[r][c + 1];
    if (near) x.fillRect(c, r, 1, 1);
  }
  benchSpriteCv = cv;
  return cv;
}

// 긴 바게트 의자 (긴 식탁용): 가운데는 길게, 양 끝은 둥글게
let longBenchCv = null;
function longBenchSprite(wTiles) {
  if (longBenchCv) return longBenchCv;
  const W = Math.round((wTiles * TILE) / 3) + 2; // 3배로 키워 그린다
  const cv = document.createElement("canvas");
  cv.width = W; cv.height = 12;
  const x = cv.getContext("2d");
  const g = Array.from({ length: 12 }, () => new Array(W).fill(0));
  for (let r = 1; r <= 7; r++) for (let c = 1; c < W - 1; c++) {
    const dx = c < 8 ? 8 - c : c > W - 9 ? c - (W - 9) : 0;
    if ((dx / 7) ** 2 + ((r - 4) / 3) ** 2 <= 1) g[r][c] = 1;
  }
  for (let r = 0; r < 12; r++) for (let c = 0; c < W; c++) {
    if (!g[r][c]) continue;
    let col = "#E6BE84";
    if (!((g[r + 1] || [])[c])) col = "#BD9154";
    if (r <= 2) col = "#F4DCAE";
    x.fillStyle = col; x.fillRect(c, r, 1, 1);
  }
  x.fillStyle = "#F4DCAE"; // 바게트 칼집
  for (let c = 8, i = 0; c < W - 9; c += 9, i++) {
    const r = 2 + (i % 2);
    x.fillRect(c, r, 2, 1); x.fillRect(c + 1, r + 1, 2, 1);
  }
  // 나무 다리 3쌍
  x.fillStyle = "#8A5A33";
  for (const lc of [6, Math.floor(W / 2) - 1, W - 9]) {
    x.fillRect(lc, 7, 3, 4);
    for (let r = 7; r < 11; r++) { g[r][lc] = g[r][lc + 1] = g[r][lc + 2] = 1; }
  }
  x.fillStyle = OUTLINE;
  for (let r = 0; r < 12; r++) for (let c = 0; c < W; c++) {
    if (g[r][c]) continue;
    const near = (g[r - 1] || [])[c] || (g[r + 1] || [])[c] || g[r][c - 1] || g[r][c + 1];
    if (near) x.fillRect(c, r, 1, 1);
  }
  longBenchCv = cv;
  return cv;
}

/* ---------- 낚시 자리: 딸기 방석 + 노란 깃발 (선착장 위, 한 자리) ----------
   28x20 격자. 방석은 가운데(앉은 캐릭터 엉덩이 밑), 깃발은 왼쪽 (낚싯대를 든 오른손과 겹치지 않게). */
let fishSpotCv = null;
function fishSpotSprite() {
  if (fishSpotCv) return fishSpotCv;
  const W = 28, H = 20;
  const cv = document.createElement("canvas");
  cv.width = W; cv.height = H;
  const x = cv.getContext("2d");
  const g = Array.from({ length: H }, () => new Array(W).fill(0));
  const put = (c, r, v) => { if (c >= 0 && r >= 0 && c < W && r < H) g[r][c] = v; };
  // 방석 (둥근 네모): 1
  for (let r = 13; r <= 18; r++) for (let c = 8; c <= 23; c++) {
    const corner = (r === 13 || r === 18) && (c === 8 || c === 23);
    if (!corner) put(c, r, 1);
  }
  // 깃대: 2 / 깃발(세모): 3
  for (let r = 3; r <= 17; r++) put(3, r, 2);
  for (let r = 3; r <= 8; r++) {
    const w = r <= 5 ? r - 2 : 9 - r; // 1,2,3,3,2,1
    for (let k = 0; k < w; k++) put(4 + k, r, 3); // 깃대 오른쪽으로 펄럭인다
  }
  const colors = { 1: "#F77C9A", 2: "#8A5A33", 3: "#F6C244" };
  for (let r = 0; r < H; r++) for (let c = 0; c < W; c++) {
    const v = g[r][c];
    if (!v) continue;
    let col = colors[v];
    if (v === 1 && r === 13) col = "#FBA9BE";                       // 방석 윗면 밝게
    if (v === 1 && r === 18) col = "#D9577A";                       // 방석 아래 그늘
    if (v === 3 && r === 3) col = "#FFE08A";
    x.fillStyle = col; x.fillRect(c, r, 1, 1);
  }
  x.fillStyle = "#FFF4E0"; // 방석 가운데 단추와 바느질 점
  x.fillRect(15, 15, 2, 2);
  [[10, 15], [21, 15], [10, 17], [21, 17]].forEach(([c, r]) => x.fillRect(c, r, 1, 1));
  x.fillStyle = OUTLINE;
  for (let r = 0; r < H; r++) for (let c = 0; c < W; c++) {
    if (g[r][c]) continue;
    const near = (g[r - 1] || [])[c] || (g[r + 1] || [])[c] || g[r][c - 1] || g[r][c + 1];
    if (near) x.fillRect(c, r, 1, 1);
  }
  fishSpotCv = cv;
  return cv;
}

/* ============================================================
   크리스마스 꾸미기 (시트 마을 탭의 "크리스마스" O/X로 켜고 끈다)
   - 빵·과자 장식: 광장 쿠키 트리, 건물 지붕 슈가파우더 눈 + 전구 줄 + 리스,
     진저브레드·지팡이 사탕, 슈크림 눈사람, 천천히 내리는 눈
   - 동작 줄이기(기기 설정)가 켜져 있으면 눈 내리기와 전구 움직임이 멈춘다
   - 주소에 ?xmas=1 을 붙이면 시트와 상관없이 켜져서 미리 볼 수 있다
   ============================================================ */
let XMAS = false;
const XMAS_FORCE = new URLSearchParams(location.search).get("xmas") === "1";
const XMAS_TREE = { c: 26, r: 14 };     // 광장 오른쪽 위 (사무소 문 앞 길·큰길·촌장 자리를 피한 자리)
const XMAS_SNOWMEN = [                  // 눈사람 3개 (길·벤치·식탁 가는 길을 피한 들판)
  { c: 22, r: 25 }, { c: 31, r: 20 }, { c: 36, r: 26 },
];
// 켜져 있을 때만 막는 칸: 트리(그림이 서 있는 3칸, 선물 상자 포함) + 눈사람들
const XMAS_BLOCKS = [
  { c: XMAS_TREE.c - 1, r: XMAS_TREE.r }, { c: XMAS_TREE.c, r: XMAS_TREE.r }, { c: XMAS_TREE.c + 1, r: XMAS_TREE.r },
  ...XMAS_SNOWMEN,
];
const REDUCED = !!(window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches);
const XMAS_BULBS = ["#FFD45C", "#7FD8BE", "#7EC8F2", "#F7A8C8", "#C3A6F0"]; // 파스텔 전구 5색

function applyChristmas(on) {
  on = !!on || XMAS_FORCE;
  if (on === XMAS) return;
  XMAS = on;
  for (const t of XMAS_BLOCKS) {
    blocked[t.r][t.c] = on; // 켜져 있을 때만 그 칸을 막는다
    // 마침 그 칸에 서 있었으면 옆으로 한 칸 비켜난다
    if (on && Math.floor(me.x / TILE) === t.c && Math.floor(me.y / TILE) === t.r) {
      for (const [dc, dr] of [[0, 1], [1, 0], [-1, 0], [0, -1]]) {
        const nc = t.c + dc, nr = t.r + dr;
        if (blocked[nr] && !blocked[nr][nc]) { me.x = (nc + 0.5) * TILE; me.y = (nr + 0.5) * TILE; break; }
      }
    }
  }
}

// 전구 한 알: 2초에 한 번 부드럽게 밝아졌다 어두워진다 (전구마다 위상이 달라 물결처럼 지나간다)
function bulbAlpha(i, now) {
  if (REDUCED) return 0.85;
  return 0.55 + 0.45 * (0.5 + 0.5 * Math.sin(2 * Math.PI * (now / 2000 - i / 10)));
}
function drawBulb(px, py, i, now) {
  const a = bulbAlpha(i, now);
  ctx.fillStyle = XMAS_BULBS[i % XMAS_BULBS.length];
  ctx.globalAlpha = a * 0.35;
  ctx.beginPath(); ctx.arc(px, py, 6, 0, Math.PI * 2); ctx.fill(); // 후광
  ctx.globalAlpha = a;
  ctx.beginPath(); ctx.arc(px, py, 2.5, 0, Math.PI * 2); ctx.fill(); // 알
  ctx.globalAlpha = 1;
}

// 광장 쿠키 트리 + 트리 밑 케이크 상자 선물 (72x72를 2배로 그린다)
let xmasTreeCv = null;
function xmasTreeSprite() {
  if (xmasTreeCv) return xmasTreeCv;
  const cv = document.createElement("canvas");
  cv.width = 72; cv.height = 72;
  const x = cv.getContext("2d");
  const box = (c, r, w, h, col) => { x.fillStyle = col; x.fillRect(c, r, w, h); };
  const O = OUTLINE;
  // 쿠키 줄기
  box(32, 58, 8, 10, "#A96A4D"); box(31, 58, 1, 10, O); box(40, 58, 1, 10, O); box(32, 68, 8, 1, O);
  // 마카롱 3층 (아래가 가장 넓다) + 하얀 아이싱 끝단
  const tier = (c0, r0, w, h) => {
    box(c0, r0, w, h, "#58984A");
    box(c0 + 2, r0, w - 4, 3, "#79B868");               // 윗면 밝게
    for (let c = c0; c < c0 + w; c += 5) box(c + 1, r0 + h - 3, 3, 3, "#FFF6E6"); // 아이싱 방울
    box(c0 - 1, r0, 1, h, O); box(c0 + w, r0, 1, h, O);
    box(c0, r0 - 1, w, 1, O); box(c0, r0 + h, w, 1, O);
  };
  tier(14, 44, 44, 14);
  tier(20, 30, 32, 14);
  tier(26, 17, 20, 13);
  // 장식: 사탕·젤리 점 + 작은 도넛
  const deco = [[20, 50, "#F77C9A"], [30, 53, "#F6C244"], [44, 49, "#7EC8F2"], [50, 52, "#C9A7E6"],
                [25, 36, "#F6C244"], [38, 34, "#F77C9A"], [45, 38, "#7FD8BE"],
                [30, 22, "#7EC8F2"], [40, 24, "#F6C244"]];
  for (const [c, r, col] of deco) { box(c, r, 4, 4, col); box(c, r, 4, 1, "#FFFFFF"); }
  // 작은 도넛 2개 (고리 모양)
  for (const [c, r] of [[36, 48], [28, 39]]) {
    box(c, r, 6, 6, "#E8C08A"); box(c + 2, r + 2, 2, 2, "#58984A");
    box(c, r, 6, 1, "#F5D8AC");
  }
  // 꼭대기 별 모양 쿠키
  box(34, 5, 4, 12, "#F6C244"); box(30, 9, 12, 4, "#F6C244");
  box(33, 8, 6, 6, "#FFE08A");
  box(34, 4, 4, 1, O); box(34, 17, 4, 1, O); box(29, 9, 1, 4, O); box(42, 9, 1, 4, O);
  box(33, 5, 1, 4, O); box(38, 5, 1, 4, O); box(30, 8, 4, 1, O); box(38, 8, 4, 1, O);
  box(30, 13, 4, 1, O); box(38, 13, 4, 1, O); box(33, 13, 1, 4, O); box(38, 13, 1, 4, O);
  // 트리 밑 케이크 상자 선물 2개
  const gift = (c0, r0, col, ribbon) => {
    box(c0, r0, 14, 10, col);
    box(c0 + 6, r0, 2, 10, ribbon); box(c0, r0 + 4, 14, 2, ribbon);
    box(c0 + 4, r0 - 3, 3, 3, ribbon); box(c0 + 8, r0 - 3, 3, 3, ribbon); // 리본 매듭
    box(c0 - 1, r0, 1, 10, O); box(c0 + 14, r0, 1, 10, O);
    box(c0, r0 - 1, 14, 1, O); box(c0, r0 + 10, 14, 1, O);
  };
  gift(2, 60, "#F77C9A", "#FFF6E6");
  gift(55, 61, "#9FDCC2", "#FFFFFF");
  xmasTreeCv = cv;
  return cv;
}

// 슈크림 눈사람 (22x28을 2배로) — 목도리가 눈사람마다 다르다
const snowmanCache = {};
function snowmanSprite(v) {
  v = (v || 0) % 3;
  if (snowmanCache[v]) return snowmanCache[v];
  const cv = document.createElement("canvas");
  cv.width = 22; cv.height = 28;
  const x = cv.getContext("2d");
  const g = Array.from({ length: 28 }, () => new Array(22).fill(0));
  const el = (cx, cy, rx, ry) => {
    for (let r = 0; r < 28; r++) for (let c = 0; c < 22; c++) {
      const dx = (c - cx) / rx, dy = (r - cy) / ry;
      if (dx * dx + dy * dy <= 1) g[r][c] = 1;
    }
  };
  el(11, 8, 6, 6);    // 머리 (슈크림 한 덩이)
  el(11, 19, 8, 8);   // 몸 (큰 슈크림)
  for (let r = 0; r < 28; r++) for (let c = 0; c < 22; c++) {
    if (!g[r][c]) continue;
    x.fillStyle = r < 5 || (r > 12 && r < 16) ? "#FFFFFF" : "#FFF6E6";
    x.fillRect(c, r, 1, 1);
  }
  x.fillStyle = "#3B2512"; // 초코 눈
  x.fillRect(8, 7, 2, 2); x.fillRect(13, 7, 2, 2);
  x.fillStyle = "#F0607A"; // 딸기 코
  x.fillRect(10, 9, 2, 2);
  // 목도리: 색·줄무늬·늘어뜨린 방향이 눈사람마다 다르다
  const scarf = [
    { main: "#F77C9A", tail: 13, stripe: null },
    { main: "#7FD8BE", tail: 6,  stripe: "#FFF6E6" },
    { main: "#7EC8F2", tail: 13, stripe: "#F6C244" },
  ][v];
  x.fillStyle = scarf.main;
  x.fillRect(6, 12, 10, 3); x.fillRect(scarf.tail, 15, 3, 5);
  if (scarf.stripe) {
    x.fillStyle = scarf.stripe;
    x.fillRect(8, 13, 2, 1); x.fillRect(12, 13, 2, 1); x.fillRect(scarf.tail + 1, 17, 1, 2);
  }
  x.fillStyle = "#A96A4D"; // 프레첼 막대 팔
  x.fillRect(2, 15, 4, 2); x.fillRect(16, 15, 4, 2);
  x.fillStyle = "#3B2512"; // 초코 단추
  x.fillRect(10, 18, 2, 2); x.fillRect(10, 22, 2, 2);
  const o = cv.getContext("2d");
  o.fillStyle = OUTLINE;
  for (let r = 0; r < 28; r++) for (let c = 0; c < 22; c++) {
    if (g[r][c]) continue;
    const near = (g[r - 1] || [])[c] || (g[r + 1] || [])[c] || g[r][c - 1] || g[r][c + 1];
    if (near) o.fillRect(c, r, 1, 1);
  }
  snowmanCache[v] = cv;
  return cv;
}

// 문에 거는 리스 (도넛 / 프레첼, 14x14를 그릴 때 키운다)
const wreathCache = {};
function wreathSprite(kind) {
  if (wreathCache[kind]) return wreathCache[kind];
  const cv = document.createElement("canvas");
  cv.width = 14; cv.height = 14;
  const x = cv.getContext("2d");
  const box = (c, r, w, h, col) => { x.fillStyle = col; x.fillRect(c, r, w, h); };
  const body = kind === "donut" ? "#F4A8BC" : "#C98A6B";
  // 둥근 고리
  box(4, 1, 6, 2, body); box(4, 11, 6, 2, body);
  box(1, 4, 2, 6, body); box(11, 4, 2, 6, body);
  box(2, 2, 3, 3, body); box(9, 2, 3, 3, body);
  box(2, 9, 3, 3, body); box(9, 9, 3, 3, body);
  if (kind === "donut") { // 스프링클
    box(5, 1, 1, 1, "#FFF6E6"); box(11, 5, 1, 1, "#7FD8BE"); box(8, 11, 1, 1, "#F6C244"); box(2, 7, 1, 1, "#7EC8F2");
  } else { // 굵은 소금
    box(5, 1, 1, 1, "#FFF6E6"); box(11, 6, 1, 1, "#FFF6E6"); box(7, 11, 1, 1, "#FFF6E6"); box(2, 5, 1, 1, "#FFF6E6");
  }
  box(6, 0, 2, 2, "#E8453C"); box(4, 0, 2, 1, "#E8453C"); box(8, 0, 2, 1, "#E8453C"); // 리본
  wreathCache[kind] = cv;
  return cv;
}

// 진저브레드 쿠키 사람 (12x16) / 지팡이 사탕 (8x18)
let gingerCv = null, caneCv = null;
function gingerSprite() {
  if (gingerCv) return gingerCv;
  const cv = document.createElement("canvas");
  cv.width = 12; cv.height = 16;
  const x = cv.getContext("2d");
  const box = (c, r, w, h, col) => { x.fillStyle = col; x.fillRect(c, r, w, h); };
  box(3, 1, 6, 5, "#C98A6B");                 // 머리
  box(2, 6, 8, 5, "#C98A6B");                 // 몸+팔
  box(0, 6, 2, 3, "#C98A6B"); box(10, 6, 2, 3, "#C98A6B");
  box(3, 11, 2, 4, "#C98A6B"); box(7, 11, 2, 4, "#C98A6B"); // 다리
  box(4, 3, 1, 1, "#3B2512"); box(7, 3, 1, 1, "#3B2512");   // 눈
  box(5, 4, 2, 1, "#FFF6E6");                 // 아이싱 입
  box(5, 7, 1, 1, "#F77C9A"); box(5, 9, 1, 1, "#7FD8BE");   // 단추
  box(2, 6, 8, 1, "#FFF6E6");                 // 아이싱 장식
  gingerCv = cv;
  return cv;
}
function caneSprite() {
  if (caneCv) return caneCv;
  const cv = document.createElement("canvas");
  cv.width = 10; cv.height = 18;
  const x = cv.getContext("2d");
  const box = (c, r, w, h, col) => { x.fillStyle = col; x.fillRect(c, r, w, h); };
  box(3, 2, 3, 15, "#FFFFFF");               // 기둥
  box(3, 0, 6, 3, "#FFFFFF"); box(8, 1, 2, 4, "#FFFFFF"); // 갈고리
  x.fillStyle = "#F0607A";                   // 딸기 줄무늬
  for (let r = 3; r < 17; r += 4) x.fillRect(3, r, 3, 2);
  x.fillRect(5, 0, 2, 2);
  x.fillStyle = OUTLINE;
  x.fillRect(2, 2, 1, 15); x.fillRect(6, 5, 1, 12); x.fillRect(3, 17, 3, 1);
  caneCv = cv;
  return cv;
}

// 건물 겉 꾸미기: 지붕 슈가파우더 눈 + 전구 줄 + 문 리스 + 문 옆 과자 (간판은 안 가린다)
function drawXmasOnBuilding(f, x, y, idx, now) {
  // 지붕턱 위 슈가파우더 눈 (흰 띠 + 흘러내린 방울)
  ctx.fillStyle = "rgba(255,255,255,0.95)";
  ctx.fillRect(x + 24, y + 6, 176, 8);
  for (let i = 0; i < 6; i++) ctx.fillRect(x + 34 + i * 30 + (idx * 7) % 12, y + 14, 10, 5);
  // 차양 위 가장자리 전구 줄 (간판보다 위)
  for (let i = 0; i < 9; i++) drawBulb(x + 20 + i * 23, y + 36, i + idx * 3, now);
  // 문 리스 (문 위쪽, 간판 아래) — 건물마다 종류가 다르다
  ctx.drawImage(wreathSprite(idx % 2 === 0 ? "donut" : "pretzel"), x + 98, y + 134, 28, 28);
  // 문 옆 장식 — 건물마다 다르다: 진저브레드 / 지팡이 사탕 / 케이크 상자 선물
  const v = idx % 3;
  if (v === 0) ctx.drawImage(gingerSprite(), x + 142, y + 156, 24, 32);
  else if (v === 1) ctx.drawImage(caneSprite(), x + 144, y + 152, 20, 36);
  else {
    ctx.fillStyle = "#7EC8F2"; ctx.fillRect(x + 142, y + 166, 26, 20);
    ctx.fillStyle = "#FFF6E6"; ctx.fillRect(x + 153, y + 166, 4, 20); ctx.fillRect(x + 142, y + 173, 26, 4);
    ctx.strokeStyle = OUTLINE; ctx.lineWidth = 2; ctx.strokeRect(x + 142, y + 166, 26, 20);
  }
}

// 광장 트리 (장식 전구 포함)와 눈사람 그리기
function drawXmasTree(now) {
  const x = (XMAS_TREE.c + 0.5) * TILE - cam.x;
  const y = (XMAS_TREE.r + 1) * TILE - cam.y;
  if (x < -90 || x > canvas.width + 90) return;
  ctx.fillStyle = "rgba(60,40,20,0.18)";
  ctx.beginPath(); ctx.ellipse(x, y - 4, 42, 9, 0, 0, Math.PI * 2); ctx.fill();
  ctx.drawImage(xmasTreeSprite(), x - 72, y - 138, 144, 144);
  // 트리 전구 몇 알
  const spots = [[-30, -52], [26, -58], [-16, -86], [18, -92], [0, -116]];
  spots.forEach(([dx, dy], i) => drawBulb(x + dx, y + dy, i * 2 + 1, now));
}
function drawSnowman(pos, v) {
  const x = (pos.c + 0.5) * TILE - cam.x;
  const y = (pos.r + 1) * TILE - cam.y;
  if (x < -40 || x > canvas.width + 40) return;
  ctx.fillStyle = "rgba(60,40,20,0.16)";
  ctx.beginPath(); ctx.ellipse(x, y - 3, 22, 6, 0, 0, Math.PI * 2); ctx.fill();
  ctx.drawImage(snowmanSprite(v), x - 22, y - 56, 44, 56);
}

// 천천히 내리는 눈 (동작 줄이기면 안 내린다)
let snowFlakes = null;
function drawSnowfall(dt) {
  if (!XMAS || REDUCED) return;
  if (!snowFlakes) {
    snowFlakes = [];
    for (let i = 0; i < 40; i++) {
      snowFlakes.push({ x: Math.random(), y: Math.random(), v: 14 + Math.random() * 14, p: Math.random() * 6.28, z: 2 + Math.random() * 1.6 });
    }
  }
  ctx.fillStyle = "rgba(255,255,255,0.85)";
  for (const f of snowFlakes) {
    f.y += (f.v * dt) / canvas.height;
    f.p += dt * 0.8;
    if (f.y > 1.02) { f.y = -0.02; f.x = Math.random(); }
    ctx.fillRect(f.x * canvas.width + Math.sin(f.p) * 8, f.y * canvas.height, f.z, f.z);
  }
}

/* ---------- 건물 스프라이트 (차양 달린 빵집 거리 가게) ----------
   모든 건물이 같은 가게 모양이고, 차양(천막) 색만 다르다. */
const bldgCache = {};
function buildingSprite(f) {
  const key = f.id + (f.open ? "_o" : "_c");
  if (bldgCache[key]) return bldgCache[key];
  const cv = document.createElement("canvas");
  cv.width = 56; cv.height = 52;
  const x = cv.getContext("2d");
  const box = (c, r, w, h, col) => { x.fillStyle = col; x.fillRect(c, r, w, h); };
  // 닫힌 가게도 자기 차양 색을 유지하되, 반쯤 바랜 톤으로 (가게마다 구분되게)
  const blend = (h1, h2, t) => {
    const p = (h) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
    const [r1, g1, b1] = p(h1), [r2, g2, b2] = p(h2);
    const q = (v) => Math.round(v).toString(16).padStart(2, "0");
    return "#" + q(r1 + (r2 - r1) * t) + q(g1 + (g2 - g1) * t) + q(b1 + (b2 - b1) * t);
  };
  const accent = f.open ? f.roof : blend(f.roof, "#B9AE9C", 0.45);
  const gray = (col) => (f.open ? col : "#CFC6B4");
  const wall = gray("#FBEFD7");
  const wallD = shadeHex(wall, 0.87);

  // 벽
  box(4, 8, 48, 40, wall);
  box(46, 10, 6, 38, wallD); // 오른쪽 그늘
  box(3, 8, 1, 40, OUTLINE); box(52, 8, 1, 40, OUTLINE);
  box(4, 7, 48, 1, OUTLINE); box(4, 47, 48, 1, OUTLINE);

  // 지붕 턱 (차양 위의 낮은 지붕선)
  box(6, 3, 44, 5, shadeHex(accent, 0.72));
  box(6, 3, 44, 1, shadeHex(accent, 1.0));
  box(5, 3, 1, 5, OUTLINE); box(50, 3, 1, 5, OUTLINE); box(6, 2, 44, 1, OUTLINE);

  // 차양 (줄무늬 천막 + 물결 끝, 벽보다 살짝 넓다)
  for (let i = 0, c = 1; i < 9; i++, c += 6) {
    const col = i % 2 === 0 ? accent : gray("#FFF9EC");
    box(c, 9, 6, 8, col);
    box(c + 1, 17, 4, 2, col); // 물결 끝
    box(c + 1, 19, 4, 1, OUTLINE);
    box(c, 17, 1, 1, OUTLINE); box(c + 5, 17, 1, 1, OUTLINE);
  }
  box(1, 9, 54, 1, shadeHex(accent, 1.18)); // 차양 윗면 하이라이트
  box(0, 9, 1, 8, OUTLINE); box(55, 9, 1, 8, OUTLINE); box(1, 8, 54, 1, OUTLINE);

  // 간판 (차양 아래에 걸린 나무판)
  box(8, 20, 40, 8, "#FFF9EC");
  box(7, 20, 1, 8, OUTLINE); box(48, 20, 1, 8, OUTLINE);
  box(8, 19, 40, 1, OUTLINE); box(8, 28, 40, 1, OUTLINE);

  // 진열창 2개: 선반 위에 빵이 놓여 있고 안은 따뜻한 불빛
  for (const wc of [8, 36]) {
    box(wc, 34, 12, 11, f.open ? "#FFE9B8" : "#CFCDC2");
    box(wc, 34, 12, 3, f.open ? "#FFF3D6" : "#DEDCD2");
    box(wc + 2, 38, 3, 3, gray("#D9A05F")); box(wc + 7, 38, 3, 3, gray("#C98A6B")); // 빵 두 개
    box(wc + 1, 41, 10, 1, gray("#C98A6B")); // 선반
    box(wc - 1, 33, 14, 1, OUTLINE); box(wc - 1, 45, 14, 1, OUTLINE);
    box(wc - 1, 34, 1, 11, OUTLINE); box(wc + 12, 34, 1, 11, OUTLINE);
  }

  // 문 (아치)
  box(24, 36, 8, 11, "#8A5A33");
  box(25, 34, 6, 2, "#8A5A33");
  box(23, 36, 1, 11, OUTLINE); box(32, 36, 1, 11, OUTLINE);
  box(24, 34, 1, 2, OUTLINE); box(31, 34, 1, 2, OUTLINE); box(25, 33, 6, 1, OUTLINE);
  box(26, 36, 1, 10, shadeHex("#8A5A33", 1.25));
  box(30, 41, 1, 1, "#F6C244");

  bldgCache[key] = cv;
  return cv;
}

/* ============================================================
   화면 요소
   ============================================================ */
const $ = (id) => document.getElementById(id);
const entryEl = $("entry"), villageEl = $("village");
const canvas = $("game"), ctx = canvas.getContext("2d");

/* ---------- 내 정보 ---------- */
const me = {
  id: "", name: "", bread: "bun", colorIdx: 0, prop: null,
  x: 24.5 * TILE, y: 17.5 * TILE,
  path: [], moving: false,
  items: new Set(), // 모은 재료
  fish: new Set(),  // 낚은 물고기 (재료 도감과 따로)
  gifts: new Set(), // 선생님께 받은 선물 소품 (한 번 받으면 계속)
};

/* ---------- 친구(가짜 접속자) ---------- */
const friends = [
  { name: "크림이", bread: "bun",       colorIdx: 1, prop: "ribbon", x: 21.5 * TILE, y: 18.5 * TILE, path: [], wanderAt: 0, homeC: 21, homeR: 18 },
  { name: "소라빵", bread: "croissant", colorIdx: 3, prop: null,     x: 27.5 * TILE, y: 18.5 * TILE, path: [], wanderAt: 0, homeC: 27, homeR: 18 },
];

/* ---------- 마을 설정(시트에서 바꿀 수 있는 값) ---------- */
const VILLAGE_CFG = {
  missionName: "반죽 촌장",
  missionLines: ["{닉네임}님, 반가워요!", "오늘 케이크 공방이 문을 열었어요.", "고마운 사람에게 케이크를 선물해 볼래요?"],
  missionDest: "cake",
  gatherOpen: true,    // 쉬는 시간 여부 (시트의 쉬는시간/쉬는시간표로 정해짐)
  restMin: 20,         // 한 사람이 같은 나무에서 다시 딸 수 있을 때까지(분)
  soundDefault: true,  // 효과음 기본값 (시트의 소리기본)
};
let birthdays = [];   // 오늘 생일인 친구 닉네임

/* ---------- 사무소 캐릭터 (반죽 촌장) ---------- */
const NPCS = [
  { id: "mission", name: VILLAGE_CFG.missionName, bread: "loaf", colorIdx: 4, clothes: "#8C8CA0", prop: "chefhat", x: 21.5 * TILE, y: 13.6 * TILE, moving: false }, // 촌장은 회색 옷
];
function activeNpcs() { return NPCS; }

/* ============================================================
   입장 화면
   ============================================================ */
let previewSelected = { bread: "bun", colorIdx: 0 };

function drawMini(cv, breadId, colorHex, propId) {
  const x = cv.getContext("2d");
  x.imageSmoothingEnabled = false;
  x.clearRect(0, 0, cv.width, cv.height);
  drawBread(x, breadId, colorHex, propId, 0, 0, cv.width);
}

function setupEntry() {
  const bp = $("breadPicker"), cp = $("colorPicker");

  BREADS.filter((b) => !b.hidden).forEach((b) => {
    const btn = document.createElement("button");
    btn.className = "pick-btn";
    btn.title = b.name;
    const mini = document.createElement("canvas");
    mini.width = 40; mini.height = 40;
    btn.appendChild(mini);
    btn.dataset.bread = b.id;
    btn.addEventListener("click", () => {
      previewSelected.bread = b.id;
      refreshEntry();
    });
    bp.appendChild(btn);
  });

  COLORS.forEach((c, i) => {
    const btn = document.createElement("button");
    btn.className = "pick-btn";
    btn.title = c.name;
    btn.appendChild(mkIcon(macaronIcon(c.hex))); // 마카롱 모양 버튼
    btn.dataset.idx = i;
    btn.addEventListener("click", () => {
      previewSelected.colorIdx = i;
      refreshEntry();
    });
    cp.appendChild(btn);
  });

  // 닉네임 칸은 항상 빈칸으로 시작한다.
  // 이 기기에 저장된 정보는 입장 후 소품·재료를 이어 쓰는 데만 쓴다.
  try {
    const saved = JSON.parse(localStorage.getItem(SAVE_KEY) || "null");
    if (saved) {
      previewSelected.bread = saved.bread || "bun";
      previewSelected.colorIdx = saved.colorIdx ?? 0;
      me.prop = saved.prop || null;
      me.items = migrateItems(new Set(saved.items || []));
      me.fish = parseFish((saved.fish || []).join(","));
      me.gifts = parseGifts((saved.gifts || []).join(","));
    }
  } catch (e) { /* 무시 */ }

  refreshEntry();
  $("enterBtn").addEventListener("click", enterVillage);
  $("nickname").addEventListener("keydown", (e) => { if (e.key === "Enter" && !$("enterBtn").disabled) enterVillage(); });
  $("pin").addEventListener("keydown", (e) => { if (e.key === "Enter" && !$("enterBtn").disabled) enterVillage(); });
  $("nickname").addEventListener("input", updateEnterEnabled);
  $("pin").addEventListener("input", () => {
    $("pin").value = $("pin").value.replace(/[^0-9]/g, "").slice(0, 4); // 숫자만
    updateEnterEnabled();
  });
  $("newCharBtn").addEventListener("click", () => {
    setEntryMode("new");
    $("pin").value = "";
    $("nameHint").textContent = "";
    refreshEntry();
  });
  $("backBtn").addEventListener("click", () => {
    $("pin").value = "";
    if (entryMode === "look") { // 모습 바꾸기 중이었으면 그대로 마을로 돌아간다
      setEntryMode(ONLINE() ? "login" : "new");
      entryEl.classList.add("hidden");
      villageEl.classList.remove("hidden");
      resize();
    } else {
      setEntryMode("login"); // 처음이에요 → 들어가기 화면으로
    }
  });

  // 입장은 매번 이 화면부터 (자동 입장 없음)
  if (ONLINE()) setEntryMode("login");
  else { // 서버 없는 혼자 보기 모드: 빵·색을 바로 고르고 들어간다
    setEntryMode("new");
    $("pinArea").classList.add("hidden");
    $("newCharBtn").classList.add("hidden");
  }

  // 주소 뒤에 &id=... 가 있으면 그 캐릭터로 바로 들어온다 (선생님용 비상 방법)
  const urlId = new URLSearchParams(location.search).get("id");
  if (ONLINE() && urlId) idLogin(urlId);
}

/* ---------- 입장 화면 모드: login(들어가기) / new(처음이에요) / look(모습 바꾸기) ---------- */
let entryMode = "login";

function setEntryMode(m) {
  entryMode = m;
  const isNew = m === "new" || m === "look";
  $("newOnly").classList.toggle("hidden", !isNew);
  $("pinArea").classList.toggle("hidden", m === "look" || !ONLINE());
  $("pinGuide").classList.toggle("hidden", m !== "new");
  $("nickname").disabled = (m === "look");
  $("newCharBtn").classList.toggle("hidden", m !== "login");
  $("backBtn").classList.toggle("hidden", m === "login" || !ONLINE());
  $("nameHint").textContent = m === "look" ? "빵과 색만 바꿀 수 있어요." : "";
  updateEnterEnabled();
}

function updateEnterEnabled() {
  const name = $("nickname").value.replace(/\s/g, "");
  const pin = $("pin").value;
  let ok = name.length >= 2;
  if (ONLINE()) {
    if (entryMode === "new") ok = ok && pin.length === 4;                       // 새로 만들 땐 숫자 4개
    else if (entryMode === "login") ok = ok && (pin.length === 0 || pin.length === 4); // 비밀번호 없는 캐릭터는 빈칸으로
  }
  $("enterBtn").disabled = !ok;
}

/* ---------- ID로 바로 들어오기 (&id=시트의ID) ----------
   훈련생이 다른 PC에 앉았을 때 선생님이 주소를 만들어 준다.
   한 번 들어오면 이 기기에 기억돼서 다음부터는 주소 없이 들어온다. */
async function idLogin(id) {
  $("nameHint").textContent = "캐릭터를 연결하는 중…";
  const res = await api({ action: "join", class: CLASS, id: id });
  if (!res || !res.ok || !res.name) {
    $("nameHint").textContent = "연결할 캐릭터를 찾지 못했어요. 이름으로 들어와 주세요.";
    return;
  }
  me.id = id;
  me.name = String(res.name);
  me.bread = res.bread || "bun";
  me.colorIdx = Math.max(0, Math.min(5, Number(res.color) || 0));
  me.prop = res.prop || null;
  me.items = migrateItems(new Set(String(res.items || "").split(",").filter(Boolean)));
  applyServerFish(res);
  applyServerGifts(res);
  previewSelected.bread = me.bread;
  previewSelected.colorIdx = me.colorIdx;
  $("nickname").value = me.name;
  const sp = randomSpawnInPlaza();
  me.x = sp.x;
  me.y = sp.y;
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify({
      id: me.id, name: me.name, bread: me.bread, colorIdx: me.colorIdx, prop: me.prop, items: [...me.items], fish: [...me.fish], gifts: [...me.gifts],
    }));
  } catch (e) { /* 무시 */ }
  // 주소에서 id를 지워 둔다 (즐겨찾기해도 깨끗하게)
  try { history.replaceState(null, "", location.pathname + (RAW_CLASS ? "?class=" + RAW_CLASS : "")); } catch (e) { /* 무시 */ }
  friends.length = 0;
  startSync();
  sendMyPos(true);
  showVillageScreen(`${me.name}님, 어서 와요!`);
}

/* ---------- 소품함 아래 버튼: 내 모습 바꾸기 ---------- */
$("changeLookBtn").addEventListener("click", () => {
  closeModals();
  villageEl.classList.add("hidden");
  entryEl.classList.remove("hidden");
  $("nickname").value = me.name;
  previewSelected.bread = me.bread;
  previewSelected.colorIdx = me.colorIdx;
  setEntryMode("look"); // 닉네임은 잠그고 빵·색만 고른다
  refreshEntry();
});

function refreshEntry() {
  const colorHex = COLORS[previewSelected.colorIdx].hex;
  document.querySelectorAll("#breadPicker .pick-btn").forEach((btn) => {
    btn.classList.toggle("selected", btn.dataset.bread === previewSelected.bread);
    drawMini(btn.querySelector("canvas"), btn.dataset.bread, colorHex, null);
  });
  document.querySelectorAll("#colorPicker .pick-btn").forEach((btn) => {
    btn.classList.toggle("selected", Number(btn.dataset.idx) === previewSelected.colorIdx);
  });
  drawMini($("previewCanvas"), previewSelected.bread, colorHex, null); // 미리보기에는 소품을 보여주지 않는다
}

// 시작 위치: 광장 바닥 안의 걸을 수 있는 칸 중 아무 데나
// - 이미 누가 서 있는 칸은 피하고, 사무소 문 바로 앞은 비워 둔다
function randomSpawnInPlaza() {
  const plaza = FACILITIES.find((f) => f.id === "plaza");
  const cands = [];
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      if (ground[r][c] !== 2 || blocked[r][c]) continue; // 광장 바닥만
      if (Math.abs(c - plaza.doorC) <= 1 && r <= plaza.doorR + 3) continue; // 사무소 문 앞 통로
      cands.push([c, r]);
    }
  }
  const taken = new Set();
  for (const ch of [...friends, ...NPCS]) {
    taken.add(Math.floor(ch.x / TILE) + "," + Math.floor(ch.y / TILE));
  }
  const free = cands.filter(([c, r]) => !taken.has(c + "," + r));
  const pool = free.length ? free : cands;
  const [c, r] = pool[Math.floor(Math.random() * pool.length)];
  return { x: (c + 0.5) * TILE, y: (r + 0.5) * TILE };
}

async function enterVillage() {
  const raw = $("nickname").value.replace(/\s/g, "");
  const cleaned = raw.replace(/[^가-힣ㄱ-ㅎㅏ-ㅣa-zA-Z0-9]/g, "");
  if (cleaned.length < 2 || cleaned.length > 8) {
    $("nameHint").textContent = "이름은 2~8자로 써 주세요. (한글, 영어, 숫자)";
    $("nickname").focus();
    return;
  }
  me.name = cleaned;
  if (entryMode !== "login") {
    me.bread = previewSelected.bread;
    me.colorIdx = previewSelected.colorIdx;
  }
  const pin = $("pin").value;

  // 광장 안에서 무작위로 흩어져 시작한다 (모습만 바꿀 때는 서 있던 자리 그대로)
  if (entryMode !== "look") {
    const sp = randomSpawnInPlaza();
    me.x = sp.x;
    me.y = sp.y;
  }

  if (ONLINE()) {
    $("enterBtn").disabled = true;
    $("nameHint").textContent = "마을에 들어가는 중…";
    let res;
    if (entryMode === "login") {
      // 닉네임 + 마을 비밀번호로 들어가기 (확인은 서버에서만)
      res = await api({ action: "login", class: CLASS, name: me.name, pin: pin,
                        x: Math.round(me.x), y: Math.round(me.y) });
    } else {
      // 처음이에요(새 캐릭터) 또는 내 모습 바꾸기
      res = await api({
        action: "join", class: CLASS, id: entryMode === "look" ? me.id : "",
        name: me.name, bread: me.bread, color: me.colorIdx, prop: me.prop || "", pin: pin,
        x: Math.round(me.x), y: Math.round(me.y),
      });
    }
    updateEnterEnabled();
    if (!res || !res.ok) {
      const msgs = {
        no_name: "그런 친구가 없어요. 닉네임을 다시 확인해요",
        wrong_pin: "닉네임이나 마을 비밀번호가 달라요. 다시 해 봐요",
        duplicate: "이미 있는 이름이에요. 다른 이름을 써 주세요",
      };
      $("nameHint").textContent = (res && msgs[res.error]) || "마을과 연결이 안 돼요. 잠시 뒤 다시 눌러 주세요";
      return;
    }
    me.id = res.id;
    if (entryMode === "login") {
      // 시트에 저장된 내 모습 그대로
      me.bread = res.bread || "bun";
      me.colorIdx = Math.max(0, Math.min(5, Number(res.color) || 0));
      me.prop = res.prop || null;
      me.items = migrateItems(new Set(String(res.items || "").split(",").filter(Boolean)));
      applyServerFish(res);
      applyServerGifts(res);
      previewSelected.bread = me.bread;
      previewSelected.colorIdx = me.colorIdx;
    } else if (res.items) {
      migrateItems(new Set(String(res.items).split(",").filter(Boolean))).forEach((it) => me.items.add(it));
    }
    friends.length = 0;   // 가짜 친구 대신 진짜 친구들을 보여 준다
    startSync();
  }

  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify({
      id: me.id, name: me.name, bread: me.bread, colorIdx: me.colorIdx, prop: me.prop,
      items: [...me.items], fish: [...me.fish], gifts: [...me.gifts],
    }));
  } catch (e) { /* 무시 */ }

  const wasLook = entryMode === "look";
  $("pin").value = "";
  setEntryMode(ONLINE() ? "login" : "new"); // 다음에 입장 화면이 열리면 처음 화면부터
  showVillageScreen(wasLook ? "새 모습으로 바꿨어요!" : `${me.name}님, 어서 와요!`);
  if (ONLINE() && me.id) sendMyPos(true); // 바뀐 모습을 친구 화면에도 바로
}

// 왼쪽 위 공지 말풍선: 5초 보이고 천천히 사라진다 (글이 바뀌면 다시 보인다)
let noticeTimer = 0;
function showNotice() {
  const n = $("notice");
  n.classList.remove("fade");
  clearTimeout(noticeTimer);
  noticeTimer = setTimeout(() => n.classList.add("fade"), 5000);
}

function showVillageScreen(msg) {
  entryEl.classList.add("hidden");
  villageEl.classList.remove("hidden");
  resize();
  showNotice(); // 환영 말풍선은 5초만 보이고 천천히 사라진다
  showToast(msg); // 들어오면 인사 하나만 잠깐 뜬다
  // 안내 문구는 몇 초 뒤에 사라진다 (간판을 가리지 않게)
  setTimeout(() => {
    const tip = document.querySelector(".help-tip");
    if (tip) tip.classList.add("fade-out");
  }, 6000);
}

/* ============================================================
   서버와 주고받기 (2단계)
   - 읽기: GET ?action=state (2.5초마다 한 번, 마을 전체 상태)
   - 쓰기: POST text/plain (CORS 사전 요청이 생기지 않게)
   - 서버가 느려도 나는 계속 움직일 수 있다
   ============================================================ */
async function api(data) {
  try {
    const r = await fetch(API_URL, {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify(data),
    });
    return await r.json();
  } catch (e) { return null; }
}

async function apiGet(params) {
  try {
    const r = await fetch(API_URL + "?" + new URLSearchParams(params));
    return await r.json();
  } catch (e) { return null; }
}

let lastStateOk = 0;
let firstStateDone = false;
let lastSentX = -9999, lastSentY = -9999, lastSentAt = 0;
let syncStarted = false;

function startSync() {
  if (syncStarted) return;
  syncStarted = true;
  pollState();
  setInterval(pollState, 2500);  // 마을 전체 상태 받기
  setInterval(sendMyPos, 600);   // 내 위치 보내기(움직였을 때만, 2초에 한 번)
}

async function pollState() {
  const st = await apiGet({ action: "state", class: CLASS });
  const conn = $("connStatus");
  if (!st || !st.ok) {
    // 응답이 늦으면 작게 알려 주고, 혼자서는 계속 움직인다
    if (performance.now() - lastStateOk > 6000) conn.classList.remove("hidden");
    return;
  }
  lastStateOk = performance.now();
  conn.classList.add("hidden");

  // 1) 친구들: 받은 위치까지 부드럽게 걸어간다 (보간)
  const seen = new Set();
  for (const p of st.players || []) {
    if (!p || p.id === me.id) continue;
    seen.add(p.id);
    let fr = friends.find((f) => f.id === p.id);
    if (!fr) {
      fr = { id: p.id, remote: true, x: p.x, y: p.y, path: [], wanderAt: Infinity };
      friends.push(fr);
    }
    fr.name = p.name || "친구";
    fr.bread = p.bread || "bun";
    fr.colorIdx = Math.max(0, Math.min(5, Number(p.color) || 0));
    fr.prop = p.prop || null;
    fr.tx = p.x; fr.ty = p.y;
    // 친구 낚시: 낚싯대·찌, 새로 낚은 것 (처음 본 기록은 띄우지 않는다. 늦게 받아도 표시가 바뀌었으면 띄운다)
    fr.rod = Number(p.rod) === 1;
    const caught = String(p.caught || "");
    if (fr.caught === undefined) fr.caught = caught;
    else if (caught && caught !== fr.caught) {
      fr.caught = caught;
      const sp = caughtSprite(caught);
      if (sp) fr.catchShow = { sprite: sp, t0: performance.now() };
    }
  }
  for (let i = friends.length - 1; i >= 0; i--) {
    if (friends[i].remote && !seen.has(friends[i].id)) friends.splice(i, 1);
  }

  // 2) 마을 설정(사무소 캐릭터, 미션, 쉬는 시간, 소리)과 생일
  if (st.village) {
    const v = st.village;
    if (v.missionName) { VILLAGE_CFG.missionName = v.missionName; NPCS[0].name = v.missionName; }
    if (Array.isArray(v.missionLines)) {
      const lines = v.missionLines.map((s) => String(s || "").trim()).filter(Boolean);
      if (lines.length) VILLAGE_CFG.missionLines = lines;
    }
    if (v.missionDest) VILLAGE_CFG.missionDest = String(v.missionDest).trim();
    const wasBreak = VILLAGE_CFG.gatherOpen;
    VILLAGE_CFG.gatherOpen = v.gatherOpen !== false;
    VILLAGE_CFG.soundDefault = v.soundDefault !== false;
    if (Number(v.restMin) > 0) VILLAGE_CFG.restMin = Number(v.restMin);
    if (firstStateDone && !wasBreak && VILLAGE_CFG.gatherOpen) showToast("쉬는 시간이에요! ☕");
    updateSoundBtn();
    applyOpenProps(v.openProps); // 시트의 소품 설정대로 소품 열기
    applyGiftOffer(v.gift);      // 시트의 "선물소품" (비우면 새로 받을 수 없음. 받은 것은 그대로)
    applyChristmas(v.christmas === true); // 시트의 "크리스마스" O/X
  }
  birthdays = st.birthdays || [];
  // 우리 반 바구니 (옛 서버라 basket이 아예 없으면 숨김)
  applyBasket(st.basket === undefined ? null : st.basket);

  // 3) 시설: 이름, 할 일, 링크, 열림을 시트 내용으로 바꾼다
  for (const sf of st.facilities || []) {
    const f = FACILITIES.find((x) => x.id === sf.id);
    if (!f) continue;
    const wasOpen = f.open;
    if (sf.name) f.name = sf.name;
    if (sf.task) f.task = sf.task;
    f.link = sf.link || "";
    f.open = !!sf.open;
    if (firstStateDone && f.open && !wasOpen) showToast(`${f.name}이(가) 새로 열렸어요!`);
  }

  // 4) 공지: 시트 내용을 그대로 보여 준다. 공지가 바뀌면 다시 5초 보여 준다
  if (st.notice && $("noticeText").textContent !== st.notice) {
    $("noticeText").textContent = st.notice;
    if (firstStateDone) showNotice();
  }

  firstStateDone = true;
}

function sendMyPos(force) {
  if (!ONLINE() || !me.id) return;
  const now = performance.now();
  const moved = Math.hypot(me.x - lastSentX, me.y - lastSentY) > 4;
  if (!force && (!moved || now - lastSentAt < 2000)) return;
  lastSentAt = now; lastSentX = me.x; lastSentY = me.y;
  api({
    action: "move", class: CLASS, id: me.id, name: me.name,
    bread: me.bread, color: me.colorIdx, prop: me.prop || "",
    x: Math.round(me.x), y: Math.round(me.y),
    rod: me.fishing ? 1 : 0, caught: myCaught, // 친구 화면에 낚싯대·찌, 낚은 것 그림
  });
}
// 마지막으로 낚은 것 "f:물고기id:표시" 또는 "i:재료id:표시". 표시가 바뀌면 친구 화면에 그림이 한 번 뜬다
let myCaught = "";

/* ============================================================
   길찾기 (BFS)
   ============================================================ */
function findPath(c0, r0, c1, r1) {
  if (c0 === c1 && r0 === r1) return [];
  const prev = new Map();
  const key = (c, r) => r * COLS + c;
  const q = [[c0, r0]];
  const seen = new Set([key(c0, r0)]);
  let best = null, bestDist = Infinity;

  while (q.length) {
    const [c, r] = q.shift();
    const d = Math.abs(c - c1) + Math.abs(r - r1);
    if (d < bestDist) { bestDist = d; best = [c, r]; }
    if (c === c1 && r === r1) break;
    for (const [dc, dr] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nc = c + dc, nr = r + dr;
      if (isBlocked(nc, nr) || seen.has(key(nc, nr))) continue;
      seen.add(key(nc, nr));
      prev.set(key(nc, nr), key(c, r));
      q.push([nc, nr]);
    }
  }
  if (!best) return [];
  // 목적지(또는 갈 수 있는 가장 가까운 곳)까지 길 되짚기
  const path = [];
  let k = key(best[0], best[1]);
  while (k !== key(c0, r0)) {
    path.push([k % COLS, Math.floor(k / COLS)]);
    k = prev.get(k);
    if (k === undefined) return [];
  }
  path.reverse();
  return path;
}

/* ============================================================
   입력 (키보드 / 방향 버튼 / 지도 클릭)
   ============================================================ */
const keys = { up: false, down: false, left: false, right: false };
const KEYMAP = {
  ArrowUp: "up", ArrowDown: "down", ArrowLeft: "left", ArrowRight: "right",
  w: "up", s: "down", a: "left", d: "right", W: "up", S: "down", A: "left", D: "right",
  ㅈ: "up", ㄴ: "down", ㅁ: "left", ㅇ: "right", // 한글 자판 상태일 때 WASD 자리
};

window.addEventListener("keydown", (e) => {
  if (!villageEl || villageEl.classList.contains("hidden")) return;
  const dir = KEYMAP[e.key];
  if (dir) {
    if (me.sitting) standUp(); // 방향키를 누르면 벤치에서 일어난다
    keys[dir] = true; me.path = []; pendingFacility = null; pendingNpc = null; pendingBench = null;
    e.preventDefault();
  }
  if (e.key === "Escape") { closeModals(); }
  if (e.key !== " " && e.key !== "Enter") return;
  // 대화창이 열려 있으면 스페이스바/엔터로 다음 문장
  if (!$("dialog").classList.contains("hidden")) {
    e.preventDefault();
    if (dialog && dialog.idx >= dialog.lines.length - 1) $("dialogGo").click();
    else advanceDialog();
    return;
  }
  // 문 앞·벤치 앞에서 스페이스바나 엔터로 들어가기/앉기
  if (nearTarget && noModalOpen()) {
    e.preventDefault();
    activateTarget();
    return;
  }
  // 나무·바다·반짝이 앞에서는 스페이스바나 엔터로 줍기
  if (gatherSpot && !$("gatherBtn").classList.contains("hidden") && noModalOpen()) {
    e.preventDefault();
    $("gatherBtn").click();
  }
});
window.addEventListener("keyup", (e) => {
  const dir = KEYMAP[e.key];
  if (dir) keys[dir] = false;
});

// 방향 버튼
document.querySelectorAll(".dbtn").forEach((btn) => {
  const dir = btn.dataset.dir;
  const on = (e) => { e.preventDefault(); if (me.sitting) standUp(); keys[dir] = true; me.path = []; pendingFacility = null; pendingNpc = null; pendingBench = null; };
  const off = (e) => { e.preventDefault(); keys[dir] = false; };
  btn.addEventListener("pointerdown", on);
  btn.addEventListener("pointerup", off);
  btn.addEventListener("pointercancel", off);
  btn.addEventListener("pointerleave", off);
});

/* ---------- 문 앞 들어가기 / 벤치 앉기 버튼 ----------
   가장 가까운 시설 문이나 벤치에 큰 버튼이 뜬다.
   열린 시설: "들어가기" / 닫힌 시설: "준비 중이에요" / 벤치: "앉기" */
let nearFacility = null; // 미션 도착 판정 등에서 그대로 쓴다
let nearTarget = null;   // { type: "facility"|"bench", ... }
let pendingBench = null;

// 의자 가운데 x좌표 / 나와 가장 가까운 자리까지의 거리
function benchCX(b) { return (b.c + b.w / 2) * TILE; }
function benchDist(b) {
  let d = Infinity;
  for (const s of b.seats) d = Math.min(d, Math.hypot(me.x - s.x, me.y - s.y));
  return d;
}

function sitDown(b) {
  // 빈 자리 중에서 나와 가장 가까운 자리에 앉는다 (친구가 앉은 자리는 비켜 준다)
  let seat = null, best = Infinity;
  for (const s of b.seats) {
    const taken = friends.some((f) => f.remote && Math.hypot(f.x - s.x, f.y - s.y) < 7);
    if (taken) continue;
    const d = Math.hypot(me.x - s.x, me.y - s.y);
    if (d < best) { best = d; seat = s; }
  }
  if (!seat) seat = b.seats[0];
  me.sitting = { bench: b, seat };
  me.path = [];
  me.fishing = null;
  pendingFacility = null; pendingNpc = null; pendingBench = null;
  me.x = seat.x;
  me.y = seat.y;
  me.dir = b.sitUp ? "up" : "down"; // 식탁을 바라보는 의자는 뒷모습
  if (ONLINE() && me.id) sendMyPos(true);
}

function standUp() {
  if (!me.sitting) return;
  const b = me.sitting.bench, seat = me.sitting.seat;
  me.sitting = null;
  me.fishing = null; // 일어나면 낚시가 멈춘다
  me.x = seat.x;
  // 벤치 앞으로 내려선다 (긴 식탁 위쪽 의자는 뒤쪽이 테이블이라 위로 내려선다)
  me.y = b.exitUp ? (b.r - 0.5) * TILE : (b.r + 1.5) * TILE;
  me.dir = b.exitUp ? "up" : "down";
  if (ONLINE() && me.id) sendMyPos(true);
}

function updateEnterButton() {
  const btn = $("facilityEnterBtn");
  if (me.sitting) {
    nearTarget = null; nearFacility = null;
    btn.classList.add("hidden");
    return;
  }
  // 가장 가까운 시설 문
  let bestF = null, dF = Infinity;
  for (const f of FACILITIES) {
    const d = Math.hypot(me.x - f.doorX, me.y - f.doorY);
    if (d < dF) { dF = d; bestF = f; }
  }
  // 가장 가까운 벤치 (긴 의자는 자리 중 가장 가까운 곳 기준)
  let bestB = null, dB = Infinity;
  for (const b of BENCHES) {
    const d = benchDist(b);
    if (d < dB) { dB = d; bestB = b; }
  }
  // 나타날 때와 사라질 때 거리를 다르게 해서 깜빡임을 막는다
  const fLimit = (nearTarget && nearTarget.f === bestF) ? TILE * 2.6 : TILE * 2.2;
  const bLimit = (nearTarget && nearTarget.b === bestB) ? TILE * 2.2 : TILE * 1.8;
  const fOk = bestF && dF <= fLimit;
  const bOk = bestB && dB <= bLimit;
  let next = null;
  if (bOk && (!fOk || dB <= dF)) {
    // 버튼은 나와 가장 가까운 자리 위에 뜬다 (긴 의자에서 멀리 뜨지 않게)
    let bx = benchCX(bestB), bd = Infinity;
    for (const s of bestB.seats) { const d = Math.abs(me.x - s.x); if (d < bd) { bd = d; bx = s.x; } }
    next = { type: "bench", b: bestB, x: bx, topY: bestB.r * TILE - 42 };
  }
  else if (fOk) next = { type: "facility", f: bestF, x: bestF.doorX, topY: bestF.rect.y - 8 };
  if (!next) {
    if (nearTarget) { nearTarget = null; nearFacility = null; btn.classList.add("hidden"); }
    return;
  }
  const changed = !nearTarget || nearTarget.type !== next.type ||
    nearTarget.f !== next.f || nearTarget.b !== next.b || btn.classList.contains("hidden");
  nearTarget = next;
  nearFacility = next.type === "facility" ? next.f : null;
  if (changed) {
    if (next.type === "bench") setBtnIcon(btn, "cup", "앉기");
    else if (!next.f.open) setBtnIcon(btn, "cone", "준비 중이에요");
    else if (next.f.board) setBtnIcon(btn, "pin", "게시판 보기");
    else setBtnIcon(btn, "door", "들어가기");
    btn.classList.toggle("closed", next.type === "facility" && !next.f.open);
    btn.classList.remove("hidden");
  }
  btn.style.left = (next.x - cam.x) + "px";
  btn.style.top = (next.topY - cam.y) + "px";
}

function activateTarget() { // 버튼 클릭과 스페이스/엔터가 함께 쓴다
  if (!nearTarget) return;
  if (nearTarget.type === "bench") { sitDown(nearTarget.b); return; }
  const f = nearTarget.f;
  if (f.open) openFacility(f);
  else showToast(`${f.name}은(는) 아직 준비 중이에요.`);
}

$("facilityEnterBtn").addEventListener("click", activateTarget);

// 지도 클릭 → 걸어가기 / 시설 열기
let pendingFacility = null;
let walkMarker = null; // {x, y, t}
let downPos = null;

canvas.addEventListener("pointerdown", (e) => { downPos = [e.clientX, e.clientY]; });
canvas.addEventListener("pointerup", (e) => {
  if (!downPos) return;
  const moved = Math.hypot(e.clientX - downPos[0], e.clientY - downPos[1]);
  downPos = null;
  if (moved > 10) return;
  if (!$("dialog").classList.contains("hidden")) return; // 대화 중에는 지도를 누르지 않는다

  const wx = e.clientX + cam.x, wy = e.clientY + cam.y;

  // 사무소 캐릭터를 눌렀나?
  for (const npc of activeNpcs()) {
    if (Math.abs(wx - npc.x) < 38 && wy > npc.y - 80 && wy < npc.y + 14) {
      clickNpc(npc);
      return;
    }
  }

  // 친구를 눌렀나? → 짧은 인사 말풍선
  for (const fr of friends) {
    if (Math.abs(wx - dispX(fr)) < 30 && wy > fr.y - 76 && wy < fr.y + 12) {
      friendBubble(fr);
      return;
    }
  }

  // 벤치를 눌렀나?
  for (const b of BENCHES) {
    const bx = b.c * TILE, by = b.r * TILE, bw = b.w * TILE;
    if (wx >= bx - 8 && wx <= bx + bw + 8 && wy >= by - 26 && wy <= by + TILE) {
      if (benchDist(b) < TILE * 2.2) sitDown(b);
      else {
        // 누른 곳과 가까운 칸 앞으로 걸어가서 앉는다
        const tc = Math.max(b.c, Math.min(b.c + b.w - 1, Math.floor(wx / TILE)));
        walkTo(tc, b.exitUp ? b.r - 1 : b.r + 1, null);
        pendingBench = b;
      }
      return;
    }
  }

  // 건물을 눌렀나?
  for (const f of FACILITIES) {
    const R = f.rect;
    if (wx >= R.x && wx <= R.x + R.w && wy >= R.y && wy <= R.y + R.h) {
      clickFacility(f);
      return;
    }
  }

  const tc = Math.floor(wx / TILE), tr = Math.floor(wy / TILE);
  const clickedWater = ground[tr] && ground[tr][tc] === 3;
  const clickedTree = !!treeAt[tc + "," + tr];

  // 바다를 누르면 낚시 자리를 알려 준다
  if (clickedWater && VILLAGE_CFG.gatherOpen) {
    showToast("선착장의 딸기 방석에 앉으면 낚시할 수 있어요");
  }

  // 수업 시간에 나무나 바다를 누르면 알려 준다
  if (!VILLAGE_CFG.gatherOpen && (clickedTree || clickedWater)) {
    showToast("지금은 수업 시간이에요. 쉬는 시간에 다시 와요");
  }

  // 빈 땅 → 그 자리까지 걸어가기
  walkTo(tc, tr, null);
});

/* ---------- 친구를 누르면 뜨는 짧은 말풍선 ---------- */
const BUBBLE_LINES = ["만나서 반가워요", "오늘도 멋져요", "같이 놀아요", "잘하고 있어요", "반가워요!"];
const bubbles = []; // { ch, text, until }

function friendBubble(fr) {
  const now = performance.now();
  if (fr.lastBubbleAt && now - fr.lastBubbleAt < 3000) return; // 같은 친구에게 3초 안에 다시 안 뜬다
  fr.lastBubbleAt = now;
  bubbles.push({ ch: fr, text: BUBBLE_LINES[Math.floor(Math.random() * BUBBLE_LINES.length)], until: now + 2000 });
}

function drawBubbles(now) {
  for (let i = bubbles.length - 1; i >= 0; i--) {
    const b = bubbles[i];
    if (now > b.until || !friends.includes(b.ch)) { bubbles.splice(i, 1); continue; }
    const x = dispX(b.ch) - cam.x;
    const topY = (b.ch._lbl ? b.ch._lbl.ly : dispY(b.ch) - cam.y - CHAR_SIZE - 4) - 34;
    ctx.font = "bold 14px 'Malgun Gothic', sans-serif";
    const w = ctx.measureText(b.text).width + 20;
    ctx.fillStyle = "rgba(255,255,255,0.97)";
    ctx.strokeStyle = OUTLINE;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.roundRect(x - w / 2, topY - 12, w, 24, 11);
    ctx.fill();
    ctx.stroke();
    ctx.beginPath(); // 말풍선 꼬리
    ctx.moveTo(x - 4, topY + 11);
    ctx.lineTo(x, topY + 18);
    ctx.lineTo(x + 5, topY + 11);
    ctx.closePath();
    ctx.fillStyle = "#FFFFFF";
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = "#5B3A1E";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(b.text, x, topY + 1);
  }
}

function walkTo(c, r, facility) {
  if (me.sitting) standUp(); // 걸어가려면 먼저 일어난다
  me.fishing = null;
  const pc = Math.floor(me.x / TILE), pr = Math.floor(me.y / TILE);
  const path = findPath(pc, pr, c, r);
  me.path = path;
  pendingFacility = facility;
  pendingNpc = null;
  if (path.length) {
    const last = path[path.length - 1];
    walkMarker = { x: last[0] * TILE + TILE / 2, y: last[1] * TILE + TILE / 2, t: performance.now() };
  }
}

function clickFacility(f) {
  if (!f.open) { showToast(`${f.name}은(는) 아직 준비 중이에요.`); return; }
  if (Math.hypot(me.x - f.doorX, me.y - f.doorY) < TILE * 2.2) {
    openFacility(f);
  } else {
    walkTo(f.doorC, f.doorR, f); // 문 앞까지 걸어가서 열기
  }
}

// 시설 열기: 사무소는 미션 대화, 게시판은 게시판 창, 나머지는 시설 카드
function openFacility(f, asMission) {
  if (f.id === "plaza") { startMissionDialog(); return; }
  if (f.id === "cafe") { openBake(); return; } // 만빵 제빵소: 진저브레드 굽기
  if (f.board) openBoard(f);
  else openFacilityCard(f, asMission);
}

function clickNpc(npc) {
  if (Math.hypot(me.x - npc.x, me.y - npc.y) < TILE * 2.5) { openNpc(npc); return; }
  walkTo(Math.floor(npc.x / TILE), Math.floor(npc.y / TILE) + 1, null); // 멀면 옆까지 걸어간다
  pendingNpc = npc;
}

function openNpc(npc) {
  pendingNpc = null;
  startMissionDialog();
}

/* ============================================================
   시설 카드 / 소품함 / 토스트
   ============================================================ */
let currentLink = "";

function openFacilityCard(f, asMission) {
  // 카드 아이콘: 이모지 대신 그 시설의 도트 그림
  const slot = $("cardIcon");
  slot.innerHTML = "";
  slot.appendChild(mkIcon(f.board ? boardSprite() : buildingSprite(f), "card-ico"));
  $("cardTitle").textContent = asMission ? "오늘의 미션" : f.name;
  $("cardTask").textContent = f.task;
  currentLink = f.link || "";
  const btn = $("cardLink");
  btn.textContent = asMission ? "만들러 가기" : "열어보기";
  btn.classList.toggle("hidden", !currentLink); // 링크가 없으면 버튼을 숨긴다
  if (currentLink) btn.href = currentLink;
  $("facilityCard").classList.remove("hidden");
}

$("closeCard").addEventListener("click", () => $("facilityCard").classList.add("hidden"));

/* ---------- 마을 게시판 창 ---------- */
function openBoard(f) {
  $("boardNotice").textContent = f.task || "아직 공지가 없어요.";
  // 오늘 마을에 온 친구: 지금 받고 있는 접속자 명단으로
  const names = [me.name, ...friends.map((fr) => fr.name)].filter(Boolean);
  $("boardFriendsTitle").textContent = `오늘 마을에 온 친구 (${names.length}명)`;
  $("boardFriends").textContent = names.join(", ");
  const bd = $("boardBday");
  if (birthdays.length) {
    bd.textContent = birthdays.map((n) => `오늘은 ${n}님의 생일이에요 🎂`).join("\n");
    bd.style.whiteSpace = "pre-line";
    bd.classList.remove("hidden");
  } else {
    bd.classList.add("hidden");
  }
  const lb = $("boardLink");
  lb.classList.toggle("hidden", !f.link);
  if (f.link) lb.href = f.link;
  $("board").classList.remove("hidden");
}
$("closeBoard").addEventListener("click", () => $("board").classList.add("hidden"));

/* ============================================================
   사무소 캐릭터: 오늘의 미션 대화 / 도우미 설명
   ============================================================ */
let pendingNpc = null;
let dialog = null;          // { lines: [], idx: 0 }
let missionTarget = null;   // 화살표가 가리키는 시설
const MISSION_SEEN_KEY = "happybread_missionday_" + CLASS;

function todayStr() {
  const d = new Date();
  return d.getFullYear() + "-" + (d.getMonth() + 1) + "-" + d.getDate();
}
function noModalOpen() { return !document.querySelector(".modal:not(.hidden)"); }

function startMissionDialog() {
  const lines = VILLAGE_CFG.missionLines.map((s) => String(s).split("{닉네임}").join(me.name));
  dialog = { lines, idx: 0 };
  $("dialogName").textContent = NPCS[0].name;
  renderDialog();
  $("dialog").classList.remove("hidden");
  try { localStorage.setItem(MISSION_SEEN_KEY, todayStr()); } catch (e) { /* 무시 */ }
}
function renderDialog() {
  $("dialogText").textContent = dialog.lines[dialog.idx];
  const last = dialog.idx >= dialog.lines.length - 1;
  $("dialogNext").classList.toggle("hidden", last);
  $("dialogGo").classList.toggle("hidden", !last);
}
function advanceDialog() {
  if (dialog && dialog.idx < dialog.lines.length - 1) { dialog.idx++; renderDialog(); }
}
$("dialogBox").addEventListener("click", (e) => { if (e.target.id !== "dialogGo" && e.target.id !== "dialogClose") advanceDialog(); });
// ✕를 누르면 대화창이 바로 닫힌다 (사무소 캐릭터를 다시 누르면 또 이야기할 수 있다)
$("dialogClose").addEventListener("click", (e) => {
  e.stopPropagation();
  $("dialog").classList.add("hidden");
  dialog = null;
});
$("dialogGo").addEventListener("click", () => {
  $("dialog").classList.add("hidden");
  dialog = null;
  const dest = FACILITIES.find((f) => f.id === VILLAGE_CFG.missionDest);
  if (dest) { missionTarget = dest; showToast("화살표를 따라가 봐요!"); }
});

function updateMission() {
  // 그날 처음 사무소 캐릭터 가까이 가면 대화가 저절로 시작된다
  // (들어올 때 하나씩 차례로: 공지 말풍선이 사라진 뒤에 미션 대화, 그다음 선물 카드)
  if (!dialog && $("dialog").classList.contains("hidden") && noModalOpen() && $("notice").classList.contains("fade")) {
    let seen = "";
    try { seen = localStorage.getItem(MISSION_SEEN_KEY) || ""; } catch (e) { /* 무시 */ }
    if (seen !== todayStr() && Math.hypot(me.x - NPCS[0].x, me.y - NPCS[0].y) < TILE * 2.4) startMissionDialog();
  }
  // 목적지에 도착하면 반짝 효과와 함께 미션 카드가 열린다
  if (missionTarget && Math.hypot(me.x - missionTarget.doorX, me.y - missionTarget.doorY) < TILE * 2.2) {
    const dest = missionTarget;
    missionTarget = null;
    spawnSparkle(dispX(me) - cam.x, dispY(me) - cam.y - 40, 18);
    playTone("mission");
    openFacility(dest, true);
  }
}

/* ---------- 시트의 소품 설정(소품리본~소품별망토 O/X)으로 소품 열고 닫기 ----------
   서버가 O인 소품을 "리본,셰프모자"처럼 쉼표 목록으로 보내 준다.
   비어 있으면 전부 잠김, null/undefined(옛 서버)면 그대로 둔다. */
const PROP_KO = { 리본: "ribbon", 셰프모자: "chefhat", 카메라: "camera", 헤드폰: "headphone", 마이크: "mic", 별망토: "cape" };
let propsApplied = false; // 들어와서 처음 받은 값에는 알림을 띄우지 않는다

function applyOpenProps(text) {
  if (text === undefined || text === null) return; // 시트에 소품 줄이 없으면 그대로 둔다
  const t = String(text).replace(/\s/g, "");
  const open = t ? t.split(",").map((w) => PROP_KO[w]).filter(Boolean) : [];
  let newly = false, changed = false;
  for (const p of PROPS) {
    if (p.gift) continue; // 선물 소품은 시트 O/X로 잠기지 않는다
    const u = open.includes(p.id);
    if (u !== p.unlocked) { changed = true; if (u) newly = true; p.unlocked = u; }
  }
  if (changed) {
    buildPropList();
    // 입고 있던 소품이 잠기면 원래 모습이 된다
    if (me.prop && !open.includes(me.prop) && !(isGiftProp(me.prop) && me.gifts.has(me.prop))) {
      me.prop = null;
      if (ONLINE() && me.id) { api({ action: "prop", class: CLASS, id: me.id, prop: "" }); sendMyPos(true); }
    }
    if (propsApplied && newly) showToast("새 소품이 열렸어요! 🎁");
  }
  propsApplied = true;
}

function setupBag() {
  buildPropList();
  $("bagBtn").addEventListener("click", () => { refreshBag(); $("bag").classList.remove("hidden"); });
  $("closeBag").addEventListener("click", () => $("bag").classList.add("hidden"));
}

// 소품 목록 그리기 (열린 소품이 바뀌면 다시 그린다)
function buildPropList() {
  const list = $("propList");
  list.innerHTML = "";
  PROPS.forEach((p) => {
    if (p.gift && !me.gifts.has(p.id)) return; // 받은 선물만 보인다
    const btn = document.createElement("button");
    btn.className = "prop-btn" + (p.gift ? " gift" : "");
    btn.dataset.prop = p.id;
    // 소품 그림: 이모지 대신 코드로 그린 도트 그림
    const mini = document.createElement("canvas");
    mini.width = 20; mini.height = 20;
    mini.className = "p-canvas";
    const mx = mini.getContext("2d");
    mx.imageSmoothingEnabled = false;
    mx.drawImage(propIcon(p.id), 0, 0);
    if (!p.unlocked) {
      // 잠긴 소품: 회색으로 흐리게 + 도트 자물쇠
      mx.globalCompositeOperation = "source-atop";
      mx.fillStyle = "rgba(120,112,100,0.8)";
      mx.fillRect(0, 0, 20, 20);
      mx.globalCompositeOperation = "source-over";
      mx.fillStyle = OUTLINE;
      mx.fillRect(8, 5, 5, 1); mx.fillRect(7, 6, 1, 3); mx.fillRect(13, 6, 1, 3); // 고리
      mx.fillRect(6, 9, 9, 6); // 몸통 테두리
      mx.fillStyle = "#F6C244";
      mx.fillRect(7, 10, 7, 4); // 몸통
      mx.fillStyle = OUTLINE;
      mx.fillRect(10, 11, 1, 2); // 열쇠 구멍
    }
    const nameSpan = document.createElement("span");
    nameSpan.className = "p-name";
    nameSpan.textContent = p.name;
    btn.appendChild(mini);
    btn.appendChild(nameSpan);
    btn.addEventListener("click", () => {
      if (!p.unlocked) { showToast("배지를 받으면 열려요!"); return; }
      wearProp(me.prop === p.id ? null : p.id); // 다시 누르면 원래 모습, 한 번에 하나만
    });
    list.appendChild(btn);
  });
  refreshBag();
}

// 소품 쓰기 (null이면 원래 모습). 이 컴퓨터와 시트에 저장하고 친구 화면에도 바로
function wearProp(id) {
  me.prop = id || null;
  try {
    const saved = JSON.parse(localStorage.getItem(SAVE_KEY) || "{}");
    saved.prop = me.prop;
    localStorage.setItem(SAVE_KEY, JSON.stringify(saved));
  } catch (e) { /* 무시 */ }
  if (ONLINE() && me.id) {
    api({ action: "prop", class: CLASS, id: me.id, prop: me.prop || "" }); // 시트에 저장
    sendMyPos(true); // 친구 화면에도 바로 보이게
  }
  refreshBag();
  const p = PROPS.find((v) => v.id === me.prop);
  showToast(p ? `${p.name} 꾸미기 완료! ${p.emoji}` : "원래 모습이 되었어요.");
}

function refreshBag() {
  document.querySelectorAll(".prop-btn").forEach((btn) => {
    btn.classList.toggle("wearing", btn.dataset.prop === me.prop);
  });
}

/* ============================================================
   재료 줍기와 재료 도감 (요구사항 5-6)
   - 나무 앞 "흔들기", 연못 가장자리 "건지기". 꽝은 없다.
   - 못 모은 재료가 먼저 나온다. 나무와 물가 상태는 사람마다 따로.
   - 열림/닫힘과 쉬는 시간(분)은 시트(마을 탭)에서 바꾼다.
   ============================================================ */
const ITEMS = [
  // 나무·덤불에서 (흔들기)
  { id: "wheat",      name: "밀",       from: "tree",   shape: "egg",   c: "#E8C060", deco: "vein" },
  { id: "strawberry", name: "딸기",     from: "tree",   shape: "drop",  c: "#E8453C", deco: "seeds" },
  { id: "blueberry",  name: "블루베리", from: "tree",   shape: "round", c: "#6B7FD6", deco: "sparkle" },
  { id: "walnut",     name: "호두",     from: "tree",   shape: "round", c: "#B5885C", deco: "vein" },
  { id: "almond",     name: "아몬드",   from: "tree",   shape: "egg",   c: "#D9A868", deco: "vein" },
  { id: "banana",     name: "바나나",   from: "tree",   shape: "flat",  c: "#F6D44C", deco: "stem" },
  { id: "apple",      name: "사과",     from: "tree",   shape: "round", c: "#E0493F", deco: "leaf" },
  { id: "cherry",     name: "체리",     from: "tree",   shape: "round", c: "#C0392B", deco: "stem" },
  // 바다·모래에서 (낚시)
  { id: "salt",       name: "소금",     from: "sea",    shape: "cube",  c: "#F4F0E6", deco: "grains" },
  { id: "kelp",       name: "해초",     from: "sea",    shape: "flat",  c: "#58A06C", deco: "stripes" },
  { id: "shell",      name: "조개",     from: "sea",    shape: "flat",  c: "#F3D9A4", deco: "ridges" },
  { id: "wakame",     name: "미역",     from: "sea",    shape: "flat",  c: "#3F7D55", deco: "vein" },
  { id: "anchovy",    name: "멸치",     from: "sea",    shape: "egg",   c: "#B9C4CC", deco: "sparkle" },
  { id: "honey",      name: "꿀",       from: "sea",    shape: "drop",  c: "#F2A33C", deco: "sparkle" },
  { id: "coconut",    name: "코코넛",   from: "sea",    shape: "round", c: "#8A5A33", deco: "seeds" },
  // 땅·풀밭에서 (반짝이는 곳 줍기)
  { id: "egg",        name: "달걀",     from: "animal", shape: "egg",   c: "#FFF2DC", deco: "sparkle" }, // 닭에서만
  { id: "milk",       name: "우유",     from: "animal", shape: "cube",  c: "#F4F7FA", deco: "stripes" }, // 젖소에서만
  { id: "butter",     name: "버터",     from: "ground", shape: "cube",  c: "#F6D44C", deco: "stripes" },
  { id: "sugar",      name: "설탕",     from: "ground", shape: "cube",  c: "#FFFFFF", deco: "sparkle" },
  { id: "chocolate",  name: "초콜릿",   from: "ground", shape: "cube",  c: "#8A5A33", deco: "stripes" },
];

// 예전 도감 재료를 새 목록으로 자연스럽게 옮긴다 (시트에 저장된 값 포함)
const ITEM_MIGRATE = {
  lemon: "banana", chestnut: "almond", peach: "apple", cinnamon: "chocolate",
  mint: "kelp", pearl: "milk", icecandy: "sugar", jelly: "honey",
  lotus: "wheat", starcandy: "anchovy", seaweed: "wakame",
};
function migrateItems(set) {
  const out = new Set();
  const valid = new Set(ITEMS.map((it) => it.id));
  for (const id of set) {
    const mapped = ITEM_MIGRATE[id] || id;
    if (valid.has(mapped)) out.add(mapped);
  }
  return out;
}

// 재료 도트 그림 (16x16, 코드로 직접 그림)
const itemCache = {};
function itemSprite(id) {
  if (itemCache[id]) return itemCache[id];
  const it = ITEMS.find((v) => v.id === id);
  const cv = document.createElement("canvas");
  cv.width = 16; cv.height = 16;
  const x = cv.getContext("2d");
  const g = Array.from({ length: 16 }, () => new Array(16).fill(0));
  const el = (cx, cy, rx, ry) => {
    for (let r = 0; r < 16; r++) for (let c = 0; c < 16; c++) {
      const dx = (c - cx) / rx, dy = (r - cy) / ry;
      if (dx * dx + dy * dy <= 1) g[r][c] = 1;
    }
  };
  const rc = (c0, r0, w, h) => { for (let r = r0; r < r0 + h; r++) for (let c = c0; c < c0 + w; c++) if (g[r]) g[r][c] = 1; };

  const sh = it.shape;
  if (sh === "round") el(8, 9, 5.4, 5);
  else if (sh === "egg") el(8, 9, 4.6, 6);
  else if (sh === "flat") el(8, 10, 6, 3.8);
  else if (sh === "cube") rc(4, 5, 8, 8);
  else if (sh === "star") { rc(7, 3, 2, 10); rc(3, 7, 10, 2); rc(5, 5, 6, 6); }
  else if (sh === "drop") {
    el(8, 10.5, 4.6, 4.4);
    for (let r = 3; r < 8; r++) for (let c = 0; c < 16; c++) if (Math.abs(c - 8) <= (r - 2) * 0.85) g[r][c] = 1;
  }

  const shade = shadeHex(it.c, 0.78), light = shadeHex(it.c, 1.25);
  for (let r = 0; r < 16; r++) for (let c = 0; c < 16; c++) {
    if (!g[r][c]) continue;
    let col = it.c;
    if (!((g[r + 1] || [])[c])) col = shade;
    else if (r < 8 && c < 9 && !((g[r - 1] || [])[c] && g[r][c - 1])) col = light;
    x.fillStyle = col; x.fillRect(c, r, 1, 1);
  }
  // 꾸밈
  const px = (c, r, col) => { if (g[r] && g[r][c]) { x.fillStyle = col; x.fillRect(c, r, 1, 1); } };
  if (it.deco === "seeds") [[6, 8], [9, 7], [8, 11], [11, 9]].forEach(([c, r]) => px(c, r, light));
  else if (it.deco === "sparkle") { px(6, 6, "#FFFFFF"); px(10, 9, "#FFFFFF"); }
  else if (it.deco === "cap") { for (let r = 0; r < 7; r++) for (let c = 0; c < 16; c++) px(c, r, "#6E4525"); }
  else if (it.deco === "stripes") { for (const r of [7, 10]) for (let c = 0; c < 16; c++) px(c, r, shade); }
  else if (it.deco === "grains") [[6, 7], [9, 9], [7, 11]].forEach(([c, r]) => px(c, r, shade));
  else if (it.deco === "vein") { for (let r = 4; r < 14; r++) px(8, r, shade); }
  else if (it.deco === "ridges") { for (const c of [5, 8, 11]) for (let r = 7; r < 14; r++) px(c, r, shade); }
  else if (it.deco === "leaf") { x.fillStyle = "#58B368"; x.fillRect(9, 2, 2, 2); x.fillStyle = "#6E4525"; x.fillRect(8, 2, 1, 2); }
  else if (it.deco === "stem") { x.fillStyle = "#6E4525"; x.fillRect(8, 1, 1, 4); x.fillStyle = "#58B368"; x.fillRect(9, 1, 2, 2); }
  // 테두리
  x.fillStyle = OUTLINE;
  for (let r = 0; r < 16; r++) for (let c = 0; c < 16; c++) {
    if (g[r][c]) continue;
    const near = (g[r - 1] || [])[c] || (g[r + 1] || [])[c] || g[r][c - 1] || g[r][c + 1];
    if (near) x.fillRect(c, r, 1, 1);
  }
  itemCache[id] = cv;
  return cv;
}

// 재료 뽑기: 아직 못 모은 재료가 먼저, 꽝은 없다
// 소금빵 재료는 아직 없으면 그곳에서 가장 먼저 나온다 (그다음부터는 무작위)
const FIRST_PICK = { sea: "salt", tree: "wheat", ground: "butter" };

function pickFrom(fromType) {
  const first = FIRST_PICK[fromType];
  if (first && !me.items.has(first)) return ITEMS.find((it) => it.id === first);
  const pool = ITEMS.filter((it) => it.from === fromType);
  const fresh = pool.filter((it) => !me.items.has(it.id));
  const from = fresh.length ? fresh : pool;
  return from[Math.floor(Math.random() * from.length)];
}

// 땅·풀밭의 반짝이는 재료 자리 (수업 시간에는 안 보임)
let groundSpots = [];
let nextSpotAt = 0;
function updateGroundSpots(now) {
  if (!VILLAGE_CFG.gatherOpen) { groundSpots = []; return; }
  if (groundSpots.length >= 3 || now < nextSpotAt) return;
  for (let tryN = 0; tryN < 25; tryN++) {
    const c = 3 + Math.floor(Math.random() * (COLS - 9));
    const r = 3 + Math.floor(Math.random() * (ROWS - 8));
    if (ground[r][c] !== 0 || blocked[r][c]) continue;
    groundSpots.push({ c, r, seed: Math.random() * 1000 });
    break;
  }
  nextSpotAt = now + 25000;
}

// 떨어지는 열매 (나무에서 떨어져 통통 튄 뒤 가방으로)
const dropAnims = [];

const GATHER_KEY = "happybread_gather_" + CLASS;
const FISH_REST_MIN = 1;   // 낚시 쉬는 시간(분). 나무는 시트의 "열매쉬는분"을 그대로 쓴다
const ANIMAL_REST_MIN = 1; // 젖소·닭 쉬는 시간(분). 같은 종류는 함께 쉰다 (젖소 둘, 닭 셋)
let cooldowns = {};
try { cooldowns = JSON.parse(localStorage.getItem(GATHER_KEY) || "{}"); } catch (e) { /* 무시 */ }
// 예전 버전이 저장해 둔 긴 바다 쉬기 기록은 1분으로 줄인다
// 예전 오른쪽 선착장 자리에 적힌 낚시 쉬기 기록은 새싹 자리를 지운다 (낚시 자리가 아래쪽 데크로 옮겨졌다)
if (cooldowns.sea && typeof cooldowns.sea === "object" && cooldowns.sea.c >= 44) {
  cooldowns.sea.c = undefined; cooldowns.sea.r = undefined;
}
if (cooldowns.sea) {
  const seaCap = Date.now() + FISH_REST_MIN * 60 * 1000;
  if (cooldowns.sea.t && cooldowns.sea.t > seaCap) cooldowns.sea.t = seaCap;
  else if (typeof cooldowns.sea === "number" && cooldowns.sea > seaCap) cooldowns.sea = seaCap;
}
const shakeUntil = {};   // 나무 흔들림 효과
let gatherSpot = null;
let floatItem = null;    // 방금 얻은 재료가 떠오르는 효과

function saveItems(addId) {
  try {
    const saved = JSON.parse(localStorage.getItem(SAVE_KEY) || "{}");
    saved.items = [...me.items];
    saved.fish = [...me.fish];
    localStorage.setItem(SAVE_KEY, JSON.stringify(saved));
  } catch (e) { /* 무시 */ }
  if (!ONLINE() || !me.id) return;
  // add: 방금 얻은 재료. 도감에 이미 있던 재료여도 보내서 우리 반 바구니에 +1 된다 (요청은 원래 1번 그대로)
  const req = { action: "items", class: CLASS, id: me.id, items: [...me.items].join(","), fish: [...me.fish].join(",") };
  if (addId) req.add = addId;
  api(req).then((r) => { if (r && r.ok && r.basket !== undefined) applyBasket(r.basket); });
}

function findGatherSpot() {
  const pc = Math.floor(me.x / TILE), pr = Math.floor(me.y / TILE);
  // 1) 가까운 열매 나무
  let tree = null, treeD = Infinity;
  for (let r = pr - 2; r <= pr + 2; r++) {
    for (let c = pc - 2; c <= pc + 2; c++) {
      if (!fruitSet.has(c + "," + r)) continue;
      const d = Math.hypot(me.x - (c + 0.5) * TILE, me.y - (r + 0.5) * TILE);
      if (d < treeD) { treeD = d; tree = { type: "tree", key: "t" + c + "_" + r, c, r, tree: treeAt[c + "," + r] }; }
    }
  }
  if (tree && treeD < TILE * 2.1) return tree;
  // 2) 농장 동물: 젖소는 우유, 닭은 달걀 (쉬는 동물은 건너뛴다)
  let an = null, anD = Infinity;
  const nowMs = Date.now();
  for (const a of ANIMALS) {
    if (coolLeft("a_" + a.kind) > 0) continue;
    const p = animalPosAt(a, nowMs);
    const d = Math.hypot(me.x - p.x, me.y - p.y);
    if (d < anD) { anD = d; an = { type: "animal", key: "a_" + a.kind, kind: a.kind }; }
  }
  if (an && anD < TILE * 1.9) return an;
  // 3) 땅의 반짝이는 재료 (바다 낚시는 낚시 자리에 앉아서만 한다: updateFishButton)
  for (const s of groundSpots) {
    const d = Math.hypot(me.x - (s.c + 0.5) * TILE, me.y - (s.r + 0.5) * TILE);
    if (d < TILE * 1.8) return { type: "ground", key: "ground", spot: s, c: s.c, r: s.r };
  }
  return null;
}

function coolLeft(key) { // 쉬는 중이면 남은 시간(ms), 아니면 0
  const v = cooldowns[key];
  const t = v ? (v.t || v) : 0;
  return Math.max(0, t - Date.now());
}

function updateGatherButton(now) {
  const btn = $("gatherBtn");
  // 낚시 자리에 앉아 있으면 던지기/당기기 버튼으로 바뀐다
  if (me.sitting && me.sitting.bench.fishing) { updateFishButton(btn, now); return; }
  const busy = me.sitting || me.fishing || dropAnims.length > 0;
  const spot = (VILLAGE_CFG.gatherOpen && !busy) ? findGatherSpot() : null; // 수업 시간에는 버튼이 없다
  // 쉬는 중인 곳이면 버튼을 아예 숨긴다 (새싹 표시만 보임)
  if (!spot || coolLeft(spot.key) > 0) {
    if (gatherSpot) { gatherSpot = null; btn.classList.add("hidden"); }
    return;
  }
  if (!gatherSpot || gatherSpot.key !== spot.key || btn.classList.contains("hidden")) {
    if (spot.type === "tree") setBtnIcon(btn, "shake", "흔들기");
    else if (spot.type === "animal" && spot.kind === "cow") setBtnIcon(btn, itemSprite("milk"), "우유 짜기");
    else if (spot.type === "animal") setBtnIcon(btn, itemSprite("egg"), "달걀 줍기");
    else setBtnIcon(btn, "spark", "줍기");
    btn.classList.remove("closed");
    btn.classList.remove("hidden");
  }
  gatherSpot = spot;
  btn.style.left = (dispX(me) - cam.x) + "px";
  btn.style.top = (dispY(me) - cam.y + 26) + "px";
}

// 쉬는 중인 곳의 새싹 표시를 그리기 순서(items)에 넣는다
// - 나무는 윗부분(연못은 가장자리 물칸)에 붙이고,
// - 같은 자리 기준으로 캐릭터보다 먼저 그려져서 캐릭터를 절대 가리지 않는다
function collectSprouts(items, now) {
  const nowMs = Date.now();
  for (const key in cooldowns) {
    const v = cooldowns[key];
    const t = v ? (v.t || v) : 0;
    if (t <= nowMs) { delete cooldowns[key]; continue; }
    if (!v || v.c === undefined) continue;
    const isTree = key[0] === "t";
    const info = treeAt[v.c + "," + v.r];
    const topOff = !isTree ? 0 : info && info.kind === "B" ? -30 : info && info.kind === "W" ? -48 : -86;
    const sx = (v.c + 0.5) * TILE - cam.x;
    const sy = (isTree ? (v.r + 1) * TILE + topOff : (v.r + 0.5) * TILE) - cam.y + Math.sin(now / 300) * 2;
    if (sx < -30 || sy < -30 || sx > canvas.width + 30 || sy > canvas.height + 30) continue;
    items.push({ y: (v.r + 1) * TILE + 1, draw: () => ctx.drawImage(uiIcon("sprout"), sx - 11, sy - 18, 22, 22) });
  }
}

// 재료를 손에 넣었을 때 공통 처리 (폴짝 + 반짝 + 알림 + 저장 + 도감으로 날아가기 + 중요한 순간 칭찬)
function collectCore(pick, isNew) {
  const before = ITEMS.filter((it) => me.items.has(it.id)).length;
  me.items.add(pick.id);
  saveItems(pick.id);
  me.hopUntil = performance.now() + 300; // 작게 한 번 폴짝
  spawnSparkle(dispX(me) - cam.x, dispY(me) - cam.y - 30, 10);
  playTone("gather");
  showToast(isNew ? `${pick.name}을(를) 처음 모았어요! 도감에 들어갔어요.` : `${pick.name}이(가) 또 나왔어요.`);
  flyToDex(pick.id, isNew);
  if (!isNew) return;
  // 중요한 순간에만 칭찬 배너 (도감 5·10·15·20개, 소금빵 재료 다 모음)
  const count = ITEMS.filter((it) => me.items.has(it.id)).length;
  if (count > before) {
    if (count === ITEMS.length) {
      showPraise("최고예요!", "재료 도감을 다 채웠어요", true);
    } else if (count % 5 === 0) {
      showPraise("잘했어요!", `재료를 ${count}개 모았어요`);
    }
    const saltIds = SALT_NEEDS.map((n) => n.id);
    if (saltIds.includes(pick.id) && saltIds.every((id) => me.items.has(id))) {
      showPraise("멋져요!", "이제 소금빵을 구울 수 있어요");
    }
  }
}

/* ---------- 재료가 도감(책) 버튼으로 날아가기 ----------
   솟기 0.25초 → 멈춤 0.3초 → 날아가기 0.6초 → 도감 버튼 통 0.15초 (합 1.3초).
   동작 줄이기면 날지 않고 도감 버튼 옆에 잠깐 나타나고, 버튼은 살짝 밝아지기만 한다. */
const FLY_MS = 1150;
let flyBusyUntil = 0; // 칭찬 배너는 날아가기가 끝난 뒤에 나온다
function flyToDex(itemId, isNew) {
  const btn = $("dexBtn");
  if (!btn || !btn.animate) return;
  const br = btn.getBoundingClientRect();
  const tx = br.left + br.width / 2, ty = br.top + br.height / 2;
  const el = document.createElement("div");
  el.className = "fly-item";
  const cv = document.createElement("canvas");
  cv.width = 16; cv.height = 16;
  const x2 = cv.getContext("2d");
  x2.imageSmoothingEnabled = false;
  x2.drawImage(itemSprite(itemId), 0, 0);
  el.appendChild(cv);
  document.body.appendChild(el);
  const done = () => {
    el.remove();
    btn.classList.remove("dex-bump");
    void btn.offsetWidth; // 다시 통 튀게 애니메이션을 처음부터
    btn.classList.add(REDUCED ? "dex-glow" : "dex-bump");
    setTimeout(() => btn.classList.remove("dex-bump", "dex-glow"), 400);
  };
  if (REDUCED) {
    el.style.left = (tx - 64) + "px"; el.style.top = (ty - 22) + "px";
    el.animate([{ opacity: 0 }, { opacity: 1, offset: 0.3 }, { opacity: 1, offset: 0.7 }, { opacity: 0 }],
      { duration: 700 }).onfinish = done;
    flyBusyUntil = performance.now() + 700;
    return;
  }
  const sx = dispX(me) - cam.x, sy = dispY(me) - cam.y - CHAR_SIZE - 10;
  el.style.left = (sx - 22) + "px"; el.style.top = (sy - 22) + "px";
  const dx = tx - sx, dy = ty - sy;
  // 날아갈 때 위로 살짝 휘는 곡선 (가운데 지점을 조금 위로)
  const mx = dx * 0.5, my = dy * 0.5 - 60;
  el.animate([
    { transform: "translate(0px, 10px) scale(0.6)", opacity: 0, offset: 0 },
    { transform: "translate(0px, -30px) scale(1)", opacity: 1, offset: 0.22 },  // 톡 솟기
    { transform: "translate(0px, -30px) scale(1)", opacity: 1, offset: 0.48 },  // 잠깐 멈춤
    { transform: `translate(${mx}px, ${my - 30}px) scale(0.8)`, opacity: 1, offset: 0.74 },
    { transform: `translate(${dx}px, ${dy}px) scale(0.5)`, opacity: 0.9, offset: 1 }, // 도감 버튼
  ], { duration: FLY_MS, easing: "ease-in-out" }).onfinish = done;
  flyBusyUntil = performance.now() + FLY_MS + 150;
}

/* ---------- 칭찬 배너 (중요한 순간에만, 한 번에 하나씩) ----------
   위에서 0.3초 내려오고 2.5초 보였다가 0.3초 사라진다. 누르면 바로 닫힌다. 조작을 막지 않는다. */
const praiseQueue = [];
let praiseShowing = false, praiseTimer = 0;
function showPraise(title, text, big) {
  if (praiseQueue.some((p) => p.text === text)) return; // 같은 칭찬은 한 번만
  if (praiseQueue.length >= 3) return;
  praiseQueue.push({ title, text, big });
  if (!praiseShowing) setTimeout(nextPraise, Math.max(0, flyBusyUntil - performance.now()));
}
function nextPraise() {
  const p = praiseQueue.shift();
  const el = $("praise");
  if (!p) { praiseShowing = false; return; }
  praiseShowing = true;
  $("praiseTitle").textContent = p.title;
  $("praiseText").textContent = p.text;
  el.classList.remove("hidden", "out");
  void el.offsetWidth;
  el.classList.add("in");
  playTone("dex");
  if (p.big) spawnSparkle(canvas.width / 2, canvas.height / 3, 30);
  clearTimeout(praiseTimer);
  praiseTimer = setTimeout(closePraise, 2800);
}
function closePraise() {
  const el = $("praise");
  if (el.classList.contains("hidden")) return;
  clearTimeout(praiseTimer);
  el.classList.remove("in");
  el.classList.add("out");
  setTimeout(() => { el.classList.add("hidden"); el.classList.remove("out"); nextPraise(); }, 300);
}
$("praise").addEventListener("click", closePraise);


/* ============================================================
   물고기 — 낚시로 바다 재료 대신 물고기도 낚여요 (6가지, 꽝 없음)
   - 물고기는 재료 도감(20개)과 따로, 물고기 도감에 모여요.
   - 우리 반 바구니와 제빵소 재료에는 쓰지 않아요. 크기·희귀도·점수는 없어요.
   - 저장: 이 컴퓨터 + 시트 "물고기" 칸 (재료 저장 요청에 함께 실어 보낸다)
   ============================================================ */
const FISH = [
  { id: "bungeo",   name: "붕어빵 물고기" },
  { id: "mackerel", name: "고등어" },
  { id: "seabream", name: "도미" },
  { id: "puffer",   name: "복어" },
  { id: "hairtail", name: "갈치" },
  { id: "flatfish", name: "광어" },
];
const FISH_CHANCE = 0.5; // 던질 때마다 물고기 반, 바다 재료 반 (아직 못 낚은 것이 먼저)
function parseFish(text) {
  const valid = new Set(FISH.map((f) => f.id));
  return new Set(String(text || "").split(",").map((s) => s.trim()).filter((s) => valid.has(s)));
}

// 물고기 도트 그림 (16x16, 왼쪽을 본다)
const fishCache = {};
function fishSprite(id) {
  if (fishCache[id]) return fishCache[id];
  const cv = document.createElement("canvas");
  cv.width = 16; cv.height = 16;
  const x = cv.getContext("2d");
  const g = Array.from({ length: 16 }, () => new Array(16).fill(0));
  const col = Array.from({ length: 16 }, () => new Array(16).fill(null));
  const el = (cx, cy, rx, ry, c) => {
    for (let r = 0; r < 16; r++) for (let q = 0; q < 16; q++) {
      const dx = (q - cx) / rx, dy = (r - cy) / ry;
      if (dx * dx + dy * dy <= 1) { g[r][q] = 1; col[r][q] = c; }
    }
  };
  const px = (q, r, c) => { if (r >= 0 && r < 16 && q >= 0 && q < 16) { g[r][q] = 1; col[r][q] = c; } };
  const tail = (q0, cy, h, c) => { // 오른쪽 꼬리 (세모 두 갈래)
    for (let i = 0; i < 4; i++) for (let d = -Math.min(h, i + 1); d <= Math.min(h, i + 1); d++) {
      if (Math.abs(d) >= i - 1 || i < 2) px(q0 + i, cy + d, c);
    }
  };
  let eye = [4, 7], belly = null, deco = null;
  if (id === "bungeo") { // 붕어빵 물고기: 노릇한 빵, 비늘 무늬 줄, 지느러미까지 빵
    el(7, 8, 6, 4.2, "#D99A4E"); tail(12, 8, 3, "#C9863E");
    px(6, 3, "#C9863E"); px(7, 3, "#C9863E"); px(8, 3, "#C9863E"); px(7, 2, "#C9863E"); // 등지느러미
    deco = () => { // 빵 굽기 무늬 (격자)
      for (const [q, r] of [[6, 7], [8, 7], [10, 7], [7, 9], [9, 9], [5, 9], [8, 11], [6, 5], [9, 5]]) { if (g[r][q]) col[r][q] = "#B87536"; }
      for (let q = 2; q < 12; q++) if (g[6][q] && q % 2) col[6][q] = "#E9B86A";
    };
    eye = [3, 7];
  } else if (id === "mackerel") { // 고등어: 푸른 등 + 검은 물결 줄 + 은빛 배
    el(7, 8, 6.2, 3.4, "#5A8FB8"); tail(12, 8, 3, "#4A7AA0");
    belly = "#DDE6EC";
    deco = () => { for (const [q, r] of [[5, 6], [6, 7], [8, 6], [9, 7], [11, 6], [7, 5], [10, 5]]) if (g[r][q]) col[r][q] = "#2E4E6E"; };
    eye = [3, 7];
  } else if (id === "seabream") { // 도미: 분홍빛 붉은 몸, 높은 등
    el(7, 8, 5.6, 4.6, "#E88A8A"); tail(12, 8, 3, "#D97070");
    for (let q = 5; q <= 9; q++) px(q, 3, "#D97070"); px(7, 2, "#D97070");
    belly = "#F8D2CC";
    deco = () => { for (const [q, r] of [[6, 6], [8, 6], [10, 7], [7, 8]]) if (g[r][q]) col[r][q] = "#7FC6E8"; }; // 푸른 점
    eye = [3, 7];
  } else if (id === "puffer") { // 복어: 동그란 몸 + 작은 점
    el(7, 8, 5.2, 5, "#F2D27A"); tail(12, 8, 2, "#E0B85A");
    belly = "#FFF4D6";
    deco = () => { for (const [q, r] of [[6, 5], [9, 5], [7, 7], [10, 7], [5, 7], [8, 4]]) if (g[r][q]) col[r][q] = "#8A6A3A"; };
    eye = [4, 6];
  } else if (id === "hairtail") { // 갈치: 길고 가는 은빛 몸
    for (let q = 2; q <= 11; q++) { px(q, 6, "#E8EDF3"); px(q, 7, "#D8DEE6"); px(q, 8, "#C3CBD6"); }
    px(1, 7, "#D8DEE6"); px(1, 8, "#C3CBD6"); px(0, 8, "#C3CBD6");           // 뾰족한 입
    for (let q = 12; q <= 13; q++) { px(q, 7, "#D8DEE6"); px(q, 8, "#C3CBD6"); }
    px(14, 8, "#C3CBD6"); px(15, 9, "#C3CBD6");                              // 가늘어지는 꼬리
    for (let q = 4; q <= 11; q++) if (q % 2 === 0) px(q, 5, "#F2E3A6");       // 등지느러미
    eye = [3, 6];
  } else { // 광어: 넓적한 갈색 몸 + 얼룩, 두 눈이 한쪽에
    el(7, 8, 6.4, 4.6, "#A8875E"); tail(13, 8, 2, "#94744E");
    deco = () => { for (const [q, r] of [[6, 6], [9, 7], [7, 10], [10, 10], [4, 9]]) if (g[r][q]) col[r][q] = "#7A5E3E"; };
    eye = [4, 6];
  }
  // 그늘 (아래쪽 가장자리) + 배
  for (let r = 0; r < 16; r++) for (let q = 0; q < 16; q++) {
    if (!g[r][q]) continue;
    if (belly && r >= 9 && q < 12 && g[r - 1] && g[r - 1][q] && (g[r + 1] || [])[q]) col[r][q] = belly;
  }
  if (deco) deco();
  for (let r = 0; r < 16; r++) for (let q = 0; q < 16; q++) {
    if (!g[r][q]) continue;
    x.fillStyle = col[r][q]; x.fillRect(q, r, 1, 1);
  }
  // 눈
  x.fillStyle = "#FFFFFF"; x.fillRect(eye[0], eye[1], 2, 2);
  x.fillStyle = OUTLINE; x.fillRect(eye[0], eye[1] + 1, 1, 1);
  if (id === "flatfish") { x.fillStyle = "#FFFFFF"; x.fillRect(eye[0] + 2, eye[1] - 2, 2, 2); x.fillStyle = OUTLINE; x.fillRect(eye[0] + 2, eye[1] - 1, 1, 1); }
  // 테두리
  x.fillStyle = OUTLINE;
  for (let r = 0; r < 16; r++) for (let q = 0; q < 16; q++) {
    if (g[r][q]) continue;
    const near = (g[r - 1] || [])[q] || (g[r + 1] || [])[q] || g[r][q - 1] || g[r][q + 1];
    if (near) x.fillRect(q, r, 1, 1);
  }
  fishCache[id] = cv;
  return cv;
}

// 낚을 것 고르기: 소금이 없으면 소금 먼저(그대로), 그다음은 물고기 반·바다 재료 반
function pickCatch() {
  if (FIRST_PICK.sea && !me.items.has(FIRST_PICK.sea)) return { item: pickFrom("sea") };
  if (Math.random() < FISH_CHANCE) {
    const fresh = FISH.filter((f) => !me.fish.has(f.id));
    const pool = fresh.length ? fresh : FISH;
    return { fish: pool[Math.floor(Math.random() * pool.length)] };
  }
  return { item: pickFrom("sea") };
}

/* ---------- 낚아채는 모션 (약 1초, 흔들림·번쩍임 없음) ----------
   0~0.25초 낚싯대를 뒤로 휙 (살짝 휨) · 0.1~0.5초 물보라 · 0.2~0.9초 낚은 것이 포물선으로 캐릭터 머리 위까지.
   동작 줄이기면 모션 없이 바로 결과. */
const CATCH_MS = 950;
let catchAnim = null; // { t0, sprite, bx, by, drops: [] }
function startCatch(got) {
  const finish = () => {
    catchAnim = null;
    if (got.item) collectCore(got.item, !me.items.has(got.item.id));
    else collectFish(got.fish);
  };
  if (REDUCED) { finish(); return; }
  const bx = dispX(me) + 38, by = dispY(me) + 38; // 찌 자리 (월드 좌표)
  const drops = Array.from({ length: 12 }, (_, i) => ({
    a: -Math.PI / 2 + (i / 11 - 0.5) * 2.2, sp: 70 + (i * 37) % 60, c: i % 3 ? "#FFFFFF" : "#BFE3F5",
  }));
  catchAnim = { t0: performance.now(), sprite: got.item ? itemSprite(got.item.id) : fishSprite(got.fish.id), bx, by, drops };
  playTone("gather");
  setTimeout(finish, CATCH_MS);
}
// 낚싯대 끝이 어디까지 젖혀졌는지 (0: 앞, 1: 뒤로 다 젖힘)
function catchJerk(now) {
  if (!catchAnim) return 0;
  const t = (now - catchAnim.t0) / 1000;
  if (t < 0.25) return t / 0.25;                // 휙
  if (t < 0.7) return 1;                         // 젖힌 채로
  return Math.max(0, 1 - (t - 0.7) / 0.25);      // 천천히 돌아옴
}
// 물보라와 날아오는 것 (캐릭터·이름표 위에 그린다)
function drawCatchAnim(now) {
  if (!catchAnim) return;
  const t = (now - catchAnim.t0) / 1000;
  const bx = catchAnim.bx - cam.x, by = catchAnim.by - cam.y;
  if (t > 0.1 && t < 0.55) { // 물보라: 퐁 튀었다가 떨어지며 옅어진다
    const k = (t - 0.1) / 0.45;
    ctx.globalAlpha = 1 - k;
    for (const d of catchAnim.drops) {
      const s = d.sp * k * 0.45;
      ctx.fillStyle = d.c;
      ctx.fillRect(Math.round(bx + Math.cos(d.a) * s) - 2, Math.round(by + Math.sin(d.a) * s + 60 * k * k) - 2, 4, 4);
    }
    ctx.globalAlpha = 1;
    ctx.strokeStyle = `rgba(255,255,255,${0.9 * (1 - k)})`; ctx.lineWidth = 2; // 물결
    ctx.beginPath(); ctx.ellipse(bx, by + 4, 8 + k * 16, 3 + k * 5, 0, 0, Math.PI * 2); ctx.stroke();
  }
  if (t > 0.2) { // 포물선: 찌 → 캐릭터 머리 위
    const p = catchObjScreen(now);
    ctx.drawImage(catchAnim.sprite, Math.round(p.x - p.size / 2), Math.round(p.y - p.size / 2), p.size, p.size);
  }
}
// 낚은 것의 화면 위치 (0.2초 전에는 찌 자리). 낚싯줄도 여기를 따라간다
function catchObjScreen(now) {
  if (!catchAnim) return null;
  const t = (now - catchAnim.t0) / 1000;
  const bx = catchAnim.bx - cam.x, by = catchAnim.by - cam.y;
  const k = Math.max(0, Math.min(1, (t - 0.2) / 0.7));
  const hx = dispX(me) - cam.x, hy = dispY(me) - cam.y - CHAR_SIZE - 14;
  return {
    x: bx + (hx - bx) * k,
    y: by + (hy - by) * k - Math.sin(Math.PI * k) * 70,
    size: 26 + 14 * Math.sin(Math.PI * Math.min(1, k * 1.2)),
  };
}

// 물고기를 손에 넣었을 때: 크게 보여 주기 + 물고기 도감 + 저장 (바구니·제빵소와는 상관없음)
function collectFish(f) {
  const isNew = !me.fish.has(f.id);
  me.fish.add(f.id);
  saveItems(); // 재료와 같은 요청에 물고기 목록도 함께 (바구니에는 세지 않는다)
  me.hopUntil = performance.now() + 300;
  showFishCard(f, isNew);
}
let fishCardTimer = 0;
function showFishCard(f, isNew) {
  const el = $("fishCard");
  const cv = $("fishCardCanvas");
  const x = cv.getContext("2d");
  x.imageSmoothingEnabled = false;
  x.clearRect(0, 0, cv.width, cv.height);
  x.drawImage(fishSprite(f.id), 0, 0, cv.width, cv.height);
  $("fishCardTitle").textContent = `${josaOf(f.name, "을", "를")} 낚았어요!`;
  $("fishCardText").textContent = isNew ? "물고기 도감에 들어갔어요." : "또 만났어요. 반가워요!";
  el.classList.remove("hidden", "out");
  void el.offsetWidth;
  el.classList.add("in");
  if (isNew) playTone("dex");
  clearTimeout(fishCardTimer);
  fishCardTimer = setTimeout(closeFishCard, 2600);
}
function closeFishCard() {
  const el = $("fishCard");
  if (el.classList.contains("hidden")) return;
  clearTimeout(fishCardTimer);
  el.classList.remove("in");
  el.classList.add("out");
  setTimeout(() => { el.classList.add("hidden"); el.classList.remove("out"); }, 300);
}

// 서버가 보내 준 물고기 목록 + 이 컴퓨터에 남은 같은 학생의 기록을 합친다
// (새 Code.gs를 배포하기 전에 낚은 물고기도 잃지 않고, 다음 저장 때 시트로 올라간다)
function applyServerFish(res) {
  let local = new Set();
  try {
    const saved = JSON.parse(localStorage.getItem(SAVE_KEY) || "null");
    if (saved && saved.id === res.id) local = parseFish((saved.fish || []).join(","));
  } catch (e) { /* 무시 */ }
  me.fish = new Set([...parseFish(res.fish), ...local]);
}

function setCooldown(key, c, r, durMin) {
  cooldowns[key] = { t: Date.now() + durMin * 60 * 1000, c, r };
  try { localStorage.setItem(GATHER_KEY, JSON.stringify(cooldowns)); } catch (e) { /* 무시 */ }
}

// 나뭇잎이 흩날린다
function spawnLeaves(sx, sy, kind) {
  const cols = kind === "B" ? ["#7CC576", "#E8453C", "#58B368"] :
               kind === "W" ? ["#E8C060", "#D9A868", "#F6D44C"] :
                              ["#7CC576", "#58B368", "#9BDB8E"];
  for (let i = 0; i < 9; i++) {
    particles.push({
      x: sx + (Math.random() * 56 - 28), y: sy + Math.random() * 20,
      vx: Math.random() * 40 - 20, vy: 20 + Math.random() * 40,
      life: 0.8 + Math.random() * 0.5,
      color: cols[i % 3],
    });
  }
}

// 나무 흔들기: 흔들림 → 잎 → 열매가 떨어져 통통 → 줍기
function doShake(spot) {
  if (!VILLAGE_CFG.gatherOpen) { showToast("지금은 수업 시간이에요. 쉬는 시간에 다시 와요"); return; }
  if (coolLeft(spot.key) > 0) return;
  const t = spot.tree;
  // 나무마다 쉬는 시간이 ±1~2분씩 조금씩 다르다 (사람마다 따로)
  const durMin = Math.max(1, VILLAGE_CFG.restMin + ((hash2(t.c, t.r) % 5) - 2));
  setCooldown(spot.key, t.c, t.r, durMin);
  me.path = [];
  faceDir(me, (t.c + 0.5) * TILE - me.x, (t.r + 0.5) * TILE - me.y);
  shakeUntil[t.c + "," + t.r] = performance.now() + 700;
  const topY = t.kind === "P" ? (t.r + 1) * TILE - 70 : (t.r + 1) * TILE - 34;
  spawnLeaves((t.c + 0.5) * TILE - cam.x, topY - cam.y, t.kind);
  const pick = pickFrom("tree");
  dropAnims.push({
    pick, isNew: !me.items.has(pick.id),
    x: (t.c + 0.5) * TILE + (Math.random() * 18 - 9),
    y: topY, vy: 20,
    groundY: (t.r + 1) * TILE + 8,
    bounced: false, settleAt: 0, startAt: performance.now() + 420,
  });
}

// 예전 기록이 남아 있어도 낚시 쉬기는 1분을 넘지 않는다
function seaCoolLeft() {
  return Math.min(coolLeft("sea"), FISH_REST_MIN * 60 * 1000);
}

/* ---------- 낚시 (낚시 자리에 앉아서: 던지기 → 찌 4~8초 → 당기기) ----------
   me.fishing: null | { phase: "wait", biteAt, fakeAt } | { phase: "bite" }
   - 기다리는 시간은 매번 4~8초 사이에서 달라져요.
   - 진짜 입질 전에 0~1번 "가짜 입질"(찌가 작게 한 번 톡)이 있어요. "!"·소리·버튼은 없어요.
   - 동작 줄이기면 가짜 입질 없이, 시간이 되면 바로 "!"가 나와요.
   - 당기기 버튼은 계속 기다려요. 늦게 눌러도 놓치지 않아요.
   - 일어나거나 걸으면 낚시가 멈춰요. */
function fishState(now) {
  if (!VILLAGE_CFG.gatherOpen) { // 수업 시간에는 버튼이 없다
    if (me.fishing) { me.fishing = null; sendMyPos(true); } // 친구 화면의 낚싯대도 거둔다
    return null;
  }
  if (catchAnim) return null; // 낚아채는 중에는 버튼을 숨긴다
  if (me.fishing && me.fishing.phase === "wait") {
    if (now < me.fishing.biteAt) return null; // 찌를 보며 기다리는 중 (버튼 없음)
    me.fishing = { phase: "bite" };
    playTone("gather"); // 물었다는 알림 소리
  }
  if (me.fishing && me.fishing.phase === "bite") return { mode: "pull" };
  if (dropAnims.length > 0) return null;
  const left = seaCoolLeft();
  if (left > 0) return { mode: "rest", n: Math.ceil(left / 60000) };
  return { mode: "cast" };
}

function updateFishButton(btn, now) {
  const st = fishState(now);
  if (!st) {
    if (gatherSpot) { gatherSpot = null; btn.classList.add("hidden"); }
    return;
  }
  const key = "fish_" + st.mode + "_" + (st.n || 0);
  if (!gatherSpot || gatherSpot.key !== key || btn.classList.contains("hidden")) {
    if (st.mode === "cast") setBtnIcon(btn, "rod", "던지기");
    else if (st.mode === "pull") setBtnIcon(btn, "rod", "당기기");
    else setBtnIcon(btn, "sprout", `${st.n}분 쉬어요`);
    btn.classList.remove("closed");
    btn.classList.remove("hidden");
  }
  gatherSpot = { type: "fish", key, mode: st.mode };
  // 찌와 낚싯줄을 가리지 않게 캐릭터 아래(바다 위)에 띄운다
  btn.style.left = (dispX(me) - cam.x) + "px";
  btn.style.top = (dispY(me) - cam.y + 72) + "px";
}

function fishAction(mode) {
  const b = me.sitting && me.sitting.bench.fishing ? me.sitting.bench : null;
  if (!b) return;
  if (mode === "rest") {
    const n = Math.max(1, Math.ceil(seaCoolLeft() / 60000));
    showToast(`물고기가 쉬고 있어요. ${n}분 뒤에 다시 해 봐요`);
    return;
  }
  if (mode === "cast") {
    if (me.fishing || !VILLAGE_CFG.gatherOpen || seaCoolLeft() > 0) return;
    const t0 = performance.now();
    const biteAt = t0 + 4000 + Math.random() * 4000; // 4~8초
    // 가짜 입질 0~1번: 던지고 1.5초 뒤부터, 진짜 입질 1.5초 전까지 사이 (동작 줄이기면 없음)
    const fakeAt = !REDUCED && Math.random() < 0.5 ? t0 + 1500 + Math.random() * Math.max(0, biteAt - t0 - 3000) : 0;
    me.fishing = { phase: "wait", biteAt, fakeAt };
    sendMyPos(true); // 친구 화면에 낚싯대와 찌
  } else if (mode === "pull") {
    if (!me.fishing || me.fishing.phase !== "bite") return;
    me.fishing = null;
    const got = pickCatch(); // 바다 재료 또는 물고기 (꽝 없음)
    myCaught = (got.item ? "i:" + got.item.id : "f:" + got.fish.id) + ":" + Date.now().toString(36).slice(-5);
    sendMyPos(true); // 친구 화면: 낚싯대가 사라지고 머리 위에 낚은 것
    setCooldown("sea", b.c, b.r + 1, FISH_REST_MIN); // 자리 바로 아래 바다 칸
    startCatch(got);         // 낚싯대를 휙 채는 모션 뒤에 결과 (동작 줄이기면 바로)
  } else return;
  gatherSpot = null;
  $("gatherBtn").classList.add("hidden");
}

// 땅의 반짝이는 재료 줍기
function pickGround(spot) {
  const pick = pickFrom("ground");
  const isNew = !me.items.has(pick.id);
  groundSpots = groundSpots.filter((s) => s !== spot.spot);
  collectCore(pick, isNew);
}

$("gatherBtn").addEventListener("click", () => {
  const spot = gatherSpot;
  if (!spot) return;
  if (spot.type === "tree") doShake(spot);
  else if (spot.type === "fish") fishAction(spot.mode);
  else if (spot.type === "animal") pickAnimal(spot);
  else pickGround(spot);
});

// 젖소에서 우유, 닭에서 달걀 (동물마다 1분 쉰다)
function pickAnimal(spot) {
  if (coolLeft(spot.key) > 0) return;
  const pick = ITEMS.find((it) => it.id === (spot.kind === "cow" ? "milk" : "egg"));
  const isNew = !me.items.has(pick.id);
  setCooldown(spot.key, undefined, undefined, ANIMAL_REST_MIN);
  collectCore(pick, isNew);
}

/* ============================================================
   만빵 제빵소 — 진저브레드 쿠키 굽기 체험
   계량 → 반죽 → 모양 → 굽기 → 꾸미기 → 완성. 실패와 시간 제한이 없다.
   저장은 완성했을 때 한 번, 이 컴퓨터에만 (반·학생마다 따로).
   ============================================================ */
const BAKE_INGS = [         // 진저브레드 계량 재료
  { name: "밀가루", josa: "를" },
  { name: "설탕",   josa: "을" },
];
const SALT_INGS = [         // 소금빵 계량 재료
  { name: "밀가루", josa: "를" },
  { name: "우유",   josa: "를" },
];
// 소금빵에 필요한 도감 재료 (구워도 없어지지 않는다)
const SALT_NEEDS = [
  { id: "wheat",  name: "밀",  ga: "이", hint: "나무를 흔들어 봐요" },
  { id: "butter", name: "버터", ga: "가", hint: "땅의 반짝이를 주워 봐요" },
  { id: "milk",   name: "우유", ga: "가", hint: "젖소에게 가 봐요" },
  { id: "egg",    name: "달걀", ga: "이", hint: "닭에게 가 봐요" },
  { id: "salt",   name: "소금", ga: "이", hint: "바다에서 낚시해 봐요" },
];
const BAKE_MAX_G = 100;     // 저울 끝 (10g 단위)

// 할 때마다 목표가 바뀐다 (10g 단위, 20~100g). 한 재료는 넘치게 담긴 채로 시작해서 덜기로 맞춘다
function makeBakeRecipe(ings) {
  ings = ings || BAKE_INGS;
  const overIdx = Math.floor(Math.random() * ings.length);
  return ings.map((ing, i) => {
    if (i === overIdx) {
      const target = (2 + Math.floor(Math.random() * 7)) * 10; // 20~80g (넘칠 자리가 있게)
      const maxOver = Math.min(4, (BAKE_MAX_G - target) / 10);
      const start = target + (1 + Math.floor(Math.random() * maxOver)) * 10; // 10~40g 넘치게
      return { ...ing, target, start };
    }
    return { ...ing, target: (2 + Math.floor(Math.random() * 9)) * 10, start: 0 }; // 20~100g
  });
}
const BAKE_OVEN_MS = 5000;  // 오븐 5초
let bake = null;            // { step, ingIdx, grams, needle, knead, shape, decor, ovenT0, saved }

const bakeKey = () => `happybread_bake_${CLASS}_${me.id || me.name || "guest"}`;
function loadBakes() {
  try { const v = JSON.parse(localStorage.getItem(bakeKey()) || "[]"); return Array.isArray(v) ? v : []; }
  catch (e) { return []; }
}
function saveBakeEntry(entry) {
  try {
    const list = loadBakes();
    list.push(entry);
    localStorage.setItem(bakeKey(), JSON.stringify(list.slice(-24))); // 최근 24개까지
  } catch (e) { /* 무시 */ }
}

// 진저브레드 쿠키 그림 (모양 3가지 × 꾸미기 × 굽기 전/후)
const cookieCache = {};
function cookieSprite(shape, decor, baked) {
  const d = decor || {};
  const key = [shape, d.eyes ? 1 : 0, d.buttons ? 1 : 0, d.mouth ? 1 : 0, baked ? 1 : 0].join("_");
  if (cookieCache[key]) return cookieCache[key];
  const N = 26;
  const cv = document.createElement("canvas");
  cv.width = N; cv.height = N;
  const x = cv.getContext("2d");
  const g = Array.from({ length: N }, () => new Array(N).fill(0));
  const rect = (c0, r0, w, h) => {
    for (let r = r0; r < r0 + h; r++) for (let c = c0; c < c0 + w; c++)
      if (c >= 0 && r >= 0 && c < N && r < N) g[r][c] = 1;
  };
  let face = { ex1: 11, ex2: 14, ey: 4, mx: 12, my: 6, b1: [12, 10], b2: [12, 13] };
  if (shape === "man") {
    rect(9, 1, 8, 7);                     // 머리
    rect(7, 8, 12, 8);                    // 몸
    rect(3, 8, 4, 4); rect(19, 8, 4, 4);  // 팔
    rect(8, 16, 4, 8); rect(14, 16, 4, 8); // 다리
    face = { ex1: 11, ex2: 14, ey: 3, mx: 12, my: 5, b1: [12, 10], b2: [12, 13] };
  } else if (shape === "star") {
    for (let r = 0; r < 21; r++) {        // 네 꼭짓점 별 (마름모)
      const w = 21 - 2 * Math.abs(r - 10);
      if (w > 0) rect(13 - Math.floor(w / 2), 2 + r, w, 1);
    }
    rect(3, 11, 21, 3);
    face = { ex1: 10, ex2: 14, ey: 9, mx: 11, my: 13, b1: [12, 16], b2: [12, 18] };
  } else { // tree
    rect(11, 1, 4, 3);
    rect(8, 4, 10, 5); rect(5, 9, 16, 6); rect(2, 15, 22, 6);
    rect(11, 21, 4, 3);                   // 줄기
    face = { ex1: 10, ex2: 14, ey: 10, mx: 11, my: 13, b1: [8, 17], b2: [17, 17] };
  }
  const body = baked ? "#C98A6B" : "#DFC091";
  const light = baked ? "#D9A05F" : "#EDD4A8";
  for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) {
    if (!g[r][c]) continue;
    x.fillStyle = r <= 3 || !(g[r - 1] || [])[c] ? light : body;
    x.fillRect(c, r, 1, 1);
  }
  // 꾸미기: 아이싱 눈 · 사탕 단추 · 웃는 입
  if (d.eyes) {
    x.fillStyle = "#FFF6E6"; x.fillRect(face.ex1, face.ey, 2, 2); x.fillRect(face.ex2, face.ey, 2, 2);
    x.fillStyle = "#3B2512"; x.fillRect(face.ex1 + 1, face.ey + 1, 1, 1); x.fillRect(face.ex2 + 1, face.ey + 1, 1, 1);
  }
  if (d.mouth) {
    x.fillStyle = "#FFF6E6";
    x.fillRect(face.mx, face.my + 1, 1, 1); x.fillRect(face.mx + 1, face.my + 2, 2, 1); x.fillRect(face.mx + 3, face.my + 1, 1, 1);
  }
  if (d.buttons) {
    x.fillStyle = "#F77C9A"; x.fillRect(face.b1[0], face.b1[1], 2, 2);
    x.fillStyle = "#7FD8BE"; x.fillRect(face.b2[0], face.b2[1], 2, 2);
  }
  x.fillStyle = OUTLINE;
  for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) {
    if (g[r][c]) continue;
    const near = (g[r - 1] || [])[c] || (g[r + 1] || [])[c] || g[r][c - 1] || g[r][c + 1];
    if (near) x.fillRect(c, r, 1, 1);
  }
  cookieCache[key] = cv;
  return cv;
}

// 큰 저울: 받침 + 반원 눈금판 + 바늘. 목표 칸은 초록 띠 + ✓, 넘친 칸은 회색 점선 (빨강 없음)
function drawBakeScale(x2, w, h, grams, target) {
  const choco = "#5B3A1E";
  const MAXN = BAKE_MAX_G / 10;
  const nOf = (gr) => Math.max(0, Math.min(MAXN, gr / 10));
  const ang = (n) => -Math.PI / 2 + (-Math.PI / 3 + (n / MAXN) * (2 * Math.PI / 3));
  const cx = w / 2;
  const baseH = Math.round(h * 0.16);
  const cy = h - baseH - 8;
  const R = Math.min(w / 2 - 12, cy - 10);
  x2.fillStyle = "#C9A47A"; x2.strokeStyle = choco; x2.lineWidth = 3;
  x2.beginPath(); x2.roundRect(cx - R * 0.8, h - baseH - 4, R * 1.6, baseH, 8); x2.fill(); x2.stroke();
  x2.fillStyle = "#FFF8EA";
  x2.beginPath(); x2.moveTo(cx - R, cy); x2.arc(cx, cy, R, Math.PI, 0); x2.closePath(); x2.fill(); x2.stroke();
  const tN = nOf(target);
  x2.strokeStyle = "#7CC47F"; x2.lineWidth = R * 0.22; // 목표 초록 띠
  x2.beginPath(); x2.arc(cx, cy, R * 0.8, ang(tN - 0.5), ang(tN + 0.5)); x2.stroke();
  if (tN + 0.5 < MAXN) { // 넘친 칸 회색 점선
    x2.strokeStyle = "#A8A29A"; x2.lineWidth = 4; x2.setLineDash([6, 6]);
    x2.beginPath(); x2.arc(cx, cy, R * 0.8, ang(tN + 0.5), ang(MAXN)); x2.stroke();
    x2.setLineDash([]);
  }
  x2.strokeStyle = choco; x2.lineWidth = 3;
  for (let n = 0; n <= MAXN; n++) { // 눈금
    const a = ang(n);
    x2.beginPath();
    x2.moveTo(cx + Math.cos(a) * R * 0.92, cy + Math.sin(a) * R * 0.92);
    x2.lineTo(cx + Math.cos(a) * R * (n === tN ? 0.66 : 0.76), cy + Math.sin(a) * R * (n === tN ? 0.66 : 0.76));
    x2.stroke();
  }
  const ta = ang(tN); // 목표 ✓
  x2.fillStyle = "#2F6B33"; x2.font = `900 ${Math.round(R * 0.24)}px sans-serif`;
  x2.textAlign = "center"; x2.textBaseline = "middle";
  x2.fillText("✓", cx + Math.cos(ta) * R * 0.5, cy + Math.sin(ta) * R * 0.5);
  const na = ang(nOf(grams)); // 바늘 + 축
  x2.strokeStyle = choco; x2.lineWidth = 5; x2.lineCap = "round";
  x2.beginPath(); x2.moveTo(cx, cy); x2.lineTo(cx + Math.cos(na) * R * 0.86, cy + Math.sin(na) * R * 0.86); x2.stroke();
  x2.lineCap = "butt";
  x2.fillStyle = "#F6C244";
  x2.beginPath(); x2.arc(cx, cy, 9, 0, Math.PI * 2); x2.fill(); x2.stroke();
}

// 오븐: 몸통 + 손잡이 + 창. 불빛은 투명도만 천천히 변한다 (빨강 없음)
function drawBakeOven(x2, w, h, rise, glow, drawCookieAt) {
  const choco = "#5B3A1E";
  const k = Math.max(0, Math.min(1, rise));
  x2.lineWidth = 4; x2.strokeStyle = choco;
  const bx = 40, by = 6, bw = w - 80, bh = h - 14;
  x2.fillStyle = "#E9D3B0";
  x2.beginPath(); x2.roundRect(bx, by, bw, bh, 18); x2.fill(); x2.stroke();
  const knobY = by + 20;
  x2.fillStyle = "#F6C244";
  for (const kx of [bx + 26, bx + 54]) { x2.beginPath(); x2.arc(kx, knobY, 9, 0, Math.PI * 2); x2.fill(); x2.stroke(); }
  x2.fillStyle = "#C9A47A";
  x2.beginPath(); x2.roundRect(bx + bw * 0.5, knobY - 6, bw * 0.4, 12, 6); x2.fill(); x2.stroke();
  const wx = bx + 20, wy = by + 40, ww = bw - 40, wh = bh - 56;
  x2.fillStyle = "#4A3426";
  x2.beginPath(); x2.roundRect(wx, wy, ww, wh, 12); x2.fill();
  x2.save();
  x2.globalAlpha = glow;
  x2.fillStyle = "#FFB347";
  x2.beginPath(); x2.roundRect(wx, wy, ww, wh, 12); x2.fill();
  x2.restore();
  const rackY = wy + wh - 12;
  x2.strokeStyle = "#A8A29A"; x2.lineWidth = 3;
  x2.beginPath(); x2.moveTo(wx + 8, rackY); x2.lineTo(wx + ww - 8, rackY); x2.stroke();
  const full = Math.min(ww * 0.6, wh * 0.95);
  const size = REDUCED ? full : full * (0.6 + 0.4 * k);
  if (drawCookieAt) drawCookieAt(wx + ww / 2 - size / 2, rackY - size * 0.96, size, REDUCED ? 0.3 + 0.7 * k : 1);
  x2.strokeStyle = choco; x2.lineWidth = 4;
  x2.beginPath(); x2.roundRect(wx, wy, ww, wh, 12); x2.stroke();
}

// 소금빵 (얼굴 없는 진짜 빵 모양, 26x26). salt: 소금 알갱이 0~3단계, baked: 노릇하게 구웠는지
const saltBreadCache = {};
function saltBreadSprite(salt, baked) {
  const key = salt + "_" + (baked ? 1 : 0);
  if (saltBreadCache[key]) return saltBreadCache[key];
  const N = 26;
  const cv = document.createElement("canvas");
  cv.width = N; cv.height = N;
  const x = cv.getContext("2d");
  const g = Array.from({ length: N }, () => new Array(N).fill(0));
  // 돌돌 말린 반달 모양: 가운데가 가장 높고 양 끝으로 갈수록 낮아진다
  for (let c = 2; c < 24; c++) {
    const t = (c - 13) / 11;                       // -1 ~ 1
    const top = Math.round(8 + t * t * 6);         // 가운데 8, 끝 14
    const bot = Math.round(19 - Math.abs(t) * 1);  // 바닥은 거의 평평
    for (let r = top; r <= bot; r++) g[r][c] = 1;
  }
  const body = baked ? "#C98A4A" : "#E9CD96";
  const light = baked ? "#E2A968" : "#F4DFB2";
  const dark = baked ? "#9C6230" : "#CFAE72";
  for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) {
    if (!g[r][c]) continue;
    const isTop = !(g[r - 1] || [])[c];
    x.fillStyle = isTop || r <= 10 ? light : body;
    x.fillRect(c, r, 1, 1);
  }
  // 말린 결 (비스듬한 줄 4개)
  x.fillStyle = dark;
  for (const c0 of [6, 10, 15, 19]) {
    for (let k = 0; k < 7; k++) {
      const c = c0 + Math.floor(k / 2), r = 10 + k;
      if (g[r] && g[r][c]) x.fillRect(c, r, 1, 1);
    }
  }
  // 바닥 그늘
  for (let c = 2; c < 24; c++) for (let r = N - 1; r >= 0; r--) {
    if (g[r][c]) { x.fillStyle = dark; x.fillRect(c, r, 1, 1); break; }
  }
  // 소금 알갱이 (단계마다 늘어난다)
  const grains = [[9, 9], [13, 8], [17, 9], [11, 11], [15, 10], [7, 12], [19, 12], [13, 12], [10, 10]];
  x.fillStyle = "#FFFFFF";
  grains.slice(0, salt * 3).forEach(([c, r]) => x.fillRect(c, r, 1, 1));
  x.fillStyle = OUTLINE;
  for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) {
    if (g[r][c]) continue;
    const near = (g[r - 1] || [])[c] || (g[r + 1] || [])[c] || g[r][c - 1] || g[r][c + 1];
    if (near) x.fillRect(c, r, 1, 1);
  }
  saltBreadCache[key] = cv;
  return cv;
}

// 소금빵 반죽 그릇: 밀가루·우유·달걀이 들어가고, 누를수록 매끈한 반죽이 된다
function drawSaltBowl(x2, w, h, knead) {
  // 그릇은 1.35배로 크게 (아래쪽 가운데를 기준으로 키운다)
  x2.save();
  x2.translate(w / 2, h - 6);
  x2.scale(1.35, 1.35);
  x2.translate(-w / 2, -(h - 6));
  drawSaltBowlInner(x2, w, h, knead);
  x2.restore();
  // 처음에는 들어가는 재료 그림과 이름을 위에 보여 준다 (움직이지 않는 그림)
  if (knead === 0) {
    const cx = w / 2;
    const icons = [["wheat", "밀가루"], ["milk", "우유"], ["egg", "달걀"]];
    icons.forEach(([id, label], i) => {
      const ix = cx - 110 + i * 110;
      x2.drawImage(itemSprite(id), ix - 24, 6, 48, 48);
      x2.fillStyle = "#5B3A1E";
      x2.font = "bold 20px 'Malgun Gothic', sans-serif";
      x2.textAlign = "center"; x2.textBaseline = "middle";
      x2.fillText(label, ix, 66);
      x2.fillStyle = "#C98A6B"; // 그릇으로 들어가는 화살표
      x2.beginPath(); x2.moveTo(ix - 8, 80); x2.lineTo(ix + 8, 80); x2.lineTo(ix, 92); x2.closePath(); x2.fill();
    });
  }
}
function drawSaltBowlInner(x2, w, h, knead) {
  const cx = w / 2, by = h - 46;
  // 그릇 안 내용물
  if (knead < 2) {
    x2.strokeStyle = OUTLINE; x2.lineWidth = 2;
    x2.fillStyle = "#EFE6D2"; // 밀가루 더미
    x2.beginPath(); x2.ellipse(cx - 30, by - 6, 36, 22, 0, Math.PI, 0); x2.closePath(); x2.fill(); x2.stroke();
    x2.fillStyle = "#FFFFFF"; // 밀가루 가루 반짝임
    x2.fillRect(cx - 44, by - 20, 3, 3); x2.fillRect(cx - 26, by - 24, 3, 3); x2.fillRect(cx - 18, by - 14, 3, 3);
    x2.fillStyle = "#DCEFF8"; // 우유 웅덩이 (옅은 하늘빛)
    x2.beginPath(); x2.ellipse(cx + 40, by - 8, 26, 9, 0, 0, Math.PI * 2); x2.fill(); x2.stroke();
    x2.fillStyle = "#FFFFFF"; // 깨뜨린 달걀 흰자
    x2.beginPath(); x2.ellipse(cx + 8, by - 14, 17, 11, 0, 0, Math.PI * 2); x2.fill(); x2.stroke();
    x2.fillStyle = "#F6C244"; // 노른자
    x2.beginPath(); x2.arc(cx + 8, by - 15, 7, 0, Math.PI * 2); x2.fill(); x2.stroke();
  } else if (knead < 4) {
    x2.fillStyle = "#E9D3A6"; // 몽글몽글 덩어리
    for (const [dx, dy, r2] of [[-24, -6, 16], [2, -12, 18], [26, -6, 15], [-8, 2, 14], [14, 2, 13]]) {
      x2.beginPath(); x2.arc(cx + dx, by + dy, r2, 0, Math.PI * 2); x2.fill();
    }
  } else {
    x2.fillStyle = "#EBD4A4"; // 매끈한 반죽
    x2.beginPath(); x2.ellipse(cx, by - 8, 44, 22, 0, 0, Math.PI * 2); x2.fill();
    x2.strokeStyle = OUTLINE; x2.lineWidth = 3;
    x2.beginPath(); x2.ellipse(cx, by - 8, 44, 22, 0, 0, Math.PI * 2); x2.stroke();
    x2.fillStyle = "#F6E4BE";
    x2.beginPath(); x2.ellipse(cx - 14, by - 18, 14, 6, -0.3, 0, Math.PI * 2); x2.fill();
  }
  // 그릇 (앞면)
  x2.fillStyle = "#9FC7E0";
  x2.beginPath(); x2.moveTo(cx - 80, by - 4); x2.lineTo(cx + 80, by - 4);
  x2.quadraticCurveTo(cx + 70, by + 40, cx, by + 40); x2.quadraticCurveTo(cx - 70, by + 40, cx - 80, by - 4);
  x2.fill();
  x2.strokeStyle = OUTLINE; x2.lineWidth = 3; x2.stroke();
  x2.fillStyle = "#C3E0EF"; x2.fillRect(cx - 80, by - 8, 160, 6);
  x2.strokeRect(cx - 80, by - 8, 160, 6);
}

// 버터 넣고 돌돌 말기 (roll: 0~3)
function drawSaltRoll(x2, w, h, roll) {
  const cx = w / 2, cy = h / 2 + 20;
  if (roll < 3) {
    // 반죽은 1.5배로 크게 (가운데 기준)
    x2.save();
    x2.translate(cx, cy); x2.scale(1.5, 1.5); x2.translate(-cx - 10, -cy + 6);
    drawSaltRollFlat(x2, cx, cy, roll);
    x2.restore();
  } else {
    x2.drawImage(saltBreadSprite(0, false), cx - 78, cy - 90, 156, 156); // 다 말린 소금빵 반죽
  }
}
function drawSaltRollFlat(x2, cx, cy, roll) {
  {
    // 납작한 세모 반죽: 말수록 짧아지고, 말린 부분이 굵어진다
    const len = 150 - roll * 40;
    x2.fillStyle = "#EBD4A4";
    x2.beginPath(); x2.moveTo(cx - 80, cy - 34); x2.lineTo(cx - 80, cy + 34); x2.lineTo(cx - 80 + len, cy); x2.closePath(); x2.fill();
    x2.strokeStyle = OUTLINE; x2.lineWidth = 3; x2.stroke();
    if (roll > 0) { // 말린 부분
      const rr = 14 + roll * 6;
      x2.fillStyle = "#E3C48E";
      x2.beginPath(); x2.ellipse(cx - 80, cy, rr * 0.7, 34 + roll * 2, 0, 0, Math.PI * 2); x2.fill();
      x2.stroke();
      x2.strokeStyle = "#B8935A"; x2.lineWidth = 2;
      for (let k = 1; k <= roll; k++) {
        x2.beginPath(); x2.ellipse(cx - 80, cy, rr * 0.7 - k * 5, 30 - k * 4, 0, 0, Math.PI * 2); x2.stroke();
      }
    }
    if (roll === 0) { // 버터 막대
      x2.fillStyle = "#F6D44C"; x2.fillRect(cx - 74, cy - 8, 30, 16);
      x2.fillStyle = "#FBE88A"; x2.fillRect(cx - 74, cy - 8, 30, 4);
      x2.strokeStyle = OUTLINE; x2.lineWidth = 2; x2.strokeRect(cx - 74, cy - 8, 30, 16);
    }
  }
}


/* ============================================================
   머랭 케이크 — 1층 머랭 받침, 2층 크림, 3층 토핑을 쌓아요
   - 도감에 있는 재료로만 만들고, 구워도 도감 재료는 없어지지 않아요.
   - 실패와 시간 제한이 없어요. 내가 쌓은 모습 그대로 선반에 남아요.
   ============================================================ */
const MERINGUE_INGS = [      // 머랭 계량 재료
  { name: "설탕",    josa: "을" },
  { name: "달걀흰자", josa: "를" },
];
const MERINGUE_NEEDS = [     // 1층 머랭에 필요한 도감 재료
  { id: "egg",   name: "달걀", ga: "이", hint: "닭에게 가 봐요" },
  { id: "sugar", name: "설탕", ga: "이", hint: "땅의 반짝이를 주워 봐요" },
];
// 2층 크림 4가지 (도감 재료로만)
const CREAMS = [
  { id: "fresh",  name: "생크림",   needs: ["milk"],               c: "#FFF6E2", hi: "#FFFFFF", sh: "#E6D6B4" },
  { id: "choco",  name: "초코 크림", needs: ["chocolate"],          c: "#9A6238", hi: "#B57A4C", sh: "#6E4326" },
  { id: "butter", name: "버터크림",  needs: ["butter"],             c: "#F8E6A0", hi: "#FFF4C8", sh: "#DEC46E" },
  { id: "berry",  name: "딸기 크림", needs: ["milk", "strawberry"], c: "#F9C6D2", hi: "#FFE2E9", sh: "#E39FB2" },
];
// 3층 토핑 9가지 (3×3 칸 순서). 바다 재료(소금·해초·조개·미역·멸치)는 올리지 않아요
const TOPPINGS = ["strawberry", "blueberry", "cherry", "apple", "banana", "coconut", "walnut", "almond", "honey"];
const TOPPING_MAX = 3;

// 받침 글자: 마지막 글자에 받침이 있으면 앞 글자, 없으면 뒤 글자
function josaOf(word, withB, withoutB) {
  const ch = word.charCodeAt(word.length - 1);
  if (ch < 0xAC00 || ch > 0xD7A3) return word + withoutB;
  return word + ((ch - 0xAC00) % 28 ? withB : withoutB);
}
// 재료를 어디서 얻는지
function itemHint(id) {
  if (id === "milk") return "젖소에게 가 봐요";
  if (id === "egg") return "닭에게 가 봐요";
  const it = ITEMS.find((v) => v.id === id);
  if (!it) return "마을을 둘러봐요";
  if (it.from === "tree") return "나무를 흔들어 봐요";
  if (it.from === "sea") return "바다에서 낚시해 봐요";
  return "땅의 반짝이를 주워 봐요";
}
const itemName = (id) => (ITEMS.find((v) => v.id === id) || { name: id }).name;

/* 머랭 케이크 그림 (26칸 도트 기준, S배로 그린다)
   o: { base, baked, cream, tops, creamDy, topDy:{id:dy} }  dy는 칸 단위 (위에서 내려앉는 움직임) */
function drawMeringue(x2, ox, oy, S, o) {
  const shapes = [];   // [c, r, w, h, color, dy]
  const outlines = []; // [c, r, w, h, dy]
  const add = (c, r, w, h, col, dy) => shapes.push([c, r, w, h, col, dy || 0]);
  const line = (c, r, w, h, dy) => outlines.push([c - 1, r - 1, w + 2, h + 2, dy || 0]);
  const flush = () => {
    x2.fillStyle = OUTLINE;
    for (const [c, r, w, h, dy] of outlines) x2.fillRect(ox + c * S, oy + (r + dy) * S, w * S, h * S);
    for (const [c, r, w, h, col, dy] of shapes) { x2.fillStyle = col; x2.fillRect(ox + c * S, oy + (r + dy) * S, w * S, h * S); }
    shapes.length = 0; outlines.length = 0;
  };
  // 접시
  if (o.base) {
    line(1, 24, 24, 1); add(1, 24, 24, 1, "#E4DCCF"); flush();
  }
  // 1층: 짤주머니로 짠 무늬가 있는 머랭 받침
  if (o.base) {
    const body = o.baked ? "#FFF7E8" : "#FFFFFF";
    const tip = o.baked ? "#F1D7A6" : "#F4F1EC";
    const ridge = o.baked ? "#EBD9BA" : "#E5E0D8";
    line(3, 18, 20, 6);
    for (const c0 of [3, 7, 11, 15, 19]) { line(c0, 17, 4, 1); line(c0 + 1, 16, 2, 1); }
    add(3, 18, 20, 6, body);
    for (const c0 of [3, 7, 11, 15, 19]) { add(c0, 17, 4, 1, body); add(c0 + 1, 16, 2, 1, tip); }
    for (const c of [5, 9, 13, 17, 21]) add(c, 19, 1, 4, ridge); // 짠 결
    add(3, 23, 20, 1, ridge);                                    // 바닥 그늘
    flush();
  }
  // 2층: 크림 (위에 살짝 뿔, 옆으로 흘러내린 방울)
  const cr = CREAMS.find((v) => v.id === o.cream);
  if (cr) {
    const dy = o.creamDy || 0;
    line(5, 10, 16, 6, dy); line(11, 8, 4, 2, dy); line(12, 7, 2, 1, dy);
    for (const [c, h] of [[7, 2], [11, 1], [15, 2], [19, 1]]) line(c, 16, 1, h, dy);
    add(5, 10, 16, 6, cr.c, dy); add(11, 8, 4, 2, cr.c, dy); add(12, 7, 2, 1, cr.hi, dy);
    for (const [c, h] of [[7, 2], [11, 1], [15, 2], [19, 1]]) { add(c, 16, 1, h, cr.c, dy); add(c, 15 + h, 1, 1, cr.sh, dy); }
    add(6, 10, 5, 1, cr.hi, dy);   // 윗면 반짝임
    add(5, 15, 16, 1, cr.sh, dy);  // 아래 그늘
    flush();
  }
  // 3층: 토핑 (최대 3개, 도감 그림 그대로)
  const tops = (o.tops || []).slice(0, TOPPING_MAX);
  const xs = tops.length === 1 ? [13] : tops.length === 2 ? [9, 17] : [8, 13, 18];
  const topR = cr ? 3 : (o.base ? 9 : 12);
  tops.forEach((id, i) => {
    const r = topR - (tops.length === 3 && i === 1 ? 1 : 0);
    const dy = (o.topDy && o.topDy[id]) || 0;
    x2.drawImage(itemSprite(id), ox + (xs[i] - 4) * S, oy + (r + dy) * S, 8 * S, 8 * S);
  });
}

// 작은 그림 (26x26): 선반·버튼·층 표시용
const meringueCache = {};
function meringueSprite(cream, tops, opt) {
  const o = opt || {};
  const key = [cream || "-", (tops || []).join("+"), o.noBase ? 0 : 1, o.raw ? 0 : 1].join("_");
  if (meringueCache[key]) return meringueCache[key];
  const cv = document.createElement("canvas");
  cv.width = 26; cv.height = 26;
  const x = cv.getContext("2d");
  x.imageSmoothingEnabled = false;
  drawMeringue(x, 0, o.noBase ? 6 : 0, 1, { base: !o.noBase, baked: !o.raw, cream, tops });
  meringueCache[key] = cv;
  return cv;
}

// 거품 내기 그릇: 투명한 흰자 → 하얀 거품 → 뿔이 선 머랭 (n: 0~5)
function drawWhiskBowl(x2, w, h, n, wobble) {
  x2.save();
  x2.translate(w / 2, h - 6); x2.scale(1.3, 1.3); x2.translate(-w / 2, -(h - 6));
  const cx = w / 2, by = h - 46;
  x2.strokeStyle = OUTLINE; x2.lineWidth = 2;
  if (n < 2) { // 투명한 흰자 + 설탕 알갱이
    x2.fillStyle = "rgba(226, 238, 242, 0.95)";
    x2.beginPath(); x2.ellipse(cx, by - 8, 56, 14, 0, 0, Math.PI * 2); x2.fill(); x2.stroke();
    x2.fillStyle = "#FFFFFF";
    x2.beginPath(); x2.ellipse(cx - 22, by - 12, 14, 4, -0.2, 0, Math.PI * 2); x2.fill();
    for (const [dx, dy] of [[8, -10], [18, -6], [28, -11], [-6, -5], [36, -7]]) x2.fillRect(cx + dx, by + dy, 3, 3);
  } else if (n < 4) { // 하얀 거품 (방울 방울)
    x2.fillStyle = "#FFFFFF"; x2.strokeStyle = "#D9D2C5";
    for (const [dx, dy, r2] of [[-38, -8, 12], [-18, -14, 15], [6, -16, 16], [30, -12, 14], [46, -6, 10], [-48, -4, 9], [-4, -4, 12], [20, -4, 11]]) {
      x2.beginPath(); x2.arc(cx + dx, by + dy, r2, 0, Math.PI * 2); x2.fill(); x2.stroke();
    }
  } else { // 단단한 머랭: 하얀 언덕 (+5번이면 뿔이 선다)
    x2.fillStyle = "#FFFFFF"; x2.strokeStyle = OUTLINE; x2.lineWidth = 2;
    x2.beginPath(); x2.ellipse(cx, by - 8, 62, 26, 0, Math.PI, 0); x2.closePath(); x2.fill(); x2.stroke();
    if (n >= 5) {
      for (const [dx, hh] of [[-30, 26], [0, 38], [28, 28]]) {
        x2.beginPath();
        x2.moveTo(cx + dx - 14, by - 22); x2.lineTo(cx + dx, by - 22 - hh); x2.lineTo(cx + dx + 4, by - 22 - hh + 6); // 끝이 살짝 휜 뿔
        x2.lineTo(cx + dx + 14, by - 22); x2.closePath(); x2.fill(); x2.stroke();
      }
    }
    x2.fillStyle = "#F4F1EC";
    x2.beginPath(); x2.ellipse(cx - 24, by - 18, 14, 5, -0.3, 0, Math.PI * 2); x2.fill();
  }
  // 거품기: 그릇 안에 비스듬히 꽂혀 있다 (철사 아랫부분은 그릇 앞면에 가려져 내용물에 담긴 것처럼 보인다)
  // 누를 때 살짝 흔들린다. 동작 줄이기면 가만히
  x2.save();
  x2.translate(cx + 30, by + 8);
  x2.rotate(0.55 + wobble);
  x2.strokeStyle = OUTLINE; x2.lineWidth = 3;
  x2.fillStyle = "#C98A6B";
  x2.beginPath(); x2.roundRect(-5, -86, 10, 34, 4); x2.fill(); x2.stroke(); // 손잡이
  x2.strokeStyle = "#8E98A3"; x2.lineWidth = 3;
  for (const k of [-10, -4, 4, 10]) {
    x2.beginPath(); x2.moveTo(0, -52); x2.quadraticCurveTo(k * 1.6, -22, 0, 0); x2.stroke();
  }
  x2.restore();
  // 그릇 (앞면)
  x2.fillStyle = "#9FC7E0";
  x2.beginPath(); x2.moveTo(cx - 80, by - 4); x2.lineTo(cx + 80, by - 4);
  x2.quadraticCurveTo(cx + 70, by + 40, cx, by + 40); x2.quadraticCurveTo(cx - 70, by + 40, cx - 80, by - 4);
  x2.fill();
  x2.strokeStyle = OUTLINE; x2.lineWidth = 3; x2.stroke();
  x2.fillStyle = "#C3E0EF"; x2.fillRect(cx - 80, by - 8, 160, 6);
  x2.strokeRect(cx - 80, by - 8, 160, 6);
  x2.restore();
  // 처음에는 들어가는 재료를 위에 보여 준다 (움직이지 않는 그림)
  if (n === 0) {
    [["sugar", "설탕"], ["egg", "흰자"]].forEach(([id, label], i) => {
      const ix = cx - 60 + i * 120;
      x2.drawImage(itemSprite(id), ix - 24, 6, 48, 48);
      x2.fillStyle = "#5B3A1E";
      x2.font = "bold 20px 'Malgun Gothic', sans-serif";
      x2.textAlign = "center"; x2.textBaseline = "middle";
      x2.fillText(label, ix, 66);
      x2.fillStyle = "#C98A6B";
      x2.beginPath(); x2.moveTo(ix - 8, 80); x2.lineTo(ix + 8, 80); x2.lineTo(ix, 92); x2.closePath(); x2.fill();
    });
  }
}

// "1층 → 2층 → 3층" 지금 어디인지 (그림 + 글자). 지금 층은 노란 테두리, 끝난 층은 초록 ✓
function renderTiers(s) {
  const el = $("bakeTiers");
  const map = { weigh: 1, weighDone: 1, whisk: 1, oven: 1, tier1: 2, cream: 2, topping: 3, done: 4 };
  const cur = s && s.kind === "meringue" ? map[s.step] : 0;
  if (!cur) { el.classList.add("hidden"); el.innerHTML = ""; return; }
  el.classList.remove("hidden");
  el.innerHTML = "";
  const icons = [meringueSprite(null, []), meringueSprite("fresh", []), meringueSprite("fresh", ["strawberry"])];
  for (let i = 1; i <= 3; i++) {
    if (i > 1) {
      const ar = document.createElement("span");
      ar.className = "tier-arrow"; ar.textContent = "→";
      el.appendChild(ar);
    }
    const chip = document.createElement("span");
    chip.className = "tier-chip" + (i < cur ? " ok" : i === cur ? " cur" : "");
    const cv = document.createElement("canvas");
    cv.width = 26; cv.height = 26;
    const cx = cv.getContext("2d");
    cx.imageSmoothingEnabled = false;
    cx.drawImage(icons[i - 1], 0, 0);
    const t = document.createElement("b");
    t.textContent = (i < cur ? "✓" : "") + i + "층";
    chip.append(cv, t);
    el.appendChild(chip);
  }
}

// 도감 재료 확인 칸 (모은 재료는 초록 ✓, 없는 재료는 회색 그림자)
function bakeNeedsRow(list) {
  const row = document.createElement("div");
  row.className = "bake-needs";
  for (const n of list) {
    const got = me.items.has(n.id);
    const cell = document.createElement("div");
    cell.className = "bake-need" + (got ? " got" : "");
    cell.appendChild(itemCanvas(n.id, !got));
    const label = document.createElement("span");
    label.textContent = (got ? "✓ " : "") + n.name;
    cell.appendChild(label);
    row.appendChild(cell);
  }
  return row;
}
function itemCanvas(id, shadow) {
  const cv = document.createElement("canvas");
  cv.width = 16; cv.height = 16;
  const x = cv.getContext("2d");
  x.imageSmoothingEnabled = false;
  x.drawImage(itemSprite(id), 0, 0);
  if (shadow) { // 회색 그림자
    x.globalCompositeOperation = "source-atop";
    x.fillStyle = "rgba(150,142,130,0.9)";
    x.fillRect(0, 0, 16, 16);
  }
  return cv;
}

// 머랭 케이크 단계별 화면 (bakeRender에서 부른다). 처리했으면 true
function meringueRender(s, startWeigh) {
  const back = { text: "처음으로", click: () => { s.step = "start"; bakeRender(); } };
  if (s.step === "mCheck") {
    const missing = MERINGUE_NEEDS.filter((n) => !me.items.has(n.id));
    if (!missing.length) {
      bakeUI("재료가 다 있어요! 머랭 케이크를 만들어 봐요.", "", [
        { text: "만들기 시작", primary: true, click: startWeigh }, back,
      ]);
    } else {
      const m = missing[0];
      bakeUI(`${m.name}${m.ga} 필요해요. ${m.hint}.`, "", [
        { text: "마을로 가기", primary: true, click: () => $("bake").classList.add("hidden") }, back,
      ]);
    }
    $("bakeInfo").appendChild(bakeNeedsRow(MERINGUE_NEEDS));
    return true;
  }
  if (s.step === "whisk") {
    const dots = Array.from({ length: 5 }, (_, i) => `<span class="bake-dot${i < s.whisk ? " full" : ""}"></span>`).join("");
    let msg = "그릇에 설탕과 흰자를 넣었어요. 휙휙 젓기를 5번 눌러요.";
    if (s.whisk >= 5) msg = "뿔이 섰어요! 단단한 머랭이 됐어요.";
    else if (s.whisk >= 4) msg = "거품이 단단해지고 있어요. 한 번 더 저어요.";
    else if (s.whisk >= 2) msg = "하얀 거품이 생겼어요. 계속 저어요.";
    else if (s.whisk >= 1) msg = "아직 투명해요. 계속 저어요.";
    bakeUI(msg, `<div class="bake-dots">${dots}</div>`, s.whisk >= 5 ? [] : [{
      text: "휙휙 젓기", primary: true,
      click: () => {
        s.whisk++;
        s.whiskAt = performance.now();
        playTone("gather");
        bakeRender();
        if (s.whisk >= 5) setTimeout(() => { if (bake === s) { s.step = "oven"; s.ovenT0 = performance.now(); bakeRender(); } }, 1200);
      },
    }]);
    return true;
  }
  if (s.step === "tier1") {
    bakeUI("1층이 완성됐어요! 이제 2층에 크림을 올려요.", "", [
      { text: "2층으로", primary: true, click: () => { s.step = "cream"; s.note = ""; bakeRender(); } },
    ]);
    return true;
  }
  if (s.step === "cream") {
    const cur = CREAMS.find((c) => c.id === s.cream);
    const btns = CREAMS.map((cr) => {
      const miss = cr.needs.find((id) => !me.items.has(id));
      return {
        text: cr.name, sprite: meringueSprite(cr.id, [], { noBase: true }), on: s.cream === cr.id, off: !!miss,
        click: () => {
          if (miss) { // 아직 못 만드는 크림: 무엇이 필요한지 알려 준다
            s.note = `${josaOf(cr.name, "을", "를")} 만들려면 ${josaOf(itemName(miss), "이", "가")} 필요해요. ${itemHint(miss)}.`;
          } else if (s.cream === cr.id) {
            s.cream = null; s.note = "";
          } else {
            s.cream = cr.id; s.creamAt = performance.now(); s.note = ""; playTone("gather");
          }
          bakeRender();
        },
      };
    });
    btns.push({ text: cur ? "3층으로" : "크림 없이 다음으로", primary: true, wide: true,
      click: () => { s.step = "topping"; s.note = ""; bakeRender(); } });
    bakeUI(s.note || (cur ? `${josaOf(cur.name, "을", "를")} 올렸어요! 다시 누르면 내려와요.` : "2층에 올릴 크림을 골라요."), "", btns, "grid2");
    return true;
  }
  if (s.step === "topping") {
    const n = s.tops.length;
    bakeUI(s.note || (n ? "누르면 올라가고, 다시 누르면 내려와요." : "토핑을 3개까지 골라 올려요."), "", [
      { text: "다 됐어요", primary: true, click: () => { s.step = "done"; bakeFinish(); bakeRender(); } },
    ]);
    const info = $("bakeInfo");
    const count = document.createElement("div");
    count.className = "top-count";
    count.textContent = `올린 토핑 ${n} / ${TOPPING_MAX}`;
    info.appendChild(count);
    const grid = document.createElement("div");
    grid.className = "top-grid";
    for (const id of TOPPINGS) {
      const got = me.items.has(id);
      const on = s.tops.includes(id);
      const tile = document.createElement("button");
      tile.className = "top-tile" + (on ? " on" : "") + (got ? "" : " off");
      tile.appendChild(itemCanvas(id, !got));
      const nm = document.createElement("span");
      nm.textContent = (on ? "✓" : "") + itemName(id);
      tile.appendChild(nm);
      tile.setAttribute("aria-label", itemName(id) + (on ? " 올렸어요" : got ? "" : " 아직 없어요"));
      tile.addEventListener("click", () => {
        if (!got) s.note = `${josaOf(itemName(id), "은", "는")} 아직 없어요. ${itemHint(id)}.`;
        else if (on) { s.tops = s.tops.filter((v) => v !== id); s.note = ""; }
        else if (s.tops.length >= TOPPING_MAX) s.note = "토핑은 3개까지 올릴 수 있어요. 하나를 내려 봐요.";
        else { s.tops.push(id); s.topAt[id] = performance.now(); s.note = ""; playTone("gather"); }
        bakeRender();
      });
      grid.appendChild(tile);
    }
    info.appendChild(grid);
    return true;
  }
  return false;
}

// 머랭 케이크 그림 (매 프레임). 처리했으면 true
function meringueTick(s, x2, w, h, now) {
  const drop = (at) => { // 위에서 내려앉기 (0.3초). 동작 줄이기면 바로
    if (REDUCED || !at) return 0;
    const t = Math.min(1, (now - at) / 300);
    return -(1 - t) * (1 - t) * 6;
  };
  if (s.step === "mCheck") {
    drawMeringue(x2, w / 2 - 91, h - 25 * 7, 7, { base: true, baked: true, cream: "fresh", tops: ["strawberry", "blueberry", "cherry"] });
    return true;
  }
  if (s.step === "whisk") {
    const wob = REDUCED || !s.whiskAt ? 0 : Math.sin(Math.min(1, (now - s.whiskAt) / 300) * Math.PI * 3) * 0.25 * (1 - Math.min(1, (now - s.whiskAt) / 300));
    drawWhiskBowl(x2, w, h, s.whisk, wob);
    return true;
  }
  if (s.step === "oven") {
    const k = Math.min(1, (now - s.ovenT0) / BAKE_OVEN_MS);
    const glow = REDUCED ? 0.4 : 0.25 + 0.35 * (0.5 + 0.5 * Math.sin((2 * Math.PI * now) / 1200));
    drawBakeOven(x2, w, h, k, glow, (ox, oy, size, alpha) => {
      x2.save(); x2.globalAlpha = alpha;
      drawMeringue(x2, ox, oy, size / 26, { base: true, baked: k > 0.55 });
      x2.restore();
    });
    const timer = $("bakeTimer");
    if (timer) timer.textContent = `${Math.max(0, Math.ceil((BAKE_OVEN_MS - (now - s.ovenT0)) / 1000))}초`;
    if (k >= 1) { s.step = "tier1"; playTone("gather"); bakeRender(); }
    return true;
  }
  if (["tier1", "cream", "topping", "done"].includes(s.step)) {
    const S = 8;
    const topDy = {};
    for (const id of s.tops) topDy[id] = drop(s.topAt[id]);
    drawMeringue(x2, w / 2 - 13 * S, h - 26 * S + 4, S, {
      base: true, baked: true,
      cream: s.step === "tier1" ? null : s.cream, creamDy: drop(s.creamAt),
      tops: s.step === "tier1" || s.step === "cream" ? [] : s.tops, topDy,
    });
    if (s.step === "done") { // 축하 반짝이 (움직이지 않는 별)
      x2.fillStyle = "#F6C244";
      for (const [dx, dy] of [[-130, -60], [130, -48], [-118, 40], [122, 50]]) {
        x2.save(); x2.translate(w / 2 + dx, h / 2 + dy);
        x2.fillRect(-2, -8, 4, 16); x2.fillRect(-8, -2, 16, 4);
        x2.restore();
      }
    }
    return true;
  }
  return false;
}

// 체험 창 UI: 안내 문구 + 버튼 줄 (버튼은 크게)
// layout: 버튼 줄 배치 ("grid2" = 두 칸씩). b.off: 아직 못 쓰는 버튼(회색 그림자, 누르면 안내), b.wide: 한 줄 전체
function bakeUI(msg, infoHTML, btns, layout) {
  $("bakeMsg").textContent = msg;
  $("bakeInfo").innerHTML = infoHTML || "";
  const bb = $("bakeBtns");
  bb.innerHTML = "";
  bb.className = "bake-btns" + (layout ? " " + layout : "");
  for (const b of btns || []) {
    const el = document.createElement("button");
    el.className = "bake-btn" + (b.primary ? " primary" : "") + (b.on ? " on" : "") + (b.off ? " off" : "") + (b.wide ? " wide" : "");
    if (b.sprite) {
      const mini = document.createElement("canvas");
      mini.width = 26; mini.height = 26;
      mini.className = "bake-mini";
      const mx = mini.getContext("2d");
      mx.imageSmoothingEnabled = false;
      mx.drawImage(b.sprite, 0, 0);
      if (b.off) { // 회색 그림자
        mx.globalCompositeOperation = "source-atop";
        mx.fillStyle = "rgba(150,142,130,0.9)";
        mx.fillRect(0, 0, 26, 26);
      }
      el.appendChild(mini);
    }
    const span = document.createElement("span");
    span.textContent = (b.on ? "✓ " : "") + b.text;
    el.appendChild(span);
    el.addEventListener("click", b.click);
    bb.appendChild(el);
  }
}

function openBake() {
  bake = {
    step: "start", kind: "ginger", recipe: makeBakeRecipe(BAKE_INGS), ingIdx: 0, grams: 0, needle: 0, touched: false, knead: 0,
    shape: null, decor: { eyes: false, buttons: false, mouth: false }, ovenT0: 0, saved: false,
    roll: 0, salt: 0,
    whisk: 0, whiskAt: 0, cream: null, creamAt: 0, tops: [], topAt: {}, note: "", // 머랭 케이크
  };
  $("bake").classList.remove("hidden");
  bakeRender();
  const loop = () => {
    if ($("bake").classList.contains("hidden")) { bake = null; return; }
    bakeTick(performance.now());
    requestAnimationFrame(loop);
  };
  requestAnimationFrame(loop);
}

function bakeRender() {
  if (!bake) return;
  const s = bake;
  const startWeigh = () => { s.step = "weigh"; s.ingIdx = 0; s.grams = s.recipe[0].start; s.needle = 0; s.touched = false; bakeRender(); };
  renderTiers(s); // 머랭 케이크: 1층 → 2층 → 3층 표시
  const card = $("bake").querySelector(".bake-card");
  if (card) card.classList.toggle("topping", s.kind === "meringue" && s.step === "topping");
  if (card) card.classList.toggle("shelf", s.step === "shelf"); // 선반 화면에서는 진열장만 크게
  if (s.kind === "meringue" && meringueRender(s, startWeigh)) return;
  if (s.step === "start") {
    bakeUI("무엇을 구울까요?", "", [
      { text: "진저브레드 쿠키", sprite: cookieSprite("man", { eyes: true, buttons: true, mouth: true }, true),
        click: () => { s.kind = "ginger"; s.recipe = makeBakeRecipe(BAKE_INGS); startWeigh(); } },
      { text: "소금빵", sprite: saltBreadSprite(3, true),
        click: () => { s.kind = "salt"; s.recipe = makeBakeRecipe(SALT_INGS); s.step = "saltCheck"; bakeRender(); } },
      { text: "머랭 케이크", sprite: meringueSprite("fresh", ["strawberry", "blueberry", "cherry"]),
        click: () => {
          s.kind = "meringue"; s.recipe = makeBakeRecipe(MERINGUE_INGS); s.step = "mCheck";
          s.whisk = 0; s.cream = null; s.tops = []; s.topAt = {}; s.note = ""; bakeRender();
        } },
      { text: "내 선반", click: () => { s.step = "shelf"; bakeRender(); } },
    ]);
  } else if (s.step === "saltCheck") {
    const missing = SALT_NEEDS.filter((n) => !me.items.has(n.id));
    if (!missing.length) {
      bakeUI("재료가 다 있어요! 소금빵을 구워 봐요.", "", [
        { text: "굽기 시작", primary: true, click: startWeigh },
        { text: "처음으로", click: () => { s.step = "start"; bakeRender(); } },
      ]);
    } else {
      const m = missing[0];
      bakeUI(`${m.name}${m.ga} 필요해요. ${m.hint}.`, "", [
        { text: "마을로 가기", primary: true, click: () => $("bake").classList.add("hidden") },
        { text: "처음으로", click: () => { s.step = "start"; bakeRender(); } },
      ]);
    }
    // 재료 다섯 칸: 모은 재료는 초록 ✓, 없는 재료는 회색 그림자
    const info = $("bakeInfo");
    info.innerHTML = "";
    const row = document.createElement("div");
    row.className = "bake-needs";
    for (const n of SALT_NEEDS) {
      const got = me.items.has(n.id);
      const cell = document.createElement("div");
      cell.className = "bake-need" + (got ? " got" : "");
      const cv2 = document.createElement("canvas");
      cv2.width = 16; cv2.height = 16;
      const cx2 = cv2.getContext("2d");
      cx2.imageSmoothingEnabled = false;
      cx2.drawImage(itemSprite(n.id), 0, 0);
      if (!got) { // 회색 그림자
        cx2.globalCompositeOperation = "source-atop";
        cx2.fillStyle = "rgba(150,142,130,0.9)";
        cx2.fillRect(0, 0, 16, 16);
      }
      cell.appendChild(cv2);
      const label = document.createElement("span");
      label.textContent = (got ? "✓ " : "") + n.name;
      cell.appendChild(label);
      row.appendChild(cell);
    }
    info.appendChild(row);
  } else if (s.step === "weigh") {
    const ing = s.recipe[s.ingIdx];
    const add = (n) => () => { s.touched = true; s.grams = Math.min(BAKE_MAX_G, s.grams + n); afterWeighChange(); };
    const sub = () => { s.touched = true; s.grams = Math.max(0, s.grams - 10); afterWeighChange(); };
    let msg = `${ing.name}${ing.josa} ${ing.target}g 맞춰요.`;
    if (!s.touched && s.grams > ing.target) msg = `${s.grams}g이 담겨 있어요. ${ing.target}g으로 맞춰요.`;
    else if (s.grams > ing.target) msg = "조금 넘쳤어요. 덜기를 눌러요.";
    // 소금빵: 도감의 "밀"이 계량에서는 "밀가루"가 된 이유를 한 줄로 이어 준다
    if (s.kind === "salt" && s.ingIdx === 0 && !s.touched) msg = "밀을 곱게 갈아서 밀가루를 만들었어요. " + msg;
    // 머랭 케이크: 도감의 "달걀"에서 흰자만 쓴다는 것을 한 줄로 이어 준다
    if (s.kind === "meringue" && s.ingIdx === 1 && !s.touched) msg = "달걀에서 흰자만 따로 담았어요. " + msg;
    bakeUI(msg,
      `<div class="bake-g">재료 ${s.ingIdx + 1} / ${s.recipe.length} · ${ing.name}<br><b>${s.grams}g</b> <span>/ ${ing.target}g</span></div>`,
      [
        { text: "+10g", click: add(10) },
        { text: "+20g", click: add(20) },
        { text: "덜기 −10g", click: sub },
      ]);
  } else if (s.step === "weighDone") {
    bakeUI("딱 맞아요!", `<div class="bake-g"><b>${s.recipe[s.ingIdx].target}g</b></div>`, []);
  } else if (s.step === "knead") {
    const dots = Array.from({ length: 5 }, (_, i) => `<span class="bake-dot${i < s.knead ? " full" : ""}"></span>`).join("");
    let kneadMsg = "꾹꾹 반죽하기를 5번 눌러요.";
    if (s.kind === "salt" && s.knead === 0) kneadMsg = "그릇에 밀가루, 우유, 달걀을 넣었어요. 꾹꾹 반죽하기를 5번 눌러요.";
    bakeUI(s.knead >= 5 ? "매끈한 반죽이 됐어요!" : kneadMsg,
      `<div class="bake-dots">${dots}</div>`,
      s.knead >= 5 ? [] : [{
        text: "꾹꾹 반죽하기", primary: true,
        click: () => {
          s.knead++;
          playTone("gather");
          bakeRender();
          const next = s.kind === "salt" ? "roll" : "shape";
          if (s.knead >= 5) setTimeout(() => { if (bake === s) { s.step = next; bakeRender(); } }, 1100);
        },
      }]);
  } else if (s.step === "roll") { // 소금빵: 버터 넣고 돌돌 말기
    const dots = Array.from({ length: 3 }, (_, i) => `<span class="bake-dot${i < s.roll ? " full" : ""}"></span>`).join("");
    bakeUI(s.roll >= 3 ? "예쁘게 말았어요!" : "반죽에 버터를 올렸어요. 돌돌 말기를 3번 눌러요.",
      `<div class="bake-dots">${dots}</div>`,
      s.roll >= 3 ? [] : [{
        text: "돌돌 말기", primary: true,
        click: () => {
          s.roll++;
          playTone("gather");
          bakeRender();
          if (s.roll >= 3) setTimeout(() => { if (bake === s) { s.step = "oven"; s.ovenT0 = performance.now(); bakeRender(); } }, 1100);
        },
      }]);
  } else if (s.step === "sprinkle") { // 소금빵: 소금 뿌리기
    const btns = [];
    if (s.salt < 3) btns.push({ text: "솔솔 뿌리기", primary: true, click: () => { s.salt++; playTone("gather"); bakeRender(); } });
    else btns.push({ text: "다 됐어요", primary: true, click: () => { s.step = "done"; bakeFinish(); bakeRender(); } });
    bakeUI(s.salt >= 3 ? "소금을 골고루 뿌렸어요!" : "솔솔 뿌리기를 눌러서 소금을 뿌려요.", "", btns);
  } else if (s.step === "shape") {
    const pick = (shape) => () => { s.shape = shape; s.step = "oven"; s.ovenT0 = performance.now(); bakeRender(); };
    bakeUI("쿠키 모양을 골라요.", "", [
      { text: "사람", sprite: cookieSprite("man", {}, false), click: pick("man") },
      { text: "트리", sprite: cookieSprite("tree", {}, false), click: pick("tree") },
    ]);
  } else if (s.step === "oven") {
    bakeUI("오븐에서 굽고 있어요.", `<div class="bake-g" id="bakeTimer">5초</div>`, []);
  } else if (s.step === "decor") {
    const tog = (k2) => () => { s.decor[k2] = !s.decor[k2]; bakeRender(); };
    bakeUI("쿠키를 예쁘게 꾸며요. 누르면 붙고, 또 누르면 떼져요.", "", [
      { text: "눈", on: s.decor.eyes, click: tog("eyes") },
      { text: "단추", on: s.decor.buttons, click: tog("buttons") },
      { text: "웃는 입", on: s.decor.mouth, click: tog("mouth") },
      { text: "다 됐어요", primary: true, click: () => { s.step = "done"; bakeFinish(); bakeRender(); } },
    ]);
  } else if (s.step === "done") {
    bakeUI(s.kind === "salt" ? "고소한 소금빵이 완성됐어요! 정말 잘했어요."
      : s.kind === "meringue" ? "층층이 머랭 케이크가 완성됐어요! 정말 멋져요."
      : "참 잘 구웠어요! 멋진 진저브레드예요.", "", [
      { text: "내 선반 보기", primary: true, click: () => { s.step = "shelf"; bakeRender(); } },
      { text: "한 번 더 굽기", click: () => { openBake(); } },
    ]);
  } else if (s.step === "shelf") {
    const list = loadBakes();
    bakeUI(list.length ? `내 빵 선반이에요. 모두 ${list.length}개 구웠어요!` : "아직 구운 빵이 없어요.", "", [
      { text: "새로 굽기", primary: true, click: () => { openBake(); } },
      { text: "닫기", click: () => $("bake").classList.add("hidden") },
    ]);
    // 나무 진열장: 선반 판자 위에 빵이 한 줄에 4개씩 나란히 놓인다 (최근에 구운 것이 맨 위)
    const info = $("bakeInfo");
    info.innerHTML = "";
    const cab = document.createElement("div");
    cab.className = "bake-cabinet";
    const all = list.slice().reverse();
    const rows = Math.max(2, Math.ceil(all.length / 4)); // 비어 있어도 판자 두 칸은 보인다
    for (let r = 0; r < rows; r++) {
      const row = document.createElement("div");
      row.className = "shelf-row";
      const items = document.createElement("div");
      items.className = "shelf-items";
      for (const it of all.slice(r * 4, r * 4 + 4)) {
        const spot = document.createElement("span");
        spot.className = "shelf-spot";
        const sprite = it.kind === "salt" ? saltBreadSprite(3, true)
          : it.kind === "meringue" ? meringueSprite(it.cream || null, Array.isArray(it.tops) ? it.tops : [])
          : cookieSprite(it.shape, it.decor, true);
        spot.appendChild(shelfCanvas(sprite));
        items.appendChild(spot);
      }
      const plank = document.createElement("div");
      plank.className = "shelf-plank";
      row.append(items, plank);
      cab.appendChild(row);
    }
    info.appendChild(cab);
  }
}

function afterWeighChange() {
  const s = bake;
  const ing = s.recipe[s.ingIdx];
  if (s.grams === ing.target) {
    s.step = "weighDone";
    playTone("gather");
    bakeRender();
    setTimeout(() => {
      if (bake !== s) return;
      if (s.ingIdx + 1 < s.recipe.length) {
        s.ingIdx++;
        s.grams = s.recipe[s.ingIdx].start;
        s.needle = 0;
        s.touched = false;
        s.step = "weigh";
      } else s.step = s.kind === "meringue" ? "whisk" : "knead";
      bakeRender();
    }, 1200);
  } else bakeRender();
}

// 선반용 그림: 빵 아랫부분이 판자에 딱 닿게 아래로 맞춘다 (위에 붕 뜨지 않게)
function shelfCanvas(sprite) {
  const cv = document.createElement("canvas");
  cv.width = 26; cv.height = 26;
  cv.className = "shelf-bread";
  const x = cv.getContext("2d");
  x.imageSmoothingEnabled = false;
  let bottom = 25;
  try {
    const d = sprite.getContext("2d").getImageData(0, 0, sprite.width, sprite.height).data;
    for (bottom = sprite.height - 1; bottom > 0; bottom--) {
      let hit = false;
      for (let c = 0; c < sprite.width; c++) if (d[(bottom * sprite.width + c) * 4 + 3] > 0) { hit = true; break; }
      if (hit) break;
    }
  } catch (e) { /* 무시 */ }
  x.drawImage(sprite, 0, 25 - bottom);
  return cv;
}

function bakeFinish() { // 완성: 이 컴퓨터에 한 번만 저장 (반·학생마다 따로)
  const s = bake;
  if (s.saved) return;
  s.saved = true;
  if (s.kind === "salt") saveBakeEntry({ kind: "salt", t: Date.now() });
  else if (s.kind === "meringue") saveBakeEntry({ kind: "meringue", cream: s.cream, tops: s.tops.slice(), t: Date.now() }); // 쌓은 모습 그대로
  else saveBakeEntry({ kind: "ginger", shape: s.shape, decor: { ...s.decor }, t: Date.now() });
  spawnSparkle(canvas.width / 2, canvas.height / 2, 24);
  playTone("dex");
}

// 체험 창 그림 (매 프레임): 저울·반죽·오븐·쿠키
function bakeTick(now) {
  const s = bake;
  if (!s) return;
  const cv = $("bakeCanvas");
  const x2 = cv.getContext("2d");
  x2.imageSmoothingEnabled = false;
  x2.clearRect(0, 0, cv.width, cv.height);
  const w = cv.width, h = cv.height;
  const drawCookie = (shape, decor, baked, size, alpha) => {
    x2.save();
    x2.globalAlpha = alpha === undefined ? 1 : alpha;
    x2.drawImage(cookieSprite(shape, decor, baked), w / 2 - size / 2, h / 2 - size / 2 + 8, size, size);
    x2.restore();
  };
  const drawSalt = (salt, baked, size) =>
    x2.drawImage(saltBreadSprite(salt, baked), w / 2 - size / 2, h / 2 - size / 2 + 8, size, size);
  if (s.kind === "meringue" && meringueTick(s, x2, w, h, now)) return; // 머랭 케이크 화면
  if (s.step === "start") { // 세 가지를 나란히
    x2.drawImage(cookieSprite("man", { eyes: true, buttons: true, mouth: true }, true), w / 2 - 172, h / 2 - 52, 104, 104);
    x2.drawImage(saltBreadSprite(3, true), w / 2 - 52, h / 2 - 52, 104, 104);
    x2.drawImage(meringueSprite("fresh", ["strawberry", "blueberry", "cherry"]), w / 2 + 68, h / 2 - 52, 104, 104);
  } else if (s.step === "saltCheck") {
    drawSalt(3, true, 170);
  } else if (s.step === "knead" && s.kind === "salt") {
    drawSaltBowl(x2, w, h, s.knead);
  } else if (s.step === "roll") {
    drawSaltRoll(x2, w, h, s.roll);
  } else if (s.step === "oven" && s.kind === "salt") {
    const k = Math.min(1, (now - s.ovenT0) / BAKE_OVEN_MS);
    const glow = REDUCED ? 0.4 : 0.25 + 0.35 * (0.5 + 0.5 * Math.sin((2 * Math.PI * now) / 1200));
    drawBakeOven(x2, w, h, k, glow, (ox, oy, size, alpha) => {
      x2.save(); x2.globalAlpha = alpha;
      x2.drawImage(saltBreadSprite(0, k > 0.55), ox, oy, size, size);
      x2.restore();
    });
    const timer = $("bakeTimer");
    if (timer) timer.textContent = `${Math.max(0, Math.ceil((BAKE_OVEN_MS - (now - s.ovenT0)) / 1000))}초`;
    if (k >= 1) { s.step = "sprinkle"; playTone("gather"); bakeRender(); }
  } else if (s.step === "sprinkle" || (s.step === "done" && s.kind === "salt")) {
    drawSalt(s.salt, true, 180);
    if (s.step === "done") { // 축하 반짝이 (움직이지 않는 별)
      x2.fillStyle = "#F6C244";
      for (const [dx, dy] of [[-120, -60], [126, -48], [-106, 56], [114, 66], [0, -92]]) {
        x2.save(); x2.translate(w / 2 + dx, h / 2 + dy);
        x2.fillRect(-2, -8, 4, 16); x2.fillRect(-8, -2, 16, 4);
        x2.restore();
      }
    }
  } else if (s.step === "weigh" || s.step === "weighDone") {
    const target = s.step === "weighDone" ? s.recipe[s.ingIdx].target : s.grams;
    s.needle = REDUCED ? target : s.needle + (target - s.needle) * 0.12; // 바늘이 부드럽게 따라간다
    drawBakeScale(x2, w, h, s.needle, s.recipe[s.ingIdx].target);
  } else if (s.step === "knead") {
    // 가루 → 덩어리 → 매끈한 반죽
    const stage = s.knead < 2 ? 0 : s.knead < 4 ? 1 : 2;
    x2.fillStyle = "#DFC091";
    if (stage === 0) {
      for (let i = 0; i < 26; i++) {
        const hx = hash2(i, 7);
        x2.fillRect(w / 2 - 70 + (hx % 140), h / 2 - 10 + ((hx >> 6) % 50), 7, 6);
      }
    } else if (stage === 1) {
      for (const [dx, dy, r2] of [[-26, 14, 30], [20, 10, 34], [0, -12, 28], [-6, 22, 24]]) {
        x2.beginPath(); x2.arc(w / 2 + dx, h / 2 + dy, r2, 0, Math.PI * 2); x2.fill();
      }
      x2.strokeStyle = OUTLINE; x2.lineWidth = 3;
      x2.beginPath(); x2.arc(w / 2, h / 2 + 6, 56, 0, Math.PI * 2); x2.stroke();
    } else {
      x2.beginPath(); x2.ellipse(w / 2, h / 2 + 14, 62, 48, 0, 0, Math.PI * 2); x2.fill();
      x2.strokeStyle = OUTLINE; x2.lineWidth = 3;
      x2.beginPath(); x2.ellipse(w / 2, h / 2 + 14, 62, 48, 0, 0, Math.PI * 2); x2.stroke();
      x2.fillStyle = "#EDD4A8";
      x2.beginPath(); x2.ellipse(w / 2 - 20, h / 2 - 6, 18, 10, -0.5, 0, Math.PI * 2); x2.fill();
    }
  } else if (s.step === "shape") {
    x2.fillStyle = "#DFC091";
    x2.beginPath(); x2.ellipse(w / 2, h / 2 + 14, 62, 48, 0, 0, Math.PI * 2); x2.fill();
    x2.strokeStyle = OUTLINE; x2.lineWidth = 3;
    x2.beginPath(); x2.ellipse(w / 2, h / 2 + 14, 62, 48, 0, 0, Math.PI * 2); x2.stroke();
  } else if (s.step === "oven") {
    const k = Math.min(1, (now - s.ovenT0) / BAKE_OVEN_MS);
    const glow = REDUCED ? 0.4 : 0.25 + 0.35 * (0.5 + 0.5 * Math.sin((2 * Math.PI * now) / 1200));
    drawBakeOven(x2, w, h, k, glow, (ox, oy, size, alpha) => {
      x2.save(); x2.globalAlpha = alpha;
      x2.drawImage(cookieSprite(s.shape, {}, k > 0.55), ox, oy, size, size);
      x2.restore();
    });
    const timer = $("bakeTimer");
    if (timer) timer.textContent = `${Math.max(0, Math.ceil((BAKE_OVEN_MS - (now - s.ovenT0)) / 1000))}초`;
    if (k >= 1) { s.step = "decor"; playTone("gather"); bakeRender(); }
  } else if (s.step === "decor" || s.step === "done") {
    drawCookie(s.shape, s.decor, true, 160);
    if (s.step === "done") { // 축하 반짝이 (움직이지 않는 별)
      x2.fillStyle = "#F6C244";
      for (const [dx, dy] of [[-110, -60], [116, -48], [-96, 56], [104, 66], [0, -92]]) {
        x2.save(); x2.translate(w / 2 + dx, h / 2 + dy);
        x2.fillRect(-2, -8, 4, 16); x2.fillRect(-8, -2, 16, 4);
        x2.restore();
      }
    }
  } else if (s.step === "shelf") {
    x2.drawImage(cookieSprite("man", { eyes: true, buttons: true, mouth: true }, true), w / 2 - 150, h / 2 - 40, 90, 90);
    x2.drawImage(saltBreadSprite(3, true), w / 2 - 45, h / 2 - 40, 90, 90);
    x2.drawImage(meringueSprite("fresh", ["strawberry", "blueberry", "cherry"]), w / 2 + 60, h / 2 - 40, 90, 90);
  }
}

$("closeBake").addEventListener("click", () => $("bake").classList.add("hidden"));

/* ---------- 재료 도감 창 ---------- */
let dexTab = "items";
function openDex() {
  renderDex();
  $("dex").classList.remove("hidden");
}
function renderDex() {
  $("dexTabItems").classList.toggle("on", dexTab === "items");
  $("dexTabFish").classList.toggle("on", dexTab === "fish");
  $("dexTitleText").textContent = dexTab === "fish" ? "물고기 도감" : "재료 도감";
  $("dexCount").classList.toggle("dex-count-big", dexTab === "fish"); // 물고기 도감은 22px
  if (dexTab === "fish") { renderFishDex(); return; }
  $("dexGrid").className = "dex-grid";
  $("dexCount").textContent = `모은 재료 ${me.items.size} / ${ITEMS.length}`;
  const grid = $("dexGrid");
  grid.innerHTML = "";
  for (const it of ITEMS) {
    const got = me.items.has(it.id);
    const cell = document.createElement("div");
    cell.className = "dex-cell" + (got ? "" : " unknown");
    const cv = document.createElement("canvas");
    cv.width = 16; cv.height = 16;
    const x = cv.getContext("2d");
    x.imageSmoothingEnabled = false;
    x.drawImage(itemSprite(it.id), 0, 0);
    if (!got) { // 회색 실루엣
      x.globalCompositeOperation = "source-atop";
      x.fillStyle = "#B9AE9C";
      x.fillRect(0, 0, 16, 16);
    }
    const nm = document.createElement("span");
    nm.textContent = got ? it.name : "?";
    cell.appendChild(cv);
    cell.appendChild(nm);
    grid.appendChild(cell);
  }
}
// 물고기 도감: 6칸. 못 낚은 물고기는 그림자와 "?" (크기·희귀도·순위 없음)
function renderFishDex() {
  $("dexCount").textContent = `낚은 물고기 ${FISH.filter((f) => me.fish.has(f.id)).length} / ${FISH.length}`;
  const grid = $("dexGrid");
  grid.className = "dex-grid fish-grid";
  grid.innerHTML = "";
  for (const f of FISH) {
    const got = me.fish.has(f.id);
    const cell = document.createElement("div");
    cell.className = "dex-cell fish-cell" + (got ? "" : " unknown");
    const cv = document.createElement("canvas");
    cv.width = 16; cv.height = 16;
    const x = cv.getContext("2d");
    x.imageSmoothingEnabled = false;
    x.drawImage(fishSprite(f.id), 0, 0);
    if (!got) {
      x.globalCompositeOperation = "source-atop";
      x.fillStyle = "#B9AE9C";
      x.fillRect(0, 0, 16, 16);
    }
    const nm = document.createElement("span");
    nm.textContent = got ? f.name : "?";
    cell.append(cv, nm);
    grid.appendChild(cell);
  }
}
$("dexTabItems").addEventListener("click", () => { dexTab = "items"; renderDex(); });
$("dexTabFish").addEventListener("click", () => { dexTab = "fish"; renderDex(); });
$("fishCard").addEventListener("click", closeFishCard);
$("dexBtn").addEventListener("click", openDex);
$("closeDex").addEventListener("click", () => $("dex").classList.add("hidden"));

/* ============================================================
   우리 반 바구니 — 반 친구들이 얻은 재료가 저절로 모여요
   - 선생님이 시트(마을 탭) "반목표"에 적으면 보이고, 비우면 숨어요.
   - 숫자는 서버(시트)가 세요. 여기서는 받은 숫자를 보여 주기만 해요.
   - 다 채우면 긴 식탁에 큰 식빵이 놓이고(목표가 바뀔 때까지), 학생마다 목표당 한 번만 축하해요.
   ============================================================ */
let basketState = null; // { key, items:[{id, need, have}], done }
const BASKET_SEEN_KEY = () => "happybread_basket_" + CLASS + "_" + (me.id || "solo");

function basketTotals(b) {
  let have = 0, need = 0;
  for (const it of b.items) { need += it.need; have += Math.min(it.need, it.have); }
  return { have, need };
}

function applyBasket(b) {
  const hud = $("basketHud");
  const items = b && Array.isArray(b.items)
    ? b.items
      .filter((it) => it && ITEMS.some((v) => v.id === it.id))
      .map((it) => ({ id: it.id, need: Math.max(1, Number(it.need) || 1), have: Math.max(0, Number(it.have) || 0) }))
    : [];
  if (!items.length) {
    basketState = null;
    hud.classList.add("hidden");
    $("basket").classList.add("hidden");
    return;
  }
  const done = items.every((it) => it.have >= it.need);
  basketState = { key: String(b.key || ""), items, done, doneAt: Number(b.doneAt) || 0 };
  const t = basketTotals(basketState);
  $("basketHudText").textContent = `${t.have}/${t.need}`;
  $("basketBarFill").style.width = Math.round((t.have / t.need) * 100) + "%";
  hud.classList.toggle("done", done);
  hud.setAttribute("aria-label", `우리 반 바구니 ${t.have}/${t.need}`);
  hud.classList.remove("hidden");
  if (!$("basket").classList.contains("hidden")) renderBasket();
  // 다 채웠어요: 이 학생이 이 목표로 아직 축하를 못 봤으면 한 번만 (새로고침해도 다시 안 나와요)
  if (done) {
    let seen = "";
    try { seen = localStorage.getItem(BASKET_SEEN_KEY()) || ""; } catch (e) { /* 무시 */ }
    if (seen !== basketState.key) {
      try { localStorage.setItem(BASKET_SEEN_KEY(), basketState.key); } catch (e) { /* 무시 */ }
      celebrateBasket();
    }
  }
}

function renderBasket() {
  const b = basketState;
  if (!b) return;
  $("basketSub").textContent = b.done ? "우리 반이 다 채웠어요!" : "다 같이 모으고 있어요.";
  const grid = $("basketGrid");
  grid.innerHTML = "";
  for (const it of b.items) {
    const info = ITEMS.find((v) => v.id === it.id);
    const have = Math.min(it.need, it.have);
    const cell = document.createElement("div");
    cell.className = "basket-cell" + (have >= it.need ? " full" : "");
    const cv = document.createElement("canvas");
    cv.width = 16; cv.height = 16;
    const x = cv.getContext("2d");
    x.imageSmoothingEnabled = false;
    x.drawImage(itemSprite(it.id), 0, 0);
    const nm = document.createElement("span");
    nm.className = "bc-name"; nm.textContent = info.name;
    const num = document.createElement("span");
    num.className = "bc-num"; num.textContent = `${have}/${it.need}`;
    cell.append(cv, nm, num);
    grid.appendChild(cell);
  }
}
$("basketHud").addEventListener("click", () => { renderBasket(); $("basket").classList.remove("hidden"); });
$("closeBasket").addEventListener("click", () => $("basket").classList.add("hidden"));
$("basket").addEventListener("click", (e) => { if (e.target === $("basket")) $("basket").classList.add("hidden"); }); // 바깥을 눌러도 닫힌다

/* ============================================================
   식탁 파티 음악 — 우리 반 바구니를 다 채우면 30분 동안 긴 식탁에서 흐른다
   (study 폴더 partybgm.js의 곡을 그대로: 다장조 8비트 멜로디, 1분에 120박, 16초 곡)
   - 식탁 가까이(3칸 안) 가장 크게, 멀어질수록 작아지고 12칸부터는 들리지 않는다.
   - 효과음을 끄면 함께 꺼진다. 탭이 숨겨지거나 마을 밖이면 1초 안에 작아진다.
   - 시계에 맞춰 연주한다: 모든 컴퓨터에서 같은 순간에 같은 부분이 나온다.
   - 아주 작게: 한 음은 0.05 이하로, 효과음(0.11)보다 작다.
   ============================================================ */
const PARTY_MS = 30 * 60 * 1000;   // 다 채운 뒤 30분
const PBGM_NOTE_VOL = 0.05;
const PBGM_NEAR_PX = 120, PBGM_FAR_PX = 480;
const PBGM_MELODY = [
  ["C5", 2], ["E5", 2], ["G5", 2], ["E5", 2],
  ["F5", 2], ["A5", 2], ["G5", 4],
  ["E5", 2], ["G5", 2], ["C6", 2], ["G5", 2],
  ["A5", 2], ["G5", 2], ["E5", 4],
  ["F5", 2], ["F5", 1], ["G5", 1], ["A5", 2], ["F5", 2],
  ["E5", 2], ["E5", 1], ["F5", 1], ["G5", 2], ["E5", 2],
  ["D5", 2], ["E5", 2], ["F5", 2], ["D5", 2],
  ["C5", 4], [null, 2], ["G4", 2],
];
const PBGM_BASS = [
  ["C3", 2], ["G3", 2], ["C3", 2], ["G3", 2],
  ["F2", 2], ["C3", 2], ["F2", 2], ["C3", 2],
  ["C3", 2], ["G3", 2], ["C3", 2], ["G3", 2],
  ["A2", 2], ["E3", 2], ["A2", 2], ["E3", 2],
  ["F2", 2], ["C3", 2], ["F2", 2], ["C3", 2],
  ["C3", 2], ["G3", 2], ["C3", 2], ["G3", 2],
  ["G2", 2], ["D3", 2], ["G2", 2], ["D3", 2],
  ["C3", 2], ["G3", 2], ["C3", 2], ["G3", 2],
];
const PBGM_EIGHTH_MS = 60000 / 120 / 2;
const PBGM_LOOP_MS = 64 * PBGM_EIGHTH_MS;   // 16초
const PBGM_EVENTS = (() => {
  const semi = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
  const freq = (n) => { const m = /^([A-G])(\d)$/.exec(n); return 440 * Math.pow(2, (12 * (+m[2] + 1) + semi[m[1]] - 69) / 12); };
  const out = [];
  const add = (seq, type, vol) => {
    let at = 0;
    for (const [n, k] of seq) { if (n) out.push({ at: at * PBGM_EIGHTH_MS, dur: k * PBGM_EIGHTH_MS, f: freq(n), type, vol }); at += k; }
  };
  add(PBGM_MELODY, "triangle", 1);
  add(PBGM_BASS, "sine", 0.5);
  return out.sort((a, b) => a.at - b.at);
})();

// 식탁 네모 가장자리까지의 거리(px). 식탁 위면 0
function tableDistPx(x, y) {
  const x0 = LONG_TABLE.c0 * TILE, y0 = LONG_TABLE.r0 * TILE;
  const x1 = (LONG_TABLE.c0 + LONG_TABLE.w) * TILE, y1 = (LONG_TABLE.r0 + 1) * TILE;
  return Math.hypot(Math.max(x0 - x, 0, x - x1), Math.max(y0 - y, 0, y - y1));
}
function partyOn(nowMs) {
  return !!(basketState && basketState.done && basketState.doneAt && nowMs < basketState.doneAt + PARTY_MS);
}

const pbgm = { master: null, timer: 0, cursorWall: null, applied: 0, offTimer: 0 };
function pbgmTick() {
  const ctx = audioCtx;
  if (!ctx || !pbgm.master) return;
  if (ctx.state !== "running") { pbgm.cursorWall = null; return; } // 멈춘 동안은 음을 쌓지 않는다
  const wallOff = Date.now() - ctx.currentTime * 1000;
  const nowWall = ctx.currentTime * 1000 + wallOff;
  if (pbgm.cursorWall === null) pbgm.cursorWall = nowWall + 50;
  const until = nowWall + 400;
  for (let base = Math.floor(pbgm.cursorWall / PBGM_LOOP_MS) * PBGM_LOOP_MS; base < until; base += PBGM_LOOP_MS) {
    for (const ev of PBGM_EVENTS) {
      const w = base + ev.at;
      if (w < pbgm.cursorWall || w >= until) continue;
      const t = (w - wallOff) / 1000;
      const o = ctx.createOscillator(), g = ctx.createGain();
      o.type = ev.type; o.frequency.value = ev.f;
      const vol = PBGM_NOTE_VOL * ev.vol, end = t + (ev.dur / 1000) * 0.9;
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(vol, t + 0.01);
      g.gain.exponentialRampToValueAtTime(0.0001, end);
      o.connect(g).connect(pbgm.master);
      o.start(t); o.stop(end + 0.05);
    }
  }
  pbgm.cursorWall = until;
}
function pbgmTeardown() {
  clearInterval(pbgm.timer); clearTimeout(pbgm.offTimer);
  pbgm.timer = 0; pbgm.offTimer = 0;
  if (pbgm.master) { try { pbgm.master.disconnect(); } catch (e) { /* 무시 */ } }
  pbgm.master = null; pbgm.cursorWall = null; pbgm.applied = 0;
}
// 매 프레임: 파티 중이고 효과음이 켜져 있고 마을이 보이면, 식탁까지 거리로 크기를 정한다
function updatePartyBgm() {
  let v = 0;
  if (partyOn(Date.now()) && soundEnabled() && !document.hidden && !villageEl.classList.contains("hidden")) {
    const d = tableDistPx(me.x, me.y);
    v = d <= PBGM_NEAR_PX ? 1 : d >= PBGM_FAR_PX ? 0 : (PBGM_FAR_PX - d) / (PBGM_FAR_PX - PBGM_NEAR_PX);
  }
  if (v > 0) {
    if (!pbgm.master) {
      try {
        if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        if (audioCtx.state === "suspended") audioCtx.resume();
        pbgm.master = audioCtx.createGain();
        pbgm.master.gain.value = 0;
        pbgm.master.connect(audioCtx.destination);
        pbgm.applied = 0; pbgm.cursorWall = null;
        pbgm.timer = setInterval(pbgmTick, 100);
        pbgmTick();
      } catch (e) { return; } // 소리를 쓸 수 없어도 다른 기능은 그대로
    }
    if (pbgm.offTimer) { clearTimeout(pbgm.offTimer); pbgm.offTimer = 0; }
  } else if (!pbgm.master) return;
  if (Math.abs(v - pbgm.applied) >= 0.02 || (v > 0) !== (pbgm.applied > 0)) {
    pbgm.master.gain.setTargetAtTime(v, audioCtx.currentTime, 0.4);
    pbgm.applied = v;
  }
  if (v === 0 && !pbgm.offTimer) pbgm.offTimer = setTimeout(pbgmTeardown, 1500);
}

// 이름표 자리 잡기에 쓰는 바구니 표시 영역 (캔버스 좌표)
function basketHudRect() {
  const hud = $("basketHud");
  if (!basketState || hud.classList.contains("hidden")) return null;
  const a = hud.getBoundingClientRect(), c = canvas.getBoundingClientRect();
  return { x: a.left - c.left - 4, y: a.top - c.top - 4, w: a.width + 8, h: a.height + 8 };
}

// 다 채웠을 때: 배너 + (동작 줄이기가 아니면) 식탁 위 폭죽 3번
function celebrateBasket() {
  showPraise("우리 반이 해냈어요!", "우리 반 바구니를 다 채웠어요"); // 소리는 배너가 소리 설정대로 한 번 낸다
  if (REDUCED) return; // 동작 줄이기: 식빵과 글자만
  const cx = (LONG_TABLE.c0 + LONG_TABLE.w / 2) * TILE, cy = LONG_TABLE.r0 * TILE - 100;
  const t0 = performance.now();
  // 하나당 1.3초, 0.8초 간격으로 3번 → 2.9초 안에 끝난다
  [[0, 0], [-90, 24], [90, 12]].forEach(([dx, dy], i) => {
    fireworks.push({ x: cx + dx, y: cy + dy, at: t0 + i * 800, ms: FW_MS, seed: i });
  });
}

/* 폭죽: 부드러운 색, 깜빡임 없이 천천히 퍼졌다가 서서히 옅어진다 (월드 좌표) */
const FW_MS = 1300;
const FW_COLORS = ["#FFD66B", "#F7B2C4", "#9FDCC2", "#BFD7FF", "#FFE7B0"];
const fireworks = [];
function drawFireworks() {
  if (!fireworks.length) return;
  const now = performance.now();
  for (let i = fireworks.length - 1; i >= 0; i--) {
    const f = fireworks[i];
    const u = (now - f.at) / f.ms;
    if (u < 0) continue;
    if (u >= 1) { fireworks.splice(i, 1); continue; }
    const ease = 1 - Math.pow(1 - u, 3);         // 처음엔 빨리, 나중엔 천천히 퍼진다
    const rad = 12 + ease * 60;
    const alpha = u < 0.55 ? 0.9 : 0.9 * (1 - (u - 0.55) / 0.45); // 끝에서 서서히 옅어진다
    const x0 = f.x - cam.x, y0 = f.y - cam.y + u * 14; // 아주 조금 아래로 내려앉는다
    if (x0 < -120 || y0 < -120 || x0 > canvas.width + 120 || y0 > canvas.height + 120) continue;
    ctx.globalAlpha = Math.max(0, alpha);
    for (let k = 0; k < 14; k++) {
      const a = (k / 14) * Math.PI * 2 + f.seed * 0.4;
      ctx.fillStyle = FW_COLORS[(k + f.seed) % FW_COLORS.length];
      const px = Math.round(x0 + Math.cos(a) * rad), py = Math.round(y0 + Math.sin(a) * rad);
      ctx.fillRect(px - 3, py - 3, 6, 6);
      const ix = Math.round(x0 + Math.cos(a) * rad * 0.6), iy = Math.round(y0 + Math.sin(a) * rad * 0.6);
      ctx.fillRect(ix - 2, iy - 2, 4, 4); // 안쪽 작은 점 (도트 꼬리)
    }
    ctx.globalAlpha = 1;
  }
}

// 얼굴 없는 큰 식빵 (도트 26x22, 봉우리 두 개)
let loafCache = null;
function loafSprite() {
  if (loafCache) return loafCache;
  const W = 26, H = 22;
  const cv = document.createElement("canvas");
  cv.width = W; cv.height = H;
  const x = cv.getContext("2d");
  const g = Array.from({ length: H }, () => new Array(W).fill(0));
  const top = (c, r) => ((c - 7.5) / 6) ** 2 + ((r - 7) / 6) ** 2 <= 1 || ((c - 17.5) / 6) ** 2 + ((r - 7) / 6) ** 2 <= 1;
  for (let r = 0; r < H; r++) for (let c = 0; c < W; c++) {
    const body = r >= 8 && r <= H - 2 && c >= 3 && c <= W - 4;
    if (top(c, r) || body) g[r][c] = 1;
  }
  for (let r = 0; r < H; r++) for (let c = 0; c < W; c++) {
    if (!g[r][c]) continue;
    let col = "#F2CF8C";                                   // 노릇한 빵
    const inTop = top(c, r) && r < 10;
    if (inTop) col = "#C97F3A";                            // 위 껍질
    if (inTop && !(g[r - 1] || [])[c]) col = "#A9622A";    // 맨 위 진한 껍질
    if (!inTop && (c <= 4 || c >= W - 5)) col = "#DDA45C"; // 옆 껍질
    if (r >= H - 3) col = "#C38544";                       // 아래 껍질
    x.fillStyle = col; x.fillRect(c, r, 1, 1);
  }
  x.fillStyle = "#E2A158"; x.fillRect(5, 3, 3, 1); x.fillRect(15, 3, 3, 1); // 윗면 반짝임
  x.fillStyle = "#FBE7BC"; x.fillRect(7, 12, 3, 1); x.fillRect(7, 13, 1, 2);
  // 테두리
  x.fillStyle = OUTLINE;
  for (let r = 0; r < H; r++) for (let c = 0; c < W; c++) {
    if (g[r][c]) continue;
    const near = (g[r - 1] || [])[c] || (g[r + 1] || [])[c] || g[r][c - 1] || g[r][c + 1];
    if (near) x.fillRect(c, r, 1, 1);
  }
  loafCache = cv;
  return cv;
}

/* ============================================================
   사진 찍기 — 지금 서 있는 실제 화면을 그대로 찰칵
   화면에 보이는 친구·이름표·장식이 전부 함께 담긴다.
   ============================================================ */
function drawPhoto() {
  const cv = $("photoCanvas"), x = cv.getContext("2d");
  x.imageSmoothingEnabled = false;
  const W = cv.width, H = cv.height;
  // 액자 안쪽 영역 (아래에는 이름 띠 공간을 남긴다)
  const ix = 24, iy = 24, iw = W - 48, ih = H - 104;
  // 내 캐릭터가 가운데(살짝 아래)에 오게 실제 게임 화면을 잘라 온다
  // 줄이지 않고 1:1로 담는다 (줄이면 이름표 글자가 깨진다). 창이 사진보다 작을 때만 맞춰 키운다
  const k = Math.min(1, canvas.width / iw, canvas.height / ih);
  const sw = iw * k, sh = ih * k;
  let sx = dispX(me) - cam.x - sw / 2;
  let sy = dispY(me) - cam.y - sh / 2 - 16;
  sx = Math.max(0, Math.min(canvas.width - sw, sx));
  sy = Math.max(0, Math.min(canvas.height - sh, sy));
  x.fillStyle = "#F3E2C0"; x.fillRect(0, 0, W, H);
  x.drawImage(canvas, sx, sy, sw, sh, ix, iy, iw, ih);
  // 액자 틀
  x.strokeStyle = "#5B3A1E"; x.lineWidth = 14; x.strokeRect(7, 7, W - 14, H - 14);
  x.strokeStyle = "#F6C244"; x.lineWidth = 6; x.strokeRect(17, 17, W - 34, H - 34);
  // 아래 띠: 닉네임 + 마을 이름
  x.fillStyle = "#FFF4E0"; x.fillRect(24, H - 76, W - 48, 50);
  x.strokeStyle = "#5B3A1E"; x.lineWidth = 3; x.strokeRect(24, H - 76, W - 48, 50);
  x.fillStyle = "#5B3A1E";
  x.font = "bold 20px 'Malgun Gothic', sans-serif";
  x.textAlign = "center"; x.textBaseline = "middle";
  x.fillText(me.name, W / 2, H - 58);
  x.font = "12px 'Malgun Gothic', sans-serif";
  x.fillStyle = "#8A5A33";
  x.fillText("행복만빵 마을", W / 2, H - 38);
}

$("photoBtn").addEventListener("click", () => { drawPhoto(); $("photo").classList.remove("hidden"); });
$("closePhoto").addEventListener("click", () => $("photo").classList.add("hidden"));
$("retakePhoto").addEventListener("click", () => { drawPhoto(); showToast("다시 찍었어요!"); });
$("savePhoto").addEventListener("click", () => {
  $("photoCanvas").toBlob((blob) => {
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `행복만빵_${me.name || "나"}.png`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 3000);
    showToast("사진을 저장했어요!");
  });
});

function closeModals() {
  ["facilityCard", "bag", "dex", "board", "photo", "bake", "dialog", "giftCard", "basket"].forEach((id) => $(id).classList.add("hidden"));
  dialog = null;
}
// 바깥(어두운 부분) 누르면 닫기
["facilityCard", "bag", "dex", "board", "photo", "bake"].forEach((id) => {
  $(id).addEventListener("click", (e) => { if (e.target === $(id)) $(id).classList.add("hidden"); });
});

let toastTimer = null;
function showToast(msg) {
  const t = $("toast");
  t.textContent = msg;
  t.classList.remove("hidden");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.add("hidden"), 2600);
}

/* ============================================================
   움직임 계산
   ============================================================ */
function canStand(x, y) {
  // 발 밑 네 귀퉁이가 모두 지나갈 수 있는 칸인지 확인
  for (const [dx, dy] of [[-11, -4], [11, -4], [-11, 8], [11, 8]]) {
    if (isBlocked(Math.floor((x + dx) / TILE), Math.floor((y + dy) / TILE))) return false;
  }
  return true;
}

function faceDir(a, dx, dy) { // 움직이는 방향으로 바라본다 (멈추면 마지막 방향 유지)
  if (Math.abs(dx) >= Math.abs(dy)) a.dir = dx >= 0 ? "right" : "left";
  else a.dir = dy >= 0 ? "down" : "up";
}

function moveActor(a, speed, dt) {
  // 1) 키/버튼 이동 (내 캐릭터만)
  if (a === me) {
    let vx = (keys.right ? 1 : 0) - (keys.left ? 1 : 0);
    let vy = (keys.down ? 1 : 0) - (keys.up ? 1 : 0);
    if ((vx || vy) && !me.sitting) {
      me.fishing = null; // 움직이면 낚시 멈춤
      faceDir(a, vx, vy);
      const len = Math.hypot(vx, vy);
      const nx = a.x + (vx / len) * speed * dt;
      const ny = a.y + (vy / len) * speed * dt;
      if (canStand(nx, a.y)) a.x = nx;
      if (canStand(a.x, ny)) a.y = ny;
      a.moving = true;
      return;
    }
  }
  // 2) 길 따라 걷기
  if (a.path && a.path.length) {
    const [tc, tr] = a.path[0];
    const tx = tc * TILE + TILE / 2, ty = tr * TILE + TILE / 2;
    const dx = tx - a.x, dy = ty - a.y;
    const dist = Math.hypot(dx, dy);
    const step = speed * dt;
    faceDir(a, dx, dy);
    if (dist <= step) {
      a.x = tx; a.y = ty;
      a.path.shift();
      if (!a.path.length && a === me && pendingFacility) {
        const f = pendingFacility;
        pendingFacility = null;
        openFacility(f);
      } else if (!a.path.length && a === me && pendingNpc) {
        const n = pendingNpc;
        pendingNpc = null;
        if (Math.hypot(me.x - n.x, me.y - n.y) < TILE * 2.8) openNpc(n);
      } else if (!a.path.length && a === me && pendingBench) {
        const b = pendingBench;
        pendingBench = null;
        if (benchDist(b) < TILE * 2.4) sitDown(b);
      }
    } else {
      a.x += (dx / dist) * step;
      a.y += (dy / dist) * step;
    }
    a.moving = true;
  } else {
    a.moving = false;
  }
}

/* ---------- 캐릭터끼리 살짝 밀려나기 ----------
   - 서로 막지는 않는다. 겹치면 "보이는 위치"만 조금씩 옆으로 밀린다.
   - 실제 위치와 길찾기는 그대로라서, 지나가는 캐릭터가 멈추지 않는다.
   - 밀려난 자리가 나무, 건물 같은 막힌 곳이면 밀리지 않는다.
   - 계산은 쌍마다 한 번씩(20명이면 190번)이라 아주 가볍다. */
const SEP_DIST = 44;   // 이보다 가까우면 민다 (캐릭터 몸 너비만큼)
const SEP_FORCE = 150; // 미는 힘 (지나갈 때 또렷하게 비켜 보이게)
const SEP_MAX = 30;    // 최대 밀려나는 거리(px)

function dispX(c) { return c.x + (c.sepX || 0); }
function dispY(c) { return c.y + (c.sepY || 0); }

function applySeparation(dt) {
  const chars = [me, ...friends];
  const n = chars.length;
  for (const c of chars) {
    c._fx = 0; c._fy = 0;
    if (c.sepX === undefined) { c.sepX = 0; c.sepY = 0; }
  }
  // 가까운 쌍끼리 서로 반대쪽으로 약한 힘
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      const a = chars[i], b = chars[j];
      let dx = dispX(b) - dispX(a), dy = dispY(b) - dispY(a);
      let d = Math.hypot(dx, dy);
      if (d >= SEP_DIST) continue;
      if (d < 0.01) { // 완전히 겹치면 서로 다른 방향으로
        const ang = i * 2.4 + j * 1.7;
        dx = Math.cos(ang); dy = Math.sin(ang); d = 1;
      }
      const s = (1 - d / SEP_DIST) * SEP_FORCE; // 가까울수록 조금 더
      a._fx -= (dx / d) * s; a._fy -= (dy / d) * s;
      b._fx += (dx / d) * s; b._fy += (dy / d) * s;
    }
  }
  for (const c of chars) {
    if (c._fx || c._fy) {
      // 막힌 곳 안으로는 밀리지 않게, 가로와 세로를 따로 확인
      const nx = c.sepX + c._fx * dt;
      if (canStand(c.x + nx, dispY(c))) c.sepX = nx;
      const ny = c.sepY + c._fy * dt;
      if (canStand(dispX(c), c.y + ny)) c.sepY = ny;
    } else {
      // 겹침이 풀리면 제자리로 스르륵 돌아온다
      const k = Math.min(1, dt * 3);
      c.sepX -= c.sepX * k;
      c.sepY -= c.sepY * k;
    }
    // 너무 멀리 밀리지 않게
    const m = Math.hypot(c.sepX, c.sepY);
    if (m > SEP_MAX) { c.sepX *= SEP_MAX / m; c.sepY *= SEP_MAX / m; }
    // 걷다가 밀린 자리가 막힌 곳이 되면 줄여서 빠져나온다
    for (let t = 0; t < 3 && !canStand(dispX(c), dispY(c)); t++) { c.sepX *= 0.4; c.sepY *= 0.4; }
    if (!canStand(dispX(c), dispY(c))) { c.sepX = 0; c.sepY = 0; }
  }
  // 낚시 방석을 같이 쓰는 사람들은 살짝 비켜 앉은 것처럼 보인다 (보이는 위치만)
  for (const b of BENCHES) {
    if (!b.fishing && !b.macaron) continue;
    const seat = b.seats[0];
    const group = chars.filter((c) => Math.abs(c.x - seat.x) < 7 && Math.abs(c.y - seat.y) < 7);
    if (group.length < 2) continue;
    group.sort((a, b2) => String(a.id || a.name).localeCompare(String(b2.id || b2.name)));
    group.forEach((c, i) => { c.sepX = (i - (group.length - 1) / 2) * 15; c.sepY = 0; });
  }
}

function updateFriends(now, dt) {
  for (const fr of friends) {
    // 서버에서 받은 친구: 받은 위치까지 부드럽게 걸어간다 (순간이동 금지)
    if (fr.remote) {
      const dx = (fr.tx ?? fr.x) - fr.x, dy = (fr.ty ?? fr.y) - fr.y;
      const dist = Math.hypot(dx, dy);
      if (dist > TILE * 8) { fr.x = fr.tx; fr.y = fr.ty; fr.moving = false; continue; } // 너무 멀면 새 자리로
      if (dist > 2) {
        faceDir(fr, dx, dy);
        const step = Math.max(PLAYER_SPEED, dist / 1.2) * dt; // 늦으면 조금 빠르게 따라간다
        const s = Math.min(dist, step);
        fr.x += (dx / dist) * s;
        fr.y += (dy / dist) * s;
        fr.moving = true;
      } else {
        fr.moving = false;
      }
      continue;
    }
    if (!fr.path.length && now > fr.wanderAt) {
      // 집 근처 아무 곳이나 골라 천천히 걸어간다 (움직임 보간 느낌 보여주기)
      for (let tryN = 0; tryN < 8; tryN++) {
        const c = fr.homeC + Math.floor(Math.random() * 11) - 5;
        const r = fr.homeR + Math.floor(Math.random() * 7) - 3;
        if (!isBlocked(c, r)) {
          fr.path = findPath(Math.floor(fr.x / TILE), Math.floor(fr.y / TILE), c, r);
          break;
        }
      }
      fr.wanderAt = now + 2500 + Math.random() * 4000;
    }
    moveActor(fr, NPC_SPEED, dt);
  }
}

/* ============================================================
   그리기
   ============================================================ */
const cam = { x: 0, y: 0 };

function resize() {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
  ctx.imageSmoothingEnabled = false;
}
window.addEventListener("resize", resize);

function hash2(c, r) { return ((c * 73856093) ^ (r * 19349663)) >>> 0; }

function drawGround(now) {
  const c0 = Math.max(0, Math.floor(cam.x / TILE));
  const r0 = Math.max(0, Math.floor(cam.y / TILE));
  const c1 = Math.min(COLS - 1, Math.ceil((cam.x + canvas.width) / TILE));
  const r1 = Math.min(ROWS - 1, Math.ceil((cam.y + canvas.height) / TILE));

  for (let r = r0; r <= r1; r++) {
    for (let c = c0; c <= c1; c++) {
      const x = c * TILE - cam.x, y = r * TILE - cam.y;
      const g = ground[r][c];
      const h = hash2(c, r);

      if (g === 3) { // 바다 (살랑살랑 물결)
        ctx.fillStyle = c >= 46 ? "#58AFCE" : "#6FC3DE";
        ctx.fillRect(x, y, TILE, TILE);
        const wavePhase = (h + Math.floor(now / 520)) % 4;
        if (wavePhase === 0) {
          ctx.fillStyle = "#A8DEEE";
          ctx.fillRect(x + 6, y + 12 + (Math.floor(now / 520) % 2) * 6, 16, 3);
        } else if (wavePhase === 2) {
          ctx.fillStyle = "#8FD2E6";
          ctx.fillRect(x + 18, y + 26, 12, 3);
        }
        if (ground[r][c - 1] === 5 || ground[r][c - 1] === 6) { // 물가 거품
          ctx.fillStyle = "rgba(255,255,255,0.85)";
          const f = Math.floor(now / 700) % 2;
          ctx.fillRect(x, y + 4 + f * 4, 4, 6);
          ctx.fillRect(x, y + 22 - f * 4, 4, 6);
        }
      } else if (g === 5) { // 설탕 가루 모래사장
        ctx.fillStyle = "#F8EED6";
        ctx.fillRect(x, y, TILE, TILE);
        ctx.fillStyle = (h + Math.floor(now / 900)) % 5 === 0 ? "#FFFFFF" : "#EEDFBE";
        ctx.fillRect(x + (h % 30), y + ((h >> 5) % 30), 3, 3);
        ctx.fillRect(x + ((h >> 3) % 30), y + ((h >> 8) % 30), 2, 2);
        if (ground[r][c - 1] === 0 || ground[r][c - 1] === 1) {
          ctx.fillStyle = "#E8D5A8";
          ctx.fillRect(x, y, 3, TILE);
        }
      } else if (g === 6) { // 나무 선착장
        ctx.fillStyle = "#B98A5A";
        ctx.fillRect(x, y, TILE, TILE);
        ctx.fillStyle = "#9C6E42";
        ctx.fillRect(x, y + 12, TILE, 2);
        ctx.fillRect(x, y + 27, TILE, 2);
        ctx.fillStyle = "#8A5A33";
        ctx.fillRect(x, y, 2, TILE);
        ctx.fillStyle = "#6E4525";
        ctx.fillRect(x + 6, y + 5, 2, 2);
        ctx.fillRect(x + 30, y + 20, 2, 2);
      } else if (g === 1) { // 쿠키 조각 길
        ctx.fillStyle = (c + r) % 2 === 0 ? "#D9A866" : "#D2A05E";
        ctx.fillRect(x, y, TILE, TILE);
        ctx.fillStyle = "#8A5A33"; // 초코칩
        ctx.fillRect(x + 8 + (h % 14), y + 7 + ((h >> 4) % 14), 4, 4);
        ctx.fillRect(x + 22 - (h % 9), y + 24 + ((h >> 6) % 6), 3, 3);
        ctx.fillStyle = "#B8864C";
        if (ground[r - 1]?.[c] === 0) ctx.fillRect(x, y, TILE, 3);
        if (ground[r + 1]?.[c] === 0) ctx.fillRect(x, y + TILE - 3, TILE, 3);
        if (ground[r][c - 1] === 0) ctx.fillRect(x, y, 3, TILE);
        if (ground[r][c + 1] === 0) ctx.fillRect(x + TILE - 3, y, 3, TILE);
      } else if (g === 2) { // 와플 광장
        ctx.fillStyle = "#EFCB92";
        ctx.fillRect(x, y, TILE, TILE);
        ctx.fillStyle = "#D2A15C";
        ctx.fillRect(x, y, TILE, 3);
        ctx.fillRect(x, y, 3, TILE);
        ctx.fillRect(x + 19, y + 3, 2, TILE - 3);
        ctx.fillRect(x + 3, y + 19, TILE - 3, 2);
        ctx.fillStyle = "#F7DEB0";
        ctx.fillRect(x + 5, y + 5, 5, 5);
      } else { // 연한 식빵 들판 (캐릭터가 또렷하게 보이게 연하게)
        ctx.fillStyle = (c + r) % 2 === 0 ? "#F3E2C0" : "#EDDBB2";
        ctx.fillRect(x, y, TILE, TILE);
        if (h % 19 === 0) { // 빵가루 (드문드문)
          ctx.fillStyle = "#E0C898";
          const gx = x + 6 + (h % 20), gy = y + 6 + ((h >> 4) % 20);
          ctx.fillRect(gx, gy, 3, 3);
          ctx.fillRect(gx + 6, gy + 3, 2, 2);
        }
        if (XMAS && h % 9 === 0) { // 슈가파우더 눈 더미 (들판에만, 길은 안 덮는다)
          ctx.fillStyle = "rgba(255,255,255,0.95)";
          const sx2 = x + 2 + (h % 14), sy2 = y + 6 + ((h >> 5) % 16);
          ctx.fillRect(sx2, sy2, 18, 7);
          ctx.fillRect(sx2 + 4, sy2 - 3, 10, 3);
          ctx.fillRect(sx2 + 13, sy2 + 7, 8, 3);
          ctx.fillStyle = "rgba(214,228,240,0.85)"; // 아래쪽 옅은 그늘
          ctx.fillRect(sx2 + 2, sy2 + 7, 11, 2);
        }
        if (h % 53 === 0 && !blocked[r][c]) { // 사탕 꽃 (아주 가끔)
          const fc = ["#F77C9A", "#FFD66B", "#FFFFFF", "#C9A7E6"][h % 4];
          const fx = x + 8 + (h % 16), fy = y + 8 + ((h >> 3) % 16);
          ctx.fillStyle = fc;
          ctx.fillRect(fx - 3, fy, 3, 3); ctx.fillRect(fx + 3, fy, 3, 3);
          ctx.fillRect(fx, fy - 3, 3, 3); ctx.fillRect(fx, fy + 3, 3, 3);
          ctx.fillStyle = "#F6C244";
          ctx.fillRect(fx, fy, 3, 3);
        }
      }
    }
  }
}

/* ---------- 마을 게시판 그림 (코르크판 + 종이) ---------- */
let boardSpriteCv = null;
function boardSprite() {
  if (boardSpriteCv) return boardSpriteCv;
  const cv = document.createElement("canvas");
  cv.width = 24; cv.height = 32;
  const x = cv.getContext("2d");
  const box = (c, r, w, h, col) => { x.fillStyle = col; x.fillRect(c, r, w, h); };
  // 기둥 2개
  box(3, 15, 3, 16, "#8A5A33"); box(18, 15, 3, 16, "#8A5A33");
  box(3, 15, 1, 16, "#6E4525"); box(18, 15, 1, 16, "#6E4525");
  box(2, 15, 1, 16, OUTLINE); box(6, 15, 1, 16, OUTLINE);
  box(17, 15, 1, 16, OUTLINE); box(21, 15, 1, 16, OUTLINE);
  box(3, 30, 3, 1, OUTLINE); box(18, 30, 3, 1, OUTLINE);
  // 나무 틀 + 코르크판
  box(1, 2, 22, 16, "#A96A4D");
  box(1, 2, 22, 1, "#C27E5C");
  box(3, 4, 18, 12, "#D9B380");
  box(0, 1, 24, 1, OUTLINE); box(0, 18, 24, 1, OUTLINE);
  box(0, 2, 1, 16, OUTLINE); box(23, 2, 1, 16, OUTLINE);
  // 붙어 있는 종이들 + 압정
  box(5, 6, 5, 6, "#FFFFFF"); box(11, 5, 5, 5, "#FFD9E3"); box(15, 9, 4, 5, "#FFF3C2");
  box(7, 6, 1, 1, "#E8453C"); box(13, 5, 1, 1, "#4B7FD6"); box(16, 9, 1, 1, "#58B368");
  box(6, 8, 3, 1, "#C9B07E"); box(6, 10, 3, 1, "#C9B07E"); box(12, 7, 3, 1, "#C9B07E");
  boardSpriteCv = cv;
  return cv;
}

function drawBoard(f, x, y) {
  // 그림자
  ctx.fillStyle = "rgba(60,40,20,0.18)";
  ctx.beginPath();
  ctx.ellipse(x + 48, y + 124, 44, 9, 0, 0, Math.PI * 2);
  ctx.fill();
  if (!f.open) ctx.globalAlpha = 0.8;
  ctx.drawImage(boardSprite(), x, y, 96, 128);
  ctx.globalAlpha = 1;
  // 이름 팻말
  ctx.fillStyle = "#FFF9EC";
  ctx.fillRect(x + 14, y + 10, 68, 18);
  ctx.strokeStyle = OUTLINE;
  ctx.lineWidth = 2;
  ctx.strokeRect(x + 14, y + 10, 68, 18);
  ctx.font = "bold 12px 'Malgun Gothic', sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillStyle = f.open ? "#5B3A1E" : "#8C8475";
  ctx.fillText(f.name, x + 48, y + 20);
  if (!f.open) {
    ctx.fillStyle = "#5B3A1E";
    ctx.beginPath();
    ctx.roundRect(x + 10, y + 56, 76, 26, 8);
    ctx.fill();
    ctx.drawImage(uiIcon("cone"), x + 15, y + 60, 18, 18);
    ctx.fillStyle = "#FFF4E0";
    ctx.font = "bold 13px 'Malgun Gothic', sans-serif";
    ctx.fillText("준비 중", x + 56, y + 70);
  }
}

function drawBuilding(f) {
  const R = f.rect;
  const x = R.x - cam.x, y = R.y - cam.y;
  if (f.board) { drawBoard(f, x, y); return; }
  // 그림자
  ctx.fillStyle = "rgba(60,40,20,0.18)";
  ctx.beginPath();
  ctx.ellipse(x + R.w / 2, y + R.h - 4, R.w / 2 - 8, 12, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.drawImage(buildingSprite(f), x, y, R.w, R.h);

  // 간판 글씨 (또렷하게 화면 해상도로, 길면 글씨를 줄인다)
  const signText = f.name;
  ctx.font = "bold 17px 'Malgun Gothic', sans-serif";
  if (ctx.measureText(signText).width > 150) ctx.font = "bold 13px 'Malgun Gothic', sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillStyle = f.open ? "#5B3A1E" : "#8C8475";
  ctx.fillText(signText, x + R.w / 2, y + 24 * 4 + 2);

  if (XMAS) drawXmasOnBuilding(f, x, y, FACILITIES.indexOf(f), performance.now()); // 크리스마스 겉 꾸미기
}

// 가게 앞에 세워 둔 나무 팻말 (공사 중 · 준비 중)
function drawStandSign(f, text) {
  const x = (f.c0 + 0.9) * TILE - cam.x;       // 문 왼쪽 앞
  const y = (f.r0 + 4) * TILE - 2 - cam.y;     // 건물 앞 바닥
  if (x < -60 || x > canvas.width + 60) return;
  ctx.fillStyle = "rgba(60,40,20,0.16)";
  ctx.beginPath(); ctx.ellipse(x, y + 2, 26, 5, 0, 0, Math.PI * 2); ctx.fill();
  // 다리 2개
  ctx.fillStyle = "#8A5A33";
  ctx.fillRect(x - 14, y - 22, 4, 22); ctx.fillRect(x + 10, y - 22, 4, 22);
  ctx.strokeStyle = OUTLINE; ctx.lineWidth = 2;
  ctx.strokeRect(x - 14, y - 22, 4, 22); ctx.strokeRect(x + 10, y - 22, 4, 22);
  // 판자 + 위쪽 공사 줄무늬
  ctx.fillStyle = "#F4DCAE";
  ctx.fillRect(x - 27, y - 48, 54, 30);
  ctx.fillStyle = "#F6C244";
  ctx.fillRect(x - 27, y - 48, 54, 5);
  ctx.fillStyle = "#5B3A1E";
  for (let i = 0; i < 5; i++) ctx.fillRect(x - 27 + 6 + i * 11, y - 48, 5, 5);
  ctx.strokeStyle = OUTLINE;
  ctx.strokeRect(x - 27, y - 48, 54, 30);
  // 글자
  ctx.fillStyle = "#5B3A1E";
  ctx.font = "bold 15px 'Malgun Gothic', sans-serif";
  ctx.textAlign = "center"; ctx.textBaseline = "middle";
  ctx.fillText(text, x, y - 29);
  // 옆의 고깔
  ctx.drawImage(uiIcon("cone"), x + 20, y - 15, 16, 16);
}

// 나무·덤불·밀 이삭 그리기 (열매 나무만, 쉬는 시간에만 열매가 보인다)
function drawPlantAt(c, r, kind, fruit) {
  const x = c * TILE + TILE / 2 - cam.x;
  const y = (r + 1) * TILE - cam.y;
  const nowMs = performance.now();
  const sh = shakeUntil[c + "," + r];
  const off = sh && nowMs < sh ? Math.sin(nowMs / 30) * 3 : 0;
  const showFruit = fruit && VILLAGE_CFG.gatherOpen;
  const h = hash2(c, r);

  if (kind === "B") { // 딸기 덤불
    ctx.fillStyle = "rgba(60,40,20,0.16)";
    ctx.beginPath(); ctx.ellipse(x, y - 3, 26, 7, 0, 0, Math.PI * 2); ctx.fill();
    ctx.drawImage(plantSprite("B"), x - 30 + off, y - 38, 60, 42);
    if (XMAS) { // 슈가파우더 눈 모자
      ctx.fillStyle = "rgba(255,255,255,0.92)";
      ctx.fillRect(x - 16 + off, y - 36, 14, 4); ctx.fillRect(x + 2 + off, y - 39, 13, 4);
    }
  } else if (kind === "W") { // 밀 이삭 (살랑살랑 흔들림)
    const sway = Math.sin(nowMs / 600 + c * 1.3) * 1.5 + off;
    ctx.fillStyle = "rgba(60,40,20,0.12)";
    ctx.beginPath(); ctx.ellipse(x, y - 3, 20, 5, 0, 0, Math.PI * 2); ctx.fill();
    ctx.drawImage(plantSprite("W", showFruit), x - 24 + sway, y - 52, 48, 54);
    if (showFruit) { // 잘 익은 반짝임
      ctx.fillStyle = "#FFF4C2";
      ctx.fillRect(x - 10 + sway + ((h >> 2) % 16), y - 48 + (h % 10), 3, 3);
    }
  } else { // P: 프레첼 나무
    ctx.fillStyle = "rgba(60,40,20,0.18)";
    ctx.beginPath(); ctx.ellipse(x, y - 4, 24, 8, 0, 0, Math.PI * 2); ctx.fill();
    ctx.drawImage(plantSprite("P"), x - 33 + off, y - 88, 66, 88);
    if (XMAS) { // 슈가파우더 눈 모자
      ctx.fillStyle = "rgba(255,255,255,0.92)";
      ctx.fillRect(x - 17 + off, y - 80, 12, 4); ctx.fillRect(x - 3 + off, y - 86, 14, 4); ctx.fillRect(x + 9 + off, y - 75, 10, 4);
    }
    if (showFruit) {
      const fruitCols = ["#E8453C", "#F6D44C", "#FFB3A7"];
      for (let i = 0; i < 3; i++) {
        const fx = x - 24 + ((h >> (i * 4)) % 38) + off;
        const fy = y - 82 + ((h >> (i * 3 + 2)) % 24);
        ctx.fillStyle = OUTLINE; ctx.fillRect(fx - 1, fy - 1, 8, 8);
        ctx.fillStyle = fruitCols[(h + i) % 3]; ctx.fillRect(fx, fy, 6, 6);
      }
    }
  }
}

// 바게트 벤치 (앉은 캐릭터 뒤에 그려져서 다리를 가려 준다)
function drawBenchAt(b) {
  const x = (b.c + b.w / 2) * TILE - cam.x;
  const y = (b.r + 1) * TILE - cam.y;
  if (b.macaron) return; // 마카롱은 돌 그림을 그대로 쓴다
  if (b.fishing) { // 낚시 자리: 딸기 방석 + 노란 깃발
    ctx.drawImage(fishSpotSprite(), x - 32, y - 40, 56, 40);
    return;
  }
  ctx.fillStyle = "rgba(60,40,20,0.16)";
  if (b.long) {
    ctx.beginPath(); ctx.ellipse(x, y - 3, (b.w * TILE) / 2 + 4, 7, 0, 0, Math.PI * 2); ctx.fill();
    const sp = longBenchSprite(b.w);
    ctx.drawImage(sp, x - sp.width * 1.5, y - 36, sp.width * 3, 36);
  } else {
    ctx.beginPath(); ctx.ellipse(x, y - 3, 34, 7, 0, 0, Math.PI * 2); ctx.fill();
    ctx.drawImage(benchSprite(), x - 39, y - 36, 78, 36);
  }
}

// 모두 모이는 긴 식탁 (위·아래 긴 의자 사이의 큰 테이블)
function drawLongTable() {
  const x = LONG_TABLE.c0 * TILE - cam.x, y = LONG_TABLE.r0 * TILE - cam.y;
  const w = LONG_TABLE.w * TILE;
  if (x + w < -60 || x > canvas.width + 60) return;
  // 그림자
  ctx.fillStyle = "rgba(60,40,20,0.16)";
  ctx.beginPath(); ctx.ellipse(x + w / 2, y + 34, w / 2 + 8, 9, 0, 0, Math.PI * 2); ctx.fill();
  // 나무 다리
  ctx.fillStyle = "#8A5A33";
  ctx.fillRect(x + 12, y + 16, 10, 18); ctx.fillRect(x + w - 22, y + 16, 10, 18);
  ctx.strokeStyle = OUTLINE; ctx.lineWidth = 2;
  ctx.strokeRect(x + 12, y + 16, 10, 18); ctx.strokeRect(x + w - 22, y + 16, 10, 18);
  // 나무 상판 + 크림색 식탁보
  ctx.fillStyle = "#C98A6B";
  ctx.fillRect(x - 8, y - 10, w + 16, 30);
  ctx.fillStyle = "#FFF6E6";
  ctx.fillRect(x - 4, y - 10, w + 8, 22);
  ctx.fillStyle = "#F3E2C2";
  ctx.fillRect(x - 4, y + 7, w + 8, 5);
  ctx.strokeStyle = OUTLINE;
  ctx.strokeRect(x - 8, y - 10, w + 16, 30);
  // 접시들
  for (let i = 0; i < LONG_TABLE.w; i++) {
    const px = x + i * TILE + TILE / 2;
    ctx.fillStyle = "#FFFFFF";
    ctx.beginPath(); ctx.ellipse(px, y + 1, 10, 5, 0, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = "#D9C9A8"; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.ellipse(px, y + 1, 10, 5, 0, 0, Math.PI * 2); ctx.stroke();
  }
  // 가운데 컵 (우리 반 바구니를 다 채우면 컵 대신 큰 식빵)
  if (basketState && basketState.done) {
    ctx.drawImage(loafSprite(), x + w / 2 - 39, y - 50, 78, 66); // 3배 크기 도트
  } else {
    ctx.drawImage(uiIcon("cup"), x + w / 2 - 8, y - 9, 16, 16);
  }
}

// 낚싯대: 손에서 앞(아래쪽 바다)으로 뻗고, 줄 끝의 찌가 물 위에서 흔들린다.
// 물고기가 물면(bite) 찌가 크게 흔들리고 물결이 퍼진다.
// jerk(0~1): 당기기를 눌렀을 때 뒤로 휙 젖힌 정도. -1이면 보통 낚시 중
// friend: 친구 낚싯대 (가짜 입질·입질 없이 찌만 천천히. 동작 줄이기면 찌가 가만히 있다)
function drawRod(x, y, now, bite, jerk, friend) {
  const hx = x + 10, hy = y - 10;         // 손
  const j = Math.max(0, jerk === undefined ? -1 : jerk);
  // 낚싯대 끝: 앞쪽 바다 위 → 뒤로 젖히면 머리 위 뒤쪽
  const tx = x + 36 + (-4 - 36) * j, ty = y + 12 + (-58 - 12) * j;
  // 가짜 입질: 0.35초 동안 찌가 작게 한 번 "톡" 잠겼다 올라온다 (진짜 입질처럼 계속 흔들리지 않는다)
  const fk = !friend && !bite && me.fishing && me.fishing.fakeAt ? (now - me.fishing.fakeAt) / 350 : -1;
  const nibble = fk >= 0 && fk < 1 ? Math.sin(Math.PI * fk) * 3 : 0;
  const bob = friend ? (REDUCED ? 0 : Math.sin((now + friend) / 260) * 1.5)
    : bite ? Math.sin(now / 55) * 4 : Math.sin(now / 260) * 1.5 + nibble;
  const bx = tx + 2 + (bite ? Math.sin(now / 90) * 2 : 0), by = y + 38 + bob; // 찌 (바다 칸 위)
  // 젖힐 때는 줄에 끌려 낚싯대가 앞쪽으로 살짝 휜다
  const mx = (hx + tx) / 2 + 9 * j, my = (hy + ty) / 2 + 7 * j;
  ctx.strokeStyle = OUTLINE; ctx.lineWidth = 5;
  ctx.beginPath(); ctx.moveTo(hx, hy); ctx.quadraticCurveTo(mx, my, tx, ty); ctx.stroke();
  ctx.strokeStyle = "#B8864C"; ctx.lineWidth = 3;
  ctx.beginPath(); ctx.moveTo(hx, hy); ctx.quadraticCurveTo(mx, my, tx, ty); ctx.stroke();
  if (jerk !== undefined && jerk >= 0) { // 낚아채는 중: 줄은 날아오는 것 쪽으로, 찌는 없다
    const p = catchObjScreen(now);
    if (p) {
      ctx.strokeStyle = "rgba(255,255,255,0.95)"; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.moveTo(tx, ty); ctx.lineTo(p.x, p.y); ctx.stroke();
    }
    return;
  }
  ctx.strokeStyle = "rgba(255,255,255,0.95)"; ctx.lineWidth = 1.5; // 낚싯줄
  ctx.beginPath(); ctx.moveTo(tx, ty); ctx.lineTo(bx, by - 4); ctx.stroke();
  if (bite) { // 물결
    const k = (now % 700) / 700;
    ctx.strokeStyle = `rgba(255,255,255,${0.9 - k * 0.8})`; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.ellipse(bx, by + 4, 8 + k * 12, 3 + k * 4, 0, 0, Math.PI * 2); ctx.stroke();
  } else if (fk >= 0 && fk < 1.6) { // 가짜 입질: 작은 물결 한 번만
    const k = fk / 1.6;
    ctx.strokeStyle = `rgba(255,255,255,${0.7 * (1 - k)})`; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.ellipse(bx, by + 4, 5 + k * 6, 2 + k * 2, 0, 0, Math.PI * 2); ctx.stroke();
  }
  ctx.fillStyle = OUTLINE; ctx.fillRect(bx - 4, by - 5, 9, 11);      // 찌 (위 분홍, 아래 흰색)
  ctx.fillStyle = "#F77C9A"; ctx.fillRect(bx - 3, by - 4, 7, 4);
  ctx.fillStyle = "#FFFFFF"; ctx.fillRect(bx - 3, by, 7, 5);
}

// 친구가 낚은 것: "i:재료id:..." / "f:물고기id:..." → 그림 (모르는 것이면 null)
function caughtSprite(s) {
  const [k, id] = String(s).split(":");
  if (k === "i" && ITEMS.some((v) => v.id === id)) return itemSprite(id);
  if (k === "f" && FISH.some((v) => v.id === id)) return fishSprite(id);
  return null;
}
// 친구 머리 위(이름표 위)에 낚은 것 그림을 2초 동안. 알림·글자·소리 없이 조용히.
// 동작 줄이기면 떠오르거나 흐려지지 않고 그대로 있다가 사라진다
const FRIEND_CATCH_MS = 2000;
function drawFriendCatches(now) {
  for (const fr of friends) {
    if (!fr.catchShow) continue;
    const t = now - fr.catchShow.t0;
    if (t > FRIEND_CATCH_MS) { fr.catchShow = null; continue; }
    const k = t / FRIEND_CATCH_MS;
    const x = dispX(fr) - cam.x;
    const top = fr._lbl ? fr._lbl.ly - 13 : dispY(fr) - cam.y - CHAR_SIZE - 17; // 이름표 윗변
    const y = top - 24 - (REDUCED ? 0 : Math.min(1, k * 4) * 6);               // 처음에 살짝 떠오른다
    ctx.save();
    if (!REDUCED && k > 0.8) ctx.globalAlpha = (1 - k) / 0.2;                  // 마지막에 흐려진다
    ctx.fillStyle = "#FFFFFF"; ctx.strokeStyle = OUTLINE; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.roundRect(x - 20, y - 20, 40, 40, 10); ctx.fill(); ctx.stroke();
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(fr.catchShow.sprite, x - 16, y - 16, 32, 32);
    ctx.restore();
  }
}

// 물고기가 물었을 때 머리 위 "!" (이름표 위)
function drawBiteMark(now) {
  if (!me.fishing || me.fishing.phase !== "bite" || !me.sitting || !me.sitting.bench.fishing) return;
  const x = dispX(me) - cam.x;
  // 미션 화살표(이름표 바로 위)와 겹치지 않게 그보다 위에
  const y = (me._lbl ? me._lbl.ly : dispY(me) - cam.y - CHAR_SIZE - 4) - (missionTarget ? 58 : 38) + Math.sin(now / 150) * 3;
  ctx.fillStyle = "#FFFFFF";
  ctx.strokeStyle = OUTLINE;
  ctx.lineWidth = 3;
  ctx.beginPath(); ctx.arc(x, y, 17, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  ctx.font = "bold 24px 'Malgun Gothic', sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillStyle = "#E8453C";
  ctx.fillText("!", x, y + 1);
}

// 마카롱·도넛 돌
function drawRockAt(k, idx) {
  const x = k.c * TILE + TILE / 2 - cam.x;
  const y = (k.r + 1) * TILE - cam.y;
  ctx.fillStyle = "rgba(60,40,20,0.16)";
  ctx.beginPath(); ctx.ellipse(x, y - 3, 30, 7, 0, 0, Math.PI * 2); ctx.fill();
  if (k.kind === "macaron") ctx.drawImage(rockSprite("macaron", idx), x - 33, y - 46, 66, 45);
  else ctx.drawImage(rockSprite("donut", idx), x - 30, y - 48, 60, 48);
}

// 모래사장의 조개·불가사리 (바닥 꾸밈)
function drawShells() {
  for (const s of SHELLS) {
    const x = s.c * TILE + TILE / 2 - cam.x;
    const y = s.r * TILE + TILE / 2 - cam.y;
    if (x < -20 || x > canvas.width + 20 || y < -20 || y > canvas.height + 20) continue;
    if (s.k === "shell") {
      ctx.fillStyle = "#F3D9A4";
      ctx.beginPath(); ctx.ellipse(x, y, 8, 6, 0, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = "#C9A05F"; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.moveTo(x - 4, y - 3); ctx.lineTo(x - 2, y + 4); ctx.moveTo(x + 1, y - 4); ctx.lineTo(x + 2, y + 4); ctx.stroke();
      ctx.strokeStyle = OUTLINE; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.ellipse(x, y, 8, 6, 0, 0, Math.PI * 2); ctx.stroke();
    } else {
      ctx.fillStyle = "#F7A05C";
      ctx.strokeStyle = OUTLINE; ctx.lineWidth = 1.5;
      for (let i = 0; i < 5; i++) {
        const a = -Math.PI / 2 + (i * Math.PI * 2) / 5;
        ctx.beginPath();
        ctx.ellipse(x + Math.cos(a) * 5, y + Math.sin(a) * 5, 3.4, 3.4, 0, 0, Math.PI * 2);
        ctx.fill(); ctx.stroke();
      }
      ctx.fillStyle = "#FBC27E";
      ctx.beginPath(); ctx.ellipse(x, y, 4, 4, 0, 0, Math.PI * 2); ctx.fill();
    }
  }
}

// 하늘의 생크림 구름 (아주 천천히 흘러간다)
function drawSkyClouds(now) {
  ctx.save();
  ctx.globalAlpha = 0.92;
  for (let i = 0; i < 2; i++) {
    const w = i === 0 ? 150 : 110;
    const span = WORLD_W + 400;
    const wx = ((now * (0.010 + i * 0.004) + i * 900) % span) - 200;
    const x = wx - cam.x, y = (i === 0 ? 64 : 120) - cam.y;
    if (x < -200 || x > canvas.width + 200 || y < -80 || y > canvas.height + 80) continue;
    ctx.fillStyle = "#FFF3DC";
    ctx.beginPath(); ctx.ellipse(x, y + 6, w / 2, 13, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "#FFFFFF";
    ctx.beginPath();
    ctx.ellipse(x, y, w / 2, 14, 0, 0, Math.PI * 2);
    ctx.ellipse(x - w / 5, y - 10, w / 4, 12, 0, 0, Math.PI * 2);
    ctx.ellipse(x + w / 6, y - 8, w / 5, 10, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

// 땅의 반짝이는 재료 자리
function drawGroundSpots(now) {
  for (const s of groundSpots) {
    const x = s.c * TILE + TILE / 2 - cam.x;
    const y = s.r * TILE + TILE / 2 - cam.y;
    if (x < -30 || x > canvas.width + 30 || y < -30 || y > canvas.height + 30) continue;
    const tw = 0.6 + Math.sin(now / 300 + s.seed) * 0.4;
    ctx.save();
    ctx.globalAlpha = 0.55 + tw * 0.45;
    const sz = 18 + tw * 6;
    ctx.drawImage(uiIcon("spark"), x - sz / 2, y - sz / 2, sz, sz);
    ctx.restore();
  }
}

// 떨어지는 열매 (통통 튀고 나서 가방으로)
function updateDrawDrops(now, dt) {
  for (let i = dropAnims.length - 1; i >= 0; i--) {
    const d = dropAnims[i];
    if (now < d.startAt) continue;
    if (!d.settleAt) {
      d.vy += 900 * dt;
      d.y += d.vy * dt;
      if (d.y >= d.groundY) {
        d.y = d.groundY;
        if (!d.bounced) { d.bounced = true; d.vy = -Math.abs(d.vy) * 0.45; }
        else { d.settleAt = now; }
      }
    } else if (now - d.settleAt > 260) {
      dropAnims.splice(i, 1);
      collectCore(d.pick, d.isNew);
      continue;
    }
    ctx.drawImage(itemSprite(d.pick.id), d.x - cam.x - 13, d.y - cam.y - 26, 26, 26);
  }
}

/* ---------- 반짝이 효과와 떠오르는 재료 ---------- */
const particles = [];
function spawnSparkle(sx, sy, n) {
  for (let i = 0; i < n; i++) {
    const a = Math.random() * Math.PI * 2, sp = 40 + Math.random() * 90;
    particles.push({
      x: sx, y: sy,
      vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 40,
      life: 0.7 + Math.random() * 0.4,
      color: ["#FFD66B", "#F77C9A", "#9FDCC2", "#FFFFFF"][i % 4],
    });
  }
}
function updateDrawParticles(dt) {
  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i];
    p.life -= dt;
    if (p.life <= 0) { particles.splice(i, 1); continue; }
    p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 60 * dt;
    ctx.fillStyle = p.color;
    ctx.fillRect(p.x - 2, p.y - 2, 4, 4);
  }
}
function drawFloatItem() {
  if (!floatItem) return;
  const t = (performance.now() - floatItem.t0) / 1000;
  if (t > 1.1) { floatItem = null; return; }
  ctx.globalAlpha = Math.max(0, Math.min(1, 1.4 - t));
  ctx.drawImage(itemSprite(floatItem.id), dispX(me) - cam.x - 20, dispY(me) - cam.y - CHAR_SIZE - 46 - t * 30, 40, 40);
  ctx.globalAlpha = 1;
}

/* ---------- 미션 담당 "!" 표시와 길잡이 화살표 ---------- */
function drawNpcMark(now) {
  const npc = NPCS[0];
  if (Math.hypot(me.x - npc.x, me.y - npc.y) > TILE * 4) return;
  const x = npc.x - cam.x;
  const y = (npc._lbl ? npc._lbl.ly : npc.y - cam.y - CHAR_SIZE - 4) - 26 + Math.sin(now / 180) * 3;
  ctx.fillStyle = "#F6C244";
  ctx.strokeStyle = OUTLINE;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(x, y, 11, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = "#5B3A1E";
  ctx.font = "bold 16px sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("!", x, y + 1);
}

function drawMissionArrow(now) {
  if (!missionTarget) return;
  const x = dispX(me) - cam.x;
  const topY = (me._lbl ? me._lbl.ly : dispY(me) - cam.y - CHAR_SIZE - 4) - 26 + Math.sin(now / 200) * 3;
  const ang = Math.atan2(missionTarget.doorY - me.y, missionTarget.doorX - me.x);
  ctx.save();
  ctx.translate(x, topY);
  ctx.rotate(ang);
  ctx.fillStyle = "#F6C244";
  ctx.strokeStyle = OUTLINE;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(13, 0); ctx.lineTo(-8, -9); ctx.lineTo(-3, 0); ctx.lineTo(-8, 9);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.restore();
}

// 벤치에 앉아 있나 (나는 상태값으로, 친구는 앉는 자리와 겹치면 앉은 것으로 본다)
// 앉아 있으면 그 벤치를 돌려준다 (뒷모습으로 앉는 의자인지 알 수 있게)
function seatedInfo(ch) {
  if (ch === me) return me.sitting ? me.sitting.bench : null;
  if (!ch.remote) return null; // 사무소 캐릭터·가짜 친구는 앉지 않는다
  for (const b of BENCHES) {
    for (const s of b.seats) {
      if (Math.hypot(ch.x - s.x, ch.y - s.y) < 7) return b;
    }
  }
  return null;
}

function drawCharacter(ch, isMe, now) {
  if (ch.blinkSeed === undefined) ch.blinkSeed = Math.floor(Math.random() * 4000);
  const sitting = seatedInfo(ch);
  const moving = ch.moving && !sitting;

  // 걷기 들썩임 / 가만히 있을 때 숨쉬기 / 재료 얻었을 때 폴짝
  const walkBob = moving ? Math.sin(now / 110) * 1.6 : 0;
  const breath = !moving ? Math.sin((now + ch.blinkSeed) / 850) * 0.9 : 0;
  let hop = 0;
  if (ch.hopUntil && now < ch.hopUntil) {
    const t = 1 - (ch.hopUntil - now) / 300;
    hop = Math.sin(t * Math.PI) * 10;
  }

  const x = dispX(ch) - cam.x;
  // 앉으면 엉덩이가 의자 면에 닿게 가라앉힌다 (다리가 의자 앞면에 늘어진다)
  // 앉으면 몸을 웅크려 낮게. 마카롱 위에 앉으면 마카롱 높이만큼 올려 그린다
  const y = dispY(ch) - cam.y + walkBob + breath - hop + (sitting ? (sitting.macaron ? 13 - MACARON_LIFT : 13) : 0);
  const S = CHAR_SIZE;
  const clothes = ch.clothes || COLORS[ch.colorIdx].hex;

  // 그림자 (발 밑에만, 앉아 있을 때는 의자 위라 그리지 않는다)
  if (!sitting) {
    ctx.fillStyle = "rgba(60,40,20,0.22)";
    ctx.beginPath();
    ctx.ellipse(dispX(ch) - cam.x, dispY(ch) - cam.y + 8, S * 0.26, 6, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  // 방향·걸음·깜빡임
  const dir = sitting ? (sitting.sitUp ? "up" : "down") : (ch.dir || "down");
  const sDir = (dir === "left" || dir === "right") ? "side" : dir;
  const frame = moving ? 1 + (Math.floor(now / 160) % 2) : 0;
  const blink = sDir !== "up" && ((now + ch.blinkSeed) % 3700) < 140;

  const sx = x - S / 2, sy = y - S + 10;
  ctx.save();
  if (dir === "left") { ctx.translate(x * 2, 0); ctx.scale(-1, 1); } // 왼쪽은 오른쪽을 뒤집는다
  drawBread(ctx, ch.bread, clothes, ch.prop, sx, sy, S, sDir, frame, blink, sitting);
  ctx.restore();

  // 낚시 자리에서 던졌으면 아래(바다 쪽)로 드리운 낚싯대와 찌
  if (isMe && (me.fishing || catchAnim) && sitting && sitting.fishing) {
    drawRod(x, y, now, !!(me.fishing && me.fishing.phase === "bite"), catchAnim ? catchJerk(now) : -1);
  } else if (!isMe && ch.remote && ch.rod && sitting && sitting.fishing) { // 친구가 던졌으면 친구에게도
    drawRod(x, y, now, false, -1, 1 + ch.blinkSeed);
  }
  // 이름표는 모든 캐릭터를 그린 뒤 따로 그린다 (layoutAndDrawLabels)
}

/* ---------- 이름표: 겹치면 위로 비켜 그리기 ----------
   - 내 이름표가 먼저 자리를 잡고, 친구 이름표는 겹치면 한 칸씩 위로 비킨다.
   - 크기와 글자는 그대로, 위치만 바꾼다.
   - 비켜 난 이름표는 캐릭터와 이어 주는 작은 꼬리를 단다.
   - 내 이름표는 맨 마지막에 그려서 항상 맨 위에 보인다.
   - 위치는 보간으로 부드럽게 바뀐다(순간이동 금지). */
function rectsOverlap(a, b, m) {
  return a.x < b.x + b.w + m && a.x + a.w + m > b.x &&
         a.y < b.y + b.h + m && a.y + a.h + m > b.y;
}

// 이름표 자리 후보: 3개까지는 위로, 4개부터는 좌우로 번갈아 (높이는 최대 3줄)
// 맨 끝의 아래쪽 자리는 화면 위에서 잘릴 때만 쓰인다.
const LABEL_CANDS = (() => {
  const out = [[0, 0], [0, -27], [0, -54]];
  for (let col = 1; col <= 6; col++) {
    for (let row = 0; row < 3; row++) {
      out.push([-col * 74, -row * 27], [col * 74, -row * 27]);
    }
  }
  for (let col = 0; col <= 3; col++) {
    out.push([col * 74, 30], [-col * 74, 30]);
  }
  return out;
})();

function layoutAndDrawLabels(dt) {
  ctx.font = "bold 15px 'Malgun Gothic', sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";

  const chars = [me, ...friends, ...activeNpcs()]; // 내 이름표가 맨 먼저 자리를 잡는다 (항상 캐릭터 바로 위)
  const placed = [];
  // 우리 반 바구니 표시(왼쪽 위) 자리는 이름표가 피해 간다
  const hudR = basketHudRect();
  if (hudR) placed.push(hudR);
  // 상어 "부캉이" 이름표: 등지느러미 위. 학생 이름표가 이 자리를 피해 간다
  let sharkLbl = null;
  if (seaShark) {
    const sw = ctx.measureText(SHARK_NAME).width + 18;
    const sx = seaShark.x - cam.x, sy = seaShark.y - cam.y - Math.round(seaShark.lift || 0) - 40;
    if (sx > -sw && sx < canvas.width + sw && sy > -20 && sy < canvas.height + 20) {
      sharkLbl = { x: sx, ly: sy, w: sw };
      placed.push({ x: sx - sw / 2, y: sy - 12, w: sw, h: 24 });
    }
  }
  for (const ch of chars) {
    const prop = PROPS.find((p) => p.id === ch.prop);
    const seated = seatedInfo(ch); // 앉아 있으면 이름표 옆에 작은 컵 표시
    const iconW = (prop ? 21 : 0) + (seated ? 21 : 0);
    const textW = ctx.measureText(ch.name).width;
    const w = textW + 18 + iconW;
    const bx = dispX(ch) - cam.x;
    const by = dispY(ch) - cam.y - CHAR_SIZE - 4 - (seated && seated.macaron ? MACARON_LIFT - 13 : 0); // 기본 위치: 머리 위

    // 빈 자리 찾기 (화면 위·왼쪽·오른쪽으로 잘리는 자리는 건너뛴다)
    let tx = 0, ty = 0, found = false;
    const fits = (cx, cy) => {
      const r = { x: bx + cx - w / 2, y: by + cy - 12, w, h: 24 };
      if (r.y < 6 || r.x < 4 || r.x + r.w > canvas.width - 4) return false; // 화면 밖으로 잘리면 안 됨
      return !placed.some((p) => rectsOverlap(r, p, 4));
    };
    for (const [cx, cy] of LABEL_CANDS) {
      if (!fits(cx, cy)) continue;
      tx = cx; ty = cy; found = true;
      break;
    }
    // 후보가 다 차면 더 위·더 옆으로 찾아서, 어떤 경우에도 서로 겹치지 않게 한다
    for (let row = 3; !found && row < 12; row++) {
      for (const cx of [0, -74, 74, -148, 148, -222, 222]) {
        if (fits(cx, -row * 27)) { tx = cx; ty = -row * 27; found = true; break; }
      }
    }
    placed.push({ x: bx + tx - w / 2, y: by + ty - 12, w, h: 24 });

    // 부드럽게 이동 (깜빡임, 순간이동 금지)
    if (ch.lblX === undefined) { ch.lblX = tx; ch.lblY = ty; }
    const k = Math.min(1, dt * 10);
    ch.lblX += (tx - ch.lblX) * k;
    ch.lblY += (ty - ch.lblY) * k;
    ch._lbl = { x: bx + ch.lblX, ly: by + ch.lblY, w, textW, iconW, prop, seated };
  }

  // 1) 꼬리 먼저: 얇게, 이름표 상자 뒤에 깔리게
  for (const ch of chars) {
    const L = ch._lbl;
    const hx = dispX(ch) - cam.x;
    const hy = dispY(ch) - cam.y - CHAR_SIZE + 8;
    if (Math.hypot(L.x - hx, L.ly + 11 - hy) > 14) {
      ctx.strokeStyle = "rgba(74,46,20,0.55)";
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(L.x, L.ly + 11);
      ctx.lineTo(hx, hy);
      ctx.stroke();
    }
  }
  // 상어 이름표 (학생 이름표와 같은 모양, 흰 상자)
  if (sharkLbl) {
    ctx.fillStyle = "rgba(255,255,255,0.92)";
    ctx.strokeStyle = OUTLINE;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.roundRect(sharkLbl.x - sharkLbl.w / 2, sharkLbl.ly - 12, sharkLbl.w, 24, 12);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = "#5B3A1E";
    ctx.fillText(SHARK_NAME, sharkLbl.x, sharkLbl.ly + 1);
  }
  // 2) 상자: 친구 먼저, 내 것은 맨 마지막(항상 맨 앞, 절대 가려지지 않음)
  for (let i = chars.length - 1; i >= 0; i--) {
    const ch = chars[i], L = ch._lbl;
    ctx.fillStyle = (ch === me) ? "rgba(246,194,68,0.95)" : "rgba(255,255,255,0.92)";
    ctx.strokeStyle = OUTLINE;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.roundRect(L.x - L.w / 2, L.ly - 12, L.w, 24, 12);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = "#5B3A1E";
    ctx.fillText(ch.name, L.x - L.iconW / 2, L.ly + 1);
    let iconX = L.x - L.iconW / 2 + L.textW / 2 + 3;
    if (L.prop) { ctx.drawImage(propIcon(L.prop.id), iconX, L.ly - 9, 18, 18); iconX += 20; }
    if (L.seated) ctx.drawImage(uiIcon("cup"), iconX, L.ly - 9, 18, 18); // 앉아 있어요
  }
}

function drawWalkMarker(now) {
  if (!walkMarker || !me.path.length) return;
  const t = (now - walkMarker.t) / 400;
  const x = walkMarker.x - cam.x, y = walkMarker.y - cam.y;
  ctx.strokeStyle = "rgba(255,255,255,0.9)";
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.ellipse(x, y, 12 + Math.sin(t * 4) * 3, 7 + Math.sin(t * 4) * 1.5, 0, 0, Math.PI * 2);
  ctx.stroke();
  ctx.fillStyle = "#F6C244";
  ctx.beginPath();
  ctx.ellipse(x, y, 5, 3.5, 0, 0, Math.PI * 2);
  ctx.fill();
}

/* ============================================================
   메인 루프
   ============================================================ */
let lastT = performance.now();

function loop(now) {
  requestAnimationFrame(loop);
  if (villageEl.classList.contains("hidden")) { lastT = now; return; }
  const dt = Math.min(0.05, (now - lastT) / 1000);
  lastT = now;

  moveActor(me, PLAYER_SPEED, dt);
  updateFriends(now, dt);
  applySeparation(dt); // 겹치면 살짝 밀려나기

  // 카메라가 내 캐릭터를 따라간다
  cam.x = Math.round(me.x - canvas.width / 2);
  cam.y = Math.round(me.y - canvas.height / 2);
  cam.x = Math.max(0, Math.min(WORLD_W - canvas.width, cam.x));
  cam.y = Math.max(0, Math.min(WORLD_H - canvas.height, cam.y));
  if (WORLD_W < canvas.width) cam.x = (WORLD_W - canvas.width) / 2;
  if (WORLD_H < canvas.height) cam.y = (WORLD_H - canvas.height) / 2;

  updateEnterButton();     // 문·벤치 앞이면 버튼 보이기
  updateGatherButton(now); // 열매 나무·바다·반짝이 근처면 줍기 버튼 보이기
  updateGroundSpots(now);  // 땅의 반짝이는 재료 자리 관리
  updateMission();         // 사무소 캐릭터 대화와 미션 도착 확인
  updatePartyBgm();        // 바구니를 다 채운 뒤 30분: 식탁 가까이 가면 파티 음악
  updateGiftOffer(now);    // 선생님 선물 카드 (공지·미션 대화가 끝난 뒤에)

  ctx.clearRect(0, 0, canvas.width, canvas.height);
  drawGround(now);
  drawSeaAnimals(); // 바다 동물 (바닥 바로 위)
  drawShells();
  drawGroundSpots(now);
  drawWalkMarker(now);

  // 세로 위치 순서대로 그리기 (멀리 있는 것 먼저)
  const items = [];
  for (const f of FACILITIES) items.push({ y: f.baseY, draw: () => drawBuilding(f) });
  for (const [c, r] of borderTrees) items.push({ y: (r + 1) * TILE, draw: () => drawPlantAt(c, r, "P", 0) });
  for (const t of TREES) items.push({ y: (t.r + 1) * TILE, draw: () => drawPlantAt(t.c, t.r, t.kind, t.fruit) });
  ROCKS.forEach((k, i) => items.push({ y: (k.r + 1) * TILE, draw: () => drawRockAt(k, i) }));
  // 벤치는 캐릭터 뒤에 깔려서, 앉으면 의자 위에 걸터앉은 모습이 보인다
  for (const b of BENCHES) items.push({ y: b.r * TILE + 4, draw: () => drawBenchAt(b) });
  items.push({ y: (LONG_TABLE.r0 + 1) * TILE, draw: drawLongTable }); // 모두 모이는 긴 식탁
  // 농장 울타리와 동물 (동물 자리는 시간으로 정해져 모두에게 같다)
  for (const fc of FARM_FENCE) items.push({ y: (fc.r + 1) * TILE, draw: () => drawFenceCell(fc) });
  for (const a of ANIMALS) {
    const p = animalPosAt(a, Date.now());
    items.push({ y: p.y + 2, draw: () => drawAnimalAt(a, p, now) });
  }
  if (XMAS_FORCE && !XMAS) applyChristmas(true); // 주소에 ?xmas=1 이면 켠다
  if (XMAS) {
    items.push({ y: (XMAS_TREE.r + 1) * TILE, draw: () => drawXmasTree(now) }); // 광장 쿠키 트리
    XMAS_SNOWMEN.forEach((sm, i) => items.push({ y: (sm.r + 1) * TILE, draw: () => drawSnowman(sm, i) })); // 슈크림 눈사람들
  }
  // 가게 앞 나무 팻말: 카페는 공사 중, 닫힌 가게는 준비 중
  for (const f of FACILITIES) {
    if (f.board) continue;
    if (!f.open) items.push({ y: (f.r0 + 4) * TILE + 1, draw: () => drawStandSign(f, "준비 중") });
  }
  collectSprouts(items, now); // 쉬는 중 새싹 (캐릭터 뒤에 깔린다)
  for (const npc of activeNpcs()) items.push({ y: npc.y, draw: () => drawCharacter(npc, false, now) });
  for (const fr of friends) items.push({ y: dispY(fr), draw: () => drawCharacter(fr, false, now) });
  items.push({ y: dispY(me), draw: () => drawCharacter(me, true, now) });
  items.sort((a, b) => a.y - b.y);
  for (const it of items) {
    it.draw();
  }

  updateDrawDrops(now, dt); // 떨어지는 열매

  // 이름표는 맨 마지막에 (겹침 비켜 그리기 + 내 이름표 항상 맨 위)
  layoutAndDrawLabels(dt);
  drawBubbles(now); // 친구 인사 말풍선

  // 사무소 캐릭터 "!", 미션 화살표, 물고기 입질 "!", 떠오르는 재료, 반짝이 효과, 생크림 구름
  drawNpcMark(now);
  drawMissionArrow(now);
  drawBiteMark(now);
  drawFriendCatches(now); // 친구가 낚은 것 (머리 위 그림 2초)
  drawCatchAnim(now); // 낚아채는 모션: 물보라와 날아오는 재료·물고기
  drawFloatItem();
  drawFireworks(); // 우리 반 바구니를 다 채운 순간 식탁 위 폭죽
  updateDrawParticles(dt);
  drawSkyClouds(now);
  drawSnowfall(dt); // 크리스마스면 눈이 천천히 내린다
}

/* ============================================================
   화면 아이콘 끼우기 (이모지 대신 도트 그림)
   ============================================================ */
function setupIcons() {
  // 입장 화면 제목
  document.querySelector(".logo").prepend(mkIcon(charSprite("bun", COLORS[0].hex, "down", 0, false, false)));
  // 오른쪽 위 버튼들 (셋 다 같은 크기의 도트 아이콘)
  $("photoBtn").appendChild(mkIcon(uiIcon("camera")));
  $("dexBtn").appendChild(mkIcon(uiIcon("book")));
  $("bagBtn").appendChild(mkIcon(uiIcon("bag")));
  // 창 제목들
  $("bagTitle").prepend(mkIcon(uiIcon("bag")));
  $("dexTitle").prepend(mkIcon(uiIcon("book")));
  $("boardTitle").prepend(mkIcon(uiIcon("pin")));
  $("boardNoticeTitle").prepend(mkIcon(uiIcon("megaphone")));
  $("photoTitle").prepend(mkIcon(uiIcon("camera")));
  // 공지 말풍선
  $("notice").prepend(mkIcon(uiIcon("megaphone")));
  // 우리 반 바구니
  $("basketHudIco").appendChild(mkIcon(uiIcon("basket")));
  $("basketTitle").prepend(mkIcon(uiIcon("basket")));
  // 칭찬 배너의 도트 별
  $("praiseStar").appendChild(mkIcon(uiIcon("spark")));
}

/* ============================================================
   시작
   ============================================================ */
setupIcons();
setupSoundBtn();
setupEntry();
setupBag();
resize();
requestAnimationFrame(loop);
