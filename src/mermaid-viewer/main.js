let mermaid = null;

const MAX_SOURCE_CHARS = 50000;
const RENDER_DEBOUNCE_MS = 300;
const DEFAULT_TEMPLATE = 'flowchart';
const ZOOM_MIN = 0.1;
const ZOOM_MAX = 5;
const ZOOM_STEP = 0.15;

const TEMPLATES = {
  flowchart: `graph TD
  A[开始] --> B{是否通过?}
  B -- 是 --> C[完成]
  B -- 否 --> D[修改]
  D --> B`,
  sequence: `sequenceDiagram
  autonumber
  participant User as 用户
  participant App as 应用
  participant API as API
  User->>App: 提交请求
  App->>API: 校验并处理
  API-->>App: 返回结果
  App-->>User: 展示反馈`,
  er: `erDiagram
  USER ||--o{ ORDER : places
  ORDER ||--|{ ORDER_ITEM : contains
  PRODUCT ||--o{ ORDER_ITEM : includes
  USER {
    string id
    string name
    string email
  }
  ORDER {
    string id
    date created_at
    string status
  }
  PRODUCT {
    string id
    string title
    number price
  }`,
  gantt: `gantt
  title 工具页实现计划
  dateFormat  YYYY-MM-DD
  section 设计
  功能审核        :done,    des1, 2026-06-05, 1d
  页面实现        :active,  dev1, 2026-06-06, 2d
  section 验证
  手动测试        :         test1, after dev1, 1d
  上线整理        :         ship1, after test1, 1d`
};

// ── DOM ──
const sourceInput = document.getElementById('sourceInput');
const themeSelect = document.getElementById('themeSelect');
const bgSelect = document.getElementById('bgSelect');
const renderBtn = document.getElementById('renderBtn');
const resetBtn = document.getElementById('resetBtn');
const copySourceBtn = document.getElementById('copySourceBtn');
const copySvgBtn = document.getElementById('copySvgBtn');
const downloadSvgBtn = document.getElementById('downloadSvgBtn');
const errorBar = document.getElementById('errorBar');
const previewMeta = document.getElementById('previewMeta');
const statusText = document.getElementById('statusText');
const canvasArea = document.getElementById('canvasArea');
const canvasViewport = document.getElementById('canvasViewport');
const canvasEmpty = document.getElementById('canvasEmpty');
const zoomInBtn = document.getElementById('zoomInBtn');
const zoomOutBtn = document.getElementById('zoomOutBtn');
const zoomLabel = document.getElementById('zoomLabel');
const fitBtn = document.getElementById('fitBtn');
const resetViewBtn = document.getElementById('resetViewBtn');
const templateButtons = document.querySelectorAll('[data-template]');
const resizer = document.getElementById('resizer');
const sidebar = document.querySelector('.sidebar');

// ── 状态 ──
const state = {
  renderCounter: 0,
  renderTimer: null,
  lastSvg: '',
  lastSource: '',
  mermaidReady: false,

  zoom: 1,
  panX: 0,
  panY: 0,

  dragging: false,
  dragStartX: 0,
  dragStartY: 0,
  dragStartPanX: 0,
  dragStartPanY: 0,

  svgWidth: 0,
  svgHeight: 0
};

// ── 初始化 ──
sourceInput.value = TEMPLATES[DEFAULT_TEMPLATE];
setControlsEnabled(false);
loadMermaid();

// ── 事件绑定 ──
sourceInput.addEventListener('input', scheduleRender);

themeSelect.addEventListener('change', () => {
  if (!state.mermaidReady) return;
  renderCurrentSource();
  statusText.textContent = '已切换主题。';
});

bgSelect.addEventListener('change', () => {
  canvasViewport.classList.remove('bg-dots', 'bg-grid');
  if (bgSelect.value === 'dots') canvasViewport.classList.add('bg-dots');
  if (bgSelect.value === 'grid') canvasViewport.classList.add('bg-grid');
});

renderBtn.addEventListener('click', () => renderCurrentSource());
resetBtn.addEventListener('click', () => {
  sourceInput.value = TEMPLATES[DEFAULT_TEMPLATE];
  renderCurrentSource();
  statusText.textContent = '已恢复默认示例。';
});

copySourceBtn.addEventListener('click', async () => {
  const source = sourceInput.value;
  if (!source.trim()) return showError('当前没有可复制的源码。');
  await copyText(source, '源码已复制。');
});

copySvgBtn.addEventListener('click', async () => {
  if (!state.lastSvg) return showError('请先成功渲染图表。');
  await copyText(state.lastSvg, 'SVG 已复制。');
});

downloadSvgBtn.addEventListener('click', () => {
  if (!state.lastSvg) return showError('请先成功渲染图表。');
  downloadSvg(state.lastSvg);
});

