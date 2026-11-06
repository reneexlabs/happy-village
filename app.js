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

/* ---------- 가짜 데이터: 시설 7개 ---------- */
const FACILITIES = [
  { id: "plaza",   name: "마을 사무소", emoji: "🏠", open: true,
    task: "마을에 온 걸 환영해요!\n오늘의 공지를 확인해요.", link: "",
    roof: "#F77C9A", wall: "#FBEFD7", c0: 21, r0: 8 },
  { id: "cake",    name: "케이크 공방", emoji: "🎂", open: true,
    task: "첫날 선물 케이크를 만들어요.", link: "",
    roof: "#F6C244", wall: "#FBEFD7", c0: 7,  r0: 6 },
  { id: "menu",    name: "신메뉴 기획단", emoji: "🥐", open: false,
    task: "새 메뉴 아이디어를 내 봐요.", link: "",
    roof: "#9FDCC2", wall: "#FBEFD7", c0: 36, r0: 6 },
  { id: "dessert", name: "디저트 연구소", emoji: "🍮", open: false,
    task: "디저트 레시피를 연구해요.", link: "",
    roof: "#C9A7E6", wall: "#FBEFD7", c0: 5,  r0: 17 },
  { id: "photo",   name: "광고 사진관", emoji: "📷", open: false,
    task: "광고 사진을 만들어요.", link: "",
    roof: "#8FBFE8", wall: "#FBEFD7", c0: 38, r0: 17 },
  { id: "music",   name: "광고음악 제작소", emoji: "🎵", open: false,
    task: "우리 가게 CM송을 만들어요.", link: "",
    roof: "#FFB35C", wall: "#FBEFD7", c0: 12, r0: 24 },
  { id: "studio",  name: "마을 방송국", emoji: "📺", open: false,
    task: "홍보 영상을 만들어요.", link: "",
    roof: "#F77C9A", wall: "#FBEFD7", c0: 31, r0: 24 },
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
  { id: "bagel",     name: "베이글" },
  { id: "baguette",  name: "바게트" },
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
   지도 데이터 만들기
   ground: 0 풀, 1 길, 2 광장 바닥, 3 물
   blocked: 지나갈 수 없는 칸
   ============================================================ */
const ground = [], blocked = [];
for (let r = 0; r < ROWS; r++) {
  ground.push(new Array(COLS).fill(0));
  blocked.push(new Array(COLS).fill(false));
}

function carveH(r, c1, c2) { for (let c = Math.min(c1,c2); c <= Math.max(c1,c2); c++) ground[r][c] = 1; }
function carveV(c, r1, r2) { for (let r = Math.min(r1,r2); r <= Math.max(r1,r2); r++) ground[r][c] = 1; }

// 큰길
carveH(16, 6, 42);          // 가로 큰길
carveV(24, 13, 28);         // 세로 큰길
carveH(28, 14, 33);         // 아랫길 (음악 제작소 ~ 방송국)
carveH(21, 7, 40);          // 중간 아랫길 (연구소 ~ 사진관)
// 시설 문 앞 길
carveV(23, 12, 16);         // 광장(이장님 집)
carveV(9, 10, 16);          // 케이크 공방
carveV(38, 10, 16);         // 신메뉴 기획단

// 광장 바닥(원 모양)
for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) {
  const dx = c - 24, dy = r - 17;
  if (dx * dx / 20 + dy * dy / 13 <= 1) ground[r][c] = 2;
}

// 연못(물)
for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) {
  const dx = c - 32, dy = r - 13;
  if (dx * dx / 8 + dy * dy / 3.6 <= 1) { ground[r][c] = 3; blocked[r][c] = true; }
}

// 가장자리 나무 숲(두 줄)
const borderTrees = [];
for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) {
  if (r < 2 || r >= ROWS - 2 || c < 2 || c >= COLS - 2) {
    blocked[r][c] = true;
    if ((c * 7 + r * 5) % 2 === 0) borderTrees.push([c, r]); // 듬성듬성 그리기
  }
}

// 흩어진 나무
const TREES = [[4,4],[15,4],[28,4],[44,4],[3,12],[14,12],[31,19],[4,24],[29,24],
               [44,22],[5,31],[9,31],[20,32],[27,32],[40,31],[44,28],[18,24],[36,32]];
for (const [c, r] of TREES) blocked[r][c] = true;

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

