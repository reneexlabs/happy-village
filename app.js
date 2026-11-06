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
  { id: "plaza",   name: "마을 안내소", emoji: "🏠", open: true,
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
  for (let r = f.r0; r < f.r0 + 4; r++)
    for (let c = f.c0; c < f.c0 + 5; c++) blocked[r][c] = true;
  f.doorC = f.c0 + 2;           // 문 앞 칸
  f.doorR = f.r0 + 4;
  // 화면에서 건물이 차지하는 영역(클릭 판정용)
  f.rect = { x: f.c0 * TILE - 12, y: f.r0 * TILE - 48, w: 224, h: 208 };
  f.baseY = (f.r0 + 4) * TILE;  // 그리는 순서 정하기용
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
};

/* ---------- 친구(가짜 접속자) ---------- */
const friends = [
  { name: "크림이", bread: "bun",       colorIdx: 1, prop: "ribbon", x: 21.5 * TILE, y: 18.5 * TILE, path: [], wanderAt: 0, homeC: 21, homeR: 18 },
  { name: "소라빵", bread: "croissant", colorIdx: 3, prop: null,     x: 27.5 * TILE, y: 18.5 * TILE, path: [], wanderAt: 0, homeC: 27, homeR: 18 },
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
    }
  } catch (e) { /* 무시 */ }

  refreshEntry();
  $("enterBtn").addEventListener("click", enterVillage);
  $("nickname").addEventListener("keydown", (e) => { if (e.key === "Enter") enterVillage(); });

  // 서버 모드: 같은 기기에서 다시 오면 닉네임 입력 없이 바로 들어온다
  if (ONLINE() && saved && saved.id && saved.name) enterVillage();
}

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
    friends.length = 0;   // 가짜 친구 대신 진짜 친구들을 보여 준다
    startSync();
  }

  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify({
      id: me.id, name: me.name, bread: me.bread, colorIdx: me.colorIdx, prop: me.prop,
    }));
  } catch (e) { /* 무시 */ }

  entryEl.classList.add("hidden");
  villageEl.classList.remove("hidden");
  resize();
  showToast(`${me.name}님, 어서 와요! 🍞`);
  if (!ONLINE()) setTimeout(() => showToast("🎂 케이크 공방이 새로 열렸어요!"), 2500); // 혼자 보기 모드 시범용
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

  // 3) 공지
  if (st.notice) $("notice").textContent = "📢 " + st.notice;

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
  if (dir) { keys[dir] = true; me.path = []; pendingFacility = null; e.preventDefault(); }
  if (e.key === "Escape") { closeModals(); }
  // 문 앞에서 스페이스바나 엔터로도 들어갈 수 있다
  if ((e.key === " " || e.key === "Enter") && nearFacility &&
      $("facilityCard").classList.contains("hidden") && $("bag").classList.contains("hidden")) {
    e.preventDefault();
    if (nearFacility.open) openFacilityCard(nearFacility);
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
  const on = (e) => { e.preventDefault(); keys[dir] = true; me.path = []; pendingFacility = null; };
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
    const d = Math.hypot(me.x - (f.doorC + 0.5) * TILE, me.y - (f.doorR + 0.5) * TILE);
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
    btn.textContent = best.open ? "🚪 들어가기" : "🚧 준비 중이에요";
    btn.classList.toggle("closed", !best.open);
    btn.classList.remove("hidden");
  }
  // 건물 지붕 위, 문 가운데 자리에 띄운다
  btn.style.left = ((best.doorC + 0.5) * TILE - cam.x) + "px";
  btn.style.top = (best.rect.y - cam.y - 8) + "px";
}