templateButtons.forEach(btn => {
  btn.addEventListener('click', () => {
    const t = TEMPLATES[btn.dataset.template];
    if (!t) return;
    sourceInput.value = t;
    renderCurrentSource();
    statusText.textContent = `已载入${btn.textContent}模板。`;
  });
});

// ── 画布交互 ──
canvasArea.addEventListener('mousedown', onDragStart);
window.addEventListener('mousemove', onDragMove);
window.addEventListener('mouseup', onDragEnd);
canvasArea.addEventListener('wheel', onWheel, { passive: false });
canvasArea.addEventListener('dblclick', () => fitToView());

canvasArea.addEventListener('touchstart', onTouchStart, { passive: false });
canvasArea.addEventListener('touchmove', onTouchMove, { passive: false });
canvasArea.addEventListener('touchend', onTouchEnd);

zoomInBtn.addEventListener('click', () => zoomBy(ZOOM_STEP));
zoomOutBtn.addEventListener('click', () => zoomBy(-ZOOM_STEP));
fitBtn.addEventListener('click', () => fitToView());
resetViewBtn.addEventListener('click', () => resetView());

window.addEventListener('keydown', (e) => {
  if (e.target === sourceInput) return;
  if (e.key === '=' || e.key === '+') { zoomBy(ZOOM_STEP); e.preventDefault(); }
  if (e.key === '-') { zoomBy(-ZOOM_STEP); e.preventDefault(); }
  if (e.key === '0') { fitToView(); e.preventDefault(); }
});

// ── 拖拽调整侧边栏宽度 ──
const SIDEBAR_MIN = 240;
const SIDEBAR_MAX_RATIO = 0.7;
const savedWidth = localStorage.getItem('mermaid-sidebar-width');

if (savedWidth) {
  sidebar.style.setProperty('--sidebar-width', savedWidth + 'px');
}

resizer.addEventListener('mousedown', (e) => {
  e.preventDefault();
  resizer.classList.add('active');
  const startX = e.clientX;
  const startWidth = sidebar.getBoundingClientRect().width;
  const maxWidth = window.innerWidth * SIDEBAR_MAX_RATIO;

  const onMove = (e) => {
    const w = clamp(startWidth + (e.clientX - startX), SIDEBAR_MIN, maxWidth);
    sidebar.style.setProperty('--sidebar-width', w + 'px');
  };

  const onUp = () => {
    resizer.classList.remove('active');
    window.removeEventListener('mousemove', onMove);
    window.removeEventListener('mouseup', onUp);
    const finalWidth = sidebar.getBoundingClientRect().width;
    localStorage.setItem('mermaid-sidebar-width', Math.round(finalWidth));
    // 视口尺寸变化，重新适配图表
    if (state.lastSvg) fitToView();
  };

  window.addEventListener('mousemove', onMove);
  window.addEventListener('mouseup', onUp);
});

// ── 拖拽 ──
function onDragStart(e) {
  if (e.button !== 0) return;
  state.dragging = true;
  state.dragStartX = e.clientX;
  state.dragStartY = e.clientY;
  state.dragStartPanX = state.panX;
  state.dragStartPanY = state.panY;
  canvasArea.classList.add('dragging');
  e.preventDefault();
}

function onDragMove(e) {
  if (!state.dragging) return;
  state.panX = state.dragStartPanX + (e.clientX - state.dragStartX);
  state.panY = state.dragStartPanY + (e.clientY - state.dragStartY);
  applyTransform();
}

function onDragEnd() {
  if (!state.dragging) return;
  state.dragging = false;
  canvasArea.classList.remove('dragging');
}

let touchId = null;
function onTouchStart(e) {
  if (e.touches.length !== 1) return;
  const t = e.touches[0];
  touchId = t.identifier;
  state.dragging = true;
  state.dragStartX = t.clientX;
  state.dragStartY = t.clientY;
  state.dragStartPanX = state.panX;
  state.dragStartPanY = state.panY;
  e.preventDefault();
}

function onTouchMove(e) {
  if (!state.dragging) return;
  const t = Array.from(e.touches).find(tt => tt.identifier === touchId);
  if (!t) return;
  state.panX = state.dragStartPanX + (t.clientX - state.dragStartX);
  state.panY = state.dragStartPanY + (t.clientY - state.dragStartY);
  applyTransform();
  e.preventDefault();
}

function onTouchEnd() {
  state.dragging = false;
  touchId = null;
}

// ── 缩放 ──
function onWheel(e) {
  e.preventDefault();
  const rect = canvasArea.getBoundingClientRect();
  const mx = e.clientX - rect.left;
  const my = e.clientY - rect.top;
  const factor = e.deltaY < 0 ? (1 + ZOOM_STEP) : (1 / (1 + ZOOM_STEP));
  zoomAt(mx, my, factor);
}