/* ---------- 빵 캐릭터 스프라이트 ---------- */
const spriteCache = {};
function breadSprite(type, color) {
  const key = type + "_" + color;
  if (spriteCache[key]) return spriteCache[key];

  const g = newGrid();
  let eyeRow = 10; // 눈 위치(세로)

  if (type === "bun") {
    gEllipse(g, 10, 11.5, 6.6, 6);
  } else if (type === "loaf") {
    gEllipse(g, 7.2, 8.5, 3.7, 3.3);
    gEllipse(g, 12.8, 8.5, 3.7, 3.3);
    gRect(g, 4, 8, 13, 9);
    eyeRow = 11;
  } else if (type === "croissant") {
    gEllipse(g, 10, 9.8, 4.3, 3.9);
    gEllipse(g, 7.3, 10.6, 3.6, 3.4);
    gEllipse(g, 12.7, 10.6, 3.6, 3.4);
    gEllipse(g, 5.2, 12, 3, 2.8);
    gEllipse(g, 14.8, 12, 3, 2.8);
  } else if (type === "donut") {
    gEllipse(g, 10, 11.5, 7, 5.8);
    eyeRow = 12;
  } else if (type === "bagel") {
    gEllipse(g, 10, 11, 6.8, 5.8);
  } else if (type === "baguette") {
    gEllipse(g, 10, 11, 4.7, 7.7);
  }

  const cv = document.createElement("canvas");
  cv.width = 20; cv.height = 20;
  const x = cv.getContext("2d");

  const body = color, shade = shadeHex(color, 0.78), light = shadeHex(color, 1.22);

  // 몸통 + 음영
  for (let r = 0; r < 20; r++) for (let c = 0; c < 20; c++) {
    if (!g[r][c]) continue;
    let col = body;
    if (!((g[r + 1] || [])[c]) || !((g[r + 2] || [])[c])) col = shade;       // 아래쪽 그늘
    else if (r < 9 && c < 11 && !((g[r - 1] || [])[c] && g[r][c - 1])) col = light; // 왼쪽 위 밝게
    x.fillStyle = col; x.fillRect(c, r, 1, 1);
  }

  // 종류별 꾸미기
  x.fillStyle = shade;
  if (type === "donut") { // 초코 글레이즈 + 스프링클
    x.fillStyle = "#8A5A33";
    for (let r = 0; r < 11; r++) for (let c = 0; c < 20; c++) if (g[r][c]) x.fillRect(c, r, 1, 1);
    const sp = ["#FFF4E0", "#F77C9A", "#9FDCC2", "#F6C244"];
    [[6,7],[9,6],[13,7],[11,9],[7,9],[14,9]].forEach(([c, r], i) => {
      if (g[r][c]) { x.fillStyle = sp[i % 4]; x.fillRect(c, r, 1, 1); }
    });
  } else if (type === "croissant") { // 결 나누는 선
    x.fillStyle = shade;
    [[7, 8], [13, 8]].forEach(([c, r0]) => { for (let r = r0; r < r0 + 5; r++) if (g[r][c]) x.fillRect(c, r, 1, 1); });
  } else if (type === "baguette") { // 칼집 선
    x.fillStyle = shade;
    for (let i = 0; i < 3; i++) {
      const r0 = 6 + i * 4;
      for (let k = 0; k < 3; k++) if ((g[r0 + k] || [])[8 + k]) x.fillRect(8 + k, r0 + k, 1, 1);
    }
  } else if (type === "bagel") { // 가운데 고리 + 깨
    x.fillStyle = light;
    for (let r = 0; r < 20; r++) for (let c = 0; c < 20; c++) {
      const dx = (c - 10) / 4, dy = (r - 9.5) / 2.4;
      if (g[r][c] && dx * dx + dy * dy <= 1) x.fillRect(c, r, 1, 1);
    }
    x.fillStyle = shade;
    [[5,8],[8,6],[12,6],[15,8]].forEach(([c, r]) => { if (g[r][c]) x.fillRect(c, r, 1, 1); });
  } else if (type === "loaf") { // 윗면 밝은 빵 껍질
    x.fillStyle = light;
    for (let r = 5; r < 9; r++) for (let c = 0; c < 20; c++) if (g[r][c]) x.fillRect(c, r, 1, 1);
  }

  // 테두리(몸 주변을 진하게)
  x.fillStyle = OUTLINE;
  for (let r = 0; r < 20; r++) for (let c = 0; c < 20; c++) {
    if (g[r][c]) continue;
    const near = (g[r - 1] || [])[c] || (g[r + 1] || [])[c] || g[r][c - 1] || g[r][c + 1] ||
                 (g[r - 1] || [])[c - 1] || (g[r - 1] || [])[c + 1] || (g[r + 1] || [])[c - 1] || (g[r + 1] || [])[c + 1];
    if (near) x.fillRect(c, r, 1, 1);
  }

  // 얼굴 (눈, 볼, 입)
  const dark = "#3B2512";
  for (const ec of [6, 12]) {
    x.fillStyle = dark; x.fillRect(ec, eyeRow, 2, 2);
    x.fillStyle = "#FFFFFF"; x.fillRect(ec, eyeRow, 1, 1);
  }
  x.fillStyle = "#FF9FB6";
  if (g[eyeRow + 2] && g[eyeRow + 2][4]) x.fillRect(4, eyeRow + 2, 2, 1);
  if (g[eyeRow + 2] && g[eyeRow + 2][15]) x.fillRect(14, eyeRow + 2, 2, 1);
  x.fillStyle = dark; x.fillRect(9, eyeRow + 3, 2, 1);

  spriteCache[key] = cv;
  return cv;
}

