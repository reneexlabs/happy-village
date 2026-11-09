/* ============================================================
   행복만빵 마을 - 1단계 (서버 없이 화면만, 가짜 데이터)
   - 마을 지도 / 내 캐릭터 이동 / 시설 카드 / 소품 입기
   ============================================================ */
"use strict";

/* ---------- 기본 설정 ---------- */
const TILE = 40;            // 타일 한 칸 크기(px)
const COLS = 48, ROWS = 36; // 마을 크기(타일 수)
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
const CLASS = (new URLSearchParams(location.search).get("class") || "A").toUpperCase();
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
  { id: "cafe",    name: "빵나라 카페", emoji: "☕", open: true,
    task: "따뜻한 간식을 먹으며 쉬어요.", link: "",
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

// 가장자리 숲 (위·아래·왼쪽만, 오른쪽은 바다)
const borderTrees = [];
for (let r = 0; r < ROWS; r++) {
  for (let c = 0; c < COLS; c++) {
    if (ground[r][c] >= 3) continue; // 바다·모래·선착장은 그대로
    if (r < 2 || r >= ROWS - 2 || c < 2) {
      blocked[r][c] = true;
      if ((c * 7 + r * 5) % 2 === 0) borderTrees.push([c, r]);
    }
  }
}
// 모래사장 위·아래 끝은 숲으로 막는다
for (const r of [0, 1, 34, 35]) { blocked[r][43] = true; ground[r][43] = 0; }
borderTrees.push([43, 0], [43, 34]);

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

// 모두 모이는 긴 식탁: 가운데 큰 테이블, 위·아래 긴 의자에 7명씩 14명이 앉는다
// 광장에서 떨어진 아래쪽 들판에 둔다 (처음 들어온 화면에는 안 보인다)
const LONG_TABLE = { c0: 13, r0: 30, w: 7 };

// 바게트 벤치: 마을 3개 + 선착장 끝 1개 + 긴 식탁의 긴 의자 2개
const BENCHES = [
  { c: 20, r: 22 }, { c: 28, r: 22 }, { c: 8, r: 13 },
  { c: 46, r: 15, dock: true },
  { c: LONG_TABLE.c0, r: LONG_TABLE.r0 - 1, w: LONG_TABLE.w, long: true, exitUp: true },
  // 아래쪽 의자는 식탁을 바라보고 앉아서 뒷모습이 보인다
  { c: LONG_TABLE.c0, r: LONG_TABLE.r0 + 1, w: LONG_TABLE.w, long: true, sitUp: true },
];
for (const b of BENCHES) {
  b.w = b.w || 1;
  for (let i = 0; i < b.w; i++) blocked[b.r][b.c + i] = true;
  if (b.long) {
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

// 모래사장 꾸밈: 조개와 불가사리
const SHELLS = [
  { c: 43, r: 8,  k: "shell" }, { c: 43, r: 12, k: "star" },
  { c: 43, r: 21, k: "star" }, { c: 43, r: 28, k: "shell" },
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
  if (propId && propId !== "cape") {
    const headProp = HEAD_PROPS.includes(propId);
    if (!back || headProp) { // 뒤에서는 머리 소품만 보인다
      draw(propSprite(propId), headProp && dir === "side" ? 2 : 0, headProp ? -3 : 4);
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
  } else if (id === "mic") {
    box(13, 13, 2, 4, "#8C8CA0"); box(12, 10, 4, 3, "#3B3B4A");
    px(13, 10, "#73738C"); box(12, 9, 4, 1, O); box(12, 13, 4, 1, O);
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
  if (iconName) btn.appendChild(mkIcon(uiIcon(iconName)));
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
  previewSelected.bread = me.bread;
  previewSelected.colorIdx = me.colorIdx;
  $("nickname").value = me.name;
  const sp = randomSpawnInPlaza();
  me.x = sp.x;
  me.y = sp.y;
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify({
      id: me.id, name: me.name, bread: me.bread, colorIdx: me.colorIdx, prop: me.prop, items: [...me.items],
    }));
  } catch (e) { /* 무시 */ }
  // 주소에서 id를 지워 둔다 (즐겨찾기해도 깨끗하게)
  try { history.replaceState(null, "", location.pathname + (CLASS !== "A" ? "?class=" + CLASS : "")); } catch (e) { /* 무시 */ }
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
      items: [...me.items],
    }));
  } catch (e) { /* 무시 */ }

  const wasLook = entryMode === "look";
  $("pin").value = "";
  setEntryMode(ONLINE() ? "login" : "new"); // 다음에 입장 화면이 열리면 처음 화면부터
  showVillageScreen(wasLook ? "새 모습으로 바꿨어요!" : `${me.name}님, 어서 와요!`);
  if (ONLINE() && me.id) sendMyPos(true); // 바뀐 모습을 친구 화면에도 바로
}