function zoomBy(delta) {
  const rect = canvasArea.getBoundingClientRect();
  const factor = delta > 0 ? (1 + delta) : (1 / (1 - delta));
  zoomAt(rect.width / 2, rect.height / 2, factor);
}

function zoomAt(fx, fy, factor) {
  const newZoom = clamp(state.zoom * factor, ZOOM_MIN, ZOOM_MAX);
  if (newZoom === state.zoom) return;
  const ratio = newZoom / state.zoom;
  state.panX = fx - ratio * (fx - state.panX);
  state.panY = fy - ratio * (fy - state.panY);
  state.zoom = newZoom;
  applyTransform();
  syncZoomLabel();
}

function fitToView() {
  if (!state.svgWidth || !state.svgHeight) return;
  const rect = canvasArea.getBoundingClientRect();
  const pad = 40;
  const sx = (rect.width - pad * 2) / state.svgWidth;
  const sy = (rect.height - pad * 2) / state.svgHeight;
  state.zoom = clamp(Math.min(sx, sy), ZOOM_MIN, ZOOM_MAX);
  state.panX = (rect.width - state.svgWidth * state.zoom) / 2;
  state.panY = (rect.height - state.svgHeight * state.zoom) / 2;
  applyTransform();
  syncZoomLabel();
}

function resetView() {
  state.zoom = 1;
  state.panX = 0;
  state.panY = 0;
  applyTransform();
  syncZoomLabel();
}

function applyTransform() {
  canvasViewport.style.transform = `translate(${state.panX}px, ${state.panY}px) scale(${state.zoom})`;
}

function syncZoomLabel() {
  zoomLabel.textContent = `${Math.round(state.zoom * 100)}%`;
}

// ── Mermaid 加载与渲染 ──
async function loadMermaid() {
  try {
    mermaid = window.mermaid;
    if (!mermaid) throw new Error('mermaid not found');
    mermaid.parseError = error => showError(createUserErrorMessage(error));
    state.mermaidReady = true;
    setControlsEnabled(true);
    initializeMermaid();
    statusText.textContent = 'Mermaid 已加载，正在渲染…';
    await renderCurrentSource();
  } catch {
    state.mermaidReady = false;
    setControlsEnabled(false);
    canvasEmpty.textContent = 'Mermaid 依赖加载失败，请检查本地文件后刷新。';
    showError('Mermaid 依赖加载失败。');
    statusText.textContent = '依赖加载失败。';
  }
}

function initializeMermaid() {
  mermaid.initialize({
    startOnLoad: false,
    theme: 'default',
    securityLevel: 'strict',
    maxTextSize: MAX_SOURCE_CHARS,
    suppressErrorRendering: true,
    htmlLabels: false,
    flowchart: { htmlLabels: false, useMaxWidth: false },
    secure: ['securityLevel', 'startOnLoad', 'maxTextSize', 'htmlLabels', 'flowchart']
  });
}

function scheduleRender() {
  if (!state.mermaidReady) return;
  clearTimeout(state.renderTimer);
  state.renderTimer = setTimeout(() => renderCurrentSource(), RENDER_DEBOUNCE_MS);
}

async function renderCurrentSource() {
  clearTimeout(state.renderTimer);
  if (!state.mermaidReady || !mermaid) {
    statusText.textContent = 'Mermaid 仍在加载…';
    return;
  }

  const source = sourceInput.value.trim();
  const renderId = `mermaid-${Date.now()}-${state.renderCounter += 1}`;
  const activeRender = state.renderCounter;

  hideError();

  if (!source) {
    state.lastSvg = '';
    state.lastSource = '';
    setActionButtonsEnabled(false);
    showEmptyCanvas('请输入 Mermaid 代码。');
    previewMeta.textContent = '';
    statusText.textContent = '等待输入。';
    return;
  }

  if (source.length > MAX_SOURCE_CHARS) {
    showError(`源码过长（最多 ${MAX_SOURCE_CHARS} 字符）。`);
    return;
  }

  renderBtn.disabled = true;
  statusText.textContent = '渲染中…';

  try {
    // 去掉用户源码中已有的 init 指令，再注入当前选择的主题
    const cleaned = source.replace(/%%\{init:\s*\{[^}]*\}\s*\}%%\s*/g, '');
    const theme = themeSelect.value;
    const renderSource = theme === 'default'
      ? cleaned
      : '%%{init: {"theme": "' + theme + '"}}%%\n' + cleaned;
    const { svg } = await mermaid.render(renderId, renderSource);
    if (activeRender !== state.renderCounter) return;

    const sanitized = sanitizeSvg(svg);
    state.lastSvg = sanitized.markup;
    state.lastSource = source;

    const svgEl = sanitized.element;
    state.svgWidth = getSvgNaturalWidth(svgEl);
    state.svgHeight = getSvgNaturalHeight(svgEl);

    canvasViewport.replaceChildren(svgEl);
    canvasViewport.style.width = `${state.svgWidth}px`;
    canvasViewport.style.height = `${state.svgHeight}px`;
    canvasEmpty.style.display = 'none';

    setActionButtonsEnabled(true);
    hideError();
    fitToView();

    previewMeta.textContent = `${source.length} 字符 · ${themeSelect.value}`;
    statusText.textContent = '渲染完成。';
  } catch (error) {
    if (activeRender !== state.renderCounter) return;
    showError(createUserErrorMessage(error));
    statusText.textContent = state.lastSvg ? '渲染失败，已保留上次结果。' : '渲染失败。';
    if (!state.lastSvg) {
      setActionButtonsEnabled(false);
      showEmptyCanvas('渲染失败，请检查语法。');
    }
  } finally {
    renderBtn.disabled = false;
  }
}