/* ---------- 빵 + 소품 함께 그리기 ---------- */
// 머리에 쓰는 소품은 빵 종류별로 머리 높이에 맞춘다 (스프라이트 픽셀 단위)
const HEAD_DY = { bun: 1, loaf: 0, croissant: 2, donut: 1.5, bagel: 1, baguette: -1 };
const HEAD_PROPS = ["ribbon", "chefhat", "headphone"];
function drawBread(x, breadId, colorHex, propId, sx, sy, S) {
  if (propId === "cape") x.drawImage(propSprite("cape"), sx, sy, S, S);
  x.drawImage(breadSprite(breadId, colorHex), sx, sy, S, S);
  if (propId && propId !== "cape") {
    const dy = HEAD_PROPS.includes(propId) ? (HEAD_DY[breadId] || 0) * (S / 20) : 0;
    x.drawImage(propSprite(propId), sx, sy + dy, S, S);
  }
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

/* ---------- 나무 스프라이트 ---------- */
let treeSpriteCv = null;
function treeSprite() {
  if (treeSpriteCv) return treeSpriteCv;
  const cv = document.createElement("canvas");
  cv.width = 18; cv.height = 24;
  const x = cv.getContext("2d");
  const g = Array.from({ length: 24 }, () => new Array(18).fill(0));
  const el = (cx, cy, rx, ry) => {
    for (let r = 0; r < 24; r++) for (let c = 0; c < 18; c++) {
      const dx = (c - cx) / rx, dy = (r - cy) / ry;
      if (dx * dx + dy * dy <= 1) g[r][c] = 1;
    }
  };
  el(9, 7, 6, 6); el(5, 11, 4.6, 4.2); el(13, 11, 4.6, 4.2);
  // 줄기
  x.fillStyle = "#8A5A33"; x.fillRect(7, 15, 4, 8);
  x.fillStyle = "#6E4525"; x.fillRect(7, 15, 1, 8);
  x.fillStyle = OUTLINE; x.fillRect(6, 15, 1, 8); x.fillRect(11, 15, 1, 8); x.fillRect(7, 23, 4, 1);
  // 잎
  for (let r = 0; r < 24; r++) for (let c = 0; c < 18; c++) {
    if (!g[r][c]) continue;
    x.fillStyle = (r > 10 || (c > 11 && r > 6)) ? "#5E9C4F" : "#79B868";
    if (r < 5 && c < 10) x.fillStyle = "#8FCB7C";
    x.fillRect(c, r, 1, 1);
  }
  x.fillStyle = OUTLINE;
  for (let r = 0; r < 24; r++) for (let c = 0; c < 18; c++) {
    if (g[r][c]) continue;
    const near = (g[r - 1] || [])[c] || (g[r + 1] || [])[c] || g[r][c - 1] || g[r][c + 1];
    if (near) x.fillRect(c, r, 1, 1);
  }
  treeSpriteCv = cv;
  return cv;
}

/* ---------- 건물 스프라이트 ---------- */
const bldgCache = {};
function buildingSprite(f) {
  const key = f.id + (f.open ? "_o" : "_c");
  if (bldgCache[key]) return bldgCache[key];
  const cv = document.createElement("canvas");
  cv.width = 56; cv.height = 52;
  const x = cv.getContext("2d");
  const roof = f.open ? f.roof : "#B9AE9C";
  const roofB = shadeHex(roof, 0.8);
  const wall = f.open ? f.wall : "#D9CFBE";
  const box = (c, r, w, h, col) => { x.fillStyle = col; x.fillRect(c, r, w, h); };

  // 벽
  box(6, 18, 44, 29, wall);
  box(6, 18, 44, 1, shadeHex(wall, 0.85));
  // 벽 테두리
  box(5, 18, 1, 30, OUTLINE); box(50, 18, 1, 30, OUTLINE); box(5, 47, 46, 1, OUTLINE);

  // 차양 지붕(줄무늬 + 물결 끝단)
  for (let c = 2; c < 54; c++) {
    const stripe = Math.floor((c - 2) / 5) % 2 === 0 ? roof : roofB;
    box(c, 9, 1, 8, stripe);
    const dip = Math.round(Math.sin(((c - 2) % 5) / 4 * Math.PI) * 2.6);
    box(c, 17, 1, dip, stripe);
    box(c, 17 + dip, 1, 1, OUTLINE);
  }
  box(2, 8, 52, 1, OUTLINE); box(1, 9, 1, 8, OUTLINE); box(54, 9, 1, 8, OUTLINE);

  // 굴뚝
  box(43, 2, 6, 7, "#C98A6B"); box(42, 1, 8, 2, "#A96A4D");
  box(42, 1, 1, 8, OUTLINE); box(49, 1, 1, 8, OUTLINE); box(42, 0, 8, 1, OUTLINE);

  // 간판(글씨는 화면에서 따로 그림)
  box(8, 20, 40, 8, "#FFF9EC"); box(8, 20, 40, 1, "#EADFC8");
  box(7, 20, 1, 8, OUTLINE); box(48, 20, 1, 8, OUTLINE); box(8, 19, 40, 1, OUTLINE); box(8, 28, 40, 1, OUTLINE);

  // 창문 2개
  for (const wc of [9, 37]) {
    box(wc, 31, 10, 9, "#BEE3F0"); box(wc, 31, 10, 3, "#D7F0F8");
    box(wc - 1, 30, 12, 1, OUTLINE); box(wc - 1, 40, 12, 1, OUTLINE);
    box(wc - 1, 31, 1, 9, OUTLINE); box(wc + 10, 31, 1, 9, OUTLINE);
    box(wc + 4, 31, 1, 9, OUTLINE); box(wc, 35, 10, 1, OUTLINE);
    box(wc - 1, 41, 12, 2, shadeHex(wall, 0.8)); // 창틀 아래
  }

  // 문(아치)
  box(24, 36, 8, 11, "#8A5A33");
  box(25, 34, 6, 2, "#8A5A33");
  box(24, 35, 1, 1, "#8A5A33"); box(31, 35, 1, 1, "#8A5A33");
  box(23, 36, 1, 11, OUTLINE); box(32, 36, 1, 11, OUTLINE);
  box(24, 34, 1, 2, OUTLINE); box(31, 34, 1, 2, OUTLINE); box(25, 33, 6, 1, OUTLINE);
  box(26, 36, 1, 10, shadeHex("#8A5A33", 1.25));
  box(30, 41, 1, 1, "#F6C244"); // 손잡이

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
  helperName: "크림 씨",
  missionLines: ["{닉네임}님, 반가워요!", "오늘 케이크 공방이 문을 열었어요.", "고마운 사람에게 케이크를 선물해 볼래요?"],
  missionDest: "cake",
  gatherOpen: true,   // 재료 줍기 열림/닫힘
  restMin: 3,         // 흔든 나무가 쉬는 시간(분)
};
let birthdays = [];   // 오늘 생일인 친구 닉네임

/* ---------- 사무소 캐릭터 2명 ---------- */
const NPCS = [
  { id: "mission", name: VILLAGE_CFG.missionName, bread: "loaf", colorIdx: 4, prop: "chefhat", x: 21.5 * TILE, y: 13.6 * TILE, moving: false },
  { id: "helper",  name: VILLAGE_CFG.helperName,  bread: "bun",  colorIdx: 1, prop: "ribbon",  x: 26.4 * TILE, y: 13.6 * TILE, moving: false },
];

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

  BREADS.forEach((b) => {
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
    const dot = document.createElement("div");
    dot.className = "color-dot";
    dot.style.background = c.hex;
    btn.appendChild(dot);
    btn.dataset.idx = i;
    btn.addEventListener("click", () => {
      previewSelected.colorIdx = i;
      refreshEntry();
    });
    cp.appendChild(btn);
  });

  // 같은 기기에서 다시 오면 이전 정보 미리 채우기
  let saved = null;
  try {
    saved = JSON.parse(localStorage.getItem(SAVE_KEY) || "null");
    if (saved) {
      $("nickname").value = saved.name || "";
      previewSelected.bread = saved.bread || "bun";
      previewSelected.colorIdx = saved.colorIdx ?? 0;
      me.id = saved.id || "";
      me.prop = saved.prop || null;
      me.items = new Set(saved.items || []);
    }
  } catch (e) { /* 무시 */ }

  refreshEntry();
  $("enterBtn").addEventListener("click", enterVillage);
  $("nickname").addEventListener("keydown", (e) => { if (e.key === "Enter") enterVillage(); });

  // 주소 뒤에 &id=... 가 있으면 그 캐릭터로 바로 들어온다 (선생님용 비상 방법)
  const urlId = new URLSearchParams(location.search).get("id");
  if (ONLINE() && urlId) { idLogin(urlId); return; }

  // 서버 모드: 같은 기기에서 다시 오면 닉네임 입력 없이 바로 들어온다
  if (ONLINE() && saved && saved.id && saved.name) enterVillage();
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
  me.items = new Set(String(res.items || "").split(",").filter(Boolean));
  previewSelected.bread = me.bread;
  previewSelected.colorIdx = me.colorIdx;
  $("nickname").value = me.name;
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify({
      id: me.id, name: me.name, bread: me.bread, colorIdx: me.colorIdx, prop: me.prop, items: [...me.items],
    }));
  } catch (e) { /* 무시 */ }
  // 주소에서 id를 지워 둔다 (즐겨찾기해도 깨끗하게)
  try { history.replaceState(null, "", location.pathname + (CLASS !== "A" ? "?class=" + CLASS : "")); } catch (e) { /* 무시 */ }
  enterVillage();
}