function showVillageScreen(msg) {
  entryEl.classList.add("hidden");
  villageEl.classList.remove("hidden");
  resize();
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
    applyOpenProps(v.openProps); // 시트의 "열린소품"대로 소품 열기
  }
  birthdays = st.birthdays || [];

  // 3) 시설: 이름, 할 일, 링크, 열림을 시트 내용으로 바꾼다
  for (const sf of st.facilities || []) {
    const f = FACILITIES.find((x) => x.id === sf.id);
    if (!f) continue;
    const wasOpen = f.open;
    if (sf.name) f.name = sf.name;
    if (sf.task) f.task = sf.task;
    f.link = sf.link || "";
    f.open = !!sf.open;
    if (f.id === "cafe") f.open = f.open && VILLAGE_CFG.gatherOpen; // 카페는 쉬는 시간에만 열린다
    if (firstStateDone && f.open && !wasOpen && f.id !== "cafe") showToast(`${f.name}이(가) 새로 열렸어요!`);
  }

  // 4) 공지: 시트 내용을 그대로 보여 준다 (맨 위 말풍선으로만)
  if (st.notice) $("noticeText").textContent = st.notice;

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
  });
}

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

  // 바다를 눌렀나? (모래사장·선착장 위에 서 있으면 낚시)
  if (clickedWater) {
    const myG = ground[Math.floor(me.y / TILE)] ? ground[Math.floor(me.y / TILE)][Math.floor(me.x / TILE)] : 0;
    if (myG === 5 || myG === 6) {
      me.fishSpot = { c: tc, r: tr };
      tryFish();
      return;
    }
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
$("dialogBox").addEventListener("click", (e) => { if (e.target.id !== "dialogGo") advanceDialog(); });
$("dialogGo").addEventListener("click", () => {
  $("dialog").classList.add("hidden");
  dialog = null;
  const dest = FACILITIES.find((f) => f.id === VILLAGE_CFG.missionDest);
  if (dest) { missionTarget = dest; showToast("화살표를 따라가 봐요!"); }
});

function updateMission() {
  // 그날 처음 사무소 캐릭터 가까이 가면 대화가 저절로 시작된다
  if (!dialog && $("dialog").classList.contains("hidden") && noModalOpen()) {
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
    const u = open.includes(p.id);
    if (u !== p.unlocked) { changed = true; if (u) newly = true; p.unlocked = u; }
  }
  if (changed) {
    buildPropList();
    // 입고 있던 소품이 잠기면 원래 모습이 된다
    if (me.prop && !open.includes(me.prop)) {
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
    const btn = document.createElement("button");
    btn.className = "prop-btn";
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
      me.prop = (me.prop === p.id) ? null : p.id; // 다시 누르면 원래 모습, 한 번에 하나만
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
      showToast(me.prop ? `${p.name} 꾸미기 완료! ${p.emoji}` : "원래 모습이 되었어요.");
    });
    list.appendChild(btn);
  });
  refreshBag();
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
  { id: "egg",        name: "달걀",     from: "ground", shape: "egg",   c: "#FFF2DC", deco: "sparkle" },
  { id: "milk",       name: "우유",     from: "ground", shape: "cube",  c: "#F4F7FA", deco: "stripes" },
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
function pickFrom(fromType) {
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
let cooldowns = {};
try { cooldowns = JSON.parse(localStorage.getItem(GATHER_KEY) || "{}"); } catch (e) { /* 무시 */ }
const shakeUntil = {};   // 나무 흔들림 효과
let gatherSpot = null;
let floatItem = null;    // 방금 얻은 재료가 떠오르는 효과

function saveItems() {
  try {
    const saved = JSON.parse(localStorage.getItem(SAVE_KEY) || "{}");
    saved.items = [...me.items];
    localStorage.setItem(SAVE_KEY, JSON.stringify(saved));
  } catch (e) { /* 무시 */ }
  if (ONLINE() && me.id) api({ action: "items", class: CLASS, id: me.id, items: [...me.items].join(",") });
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
  // 2) 바다: 모래사장이나 선착장 위에 서 있을 때
  const g0 = ground[pr] ? ground[pr][pc] : 0;
  if (g0 === 5 || g0 === 6) {
    let wC = 0, wR = 0, wD = Infinity;
    for (let r = pr - 2; r <= pr + 2; r++) {
      for (let c = pc - 2; c <= pc + 2; c++) {
        if (!ground[r] || ground[r][c] !== 3) continue;
        const d = Math.hypot(me.x - (c + 0.5) * TILE, me.y - (r + 0.5) * TILE);
        if (d < wD) { wD = d; wC = c; wR = r; }
      }
    }
    if (wD < TILE * 2.4) return { type: "sea", key: "sea", c: wC, r: wR };
  }
  // 3) 땅의 반짝이는 재료
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
  const busy = me.sitting || (me.fishing && now < me.fishing.until) || dropAnims.length > 0;
  const spot = (VILLAGE_CFG.gatherOpen && !busy) ? findGatherSpot() : null; // 수업 시간에는 버튼이 없다
  // 쉬는 중인 곳이면 버튼을 아예 숨긴다 (새싹 표시만 보임)
  if (!spot || coolLeft(spot.key) > 0) {
    if (gatherSpot) { gatherSpot = null; btn.classList.add("hidden"); }
    return;
  }
  if (!gatherSpot || gatherSpot.key !== spot.key || btn.classList.contains("hidden")) {
    if (spot.type === "tree") setBtnIcon(btn, "shake", "흔들기");
    else if (spot.type === "sea") setBtnIcon(btn, "scoop", "낚시하기");
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

// 재료를 손에 넣었을 때 공통 처리 (폴짝 + 반짝 + 알림 + 저장)
function collectCore(pick, isNew) {
  me.items.add(pick.id);
  saveItems();
  me.hopUntil = performance.now() + 300; // 작게 한 번 폴짝
  spawnSparkle(dispX(me) - cam.x, dispY(me) - cam.y - 30, 10);
  floatItem = { id: pick.id, t0: performance.now() };
  playTone("gather");
  showToast(isNew ? `${pick.name}을(를) 처음 모았어요! 도감에 들어갔어요.` : `${pick.name}이(가) 또 나왔어요.`);
  if (isNew && me.items.size === ITEMS.length) {
    setTimeout(() => {
      showToast("재료 도감을 다 채웠어요! 축하해요!");
      spawnSparkle(canvas.width / 2, canvas.height / 2, 40);
      playTone("dex");
    }, 1400);
  }
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

// 낚시: 낚싯대를 들고 잠깐 기다리면 재료가 떠오른다
function tryFish() {
  if (!VILLAGE_CFG.gatherOpen) { showToast("지금은 수업 시간이에요. 쉬는 시간에 다시 와요"); return; }
  if (coolLeft("sea") > 0) { showToast("바다가 조금 쉬고 있어요. 잠시 뒤에 다시 와요"); return; }
  if (me.sitting) standUp();
  me.path = [];
  me.dir = "right"; // 바다는 오른쪽에 있다
  me.fishing = { until: performance.now() + 1400, done: false };
}

function finishFishing(spot) {
  const pick = pickFrom("sea");
  const isNew = !me.items.has(pick.id);
  setCooldown("sea", spot ? spot.c : 44, spot ? spot.r : Math.floor(me.y / TILE), VILLAGE_CFG.restMin);
  collectCore(pick, isNew);
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
  else if (spot.type === "sea") { me.fishSpot = { c: spot.c, r: spot.r }; tryFish(); }
  else pickGround(spot);
});

/* ---------- 재료 도감 창 ---------- */
function openDex() {
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
  $("dex").classList.remove("hidden");
}
$("dexBtn").addEventListener("click", openDex);
$("closeDex").addEventListener("click", () => $("dex").classList.add("hidden"));

/* ============================================================
   사진 찍기 (요구사항 5-5, 서버 없이 화면만)
   ============================================================ */
let photoBg = "office";

function drawPhoto() {
  const cv = $("photoCanvas"), x = cv.getContext("2d");
  x.imageSmoothingEnabled = false;
  const W = cv.width, H = cv.height;
  // 연한 식빵 들판 바탕 (빵나라 느낌)
  for (let r = 0; r < H / 20; r++) for (let c = 0; c < W / 20; c++) {
    x.fillStyle = (c + r) % 2 === 0 ? "#F3E2C0" : "#EDDBB2";
    x.fillRect(c * 20, r * 20, 20, 20);
  }

  // 배경 (건물은 작게 위쪽에, 캐릭터와 겹치지 않게)
  if (photoBg === "office" || photoBg === "cake") {
    const f = FACILITIES.find((v) => v.id === (photoBg === "office" ? "plaza" : "cake"));
    x.drawImage(buildingSprite(f), W / 2 - 76, 36, 152, 141);
  } else if (photoBg === "pond") { // 바닷가
    x.fillStyle = "#6FC3DE"; x.fillRect(0, 36, W, 96);       // 바다
    x.fillStyle = "#A8DEEE";
    for (let i = 0; i < 5; i++) x.fillRect(30 + (i * 61) % (W - 70), 52 + (i * 27) % 64, 16, 4);
    x.fillStyle = "#F8EED6"; x.fillRect(0, 132, W, 44);      // 설탕 모래
    x.fillStyle = "#FFFFFF";
    for (let i = 0; i < 7; i++) x.fillRect(16 + (i * 47) % (W - 30), 140 + (i * 13) % 28, 3, 3);
    x.fillStyle = "#F3D9A4"; // 조개
    x.beginPath(); x.ellipse(70, 158, 9, 7, 0, 0, Math.PI * 2); x.fill();
    x.strokeStyle = OUTLINE; x.lineWidth = 2;
    x.beginPath(); x.ellipse(70, 158, 9, 7, 0, 0, Math.PI * 2); x.stroke();
  } else { // 마을 숲 (프레첼 나무)
    x.drawImage(plantSprite("P"), 34, 60, 60, 80);
    x.drawImage(plantSprite("P"), W / 2 - 30, 40, 60, 80);
    x.drawImage(plantSprite("P"), W - 94, 68, 60, 80);
    x.drawImage(plantSprite("B"), W / 2 + 62, 148, 54, 32);
  }

  // 발밑 쿠키 길: 타일 여러 장으로 자연스럽게
  for (let c = 0; c < 5; c++) {
    for (let r = 0; r < 3; r++) {
      const tx = W / 2 - 100 + c * 40, ty2 = H - 184 + r * 36;
      x.fillStyle = (c + r) % 2 === 0 ? "#D9A866" : "#D2A05E";
      x.fillRect(tx, ty2, 40, 36);
      x.fillStyle = "#8A5A33";
      x.fillRect(tx + 8 + ((c * 7 + r * 5) % 14), ty2 + 6 + ((c * 3 + r * 11) % 14), 4, 4);
    }
  }
  x.strokeStyle = "#B8864C";
  x.lineWidth = 3;
  x.strokeRect(W / 2 - 100, H - 184, 200, 108);

  // 배경 소품: 캐릭터 가까이에 조금 큰 사탕 꽃과 풀
  const flowers = [[46, H - 196], [W - 52, H - 186], [70, H - 120], [W - 74, H - 112]];
  flowers.forEach(([fx, fy], i) => {
    x.fillStyle = ["#F77C9A", "#FFD66B", "#FFFFFF", "#C9A7E6"][i % 4];
    x.fillRect(fx - 5, fy, 5, 5); x.fillRect(fx + 5, fy, 5, 5);
    x.fillRect(fx, fy - 5, 5, 5); x.fillRect(fx, fy + 5, 5, 5);
    x.fillStyle = "#F6C244"; x.fillRect(fx, fy, 5, 5);
    x.fillStyle = "#58B368"; x.fillRect(fx + 1, fy + 10, 3, 7);
  });
  x.fillStyle = "#B8A868";
  [[36, H - 158], [W - 42, H - 150]].forEach(([gx, gy]) => {
    x.fillRect(gx, gy, 3, 9); x.fillRect(gx + 5, gy + 3, 3, 7);
  });

  // 내 옆 가까이 있는 친구도 같이 찍힌다 (최대 2명)
  const nearFriends = friends
    .map((f) => ({ f, d: Math.hypot(f.x - me.x, f.y - me.y) }))
    .filter((v) => v.d < TILE * 3)
    .sort((a, b) => a.d - b.d)
    .slice(0, 2)
    .map((v) => v.f);
  nearFriends.forEach((f, i) => {
    const fx = i === 0 ? W / 2 - 150 : W / 2 + 24;
    x.fillStyle = "rgba(60,40,20,0.22)";
    x.beginPath();
    x.ellipse(fx + 63, H - 102, 38, 9, 0, 0, Math.PI * 2);
    x.fill();
    drawBread(x, f.bread, COLORS[f.colorIdx].hex, f.prop, fx, H - 226, 126);
  });

  // 내 캐릭터: 발 밑에만 그림자 + 항상 맨 앞, 가운데에서 조금 아래
  x.fillStyle = "rgba(60,40,20,0.25)";
  x.beginPath();
  x.ellipse(W / 2, H - 98, 42, 10, 0, 0, Math.PI * 2);
  x.fill();
  drawBread(x, me.bread, COLORS[me.colorIdx].hex, me.prop, W / 2 - 80, H - 254, 160);
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
document.querySelectorAll(".pbg-btn").forEach((b) => {
  b.addEventListener("click", () => {
    photoBg = b.dataset.bg;
    document.querySelectorAll(".pbg-btn").forEach((v) => v.classList.toggle("selected", v === b));
    drawPhoto();
  });
});
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
  ["facilityCard", "bag", "dex", "board", "photo", "dialog"].forEach((id) => $(id).classList.add("hidden"));
  dialog = null;
}
// 바깥(어두운 부분) 누르면 닫기
["facilityCard", "bag", "dex", "board", "photo"].forEach((id) => {
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
    if (me.sitting || (me.fishing && performance.now() < me.fishing.until + 0)) {
      // 앉아 있거나 낚시하는 중에는 키 이동이 일어나지 않는다 (키를 누르면 먼저 일어난다)
    }
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
  // 가운데 컵
  ctx.drawImage(uiIcon("cup"), x + w / 2 - 8, y - 9, 16, 16);
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
  const y = dispY(ch) - cam.y + walkBob + breath - hop + (sitting ? 13 : 0);
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

  // 낚시 중이면 낚싯대와 찌
  if (ch.fishing && now < ch.fishing.until) {
    ctx.strokeStyle = "#8A5A33";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(x + 10, y - 26);
    ctx.lineTo(x + 34, y - 46);
    ctx.stroke();
    ctx.strokeStyle = "#FFFFFF";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(x + 34, y - 46);
    ctx.lineTo(x + 40, y + 2);
    ctx.stroke();
    ctx.fillStyle = "#E8453C";
    ctx.fillRect(x + 38, y - 1 + Math.sin(now / 240) * 2, 5, 5);
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
  for (const ch of chars) {
    const prop = PROPS.find((p) => p.id === ch.prop);
    const seated = seatedInfo(ch); // 앉아 있으면 이름표 옆에 작은 컵 표시
    const iconW = (prop ? 21 : 0) + (seated ? 21 : 0);
    const textW = ctx.measureText(ch.name).width;
    const w = textW + 18 + iconW;
    const bx = dispX(ch) - cam.x;
    const by = dispY(ch) - cam.y - CHAR_SIZE - 4; // 기본 위치: 머리 위

    // 빈 자리 찾기 (화면 위로 잘리는 자리는 건너뛴다)
    let tx = 0, ty = 0;
    for (const [cx, cy] of LABEL_CANDS) {
      const r = { x: bx + cx - w / 2, y: by + cy - 12, w, h: 24 };
      if (r.y < 6) continue; // 화면 위로 잘리면 안 됨
      if (placed.some((p) => rectsOverlap(r, p, 4))) continue;
      tx = cx; ty = cy;
      break;
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

  // 낚시가 끝나면 재료가 떠오른다
  if (me.fishing && now >= me.fishing.until && !me.fishing.done) {
    me.fishing.done = true;
    const sp = me.fishSpot;
    me.fishing = null;
    finishFishing(sp);
  }

  ctx.clearRect(0, 0, canvas.width, canvas.height);
  drawGround(now);
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
  // 가게 앞 나무 팻말: 카페는 공사 중, 닫힌 가게는 준비 중
  for (const f of FACILITIES) {
    if (f.board) continue;
    if (f.id === "cafe") items.push({ y: (f.r0 + 4) * TILE + 1, draw: () => drawStandSign(f, "공사 중") });
    else if (!f.open) items.push({ y: (f.r0 + 4) * TILE + 1, draw: () => drawStandSign(f, "준비 중") });
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

  // 사무소 캐릭터 "!", 미션 화살표, 떠오르는 재료, 반짝이 효과, 생크림 구름
  drawNpcMark(now);
  drawMissionArrow(now);
  drawFloatItem();
  updateDrawParticles(dt);
  drawSkyClouds(now);
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