function showEmptyCanvas(msg) {
  canvasEmpty.textContent = msg;
  canvasEmpty.style.display = '';
  canvasViewport.replaceChildren();
}

// ── SVG 工具 ──
function getSvgNaturalWidth(svg) {
  const vb = svg.viewBox?.baseVal;
  if (vb?.width) return vb.width;
  const w = parseFloat(svg.getAttribute('width'));
  if (Number.isFinite(w) && w > 0) return w;
  return 800;
}

function getSvgNaturalHeight(svg) {
  const vb = svg.viewBox?.baseVal;
  if (vb?.height) return vb.height;
  const h = parseFloat(svg.getAttribute('height'));
  if (Number.isFinite(h) && h > 0) return h;
  return 600;
}

function sanitizeSvg(svg) {
  const doc = new DOMParser().parseFromString(svg, 'image/svg+xml');
  const root = doc.documentElement;
  if (!root || root.nodeName.toLowerCase() !== 'svg') {
    throw new Error('Mermaid 未生成有效 SVG。');
  }

  for (const node of root.querySelectorAll(
    'script, foreignObject, foreignobject, iframe, object, embed, ' +
    'audio, video, canvas, animate, animateMotion, animateTransform, set'
  )) {
    node.remove();
  }

  for (const s of root.querySelectorAll('style')) {
    if (/url\s*\(|@import/i.test(s.textContent || '')) s.remove();
  }

  for (const el of [root, ...root.querySelectorAll('*')]) {
    for (const attr of Array.from(el.attributes)) {
      const name = attr.name.toLowerCase();
      const val = attr.value.trim().toLowerCase();
      if (name.startsWith('on')) { el.removeAttribute(attr.name); continue; }
      if ((name === 'href' || name === 'xlink:href' || name === 'src') && val && !val.startsWith('#')) {
        el.removeAttribute(attr.name); continue;
      }
      if (name === 'style' && /url\s*\(/i.test(attr.value)) {
        el.removeAttribute(attr.name);
      }
    }
  }

  return {
    markup: new XMLSerializer().serializeToString(root),
    element: root
  };
}

// ── 剪贴板 & 下载 ──
async function copyText(text, okMsg) {
  hideError();
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
    } else {
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.style.cssText = 'position:fixed;left:-9999px';
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      ta.remove();
    }
    statusText.textContent = okMsg;
  } catch {
    showError('复制失败。');
  }
}

function downloadSvg(svg) {
  const blob = new Blob([svg], { type: 'image/svg+xml;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'mermaid-diagram.svg';
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 0);
  statusText.textContent = 'SVG 已下载。';
}

// ── UI 辅助 ──
function createUserErrorMessage(error) {
  const raw = typeof error?.message === 'string' ? error.message.trim() : '';
  if (!raw) return '语法解析失败，请检查图表定义。';
  const compact = raw.replace(/\s+/g, ' ');
  if (compact.length > 150) return '语法解析失败，请检查图表定义。';
  return compact;
}

function showError(msg) {
  errorBar.textContent = msg;
  errorBar.style.display = '';
}

function hideError() {
  errorBar.style.display = 'none';
}

function setControlsEnabled(enabled) {
  [renderBtn, resetBtn, copySourceBtn, themeSelect, ...templateButtons].forEach(c => c.disabled = !enabled);
  setActionButtonsEnabled(enabled && !!state.lastSvg);
}

function setActionButtonsEnabled(enabled) {
  copySvgBtn.disabled = !enabled;
  downloadSvgBtn.disabled = !enabled;
}

function clamp(v, min, max) {
  return Math.min(Math.max(v, min), max);
}