/* ---------- 소품함 아래 버튼: 내 모습 바꾸기 / 다른 캐릭터로 들어가기 ---------- */
let changingLook = false;

$("changeLookBtn").addEventListener("click", () => {
  closeModals();
  changingLook = true;
  villageEl.classList.add("hidden");
  entryEl.classList.remove("hidden");
  $("nickname").value = me.name;
  $("nickname").disabled = true; // 닉네임은 바꿀 수 없다
  $("nameHint").textContent = "빵과 색만 바꿀 수 있어요.";
  previewSelected.bread = me.bread;
  previewSelected.colorIdx = me.colorIdx;
  refreshEntry();
});

$("switchCharBtn").addEventListener("click", () => {
  $("confirm").classList.remove("hidden");
});
$("confirmNo").addEventListener("click", () => $("confirm").classList.add("hidden"));
$("confirmYes").addEventListener("click", () => {
  // 이 기기에 저장된 내 정보만 지운다 (시트의 줄은 그대로)
  try { localStorage.removeItem(SAVE_KEY); } catch (e) { /* 무시 */ }
  location.href = location.pathname + (CLASS !== "A" ? "?class=" + CLASS : "");
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
  drawMini($("previewCanvas"), previewSelected.bread, colorHex, me.prop);
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
  me.bread = previewSelected.bread;
  me.colorIdx = previewSelected.colorIdx;

  // 광장 안에서 무작위로 흩어져 시작한다 (모습만 바꿀 때는 서 있던 자리 그대로)
  if (!changingLook) {
    const sp = randomSpawnInPlaza();
    me.x = sp.x;
    me.y = sp.y;
  }

  // 서버 모드: 입장 등록 + 닉네임 중복 확인
  if (ONLINE()) {
    $("enterBtn").disabled = true;
    $("nameHint").textContent = "마을에 들어가는 중…";
    const res = await api({
      action: "join", class: CLASS, id: me.id, name: me.name,
      bread: me.bread, color: me.colorIdx, prop: me.prop || "",
      x: Math.round(me.x), y: Math.round(me.y),
    });
    $("enterBtn").disabled = false;
    if (!res || !res.ok) {
      $("nameHint").textContent =
        res && res.error === "duplicate"
          ? "이미 있는 이름이에요. 다른 이름을 써 주세요."
          : "마을과 연결이 안 돼요. 잠시 뒤 다시 눌러 주세요.";
      return;
    }
    me.id = res.id;
    if (res.items) String(res.items).split(",").forEach((it) => { if (it) me.items.add(it); });
    friends.length = 0;   // 가짜 친구 대신 진짜 친구들을 보여 준다
    startSync();
  }

  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify({
      id: me.id, name: me.name, bread: me.bread, colorIdx: me.colorIdx, prop: me.prop,
      items: [...me.items],
    }));
  } catch (e) { /* 무시 */ }

  entryEl.classList.add("hidden");
  villageEl.classList.remove("hidden");
  resize();
  showToast(changingLook ? "새 모습으로 바꿨어요!" : `${me.name}님, 어서 와요!`); // 인사 하나만 잠깐 뜬다
  changingLook = false;
  $("nickname").disabled = false;
  $("nameHint").textContent = "";
  if (ONLINE() && me.id) sendMyPos(true); // 바뀐 모습을 친구 화면에도 바로
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

  // 2) 시설: 이름, 할 일, 링크, 열림을 시트 내용으로 바꾼다
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

  // 3) 공지: 시트 내용을 그대로 보여 준다 (맨 위 말풍선으로만)
  if (st.notice) $("noticeText").textContent = st.notice;

  // 4) 마을 설정(사무소 캐릭터 이름, 미션, 재료 줍기)과 생일
  if (st.village) {
    const v = st.village;
    if (v.missionName) { VILLAGE_CFG.missionName = v.missionName; NPCS[0].name = v.missionName; }
    if (v.helperName) { VILLAGE_CFG.helperName = v.helperName; NPCS[1].name = v.helperName; }
    if (Array.isArray(v.missionLines)) {
      const lines = v.missionLines.map((s) => String(s || "").trim()).filter(Boolean);
      if (lines.length) VILLAGE_CFG.missionLines = lines;
    }
    if (v.missionDest) VILLAGE_CFG.missionDest = String(v.missionDest).trim();
    VILLAGE_CFG.gatherOpen = v.gatherOpen !== false;
    if (Number(v.restMin) > 0) VILLAGE_CFG.restMin = Number(v.restMin);
  }
  birthdays = st.birthdays || [];

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
  if (dir) { keys[dir] = true; me.path = []; pendingFacility = null; pendingNpc = null; e.preventDefault(); }
  if (e.key === "Escape") { closeModals(); }
  if (e.key !== " " && e.key !== "Enter") return;
  // 대화창이 열려 있으면 스페이스바/엔터로 다음 문장
  if (!$("dialog").classList.contains("hidden")) {
    e.preventDefault();
    if (dialog && dialog.idx >= dialog.lines.length - 1) $("dialogGo").click();
    else advanceDialog();
    return;
  }
  // 문 앞에서 스페이스바나 엔터로도 들어갈 수 있다
  if (nearFacility && noModalOpen()) {
    e.preventDefault();
    if (nearFacility.open) openFacility(nearFacility);
    else showToast(`${nearFacility.name}은(는) 아직 준비 중이에요.`);
  }
});
window.addEventListener("keyup", (e) => {
  const dir = KEYMAP[e.key];
  if (dir) keys[dir] = false;
});