$("facilityEnterBtn").addEventListener("click", () => {
  if (nearFacility && nearFacility.open) openFacilityCard(nearFacility);
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

  const wx = e.clientX + cam.x, wy = e.clientY + cam.y;

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
  if (path.length) {
    const last = path[path.length - 1];
    walkMarker = { x: last[0] * TILE + TILE / 2, y: last[1] * TILE + TILE / 2, t: performance.now() };
  }
}

function clickFacility(f) {
  if (!f.open) { showToast(`${f.name}은(는) 아직 준비 중이에요.`); return; }
  const doorX = (f.doorC + 0.5) * TILE, doorY = (f.doorR + 0.5) * TILE;
  if (Math.hypot(me.x - doorX, me.y - doorY) < TILE * 2.2) {
    openFacilityCard(f);
  } else {
    walkTo(f.doorC, f.doorR, f); // 문 앞까지 걸어가서 열기
  }
}

/* ============================================================
   시설 카드 / 소품함 / 토스트
   ============================================================ */
let currentLink = "";

function openFacilityCard(f) {
  $("cardIcon").textContent = f.emoji;
  $("cardTitle").textContent = f.name;
  $("cardTask").textContent = f.task;
  currentLink = f.link || "";
  const btn = $("cardLink");
  btn.classList.toggle("hidden", !currentLink); // 링크가 없으면 버튼을 숨긴다
  if (currentLink) btn.href = currentLink;
  $("facilityCard").classList.remove("hidden");
}

$("closeCard").addEventListener("click", () => $("facilityCard").classList.add("hidden"));

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

function closeModals() {
  $("facilityCard").classList.add("hidden");
  $("bag").classList.add("hidden");
}
// 바깥(어두운 부분) 누르면 닫기
["facilityCard", "bag"].forEach((id) => {
  $(id).addEventListener("click", (e) => { if (e.target === $(id)) closeModals(); });
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
        openFacilityCard(f);
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

function drawBuilding(f) {
  const R = f.rect;
  const x = R.x - cam.x, y = R.y - cam.y;
  // 그림자
  ctx.fillStyle = "rgba(60,40,20,0.18)";
  ctx.beginPath();
  ctx.ellipse(x + R.w / 2, y + R.h - 4, R.w / 2 - 8, 12, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.drawImage(buildingSprite(f), x, y, R.w, R.h);

  // 간판 글씨 (또렷하게 화면 해상도로, 길면 글씨를 줄인다)
  const signText = `${f.emoji} ${f.name}`;
  ctx.font = "bold 17px 'Malgun Gothic', sans-serif";
  if (ctx.measureText(signText).width > 150) ctx.font = "bold 13px 'Malgun Gothic', sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillStyle = f.open ? "#5B3A1E" : "#8C8475";
  ctx.fillText(signText, x + R.w / 2, y + 24 * 4 + 2);

  if (!f.open) { // 준비 중 팻말
    const px = x + R.w / 2, py = y + 150;
    ctx.fillStyle = "#5B3A1E";
    ctx.beginPath();
    ctx.roundRect(px - 52, py - 17, 104, 34, 10);
    ctx.fill();
    ctx.fillStyle = "#FFF4E0";
    ctx.font = "bold 16px 'Malgun Gothic', sans-serif";
    ctx.fillText("🚧 준비 중", px, py + 1);
  }
}

function drawTreeAt(c, r) {
  const x = c * TILE + TILE / 2 - cam.x;
  const y = (r + 1) * TILE - cam.y;
  ctx.fillStyle = "rgba(60,40,20,0.18)";
  ctx.beginPath();
  ctx.ellipse(x, y - 4, 24, 8, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.drawImage(treeSprite(), x - 33, y - 88, 66, 88);
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

  const chars = [me, ...friends]; // 내 이름표가 맨 먼저 자리를 잡는다 (항상 캐릭터 바로 위)
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

  updateEnterButton(); // 문 앞이면 들어가기 버튼 보이기

  ctx.clearRect(0, 0, canvas.width, canvas.height);
  drawGround(now);
  drawWalkMarker(now);

  // 세로 위치 순서대로 그리기 (멀리 있는 것 먼저)
  const items = [];
  for (const f of FACILITIES) items.push({ y: f.baseY, draw: () => drawBuilding(f) });
  for (const [c, r] of borderTrees) items.push({ y: (r + 1) * TILE, draw: () => drawTreeAt(c, r) });
  for (const [c, r] of TREES) items.push({ y: (r + 1) * TILE, draw: () => drawTreeAt(c, r) });
  for (const fr of friends) items.push({ y: dispY(fr), draw: () => drawCharacter(fr, false, now) });
  items.push({ y: dispY(me), draw: () => drawCharacter(me, true, now) });
  items.sort((a, b) => a.y - b.y);
  for (const it of items) {
    // 화면 밖이면 건너뛰기 (대략적인 판정)
    it.draw();
  }

  // 이름표는 맨 마지막에 (겹침 비켜 그리기 + 내 이름표 항상 맨 위)
  layoutAndDrawLabels(dt);
}

/* ============================================================
   시작
   ============================================================ */
setupEntry();
setupBag();
resize();
requestAnimationFrame(loop);