// 방향 버튼
document.querySelectorAll(".dbtn").forEach((btn) => {
  const dir = btn.dataset.dir;
  const on = (e) => { e.preventDefault(); keys[dir] = true; me.path = []; pendingFacility = null; pendingNpc = null; };
  const off = (e) => { e.preventDefault(); keys[dir] = false; };
  btn.addEventListener("pointerdown", on);
  btn.addEventListener("pointerup", off);
  btn.addEventListener("pointercancel", off);
  btn.addEventListener("pointerleave", off);
});

/* ---------- 문 앞 들어가기 버튼 ----------
   시설 문 가까이 가면 건물 위에 큰 버튼이 뜬다.
   열린 시설: "들어가기" / 닫힌 시설: "준비 중이에요"(누를 수 없음) */
let nearFacility = null;

function updateEnterButton() {
  const btn = $("facilityEnterBtn");
  let best = null, bestD = Infinity;
  for (const f of FACILITIES) {
    const d = Math.hypot(me.x - f.doorX, me.y - f.doorY);
    if (d < bestD) { bestD = d; best = f; }
  }
  // 나타날 때와 사라질 때 거리를 다르게 해서 깜빡임을 막는다
  const limit = (nearFacility === best) ? TILE * 2.6 : TILE * 2.2;
  if (!best || bestD > limit) {
    if (nearFacility) { nearFacility = null; btn.classList.add("hidden"); }
    return;
  }
  if (nearFacility !== best || btn.classList.contains("hidden")) {
    nearFacility = best;
    if (!best.open) setBtnIcon(btn, "cone", "준비 중이에요");
    else if (best.board) setBtnIcon(btn, "pin", "게시판 보기");
    else setBtnIcon(btn, "door", "들어가기");
    btn.classList.toggle("closed", !best.open);
    btn.classList.remove("hidden");
  }
  // 건물 지붕 위, 문 가운데 자리에 띄운다
  btn.style.left = (best.doorX - cam.x) + "px";
  btn.style.top = (best.rect.y - cam.y - 8) + "px";
}

$("facilityEnterBtn").addEventListener("click", () => {
  if (nearFacility && nearFacility.open) openFacility(nearFacility);
});

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
  for (const npc of NPCS) {
    if (Math.abs(wx - npc.x) < 38 && wy > npc.y - 80 && wy < npc.y + 14) {
      clickNpc(npc);
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

  // 빈 땅 → 그 자리까지 걸어가기
  walkTo(Math.floor(wx / TILE), Math.floor(wy / TILE), null);
});

function walkTo(c, r, facility) {
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
  if (npc.id === "mission") startMissionDialog();
  else openHelper();
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
    openFacility(dest, true);
  }
}

/* ---------- 도우미(크림 씨) 설명 ---------- */
const HELPER_TEXTS = {
  move: "방향키나 화면의 방향 버튼으로 걸어요.\n가고 싶은 곳을 누르면 거기까지 걸어가요.",
  prop: "🎒 소품함에서 소품을 누르면 꾸며져요.\n한 번 더 누르면 원래 모습이 돼요. 한 번에 하나만 꾸밀 수 있어요.",
  gather: "나무 앞에서 [흔들기], 연못 가장자리에서 [건지기]를 눌러요.\n모은 재료는 📖 재료 도감에 모여요.",
  photo: "📷 사진 찍기를 누르면 내 캐릭터 사진이 만들어져요.\n[저장하기]를 누르면 그림 파일로 내려받아요.",
};
function openHelper() {
  const t = $("helperTitle");
  t.textContent = " " + NPCS[1].name;
  t.prepend(mkIcon(propIcon("ribbon")));
  $("helperText").classList.add("hidden");
  $("helper").classList.remove("hidden");
}
document.querySelectorAll(".helper-btn").forEach((b) => {
  b.addEventListener("click", () => {
    $("helperText").textContent = HELPER_TEXTS[b.dataset.topic] || "";
    $("helperText").classList.remove("hidden");
  });
});
$("closeHelper").addEventListener("click", () => $("helper").classList.add("hidden"));

function setupBag() {
  const list = $("propList");
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
  $("bagBtn").addEventListener("click", () => { refreshBag(); $("bag").classList.remove("hidden"); });
  $("closeBag").addEventListener("click", () => $("bag").classList.add("hidden"));
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
  // 나무에서 (흔들기)
  { id: "strawberry", name: "딸기",     from: "tree", shape: "drop",  c: "#E8453C", deco: "seeds" },
  { id: "lemon",      name: "레몬",     from: "tree", shape: "egg",   c: "#F6D44C", deco: "sparkle" },
  { id: "chestnut",   name: "밤",       from: "tree", shape: "round", c: "#9C6B3C", deco: "cap" },
  { id: "peach",      name: "복숭아",   from: "tree", shape: "round", c: "#FFB3A7", deco: "leaf" },
  { id: "apple",      name: "사과",     from: "tree", shape: "round", c: "#E0493F", deco: "leaf" },
  { id: "blueberry",  name: "블루베리", from: "tree", shape: "round", c: "#6B7FD6", deco: "sparkle" },
  { id: "cherry",     name: "체리",     from: "tree", shape: "round", c: "#C0392B", deco: "stem" },
  { id: "walnut",     name: "호두",     from: "tree", shape: "round", c: "#B5885C", deco: "vein" },
  { id: "honey",      name: "꿀",       from: "tree", shape: "drop",  c: "#F2A33C", deco: "sparkle" },
  { id: "cinnamon",   name: "계피",     from: "tree", shape: "cube",  c: "#8A5A33", deco: "stripes" },
  // 물가에서 (건지기)
  { id: "salt",       name: "소금",       from: "pond", shape: "cube",  c: "#F4F0E6", deco: "grains" },
  { id: "shell",      name: "조개",       from: "pond", shape: "flat",  c: "#F3D9A4", deco: "ridges" },
  { id: "starcandy",  name: "별사탕",     from: "pond", shape: "star",  c: "#FF9FB6", deco: "sparkle" },
  { id: "mint",       name: "민트잎",     from: "pond", shape: "egg",   c: "#8FD7BB", deco: "vein" },
  { id: "sugar",      name: "설탕",       from: "pond", shape: "cube",  c: "#FFFFFF", deco: "sparkle" },
  { id: "pearl",      name: "진주사탕",   from: "pond", shape: "round", c: "#EADFF2", deco: "sparkle" },
  { id: "icecandy",   name: "얼음사탕",   from: "pond", shape: "cube",  c: "#BEE3F0", deco: "sparkle" },
  { id: "jelly",      name: "물방울젤리", from: "pond", shape: "drop",  c: "#7EC8DF", deco: "sparkle" },
  { id: "seaweed",    name: "미역",       from: "pond", shape: "flat",  c: "#4E8C5E", deco: "stripes" },
  { id: "lotus",      name: "연꽃잎",     from: "pond", shape: "flat",  c: "#F7A8C4", deco: "vein" },
];

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

// 흔들 수 있는 나무들
const treeSet = new Set();
for (const [c, r] of TREES) treeSet.add(c + "," + r);
for (const [c, r] of borderTrees) treeSet.add(c + "," + r);

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
  let tree = null, treeD = Infinity, pondD = Infinity, pondC = 0, pondR = 0;
  for (let r = pr - 2; r <= pr + 2; r++) {
    for (let c = pc - 2; c <= pc + 2; c++) {
      const d = Math.hypot(me.x - (c + 0.5) * TILE, me.y - (r + 0.5) * TILE);
      if (treeSet.has(c + "," + r) && d < treeD) { treeD = d; tree = { type: "tree", key: "t" + c + "_" + r, c, r }; }
      if (ground[r] && ground[r][c] === 3 && d < pondD) { pondD = d; pondC = c; pondR = r; }
    }
  }
  if (tree && treeD < TILE * 2.1 && treeD <= pondD) return tree;
  if (pondD < TILE * 1.9) return { type: "pond", key: "pond", c: pondC, r: pondR };
  return null;
}

function coolLeft(key) { // 쉬는 중이면 남은 시간(ms), 아니면 0
  const v = cooldowns[key];
  const t = v ? (v.t || v) : 0;
  return Math.max(0, t - Date.now());
}

function updateGatherButton() {
  const btn = $("gatherBtn");
  const spot = findGatherSpot();
  // 쉬는 중이면 버튼을 아예 숨긴다 (새싹 표시만 보임)
  if (!spot || coolLeft(spot.key) > 0) {
    if (gatherSpot) { gatherSpot = null; btn.classList.add("hidden"); }
    return;
  }
  if (!gatherSpot || gatherSpot.key !== spot.key || btn.classList.contains("hidden")) {
    if (spot.type === "tree") setBtnIcon(btn, "shake", "흔들기");
    else setBtnIcon(btn, "scoop", "건지기");
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
    const sx = (v.c + 0.5) * TILE - cam.x;
    const sy = (isTree ? (v.r + 1) * TILE - 86 : (v.r + 0.5) * TILE) - cam.y + Math.sin(now / 300) * 2;
    if (sx < -30 || sy < -30 || sx > canvas.width + 30 || sy > canvas.height + 30) continue;
    items.push({ y: (v.r + 1) * TILE + 1, draw: () => ctx.drawImage(uiIcon("sprout"), sx - 11, sy - 18, 22, 22) });
  }
}

$("gatherBtn").addEventListener("click", () => {
  const spot = gatherSpot;
  if (!spot) return;
  if (!VILLAGE_CFG.gatherOpen) { showToast("지금은 쉬는 시간이에요."); return; }
  if (coolLeft(spot.key) > 0) return;
  // 재료 뽑기: 못 모은 재료 먼저, 꽝은 없다
  const pool = ITEMS.filter((it) => it.from === spot.type);
  const fresh = pool.filter((it) => !me.items.has(it.id));
  const from = fresh.length ? fresh : pool;
  const pick = from[Math.floor(Math.random() * from.length)];
  const isNew = !me.items.has(pick.id);
  me.items.add(pick.id);
  saveItems();
  // 이곳은 잠시 쉬는 중 (새싹 표시용 위치도 함께 기억)
  cooldowns[spot.key] = { t: Date.now() + VILLAGE_CFG.restMin * 60 * 1000, c: spot.c, r: spot.r };
  try { localStorage.setItem(GATHER_KEY, JSON.stringify(cooldowns)); } catch (e) { /* 무시 */ }
  // 효과
  if (spot.type === "tree") shakeUntil[spot.c + "," + spot.r] = performance.now() + 700;
  spawnSparkle(dispX(me) - cam.x, dispY(me) - cam.y - 30, 10);
  floatItem = { id: pick.id, t0: performance.now() };
  showToast(isNew ? `${pick.name}을(를) 처음 모았어요! 도감에 들어갔어요.` : `${pick.name}이(가) 또 나왔어요.`);
  if (isNew && me.items.size === ITEMS.length) {
    setTimeout(() => {
      showToast("재료 도감을 다 채웠어요! 축하해요!");
      spawnSparkle(canvas.width / 2, canvas.height / 2, 40);
    }, 1400);
  }
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
  // 풀밭 바탕
  for (let r = 0; r < H / 20; r++) for (let c = 0; c < W / 20; c++) {
    x.fillStyle = (c + r) % 2 === 0 ? "#A9D27E" : "#A2CB76";
    x.fillRect(c * 20, r * 20, 20, 20);
  }

  // 배경 (건물은 작게 위쪽에, 캐릭터와 겹치지 않게)
  if (photoBg === "office" || photoBg === "cake") {
    const f = FACILITIES.find((v) => v.id === (photoBg === "office" ? "plaza" : "cake"));
    x.drawImage(buildingSprite(f), W / 2 - 76, 36, 152, 141);
  } else if (photoBg === "pond") {
    x.fillStyle = "#E8D5A8"; x.fillRect(22, 56, 192, 116);  // 물가 모래
    x.fillStyle = "#7EC8DF"; x.fillRect(30, 64, 176, 100);  // 물 (조금 줄임)
    x.fillStyle = "#A8DEEE";
    for (let i = 0; i < 5; i++) x.fillRect(44 + (i * 37) % 140, 78 + (i * 29) % 70, 14, 4);
  } else {
    x.drawImage(treeSprite(), 34, 52, 60, 80);
    x.drawImage(treeSprite(), W / 2 - 30, 34, 60, 80);
    x.drawImage(treeSprite(), W - 94, 62, 60, 80);
  }

  // 캐릭터 발밑 길 타일
  x.fillStyle = "#E8D5A8";
  x.fillRect(W / 2 - 80, H - 172, 160, 92);
  x.fillStyle = "#DCC693";
  for (let c = 0; c < 4; c++) for (let r = 0; r < 2; r++) {
    if ((c + r) % 2 === 0) x.fillRect(W / 2 - 80 + c * 40, H - 172 + r * 46, 40, 46);
  }
  x.strokeStyle = "#C9B07E";
  x.lineWidth = 3;
  x.strokeRect(W / 2 - 80, H - 172, 160, 92);

  // 작은 소품: 꽃과 풀
  const flowers = [[42, H - 198], [W - 50, H - 188], [56, 198], [W - 64, 214], [96, H - 116], [W - 96, H - 108]];
  flowers.forEach(([fx, fy], i) => {
    x.fillStyle = ["#F77C9A", "#FFD66B", "#FFFFFF", "#C9A7E6"][i % 4];
    x.fillRect(fx - 3, fy, 3, 3); x.fillRect(fx + 3, fy, 3, 3);
    x.fillRect(fx, fy - 3, 3, 3); x.fillRect(fx, fy + 3, 3, 3);
    x.fillStyle = "#F6C244"; x.fillRect(fx, fy, 3, 3);
  });
  x.fillStyle = "#8FBC62";
  [[32, 186], [W - 40, 196], [52, H - 148], [W - 58, H - 142]].forEach(([gx, gy]) => {
    x.fillRect(gx, gy, 3, 8); x.fillRect(gx + 5, gy + 2, 3, 6);
  });

  // 내 캐릭터: 발밑 그림자 + 항상 맨 앞, 가운데에서 조금 아래
  x.fillStyle = "rgba(60,40,20,0.25)";
  x.beginPath();
  x.ellipse(W / 2, H - 100, 52, 12, 0, 0, Math.PI * 2);
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
  ["facilityCard", "bag", "helper", "dex", "board", "photo", "dialog", "confirm"].forEach((id) => $(id).classList.add("hidden"));
  dialog = null;
}
// 바깥(어두운 부분) 누르면 닫기
["facilityCard", "bag", "helper", "dex", "board", "photo"].forEach((id) => {
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

function moveActor(a, speed, dt) {
  // 1) 키/버튼 이동 (내 캐릭터만)
  if (a === me) {
    let vx = (keys.right ? 1 : 0) - (keys.left ? 1 : 0);
    let vy = (keys.down ? 1 : 0) - (keys.up ? 1 : 0);
    if (vx || vy) {
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
const SEP_DIST = 34;   // 이보다 가까우면 살짝 민다
const SEP_FORCE = 60;  // 미는 힘(약하게)
const SEP_MAX = 26;    // 최대 밀려나는 거리(px)

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

      if (g === 3) { // 물
        ctx.fillStyle = "#7EC8DF";
        ctx.fillRect(x, y, TILE, TILE);
        // 반짝이는 물결
        if ((h + Math.floor(now / 600)) % 3 === 0) {
          ctx.fillStyle = "#A8DEEE";
          ctx.fillRect(x + 8, y + 14, 14, 3);
          ctx.fillRect(x + 20, y + 26, 10, 3);
        }
        // 물가 모래
        ctx.fillStyle = "#E8D5A8";
        if (ground[r - 1]?.[c] !== 3) ctx.fillRect(x, y, TILE, 5);
        if (ground[r + 1]?.[c] !== 3) ctx.fillRect(x, y + TILE - 5, TILE, 5);
        if (ground[r][c - 1] !== 3) ctx.fillRect(x, y, 5, TILE);
        if (ground[r][c + 1] !== 3) ctx.fillRect(x, y + TILE - 5, 5, TILE);
      } else if (g === 1) { // 길
        ctx.fillStyle = "#E8D5A8";
        ctx.fillRect(x, y, TILE, TILE);
        ctx.fillStyle = "#DCC693";
        if (h % 3 === 0) ctx.fillRect(x + (h % 20), y + (h % 23), 6, 4);
        ctx.fillStyle = "#C9B07E";
        if (ground[r - 1]?.[c] === 0) ctx.fillRect(x, y, TILE, 3);
        if (ground[r + 1]?.[c] === 0) ctx.fillRect(x, y + TILE - 3, TILE, 3);
        if (ground[r][c - 1] === 0) ctx.fillRect(x, y, 3, TILE);
        if (ground[r][c + 1] === 0) ctx.fillRect(x + TILE - 3, y, 3, TILE);
      } else if (g === 2) { // 광장 바닥
        ctx.fillStyle = (c + r) % 2 === 0 ? "#F0E2BD" : "#EBD9AE";
        ctx.fillRect(x, y, TILE, TILE);
        ctx.fillStyle = "#DCC693";
        ctx.fillRect(x, y, TILE, 2);
        ctx.fillRect(x, y, 2, TILE);
      } else { // 풀
        ctx.fillStyle = (c + r) % 2 === 0 ? "#A9D27E" : "#A2CB76";
        ctx.fillRect(x, y, TILE, TILE);
        if (h % 7 === 0) { // 풀잎
          ctx.fillStyle = "#8FBC62";
          const gx = x + 6 + (h % 18), gy = y + 6 + ((h >> 4) % 18);
          ctx.fillRect(gx, gy, 3, 7);
          ctx.fillRect(gx + 5, gy + 2, 3, 5);
        }
        if (h % 23 === 0 && !blocked[r][c]) { // 꽃
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

  if (!f.open) { // 준비 중 팻말 (고깔 도트 그림 + 글자)
    const px = x + R.w / 2, py = y + 150;
    ctx.fillStyle = "#5B3A1E";
    ctx.beginPath();
    ctx.roundRect(px - 52, py - 17, 104, 34, 10);
    ctx.fill();
    ctx.drawImage(uiIcon("cone"), px - 44, py - 11, 22, 22);
    ctx.fillStyle = "#FFF4E0";
    ctx.font = "bold 16px 'Malgun Gothic', sans-serif";
    ctx.fillText("준비 중", px + 11, py + 1);
  }
}

function drawTreeAt(c, r) {
  const x = c * TILE + TILE / 2 - cam.x;
  const y = (r + 1) * TILE - cam.y;
  ctx.fillStyle = "rgba(60,40,20,0.18)";
  ctx.beginPath();
  ctx.ellipse(x, y - 4, 24, 8, 0, 0, Math.PI * 2);
  ctx.fill();
  // 흔들기 효과
  const sh = shakeUntil[c + "," + r];
  const off = sh && performance.now() < sh ? Math.sin(performance.now() / 30) * 3 : 0;
  ctx.drawImage(treeSprite(), x - 33 + off, y - 88, 66, 88);
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

function drawCharacter(ch, isMe, now) {
  const bob = ch.moving ? Math.sin(now / 90) * 2.5 : 0;
  const x = dispX(ch) - cam.x, y = dispY(ch) - cam.y + bob;
  const S = CHAR_SIZE;
  const colorHex = COLORS[ch.colorIdx].hex;

  // 그림자
  ctx.fillStyle = "rgba(60,40,20,0.22)";
  ctx.beginPath();
  ctx.ellipse(dispX(ch) - cam.x, dispY(ch) - cam.y + 8, S * 0.3, 7, 0, 0, Math.PI * 2);
  ctx.fill();

  const sx = x - S / 2, sy = y - S + 10;
  drawBread(ctx, ch.bread, colorHex, ch.prop, sx, sy, S);

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

  const chars = [me, ...friends, ...NPCS]; // 내 이름표가 맨 먼저 자리를 잡는다 (항상 캐릭터 바로 위)
  const placed = [];
  for (const ch of chars) {
    const prop = PROPS.find((p) => p.id === ch.prop);
    const textW = ctx.measureText(ch.name).width;
    const iconW = prop ? 21 : 0;
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
    ch._lbl = { x: bx + ch.lblX, ly: by + ch.lblY, w, textW, iconW, prop };
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
    if (L.prop) ctx.drawImage(propIcon(L.prop.id), L.x - L.iconW / 2 + L.textW / 2 + 3, L.ly - 9, 18, 18);
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

  updateEnterButton();  // 문 앞이면 들어가기 버튼 보이기
  updateGatherButton(); // 나무, 연못 근처면 흔들기/건지기 버튼 보이기
  updateMission();      // 사무소 캐릭터 대화와 미션 도착 확인

  ctx.clearRect(0, 0, canvas.width, canvas.height);
  drawGround(now);
  drawWalkMarker(now);

  // 세로 위치 순서대로 그리기 (멀리 있는 것 먼저)
  const items = [];
  for (const f of FACILITIES) items.push({ y: f.baseY, draw: () => drawBuilding(f) });
  for (const [c, r] of borderTrees) items.push({ y: (r + 1) * TILE, draw: () => drawTreeAt(c, r) });
  for (const [c, r] of TREES) items.push({ y: (r + 1) * TILE, draw: () => drawTreeAt(c, r) });
  collectSprouts(items, now); // 쉬는 중 새싹 (캐릭터 뒤에 깔린다)
  for (const npc of NPCS) items.push({ y: npc.y, draw: () => drawCharacter(npc, false, now) });
  for (const fr of friends) items.push({ y: dispY(fr), draw: () => drawCharacter(fr, false, now) });
  items.push({ y: dispY(me), draw: () => drawCharacter(me, true, now) });
  items.sort((a, b) => a.y - b.y);
  for (const it of items) {
    // 화면 밖이면 건너뛰기 (대략적인 판정)
    it.draw();
  }

  // 이름표는 맨 마지막에 (겹침 비켜 그리기 + 내 이름표 항상 맨 위)
  layoutAndDrawLabels(dt);

  // 사무소 캐릭터 "!", 미션 화살표, 떠오르는 재료, 반짝이 효과
  drawNpcMark(now);
  drawMissionArrow(now);
  drawFloatItem();
  updateDrawParticles(dt);
}

/* ============================================================
   화면 아이콘 끼우기 (이모지 대신 도트 그림)
   ============================================================ */
function setupIcons() {
  // 입장 화면 제목
  document.querySelector(".logo").prepend(mkIcon(breadSprite("bun", COLORS[0].hex)));
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
  // 도우미 설명 버튼들
  const topicIcons = { move: uiIcon("move"), prop: propIcon("ribbon"), gather: itemSprite("strawberry"), photo: uiIcon("camera") };
  document.querySelectorAll(".helper-btn").forEach((b) => b.prepend(mkIcon(topicIcons[b.dataset.topic])));
}

/* ============================================================
   시작
   ============================================================ */
setupIcons();
setupEntry();
setupBag();
resize();
requestAnimationFrame(loop);
