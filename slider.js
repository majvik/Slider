// Patched slider script scoped to #wsls

// === EMBED WRAPPER ROOT FOR WEBSTUDIO ===
const WSLS_ROOT = (function(){
  // try to locate the nearest wrapper by id 'wsls' (the container div in our HTML block)
  const el = document.getElementById('wsls') || (document.currentScript && document.currentScript.closest('#wsls')) || document.body;
  return el;
})();
const $in = (sel) => WSLS_ROOT.querySelector(sel);
const $$in = (sel) => WSLS_ROOT.querySelectorAll(sel);

// tiny helper: check if an event occurred inside the component
function isInsideSliderEvent(e){
  const path = e.composedPath ? e.composedPath() : [];
  const el = $in('.slider-section');
  if (!el) return false;
  if (path.length) return path.includes(el);
  return el.contains(e.target);
}

// ГОРИЗОНТАЛЬНЫЙ СЛАЙДЕР
// === СОСТОЯНИЯ СТРАНИЦЫ ===
const STATE = { NORMAL: 'normal', ACTIVE: 'active' }; // NORMAL = обычная страница, ACTIVE = активен слайдер

// === ОСНОВНЫЕ НАСТРОЙКИ ===
const APPROACH_DURATION_MS = 1040;  // время плавного подъезда к секции слайдера (в миллисекундах)
const CAPTURE_ON_VIS       = 0.42;  // минимальная видимость секции для автоматического захвата (42%)
const NEAR_PX              = 200;   // зона захвата: если секция в пределах 200px от края экрана
const NEAR_TIGHT_PX        = 80;    // узкая зона для точной доводки к секции
const EXIT_PASS_MS         = 1300;  // задержка перед повторным захватом секции (после выхода)
const EXIT_WHEEL_LOCK_MS  = 1300;  // время блокировки колеса мыши после выхода из слайдера
const ACTIVATE_WHEN_VISIBLE= 0.995; // активируем слайдер когда секция видна на 99.5%


// === НАСТРОЙКИ ГОРИЗОНТАЛЬНОЙ АНИМАЦИИ ===
const H_EASE = 0.06;           // плавность движения слайдера (чем меньше, тем плавнее)
const H_EASE_NEAR_EDGE = 0.10; // плавность у краев слайдера (чуть быстрее для точности)

// === ЧУВСТВИТЕЛЬНОСТЬ КОЛЕСА МЫШИ И ТАЧПАДА ===
const H_WHEEL_GAIN   = 1.5;   // чувствительность колеса мыши (было 4.0 - теперь более плавно)
const TP_WHEEL_GAIN  = 0.75;  // чувствительность тачпада (чуть медленнее для контроля)
const H_MAX_STEP     = 60;     // максимальный сдвиг слайдера за одно движение колеса (в пикселях)

// === НАСТРОЙКИ ВЫХОДА ИЗ СЛАЙДЕРА ===
const EDGE_EPS = 50;               // зона у края слайдера для активации выхода (в пикселях)
const EDGE_INTENT_WINDOW_MS = 260; // время для накопления намерения выйти (в миллисекундах)
const TP_EDGE_EPS = 88;            // зона выхода для тачпада (шире чем для мыши)
const TP_PUSH = 20;                // минимальное усилие для выхода с тачпада (в пикселях)
const TP_BURST_EVENTS = 3;         // количество быстрых движений для мгновенного выхода
const TP_BURST_MS = 160;           // время для подсчета быстрых движений (в миллисекундах)
const TP_INSTANT_DY = 14;          // одно сильное движение сразу вызывает выход
const TP_DECAY_PER_MS = 0.003;     // скорость затухания намерения выйти (экспоненциально)

// === ЗОНА ВЫХОДА У КРАЕВ СЛАЙДЕРА ===
const EXIT_NEAR_PCT  = 0.10; // 10% от ширины слайда - зона для выхода
const EXIT_NEAR_MIN  = 60;   // минимальная зона выхода в пикселях
const EXIT_PUSH_K    = 0.85; // сниженный порог выхода (85%) когда уже у края
const TP_EXIT_ZONE_K = 1.8;  // зона выхода для тачпада в 1.8 раза шире

// === ПОМОЩЬ У КРАЕВ СЛАЙДЕРА ===
const EDGE_ASSIST_PX     = 56;  // если слайд ближе 56px к краю - автоматически подтягиваем к краю
const EDGE_ASSIST_LERP   = 0.6; // сила автоматического подтягивания к краю (0.6 = 60% от расстояния)

// === АВТОМАТИЧЕСКИЙ ДОКРУТ К КРАЯМ СЛАЙДЕРА ===
const EDGE_AUTO_COMPLETE_PCT = 0.95; // считаем "у края" когда слайд виден на 95%
const EDGE_AUTO_MIN_PX       = 14;   // минимальное расстояние для автодокрута (в пикселях)
const EDGE_AUTO_LERP         = 0.55; // скорость автодокрута (чем больше, тем быстрее)
const EDGE_AUTO_VEL_EPS      = 1.0;  // порог скорости: ниже 1px/кадр считаем "стоим на месте"

// === ТОЧНАЯ НАСТРОЙКА ДЛЯ ТАЧПАДА ===
const EDGE_AUTO_LERP_TARGET_TP = 0.55;  // быстрый отклик для тачпада (crisp-feel)

// === ЗАМЕДЛЕННАЯ АНИМАЦИЯ В ГЛАВНОМ ЦИКЛЕ ===
const EDGE_AUTO_LERP_RAF = 0.28;        // плавная анимация в 2 раза медленнее (было 0.55)

// === НАСТРОЙКИ ТОЧНОСТИ АНИМАЦИИ ===
const GSAP_DECIMALS = 2;                // точность позиционирования: 2 знака после запятой (убирает дрожание)

// === АВТОМАТИЧЕСКИЙ ДОТЯГ К КРАЯМ ===
const AUTO_SNAP_MS_DESKTOP = 750;  // время автодотяга для мыши (в миллисекундах)
const AUTO_SNAP_MS_TP      = 1050; // время автодотяга для тачпада (медленнее для контроля)
const AUTO_SNAP_EASE = (t) => 1 - Math.pow(1 - t, 3); // плавность анимации (easeOutCubic)

// === ЗАЩИТА ОТ СЛУЧАЙНОГО ВЫХОДА ===
const EXIT_AFTER_SNAP_MS = 420; // запрет выхода на 420мс после автодотяга (grace-период)

// === ПЕРЕМЕННЫЕ АВТО-ДОТЯГА ===
let autoSnap = { active:false, edge:null, from:0, to:0, start:0, dur:0 }; // состояние автодотяга
let exitLockUntil = 0; // время до которого запрещен выход (grace-период)

// === НАСТРОЙКИ ВЫХОДА У КРАЕВ ===
const EDGE_EXIT_ARM_MS = 180; // время ожидания у края перед разрешением выхода (в миллисекундах)
let startArmed = false, endArmed = false; // готовность к выходу с первого/последнего слайда

// === СТАБИЛЬНОСТЬ У КРАЕВ СЛАЙДЕРА ===
const EDGE_TIGHT_PX  = 24;   // зона "в упор к краю" (в пикселях)
const EDGE_STABLE_MS = 90;   // время неподвижности для активации выхода (в миллисекундах)
const H_VEL_EPS      = 0.65; // максимальная скорость для "стояния на месте" (пикселей/кадр)

// === НАСТРОЙКИ ДЛЯ ТАЧПАДА (более чувствительные) ===
const H_VEL_EPS_TP    = 1.6; // порог скорости для тачпада (выше чем для мыши)
const EDGE_STABLE_MS_TP = 50; // время стабильности для тачпада (быстрее чем для мыши)

// === НАСТРОЙКИ ПЕРЕТАСКИВАНИЯ МЫШЬЮ ===
const DRAG_VIS_TO_ENTER = 0.98; // минимальная видимость секции для активации перетаскивания (98%)
const DRAG_MIN_DELTA_PX = 4;    // минимальное движение мыши для начала перетаскивания (в пикселях)
const DRAG_AXIS_LOCK_K  = 1.25; // коэффициент блокировки оси (1.25 = блокируем при движении в 1.25 раза больше по одной оси)

// === ЭЛЕМЕНТЫ СЛАЙДЕРА В DOM ===
const sliderSection = $in('.slider-section'); // основная секция слайдера
const sliderTrack = $in('.slider-track');   // дорожка со слайдами
const sliderWrapper = $in('.slider-wrapper'); // обертка слайдера
const slides = $$in('.slide');       // все слайды

// === ФУНКЦИИ ДЛЯ ОПРЕДЕЛЕНИЯ ТИПА УСТРОЙСТВА ===
function isMobileDevice() {
  return window.innerWidth <= 768;
}

let isMobile = isMobileDevice(); // определение мобильного устройства

// === ПЕРЕМЕННЫЕ ДЛЯ МЕТАДАННЫХ СЛАЙДОВ ===
let lastMetaActiveIndex = -1; // кэш последнего активного индекса

// === ПЕРЕМЕННЫЕ СОСТОЯНИЯ СТРАНИЦЫ ===
let pageState = STATE.NORMAL; // текущее состояние: обычная страница или активен слайдер
let lastExitTs = 0;           // время последнего выхода из слайдера

// === ГОРИЗОНТАЛЬНОЕ ПОЛОЖЕНИЕ СЛАЙДЕРА ===
let target = 0;    // целевая позиция слайдера (куда хотим попасть)
let current = 0;   // текущая позиция слайдера (где сейчас находимся)
let maxScroll = 0; // максимальная прокрутка (длина всего слайдера)

// === ПЕРЕМЕННЫЕ ПЕРЕТАСКИВАНИЯ ===
let isDragging = false;        // активно ли перетаскивание
let dragStartX = 0, dragStartY = 0, dragStartTarget = 0; // начальные координаты и позиция
let dragMoved = false, dragLocked = false;                // было ли движение и заблокирована ли ось

// === ПЕРЕМЕННЫЕ КАСАНИЯ (МОБИЛЬНЫЕ УСТРОЙСТВА) ===
let tStartX = 0, tStartY = 0, tStartTarget = 0, touchHoriz = false; // начальные координаты касания и направление
let touchStartX = 0, touchStartY = 0, touchStartTarget = 0, hasHorizontalSwipe = false; // дополнительные переменные для лучшего контроля

// === ПЕРЕМЕННЫЕ ПОДХОДА И ИНЕРЦИИ ===
let isSettling = false;       // идет ли жесткая доводка к секции (в узкой зоне)
let approachInFlight = false; // активно ли плавное приближение к секции
let wheelLockUntil = 0;       // время до которого заблокировано колесо мыши (во время подхода)

// === ОТСЛЕЖИВАНИЕ НАМЕРЕНИЯ ВЫЙТИ ИЗ СЛАЙДЕРА ===
let edgeIntentUp = 0, edgeIntentDown = 0, edgeIntentLastTs = 0; // намерение выйти вверх/вниз и время последнего события
let tpScore = 0; // счетчик для определения типа устройства (тачпад или мышь)

// === ОТСЛЕЖИВАНИЕ СТАБИЛЬНОСТИ У КРАЕВ ===
let startTightSince = 0, endTightSince = 0; // время начала "стояния" у первого/последнего слайда
let lastCurrentX = 0;                        // предыдущая позиция слайдера (для расчета скорости)

// === ОБНАРУЖЕНИЕ БЫСТРЫХ ДВИЖЕНИЙ (ТАЧПАД) ===
let burstCountUp = 0, burstStartTsUp = 0;     // счетчик быстрых движений вверх и время начала
let burstCountDown = 0, burstStartTsDown = 0; // счетчик быстрых движений вниз и время начала
let lastIntentTs = 0;                          // время последнего намерения (для плавного затухания)

// === ОПРЕДЕЛЕНИЕ ТИПА УСТРОЙСТВА ===
let isTrackpadLikely = false; // вероятно ли что используется тачпад (влияет на настройки чувствительности)

// === НАСТРОЙКИ ПОВТОРНОГО ВХОДА В СЛАЙДЕР ===
const REENTER_CLEAR_PX = 280; // расстояние от секции для разрешения повторного захвата (в пикселях)
const EXIT_OVERSHOOT_PX = 40; // дополнительный запас поверх основного расстояния (в пикселях)

// === МЯГКИЙ ПОВТОРНЫЙ ВХОД В СЛАЙДЕР ===
const SOFT_REENTER_PX  = 140; // зона у края экрана для мгновенного захвата секции (в пикселях)
const SOFT_REENTER_VIS = 0.14; // минимальная видимость секции для мягкого входа (14%)

// === СТОРОЖ ПОВТОРНОГО ВХОДА ===
let reenterGuard = null;      // защита от повторного входа: { направление: 'up'|'down', до_позиции_Y: число }
let lastExitDir  = null;      // направление последнего выхода из слайдера

// ===== РАННИЙ ЗАХВАТ КОЛЕСА МЫШИ (исправление инерции тачпада) =====
document.addEventListener('wheel', (e) => {
  if (!isInsideSliderEvent(e)) return;
  // НЕ блокируем на мобильных устройствах - там работают touch события
  if (isMobile || pageState !== STATE.NORMAL || !sliderSection) return;

  const now = performance.now();
  const dy = e.deltaY;
  const { rect, vh, vis } = visibilityInfo();

  // --- МЯГКИЙ ПОВТОРНЫЙ ВХОД ПО НАПРАВЛЕНИЮ (обходит защиту и задержку) ---
  const softAlign = softReenterAlign(dy, rect, vh);
  if (softAlign) {
    reenterGuard = null;             // немедленно отключаем защиту от повторного входа
    lastExitTs = 0;                  // сбрасываем задержку перед повторным захватом
    wheelLockUntil = now + 360;
    e.preventDefault();
    e.stopImmediatePropagation();
    approachToSection(softAlign);
    return;
  }

  // --- ПРОВЕРКА ОБЫЧНЫХ ЗАЩИТ ---
  if (isReenterBlocked()) return;                    // проверяем защиту от повторного входа
  if (now - lastExitTs < EXIT_PASS_MS) return;      // проверяем задержку после выхода

  if (isSettling || now < wheelLockUntil || approachInFlight) {
    e.preventDefault();
    e.stopImmediatePropagation();
    return;
  }

  // --- ОПРЕДЕЛЕНИЕ НАПРАВЛЕНИЯ ДВИЖЕНИЯ ---
  const approachingDown = dy > 0 && rect.top > 0;    // движемся вниз и секция ниже экрана
  const approachingUp   = dy < 0 && rect.bottom < vh; // движемся вверх и секция выше экрана
  const towards = approachingDown || approachingUp;   // движемся ли к секции

  // --- ЗОНЫ ЗАХВАТА У КРАЕВ ЭКРАНА ---
  const nearTopTight    = Math.abs(rect.top) <= NEAR_TIGHT_PX;    // очень близко к верхнему краю
  const nearBottomTight = Math.abs(rect.bottom - vh) <= NEAR_TIGHT_PX; // очень близко к нижнему краю
  const nearTop         = Math.abs(rect.top) <= NEAR_PX;          // близко к верхнему краю
  const nearBottom      = Math.abs(rect.bottom - vh) <= NEAR_PX; // близко к нижнему краю
  const intersectingWide = rect.top < vh * 0.92 && rect.bottom > vh * 0.08; // секция пересекает экран

  if (!towards) return;

  // --- ОЧЕНЬ БЛИЗКО К СЕКЦИИ - ЖЕСТКАЯ ДОВОДКА ---
  if (nearTopTight || nearBottomTight) {
    wheelLockUntil = now + 360;
    e.preventDefault();
    e.stopImmediatePropagation();
    if (!isSettling) settleToSection(approachingDown ? 'start' : 'end');
    return;
  }

  // --- ОБЫЧНАЯ ЗОНА - ПЛАВНЫЙ ПОДЪЕЗД ---
  if (nearTop || nearBottom || intersectingWide || vis >= CAPTURE_ON_VIS) {
    wheelLockUntil = now + 100; // короткая блокировка колеса (чтобы инерция не убежала)
    e.preventDefault(); // не останавливаем всплытие события
  }
}, { passive: false, capture: true });
// ===== КОНЕЦ РАННЕГО ЗАХВАТА КОЛЕСА =====

// === ИНИЦИАЛИЗАЦИЯ СЛАЙДЕРА ===
function boot() {
  disableStaticSnapCSS(); // отключаем CSS snap-скролл

  // --- НАСТРОЙКА LENIS (ПЛАВНЫЙ СКРОЛЛ) ---
  if (window.Lenis && !window.lenis) {
    window.lenis = new window.Lenis({
      smoothWheel: true,        // плавное колесо мыши
      smoothTouch: false,       // отключаем плавность касания (используем свою)
      normalizeWheel: true,     // нормализация колеса мыши
      lerp: 0.09,               // плавность анимации (0.09 = очень плавно)
      wheelMultiplier: 1.0,     // множитель колеса мыши
      duration: 1.0,            // длительность анимации
      easing: (t) => 1 - Math.pow(1 - t, 3), // плавность: easeOutCubic
      orientation: 'vertical',   // ориентация скролла
      gestureOrientation: 'vertical', // ориентация жестов
      touchMultiplier: 2,       // множитель касания
      infinite: false            // бесконечный скролл отключен
    });
  }

  initSlider();              // инициализация слайдера
  setupIOApproachFallback(); // настройка fallback для Intersection Observer
  startLoop();               // запуск главного цикла анимации
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', boot, { once: true });
} else {
  boot();
}

function disableStaticSnapCSS() { /* noop in embed */ }

function initSlider() {
  updateMaxScroll();           // обновляем максимальную прокрутку слайдера
  
  if (!isMobile) {
    // Только для десктопа: настройка колеса мыши и перетаскивания
    setupWheel();
    setupDesktopDrag();
    if (sliderWrapper) sliderWrapper.style.cursor = 'grab';
    
    // Принудительно скрываем все метаданные при инициализации на десктопе
    setMetaActive(-1);
  } else {
    // Только для мобильных: настройка touch событий
    setupMobileTouch();
    
    // На мобильном убеждаемся, что все метаданные видны
    slides.forEach(s => s.classList.remove('meta-active'));
  }
  
  injectSlideMeta();           // добавляем метаданные к слайдам
  hydrateImageAspectRatios();  // устанавливаем правильные пропорции изображений
}

// === ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ ===
function clamp(v, a, b){ return Math.max(a, Math.min(b, v)); } // ограничивает значение v между a и b
function lerp(a, b, t){ return a + (b - a) * t; }               // линейная интерполяция между a и b с коэффициентом t

// === ФУНКЦИИ ДЛЯ УПРАВЛЕНИЯ МЕТАДАННЫМИ СЛАЙДОВ ===
function setMetaActive(index) {
  if (isMobile) {
    // На мобильном не управляем классами - все метаданные видны через CSS
    return;
  }

  if (index === null || index === undefined || index < 0) {
    slides.forEach(s => s.classList.remove('meta-active'));
    lastMetaActiveIndex = -1;
    return;
  }

  if (index === lastMetaActiveIndex) return;

  slides.forEach((s, i) => {
    if (i === index) s.classList.add('meta-active');
    else s.classList.remove('meta-active');
  });
  lastMetaActiveIndex = index;
}

function updateSlideMetaVisibility() {
  if (isMobile) {
    // На мобильном все метаданные всегда видны через CSS
    return;
  }

  // Показываем подписи только когда слайдер активируется/активен
  if (pageState !== STATE.ACTIVE) {
    setMetaActive(-1);
    return;
  }

  let idx = getCurrentSlideIndex();

  // Если дошли до конца — подсвечиваем последний
  const EPS = 1; // допустимое отклонение в пикселях
  if (maxScroll > 0 && (target >= maxScroll - EPS || current >= maxScroll - EPS)) {
    idx = slides.length - 1;
  }

  idx = Math.max(0, Math.min(idx, slides.length - 1));
  setMetaActive(idx);
}

function visibilityInfo() {
  const rect = sliderSection.getBoundingClientRect(); // получаем размеры и позицию секции слайдера
  const vh = window.innerHeight;                      // высота видимой области экрана
  const visible = Math.min(rect.bottom, vh) - Math.max(rect.top, 0); // вычисляем видимую часть секции
  return { rect, vh, vis: Math.max(0, Math.min(1, visible / vh)) };  // возвращаем: размеры, высота экрана, доля видимости (0-1)
}

function updateMaxScroll() {
  if (!sliderWrapper) return;
  let viewportWidth = window.innerWidth;

  if (!isMobile) {
    const slider = $in('.slider');
    if (slider) {
      const cs = getComputedStyle(slider);
      const paddingLeft = parseFloat(cs.paddingLeft) || 0;
      const paddingRight = parseFloat(cs.paddingRight) || 0;
      viewportWidth = Math.max(0, viewportWidth - paddingLeft - paddingRight);
    }
  }
  maxScroll = Math.max(0, sliderWrapper.scrollWidth - viewportWidth);
}

function getDesktopStep(){
  if (slides.length <= 1) return maxScroll || 0;
  return maxScroll / (slides.length - 1);
}

// Вычисляем текущий шаг для каждого слайда на мобильном (ширина слайда + отступ)
function getMobileSlideStep() {
  if (!isMobile || !sliderWrapper) return window.innerWidth;
  const firstSlide = sliderWrapper.querySelector('.slide');
  const slideWidth = firstSlide ? firstSlide.getBoundingClientRect().width : window.innerWidth;
  // Compute margin-right as spacing between slides (since gap is disabled on mobile)
  const slideStyles = firstSlide ? window.getComputedStyle(firstSlide) : null;
  const marginRightStr = slideStyles ? slideStyles.marginRight : '0px';
  const marginRight = parseFloat(marginRightStr) || 0;
  return slideWidth + marginRight;
}

function getMobileStep(){
  if (!isMobile || !sliderWrapper) return window.innerWidth;
  const first = sliderWrapper.querySelector('.slide');
  const slideWidth = first ? first.getBoundingClientRect().width : window.innerWidth;
  // Compute margin-right as spacing between slides (since gap is disabled on mobile)
  const slideStyles = first ? window.getComputedStyle(first) : null;
  const marginRightStr = slideStyles ? slideStyles.marginRight : '0px';
  const marginRight = parseFloat(marginRightStr) || 0;
  return slideWidth + marginRight;
}

function getCurrentSlideIndex() {
  if (!slides.length) return 0;
  
  if (isMobile) {
    const step = getMobileSlideStep();
    return Math.round(current / step);
  } else {
    const slideWidth = (maxScroll / (slides.length - 1));
    return Math.round(current / slideWidth);
  }
}

function isFirstSlide() {
  return getCurrentSlideIndex() === 0;
}

function isLastSlide() {
  return getCurrentSlideIndex() === slides.length - 1;
}

function pauseLenis(){ window.lenis?.stop?.(); }
function resumeLenis(){ window.lenis?.start?.(); }

function setOverscrollContain(on){
  const el = document.scrollingElement || document.documentElement;
  el.style.overscrollBehaviorY = on ? 'contain' : '';
}

function isReenterBlocked() {
  if (!reenterGuard) return false;
  const y = window.scrollY;

  if (reenterGuard.dir === 'down') {
    if (y < reenterGuard.untilY) return true;
  } else {
    if (y > reenterGuard.untilY) return true;
  }

  // Порог пройден — снимаем сторож И снимаем временной запрет
  reenterGuard = null;
      lastExitTs = 0;        // ← ключевая строка: разрешаем немедленный повторный захват
  return false;
}

function armReenterGuard(direction) {
  if (!sliderSection) return;
  const top = sliderSection.offsetTop;
  const bottom = top + sliderSection.offsetHeight;
  lastExitDir = direction;
  reenterGuard = (direction === 'down')
    ? { dir: 'down', untilY: bottom + REENTER_CLEAR_PX }
    : { dir: 'up',   untilY: Math.max(0, top - REENTER_CLEAR_PX) };
}

function softReenterAlign(dy, rect, vh) {
  if (!lastExitDir) return null;
  const goingUp = dy < 0;
  const goingDown = dy > 0;

  // считаем видимую высоту секции
  const visPx = Math.min(rect.bottom, vh) - Math.max(rect.top, 0);
  const vis = Math.max(0, Math.min(1, visPx / vh));

  // если только что вышли ВНИЗ (последний слайд) и крутим ВВЕРХ —
  // ловим, когда низ секции у нижней границы экрана / слегка вошла в кадр
  if (lastExitDir === 'down' && goingUp) {
    const nearBottomSoft = (vh - rect.bottom) <= SOFT_REENTER_PX && rect.bottom > 0;
    if (nearBottomSoft || vis >= SOFT_REENTER_VIS) return 'end'; // выравниваем к "концу"
  }

  // если вышли ВВЕРХ (первый слайд) и крутим ВНИЗ —
  // ловим, когда верх секции у верхней границы экрана / слегка вошла в кадр
  if (lastExitDir === 'up' && goingDown) {
    const nearTopSoft = Math.abs(rect.top) <= SOFT_REENTER_PX && rect.top < vh;
    if (nearTopSoft || vis >= SOFT_REENTER_VIS) return 'start';
  }

  return null;
}

function beginAutoSnap(edge){ // edge: 'start' (первый слайд) | 'end' (последний слайд)
  const now = performance.now();
  autoSnap = {
    active: true,
    edge,
    from: current,
    to:   edge === 'start' ? 0 : maxScroll,
    start: now,
    dur:   isTrackpadLikely ? AUTO_SNAP_MS_TP : AUTO_SNAP_MS_DESKTOP
  };
  // ключевое: обнуляем «намерение» выхода и burst-счётчики
  edgeIntentUp = 0; edgeIntentDown = 0;
  burstCountUp = burstCountDown = 0;
}
function cancelAutoSnap(){ autoSnap.active = false; }

// === ИЗМЕНЕНИЕ СОСТОЯНИЯ СЛАЙДЕРА ===
function setState(next){
  if (pageState === next) return;
  
  pageState = next;
  if (next === STATE.ACTIVE) {
    setOverscrollContain(true);   // ← блокируем overscroll (резиновый эффект)
    pauseLenis();
    // При активации слайдера сразу показываем метаданные первого слайда
    if (!isMobile) {
      setMetaActive(0);
    }
  } else {
    lastExitTs = Date.now();
    // оставим contain включённым — выключим его после EXIT_PASS_MS в forceExit/smoothExit
    resumeLenis();
    // При деактивации скрываем все метаданные
    if (!isMobile) {
      setMetaActive(-1);
    }
  }
}

// === ПРИНУДИТЕЛЬНЫЙ ВЫХОД ИЗ СЛАЙДЕРА ===
function forceExit(direction /* 'up' | 'down' */){
  if (!sliderSection) return;
  armReenterGuard(direction);

  if (direction === 'up') {
    target = 0; current = 0;
    if (sliderTrack && typeof gsap !== 'undefined') gsap.set(sliderTrack, { x: 0 });
  } else {
    target = maxScroll; current = maxScroll;
    if (sliderTrack && typeof gsap !== 'undefined') gsap.set(sliderTrack, { x: -maxScroll });
  }

  edgeIntentUp = edgeIntentDown = 0;
  burstCountUp = burstCountDown = 0;

  setState(STATE.NORMAL);
  setOverscrollContain(true);
  smoothExitFromSlider(direction);
  setTimeout(() => setOverscrollContain(false), EXIT_PASS_MS);
}

function smoothExitFromSlider(direction = 'down') {
  if (!window.lenis || !sliderSection) return;

  armReenterGuard(direction); // устанавливаем защиту от повторного входа

  const sliderTop = sliderSection.offsetTop;
  const sliderBottom = sliderTop + sliderSection.offsetHeight;

  // уходим минимум на REENTER_CLEAR_PX + запас
  const away = REENTER_CLEAR_PX + (typeof EXIT_OVERSHOOT_PX !== 'undefined' ? EXIT_OVERSHOOT_PX : 0);

  const targetScroll = direction === 'down'
    ? sliderBottom + away            // раньше было +180px — не хватало чтобы "разоружить" защиту
    : Math.max(0, sliderTop - away); // раньше было -180px — аналогично

  setOverscrollContain(true);
  wheelLockUntil = performance.now() + EXIT_WHEEL_LOCK_MS;
  window.lenis.scrollTo(targetScroll, {
    duration: 0.9,
    easing: (t) => 1 - Math.pow(1 - t, 3),
    immediate: false
  });

  setTimeout(() => setOverscrollContain(false), EXIT_PASS_MS);
}

// === ЖЁСТКАЯ ДОВОДКА В ОЧЕНЬ УЗКОЙ ЗОНЕ (ТОЧНОЕ ВЫРАВНИВАНИЕ) ===
function settleToSection(align /* 'start' | 'end' */) {
  if (!sliderSection || isSettling) return;
  isSettling = true;

  let lenisStopped = false;
  if (window.lenis?.stop) { window.lenis.stop(); lenisStopped = true; }

  const scroller = document.scrollingElement || document.documentElement;
  const startY   = scroller.scrollTop;
  const targetY  = (align === 'start')
    ? sliderSection.offsetTop
    : sliderSection.offsetTop + sliderSection.offsetHeight - window.innerHeight;

  const delta = targetY - startY;
  const duration = 500;
  const startT   = performance.now();
  const easeOut  = (t) => 1 - Math.pow(1 - t, 3);

  wheelLockUntil = startT + duration + 180;

  (function step(now){
    const t = Math.min(1, (now - startT) / duration);
    scroller.scrollTop = Math.round(startY + delta * easeOut(t));
    if (t < 1) { requestAnimationFrame(step); return; }

    // финальная добивка до идеального выравнивания
    if (align === 'start') {
      const remain = sliderSection.getBoundingClientRect().top;
      scroller.scrollTop = Math.round(scroller.scrollTop + remain);
    } else {
      const remain = sliderSection.getBoundingClientRect().bottom - window.innerHeight;
      scroller.scrollTop = Math.round(scroller.scrollTop + remain);
    }

    isSettling = false;
    if (lenisStopped) window.lenis?.start?.();
  })(startT);
}

// === МЯГКИЙ ПОДЪЕЗД — ВСЕГДА requestAnimationFrame, фиксированное время ===
function approachToSection(align /* 'start' | 'end' */) {
  if (!sliderSection || approachInFlight) return;
  approachInFlight = true;

  let lenisStopped = false;
  if (window.lenis?.stop) { window.lenis.stop(); lenisStopped = true; }

  const scroller = document.scrollingElement || document.documentElement;
  const startY   = scroller.scrollTop;
  const targetY  = (align === 'start')
    ? sliderSection.offsetTop
    : sliderSection.offsetTop + sliderSection.offsetHeight - window.innerHeight;
  const delta    = targetY - startY;

  const startT   = performance.now();
  const dur      = APPROACH_DURATION_MS;
  const ease     = (t) => 1 - Math.pow(1 - t, 3); // плавность: easeOutCubic (замедление к концу)

  wheelLockUntil = startT + dur + 140;

  (function step(now){
    const t = Math.min(1, (now - startT) / dur);
    scroller.scrollTop = Math.round(startY + delta * ease(t));
    if (t < 1) { requestAnimationFrame(step); return; }

    // финальная добивка до точной привязки
    if (align === 'start') {
      const remain = sliderSection.getBoundingClientRect().top;
      scroller.scrollTop = Math.round(scroller.scrollTop + remain);
    } else {
      const remain = sliderSection.getBoundingClientRect().bottom - window.innerHeight;
      scroller.scrollTop = Math.round(scroller.scrollTop + remain);
    }

    approachInFlight = false;
    if (lenisStopped) window.lenis?.start?.();

    const { vis } = visibilityInfo();
    if (vis >= ACTIVATE_WHEN_VISIBLE) setState(STATE.ACTIVE);
  })(startT);
}

// === ОБРАБОТКА КОЛЕСА МЫШИ (всплывающие события) ===
var wheelHandler = null;

function setupWheel(){
  if (isMobile) return; // пропускаем на мобильных устройствах
  
  // Очищаем предыдущий обработчик если он есть
  clearWheel();

  wheelHandler = (e) => {
    const now = performance.now();

    // --- БЛОКИРОВКА КОЛЕСА ВО ВРЕМЯ АНИМАЦИЙ ---
    if (isSettling || approachInFlight || now < wheelLockUntil) {
      e.preventDefault();
      return;
    }

    const dy = e.deltaY;

    // --- НОРМАЛЬНЫЙ РЕЖИМ - ОПРЕДЕЛЯЕМ КОГДА ЗАХВАТЫВАТЬ СЕКЦИЮ ---
    if (pageState === STATE.NORMAL) {
      if (isReenterBlocked()) return; // никакого подхода/активации, пока активна защита
      if (!sliderSection) return;
      const { rect, vh, vis } = visibilityInfo();

      const dy = e.deltaY;

      // --- МЯГКИЙ ПОВТОРНЫЙ ВХОД (ОБХОДИТ ВСЕ ЗАДЕРЖКИ) ---
      const softAlign2 = softReenterAlign(dy, rect, vh);
      if (softAlign2) {
        reenterGuard = null;    // отключаем защиту от повторного входа
        lastExitTs = 0;         // сбрасываем задержку после выхода
        e.preventDefault();
        approachToSection(softAlign2);
        return;
      }

      // --- ОПРЕДЕЛЕНИЕ НАПРАВЛЕНИЯ ДВИЖЕНИЯ К СЕКЦИИ ---
      const towards =
        (dy > 0 && rect.top > 0)  || // движемся вниз и секция ниже экрана
        (dy < 0 && rect.bottom < vh); // движемся вверх и секция выше экрана

      // --- ПРОВЕРКА УСЛОВИЙ ДЛЯ ЗАХВАТА СЕКЦИИ ---
      const intersecting = rect.top < vh * 0.95 && rect.bottom > vh * 0.05; // секция пересекает экран
      const nearTop      = Math.abs(rect.top) <= NEAR_PX;                    // секция близко к верхнему краю
      const nearBottom   = Math.abs(rect.bottom - vh) <= NEAR_PX;           // секция близко к нижнему краю

      // --- АКТИВАЦИЯ ПОДХОДА К СЕКЦИИ ---
      if ((towards && (vis >= CAPTURE_ON_VIS || nearTop || nearBottom || intersecting)) &&
          (Date.now() - lastExitTs) >= EXIT_PASS_MS) {
        e.preventDefault();
        const align = dy > 0 ? 'start' : 'end'; // определяем выравнивание по направлению
        approachToSection(align);                // запускаем плавный подход (всегда заметная анимация)
        return;
      }

      // --- АКТИВАЦИЯ РЕЖИМА СЛАЙДЕРА ---
      if (vis >= ACTIVATE_WHEN_VISIBLE &&
          (Date.now() - lastExitTs) >= EXIT_PASS_MS) { // защиту уже проверили выше
        // активируем слайдер только когда реально движемся к секции
        const towards = (dy > 0 && rect.top > 0) || (dy < 0 && rect.bottom < vh);
        if (towards) setState(STATE.ACTIVE);
      }

      return; // не блокируем страницу, если секция еще далеко
    }

    // === АКТИВНЫЙ РЕЖИМ СЛАЙДЕРА: вертикаль → горизонталь + намерение + стабильность у краев ===
    if (pageState === STATE.ACTIVE) {
      // --- ОБРАБОТКА АВТО-ДОТЯГА ---
      if (autoSnap.active) {
        const towardsExit =
          (autoSnap.edge === 'end'   && dy > 0) ||
          (autoSnap.edge === 'start' && dy < 0);

        const backInside =
          (autoSnap.edge === 'end'   && dy < 0) ||
          (autoSnap.edge === 'start' && dy > 0);

        if (backInside) {
          cancelAutoSnap(); // вернули горизонтальный контроль пользователю
          // продолжаем обычную обработку ниже
        } else if (towardsExit) {
          // --- ПРОВЕРКА ВОЗМОЖНОСТИ БЫСТРОГО ВЫХОДА ---
          const armed = (autoSnap.edge === 'end') ? endArmed : startArmed; // готовность к выходу
          if (performance.now() >= exitLockUntil && armed) {
            e.preventDefault();
            const dir = (autoSnap.edge === 'end') ? 'down' : 'up'; // определяем направление выхода
            cancelAutoSnap(); // отменяем авто-дотяг
            forceExit(dir);   // принудительно выходим
            return;
          }
          // иначе просто глотаем событие (продолжаем дотягиваться)
          e.preventDefault();
          return;
        }
      }

      const nowTs = performance.now();

      // --- ОПРЕДЕЛЕНИЕ ТИПА УСТРОЙСТВА (ТАЧПАД ИЛИ МЫШЬ) ---
      if (e.deltaMode === 0 && Math.abs(dy) <= 6) tpScore = Math.min(10, tpScore + 2); // увеличиваем счетчик тачпада
      else tpScore = Math.max(0, tpScore - 1);                                            // уменьшаем счетчик мыши
      const isTP = tpScore >= 4;                                                           // определяем тип устройства
      isTrackpadLikely = isTP;                                                             // запоминаем для других функций

      // --- НАСТРОЙКИ ЧУВСТВИТЕЛЬНОСТИ МЫШИ ---
      const MOUSE_INTENT_CAP = 60;       // максимальные "очки" за один тик колеса (было 45)
      const PUSH_MOUSE_BASE = 120;       // базовый порог для выхода (было 160)
      const PUSH_MOUSE_K = 0.25;         // коэффициент от размера шага (было 0.35)

      // --- ВЫЧИСЛЕНИЕ ЗОНЫ ВЫХОДА У КРАЕВ ---
      const stepPx = isMobile ? getMobileStep() : getDesktopStep(); // размер шага слайдера
      const nearExitBase   = Math.max(EXIT_NEAR_MIN, stepPx * EXIT_NEAR_PCT); // базовая зона выхода
      const nearExitMargin = isTP ? nearExitBase * TP_EXIT_ZONE_K : nearExitBase; // расширенная зона для тачпада

      // --- ОПРЕДЕЛЕНИЕ ЗОН ВЫХОДА У КРАЕВ ---
      // используем широкую зону для выхода, считаем ТОЛЬКО по текущей позиции
      const nearStartExit = current <= nearExitMargin;           // близко к первому слайду (выход вверх)
      const nearEndExit   = (maxScroll - current) <= nearExitMargin; // близко к последнему слайду (выход вниз)

      // --- ДИНАМИЧЕСКИЕ ПОРОГИ ВЫХОДА ---
      const edgeEps = isTP ? TP_EDGE_EPS : EDGE_EPS; // зона края в зависимости от устройства
      const PUSH    = isTP ? TP_PUSH     : 110;       // порог выхода в зависимости от устройства

      // --- ЭКСПОНЕНЦИАЛЬНОЕ ЗАТУХАНИЕ НАМЕРЕНИЯ ВЫЙТИ ---
      const dt = lastIntentTs ? (nowTs - lastIntentTs) : 0; // время с последнего события
      const decay = Math.exp(-dt * (isTP ? TP_DECAY_PER_MS : TP_DECAY_PER_MS * 0.5)); // коэффициент затухания
      edgeIntentUp   *= decay; // затухание намерения выйти вверх
      edgeIntentDown *= decay; // затухание намерения выйти вниз
      lastIntentTs = nowTs;    // обновляем время последнего события

      // --- ОПРЕДЕЛЕНИЕ БЛИЗОСТИ К КРАЯМ (УЧИТЫВАЕМ ИНЕРЦИЮ) ---
      const nearStart = Math.min(current, target) <= edgeEps;                    // близко к первому слайду
      const nearEnd   = Math.max(current, target) >= (maxScroll - edgeEps);      // близко к последнему слайду

      // --- ГОТОВНОСТЬ К ВЫХОДУ (СТАБИЛЬНОСТЬ У КРАЯ) ---
      const stableMs = isTP ? EDGE_STABLE_MS_TP : EDGE_STABLE_MS; // время стабильности в зависимости от устройства
      const readyStart = startTightSince && (nowTs - startTightSince >= stableMs); // готов к выходу с первого слайда
      const readyEnd   = endTightSince   && (nowTs - endTightSince   >= stableMs); // готов к выходу с последнего слайда

      // --- ПЕРВЫЙ СЛАЙД (ВЫХОД ВВЕРХ) - ШИРОКАЯ ЗОНА ВЫХОДА ---
      if (nearStartExit && dy < 0) {
        const nowTs = performance.now();
        if (nowTs < exitLockUntil) {
          // --- ПРОВЕРКА GRACE-ПЕРИОДА ---
          // еще идет краткий запрет выхода - просто глотаем событие
          e.preventDefault();
          return;
        }
        
        // --- НАКОПЛЕНИЕ НАМЕРЕНИЯ ВЫЙТИ ВВЕРХ ---
        if (!isTP) {
          edgeIntentUp += Math.min(-dy, MOUSE_INTENT_CAP); // для мыши: ограничиваем вклад одного тика
        } else {
          edgeIntentUp += (-dy) * 1.6;                     // для тачпада: увеличиваем чувствительность
        }

        // --- ОБНАРУЖЕНИЕ БЫСТРЫХ ДВИЖЕНИЙ ДЛЯ ТАЧПАДА ---
        if (isTP) {
          if (burstCountUp === 0 || (nowTs - burstStartTsUp) > TP_BURST_MS) {
            burstCountUp = 0; burstStartTsUp = nowTs; // сбрасываем счетчик если прошло много времени
          }
          burstCountUp++; // увеличиваем счетчик быстрых движений
        }
        const instant = isTP && (-dy >= TP_INSTANT_DY); // одно сильное движение
        const burst   = isTP && burstCountUp >= TP_BURST_EVENTS && (nowTs - burstStartTsUp) <= TP_BURST_MS; // серия быстрых движений

        // --- ПРОВЕРКА ПОРОГОВ ДЛЯ ВЫХОДА ---
        const pushThreshMouse = Math.max(PUSH_MOUSE_BASE, stepPx * PUSH_MOUSE_K); // порог для мыши
        const pushThresh = isTP ? (TP_PUSH * EXIT_PUSH_K) : pushThreshMouse;      // итоговый порог в зависимости от устройства

        if ((startArmed) && (edgeIntentUp >= pushThresh || instant || burst)) {
          // --- ВЫХОД С ПЕРВОГО СЛАЙДА ---
          e.preventDefault();
          forceExit('up'); // принудительно выходим вверх
          return;
        } else {
          // --- УДЕРЖАНИЕ СТРАНИЦЫ И НАКОПЛЕНИЕ НАМЕРЕНИЯ ---
          e.preventDefault();
          return;
        }

        // продолжаем накапливать — страницу держим
        e.preventDefault();
        return;
      }

      // --- ПОСЛЕДНИЙ СЛАЙД (ВЫХОД ВНИЗ) - ШИРОКАЯ ЗОНА ВЫХОДА ---
      if (nearEndExit && dy > 0) {
        const nowTs = performance.now();
        if (nowTs < exitLockUntil) {
          // --- ПРОВЕРКА GRACE-ПЕРИОДА ---
          // еще идет краткий запрет выхода - просто глотаем событие
          e.preventDefault();
          return;
        }
        
        // --- НАКОПЛЕНИЕ НАМЕРЕНИЯ ВЫЙТИ ВНИЗ ---
        if (!isTP) {
          edgeIntentDown += Math.min(dy, MOUSE_INTENT_CAP); // для мыши: ограничиваем вклад одного тика
        } else {
          edgeIntentDown += dy * 1.6;                       // для тачпада: увеличиваем чувствительность
        }

        // --- ОБНАРУЖЕНИЕ БЫСТРЫХ ДВИЖЕНИЙ ДЛЯ ТАЧПАДА ---
        if (isTP) {
          if (burstCountDown === 0 || (nowTs - burstStartTsDown) > TP_BURST_MS) {
            burstCountDown = 0; burstStartTsDown = nowTs; // сбрасываем счетчик если прошло много времени
          }
          burstCountDown++; // увеличиваем счетчик быстрых движений
        }
        const instant = isTP && (dy >= TP_INSTANT_DY); // одно сильное движение
        const burst   = isTP && burstCountDown >= TP_BURST_EVENTS && (nowTs - burstStartTsDown) <= TP_BURST_MS; // серия быстрых движений

        // --- ПРОВЕРКА ПОРОГОВ ДЛЯ ВЫХОДА ---
        const pushThreshMouse = Math.max(PUSH_MOUSE_BASE, stepPx * PUSH_MOUSE_K); // порог для мыши
        const pushThresh = isTP ? (TP_PUSH * EXIT_PUSH_K) : pushThreshMouse;      // итоговый порог в зависимости от устройства

        if ((endArmed) && (edgeIntentDown >= pushThresh || instant || burst)) {
          // --- ВЫХОД С ПОСЛЕДНЕГО СЛАЙДА ---
          e.preventDefault();
          forceExit('down'); // принудительно выходим вниз
          return;
        } else {
          // --- УДЕРЖАНИЕ СТРАНИЦЫ И НАКОПЛЕНИЕ НАМЕРЕНИЯ ---
          e.preventDefault();
          return;
        }

        e.preventDefault();
        return;
      }

      // --- ОБЫЧНАЯ ГОРИЗОНТАЛЬНАЯ ПРОКРУТКА (НЕ У КРАЕВ) ---
      burstCountUp = burstCountDown = 0; // сбрасываем счетчики быстрых движений

      // --- ВЫЧИСЛЕНИЕ ПЛАНИРУЕМОГО СДВИГА СЛАЙДЕРА ---
      const planned = dy * (isTP ? TP_WHEEL_GAIN : H_WHEEL_GAIN); // сдвиг с учетом чувствительности устройства
      const sgn = Math.sign(planned);                              // знак движения (направление)

      // --- ПОМОЩЬ У КРАЕВ СЛАЙДЕРА (ТОЛЬКО ДЛЯ ТАЧПАДА) ---
      if (isTP) {
        if (sgn < 0 && Math.min(current, target) <= EDGE_ASSIST_PX) {
          target = lerp(target, 0, EDGE_ASSIST_LERP); // подтягиваем к первому слайду
        }
        if (sgn > 0 && (maxScroll - Math.max(current, target)) <= EDGE_ASSIST_PX) {
          target = lerp(target, maxScroll, EDGE_ASSIST_LERP); // подтягиваем к последнему слайду
        }
      }

      // --- ДОВЕДЕНИЕ ЦЕЛЕВОЙ ПОЗИЦИИ У КРАЕВ (ТОЛЬКО ДЛЯ ТАЧПАДА) ---
      if (isTP) {
        const stepPx = getDesktopStep(); // размер шага слайдера
        const autoMargin = Math.max(EDGE_AUTO_MIN_PX, stepPx * (1 - EDGE_AUTO_COMPLETE_PCT)); // зона автодотяга
        
        if (sgn < 0 && Math.min(current, target) <= autoMargin) {
          target = lerp(target, 0, EDGE_AUTO_LERP_TARGET_TP); // плавно двигаем к первому слайду
        }
        if (sgn > 0 && Math.min(maxScroll - current, maxScroll - target) <= autoMargin) {
          target = lerp(target, maxScroll, EDGE_AUTO_LERP_TARGET_TP); // плавно двигаем к последнему слайду
        }
      }

      e.preventDefault(); // блокируем стандартный скролл страницы
      handleWheelHorizontal(planned, isTP); // обрабатываем горизонтальное движение слайдера
    }
  };

  // Добавляем обработчик
  sliderSection?.addEventListener('wheel', wheelHandler, { passive: false }); // важно: passive: false для preventDefault()
}

function clearWheel() {
  // Удаляем wheel обработчик
  if (wheelHandler) {
    sliderSection?.removeEventListener('wheel', wheelHandler);
    wheelHandler = null;
  }
}

function handleWheelHorizontal(dyPlanned, isTP){
  // --- ОГРАНИЧЕНИЕ ШАГА НА ОДНО СОБЫТИЕ КОЛЕСА ---
  const step = clamp(dyPlanned, -H_MAX_STEP, H_MAX_STEP); // ограничиваем максимальный шаг
  target = clamp(target + step, 0, maxScroll);              // обновляем целевую позицию в пределах слайдера
}

// === ПЕРЕТАСКИВАНИЕ МЫШЬЮ (ТОЛЬКО ДЛЯ ДЕСКТОПА) ===
var desktopDragHandlers = [];

function setupDesktopDrag(){
  if (!sliderWrapper) return; // выходим если нет обертки слайдера
  
  // Очищаем предыдущие обработчики если они есть
  clearDesktopDrag();

  const pointerDownHandler = (e) => {
    if (e.button !== 0) return;
    if (autoSnap.active) cancelAutoSnap();

    const { vis } = visibilityInfo();
    if (pageState !== STATE.ACTIVE) {
      const canEnter = vis >= DRAG_VIS_TO_ENTER && (Date.now() - lastExitTs) > EXIT_PASS_MS;
      if (canEnter) setState(STATE.ACTIVE);
      else return;
    }

    isDragging = true; dragMoved = false; dragLocked = false;
    dragStartX = e.clientX; dragStartY = e.clientY; dragStartTarget = target;

    try { sliderWrapper.setPointerCapture(e.pointerId); } catch(_) {}
    WSLS_ROOT.classList.add('grabbing');
    sliderWrapper.style.cursor = 'grabbing';
    WSLS_ROOT.style.userSelect = 'none';
  };

  const pointerMoveHandler = (e) => {
    if (!isDragging) return;
    const dx = e.clientX - dragStartX;
    const dy = e.clientY - dragStartY;
    if (!dragMoved && Math.abs(dx) >= DRAG_MIN_DELTA_PX) dragMoved = true;

    if (!dragLocked) {
      if (Math.abs(dx) > DRAG_AXIS_LOCK_K * Math.abs(dy)) dragLocked = true;
      else return;
    }

    target = clamp(dragStartTarget - dx, 0, maxScroll);
    e.preventDefault();
  };

  const endDrag = (e) => {
    if (!isDragging) return;
    isDragging = false;

    try { sliderWrapper.releasePointerCapture && sliderWrapper.releasePointerCapture(e && e.pointerId); } catch(_) {}
    WSLS_ROOT.classList.remove('grabbing');
    sliderWrapper.style.cursor = 'grab';
    WSLS_ROOT.style.userSelect = '';

    if (dragMoved) {
      const step = getDesktopStep();
      if (step > 0) {
        const idx = Math.round(target / step);
        target = clamp(idx * step, 0, maxScroll);
      }
    }
  };

  const pointerUpHandler = (e) => endDrag(e);
  const pointerCancelHandler = (e) => endDrag(e);
  const pointerLeaveHandler = (e) => { if (isDragging) endDrag(e); };

  // Добавляем обработчики
  sliderWrapper.addEventListener('pointerdown', pointerDownHandler);
  sliderWrapper.addEventListener('pointermove', pointerMoveHandler);
  sliderWrapper.addEventListener('pointerup', pointerUpHandler);
  sliderWrapper.addEventListener('pointercancel', pointerCancelHandler);
  sliderWrapper.addEventListener('pointerleave', pointerLeaveHandler);

  // Сохраняем ссылки для последующего удаления
  desktopDragHandlers = [
    { element: sliderWrapper, event: 'pointerdown', handler: pointerDownHandler },
    { element: sliderWrapper, event: 'pointermove', handler: pointerMoveHandler },
    { element: sliderWrapper, event: 'pointerup', handler: pointerUpHandler },
    { element: sliderWrapper, event: 'pointercancel', handler: pointerCancelHandler },
    { element: sliderWrapper, event: 'pointerleave', handler: pointerLeaveHandler }
  ];
}

function clearDesktopDrag() {
  // Удаляем все drag обработчики
  (Array.isArray(desktopDragHandlers) ? desktopDragHandlers : []).forEach(({ element, event, handler }) => {
    if (element && element.removeEventListener) {
      element.removeEventListener(event, handler);
    }
  });
  desktopDragHandlers = [];
  
  // Дополнительно очищаем состояние перетаскивания
  isDragging = false;
  dragMoved = false;
  dragLocked = false;
}

// === КАСАНИЯ НА МОБИЛЬНЫХ УСТРОЙСТВАХ ===
var mobileTouchHandlers = [];

function setupMobileTouch(){
  if (!sliderWrapper) return;
  
  // Очищаем предыдущие обработчики если они есть
  clearMobileTouch();

  const touchStartHandler = (e) => {
    // Отменяем авто-дотяг если он активен
    if (autoSnap && autoSnap.active) cancelAutoSnap();
    
    const t = e.touches[0];
    tStartX = t.clientX; 
    tStartY = t.clientY;
    tStartTarget = target; 
    touchHoriz = false;
    
    // Дополнительные переменные для лучшего контроля
    touchStartX = t.clientX;
    touchStartY = t.clientY;
    touchStartTarget = target;
    hasHorizontalSwipe = false;
  };

  const touchMoveHandler = (e) => {
    const t = e.touches[0];
    const dx = t.clientX - tStartX;
    const dy = t.clientY - tStartY;
    
    // Axis lock: act only when horizontal movement dominates and exceeds threshold
    const absDx = Math.abs(dx);
    const absDy = Math.abs(dy);
    const horizontalDominant = absDx > absDy && absDx > 8;

    if (!horizontalDominant) {
      return; // let the browser handle vertical scrolling naturally
    }

    if (!touchHoriz && absDx > 10) {
      touchHoriz = true;
    }
    
    if (!hasHorizontalSwipe && absDx > 10) {
      hasHorizontalSwipe = true;
    }

    // Обновляем позицию слайдера только при горизонтальном движении
    target = clamp(tStartTarget - dx, 0, maxScroll);
  };

  const touchEndHandler = () => {
    // Only act when a horizontal swipe occurred; otherwise, preserve vertical scroll behavior
    if (!touchHoriz || !hasHorizontalSwipe) return;
    
    // Снаппим к ближайшему слайду
    const step = getMobileStep();
    if (step > 0) {
      const slideIndex = Math.round(target / step);
      target = slideIndex * step;
    }
  };

  // Добавляем обработчики
  sliderWrapper.addEventListener('touchstart', touchStartHandler, { passive: true });
  sliderWrapper.addEventListener('touchmove', touchMoveHandler, { passive: true });
  sliderWrapper.addEventListener('touchend', touchEndHandler);

  // Сохраняем ссылки для последующего удаления
  mobileTouchHandlers = [
    { element: sliderWrapper, event: 'touchstart', handler: touchStartHandler, options: { passive: true } },
    { element: sliderWrapper, event: 'touchmove', handler: touchMoveHandler, options: { passive: true } },
    { element: sliderWrapper, event: 'touchend', handler: touchEndHandler }
  ];
}

function clearMobileTouch() {
  // Удаляем все touch обработчики
  (Array.isArray(mobileTouchHandlers) ? mobileTouchHandlers : []).forEach(({ element, event, handler, options }) => {
    if (element && element.removeEventListener) {
      element.removeEventListener(event, handler, options);
    }
  });
  mobileTouchHandlers = [];
  
  // Дополнительно очищаем состояние касания
  touchHoriz = false;
  hasHorizontalSwipe = false;
}

// === РЕЗЕРВНЫЙ МЕХАНИЗМ ЧЕРЕЗ IntersectionObserver: гарантируем захват и подъезд ===
function setupIOApproachFallback(){
  if (!('IntersectionObserver' in window) || !sliderSection) return;

  let lastScrollY = window.scrollY;
  const io = new IntersectionObserver((entries) => {
    for (const entry of entries) {
      if (entry.target !== sliderSection) continue;
      if (pageState !== STATE.NORMAL) continue;
      if (approachInFlight) continue;
      if (Date.now() - lastExitTs < EXIT_PASS_MS) continue;
      if (isReenterBlocked()) return;
      
      // НЕ активируем автоматический захват на мобильных устройствах
      if (isMobile) continue;

      const { rect, vh, vis } = visibilityInfo();
      const nowScrollY = window.scrollY;
      const dir = (nowScrollY > lastScrollY) ? 'down' : (nowScrollY < lastScrollY ? 'up' : 'down');
      lastScrollY = nowScrollY;

      if (vis >= 0.5) {
        const align = (dir === 'down') ? 'start' : 'end';
        approachToSection(align);
      } else if (Math.abs(rect.top) <= NEAR_PX) {
        const align = rect.top >= 0 ? 'start' : 'end';
        approachToSection(align);
      }
    }
  }, { root: null, rootMargin: "0px", threshold: [0, 0.25, 0.5, 0.75, 1] });

  io.observe(sliderSection);
  window.addEventListener('beforeunload', () => io.disconnect(), { once: true });
}

// === ГЛАВНЫЙ ЦИКЛ АНИМАЦИИ (requestAnimationFrame) ===
function startLoop(){
  function tick(ts){
    if (window.lenis?.raf) window.lenis.raf(ts); // синхронизируем с Lenis если доступен

    // === ПЛАВНОСТЬ У КРАЕВ + АВТОДОТЯГ ДО 100% КОГДА ≥95% ===
    const stepPx = isMobile ? getMobileStep() : getDesktopStep(); // размер шага слайдера
    const baseMargin = stepPx > 0 ? stepPx * (1 - EDGE_AUTO_COMPLETE_PCT) : 0; // базовая зона автодотяга
    const autoMargin = Math.max(EDGE_AUTO_MIN_PX, baseMargin); // итоговая зона автодотяга

    // --- АДАПТИВНАЯ ПЛАВНОСТЬ: У КРАЕВ УСКОРЯЕМ ДВИЖЕНИЕ ---
    const nearStartForEase = current <= autoMargin;           // близко к первому слайду
    const nearEndForEase   = (maxScroll - current) <= autoMargin; // близко к последнему слайду
    const localEaseBase    = (nearStartForEase || nearEndForEase)
      ? Math.max(H_EASE, H_EASE_NEAR_EDGE || 0.12) // у краев: более быстрое движение
      : H_EASE;                                      // в центре: обычная плавность

    // --- ГОРИЗОНТАЛЬНАЯ СКОРОСТЬ И НАПРАВЛЕНИЕ ДВИЖЕНИЯ ---
    const vHoriz = Math.abs((typeof lastCurrentX !== 'undefined' ? (current - lastCurrentX) : 0)); // текущая скорость
    const EPS = 0.1; // погрешность для определения состояния
    const movingLeft  = (target + EPS) < current;   // движемся влево (к первому слайду)
    const movingRight = (target - EPS) > current;   // движемся вправо (к последнему слайду)
    const idle        = Math.abs(target - current) <= EPS; // стоим на месте

    // --- УСЛОВИЯ ДЛЯ АВТОДОКРУТА К КРАЯМ ---
    // автодокрут разрешаем ТОЛЬКО если:
    //  - мы в активном режиме слайдера и не перетаскиваем мышью,
    //  - НЕ на мобильных устройствах (там работает touch),
    //  - очень близко к соответствующему краю,
    //  - скорость движения мала,
    //  - и направление движения к этому краю (или стоим на месте).
    const eligibleStart = (pageState === STATE.ACTIVE) && !isDragging && !isMobile &&
                          Math.min(current, target) <= autoMargin &&
                          vHoriz <= EDGE_AUTO_VEL_EPS &&
                          (movingLeft || idle);

    const eligibleEnd   = (pageState === STATE.ACTIVE) && !isDragging && !isMobile &&
                          Math.min(maxScroll - current, maxScroll - target) <= autoMargin &&
                          vHoriz <= EDGE_AUTO_VEL_EPS &&
                          (movingRight || idle);

    // --- ЗАПУСК АВТОДОКРУТА К КРАЯМ ---
    if ((eligibleStart || eligibleEnd) && !autoSnap.active) {
      beginAutoSnap(eligibleStart ? 'start' : 'end'); // запускаем автодотяг к соответствующему краю
    }

    // --- ОБРАБОТКА АКТИВНОГО АВТОДОКРУТА ---
    if (autoSnap.active) {
      const nowA  = performance.now(); // текущее время
      const tA    = Math.min(1, (nowA - autoSnap.start) / autoSnap.dur); // прогресс анимации (0-1)
      const eased = AUTO_SNAP_EASE(tA); // применяем плавность
      const next  = autoSnap.from + (autoSnap.to - autoSnap.from) * eased; // вычисляем следующую позицию

      current = next; // обновляем текущую позицию
      target  = next; // синхронизируем целевую позицию (чтобы не "боролись")
      
      // --- ЗАВЕРШЕНИЕ АВТОДОКРУТА ---
      if (tA >= 1) {
        cancelAutoSnap(); // отменяем автодотяг
        exitLockUntil = performance.now() + EXIT_AFTER_SNAP_MS; // устанавливаем grace-период
        // сбрасываем намерения и счетчики быстрых движений для "свежего" выхода
        edgeIntentUp = 0; edgeIntentDown = 0;
        burstCountUp = 0; burstCountDown = 0;
      }
    } else {
      // --- ОБЫЧНОЕ ПЛАВНОЕ ДВИЖЕНИЕ К ЦЕЛИ ---
      current = lerp(current, target, localEaseBase); // плавно двигаемся к цели
    }
    // --- ОБНОВЛЕНИЕ ПОЗИЦИИ СЛАЙДЕРА В DOM ---
    if (sliderTrack && typeof gsap !== 'undefined') {
      const k = Math.pow(10, GSAP_DECIMALS); // множитель для точности
      const xSmooth = Math.round(current * k) / k; // округляем до нужной точности
      gsap.set(sliderTrack, { x: -xSmooth }); // устанавливаем позицию (можно добавить force3D в CSS)
    }
    updateSlideFX(); // обновляем визуальные эффекты слайдов
    updateSlideMetaVisibility(); // обновляем видимость метаданных слайдов

    // === ОТСЛЕЖИВАНИЕ СТАБИЛЬНОСТИ У КРАЕВ СЛАЙДЕРА ===
    // НЕ отслеживаем стабильность на мобильных устройствах - там работает touch
    if (!isMobile) {
      const nowTick = performance.now(); // текущее время для отслеживания
      const v = Math.abs(current - lastCurrentX); // текущая скорость движения

      // --- ОПРЕДЕЛЕНИЕ ПОЛОЖЕНИЯ В УЗКИХ ЗОНАХ У КРАЕВ ---
      const inStartTight = Math.min(current, target) <= EDGE_TIGHT_PX;                    // в узкой зоне у первого слайда
      const inEndTight   = (maxScroll - Math.max(current, target)) <= EDGE_TIGHT_PX;      // в узкой зоне у последнего слайда

      const velEps = isTrackpadLikely ? H_VEL_EPS_TP : H_VEL_EPS; // порог скорости в зависимости от устройства

      // --- ОТСЛЕЖИВАНИЕ ВРЕМЕНИ СТАБИЛЬНОСТИ У ПЕРВОГО СЛАЙДА ---
      if (inStartTight && v <= velEps) {
        if (!startTightSince) startTightSince = nowTick; // начинаем отсчет времени стабильности
      } else {
        startTightSince = 0; // сбрасываем если вышли из зоны или движемся
      }

      // --- ОТСЛЕЖИВАНИЕ ВРЕМЕНИ СТАБИЛЬНОСТИ У ПОСЛЕДНЕГО СЛАЙДА ---
      if (inEndTight && v <= velEps) {
        if (!endTightSince) endTightSince = nowTick; // начинаем отсчет времени стабильности
      } else {
        endTightSince = 0; // сбрасываем если вышли из зоны или движемся
      }

      // --- АКТИВАЦИЯ/ДЕАКТИВАЦИЯ ВЫХОДА У КРАЕВ ---
      const stableMs = isTrackpadLikely ? EDGE_STABLE_MS_TP : EDGE_STABLE_MS; // время стабильности в зависимости от устройства

      // активируем выход с первого слайда после достаточного времени стабильности
      if (startTightSince && (nowTick - startTightSince) >= (stableMs + EDGE_EXIT_ARM_MS)) startArmed = true;
      else if (!startTightSince) startArmed = false;

      // активируем выход с последнего слайда после достаточного времени стабильности
      if (endTightSince && (nowTick - endTightSince) >= (stableMs + EDGE_EXIT_ARM_MS)) endArmed = true;
      else if (!endTightSince) endArmed = false;
    }

    lastCurrentX = current; // запоминаем текущую позицию для следующего кадра

    requestAnimationFrame(tick); // планируем следующий кадр
  }
  requestAnimationFrame(tick); // запускаем главный цикл анимации
}

function updateSlideFX(){
  if (isMobile || !slides.length) return; // пропускаем на мобильных или если нет слайдов
  
  // --- НАСТРОЙКИ ВИЗУАЛЬНЫХ ЭФФЕКТОВ ---
  const center = window.innerWidth / 2;        // центр экрана
  const maxScale = 1.75, minScale = 0.5;      // максимальный и минимальный масштаб
  const offsetMul = 300;                       // множитель смещения для 3D-эффекта

  slides.forEach(slide => {
    const r = slide.getBoundingClientRect();   // размеры и позиция слайда
    const slideCenter = (r.left + r.right) / 2; // центр слайда
    const dist = slideCenter - center;         // расстояние от центра экрана
    const n = dist / window.innerWidth;        // нормализованное расстояние (-0.5 до 0.5)

    // --- ВЫЧИСЛЕНИЕ МАСШТАБА И СМЕЩЕНИЯ ---
    let scale, offsetX;
    if (dist > 0) { 
      scale = Math.min(maxScale, 1 + n);      // справа: увеличиваем масштаб
      offsetX = (scale - 1) * offsetMul;      // смещаем для 3D-эффекта
    } else { 
      scale = Math.max(minScale, 1 - Math.abs(n)); // слева: уменьшаем масштаб
      offsetX = 0;                             // без смещения
    }

    if (typeof gsap !== 'undefined') gsap.set(slide, { scale, x: offsetX }); // применяем эффекты
  });
}

// === ДОБАВЛЕНИЕ МЕТАДАННЫХ К СЛАЙДАМ И ИЗОБРАЖЕНИЯМ ===
function injectSlideMeta(){
  slides.forEach((slide, idx) => {
    if (slide.querySelector('.slide-meta-top')) return; // пропускаем если метаданные уже добавлены

    // --- СОЗДАНИЕ ВЕРХНЕГО МЕТА-ЭЛЕМЕНТА (НОМЕР СЛАЙДА) ---
    const top = document.createElement('div');
    top.className = 'slide-meta-top';
    top.textContent = `[${idx + 1}]`; // номер слайда

    // --- ВСТАВКА МЕТАДАННЫХ В СЛАЙД ---
    const media = slide.querySelector('.slide-media'); // ищем медиа-элемент
    if (media && media.parentElement === slide) {
      // если есть медиа-элемент, вставляем метаданные перед ним
      slide.insertBefore(top, media);                    // верхний элемент перед медиа
    } else {
      // если нет медиа-элемента, добавляем метаданные в начало слайда
      slide.prepend(top);                                // верхний в начало
    }
  });
}

function hydrateImageAspectRatios(){
  // --- УСТАНОВКА ПРАВИЛЬНЫХ ПРОПОРЦИЙ ДЛЯ ИЗОБРАЖЕНИЙ ---
  const imgs = sliderWrapper ? sliderWrapper.querySelectorAll('img') : []; // все изображения в слайдере
  imgs.forEach(img => {
    const setRatio = () => {
      if (img.naturalWidth && img.naturalHeight) {
        img.style.aspectRatio = `${img.naturalWidth} / ${img.naturalHeight}`; // устанавливаем правильные пропорции
      }
    };
    
    if (img.complete) setRatio(); // если изображение уже загружено
    else img.addEventListener('load', () => { setRatio(); updateMaxScroll(); }, { once: true }); // если еще загружается
  });
  requestAnimationFrame(updateMaxScroll); // обновляем максимальную прокрутку в следующем кадре
}

// === ОБРАБОТКА ИЗМЕНЕНИЯ РАЗМЕРА ОКНА ===
let resizeTimeout;
window.addEventListener('resize', () => {
  // Debounce resize события для оптимизации производительности
  clearTimeout(resizeTimeout);
  resizeTimeout = setTimeout(() => {
    const wasMobile = isMobile;
    isMobile = isMobileDevice(); // обновляем определение мобильного устройства
    
    // Если изменился тип устройства, полностью перестраиваем логику
    if (wasMobile !== isMobile) {
      // Сначала очищаем все существующие обработчики
      if (wasMobile) {
        // Переключаемся с мобильного на десктоп
        clearMobileTouch(); // очищаем touch обработчики
        
        // Принудительно очищаем все возможные обработчики
        if (sliderWrapper) {
          // Устанавливаем курсор
          sliderWrapper.style.cursor = 'grab';
        }
        
        // Принудительно очищаем все обработчики перед настройкой новых
        clearWheel();
        clearDesktopDrag();
        
        // Обновляем ссылки на элементы после очистки
        if (sliderWrapper) {
          // Убеждаемся, что wrapper доступен
          sliderWrapper.style.cursor = 'grab';
        }
        
        // Настраиваем десктоп функциональность
        setupWheel();
        setupDesktopDrag();
        
        // Применяем логику активного слайда для десктопа
        if (pageState === STATE.ACTIVE) {
          const idx = getCurrentSlideIndex();
          setMetaActive(Math.max(0, Math.min(idx, slides.length - 1)));
        } else {
          setMetaActive(-1);
        }
        
        // Принудительно обновляем состояние слайдера для десктопного режима
        if (sliderTrack && typeof gsap !== 'undefined') {
          // Восстанавливаем текущую позицию слайдера
          gsap.set(sliderTrack, { x: -current });
        }
        
        // Обновляем визуальные эффекты для десктопного режима
        updateSlideFX();
        
        // Принудительно обновляем CSS стили для десктопного режима
        if (sliderWrapper) {
          // Убираем мобильные стили
          sliderWrapper.classList.remove('mobile-mode');
          // Восстанавливаем десктопные стили
          sliderWrapper.style.cursor = 'grab';
        }
        
        // Принудительно обновляем CSS стили слайдов для десктопного режима
        if (slides.length) {
          slides.forEach(slide => {
            // Убираем все мобильные CSS классы и стили
            slide.classList.remove('mobile-mode');
            slide.classList.add('desktop-mode');
          });
        }
        
        // Принудительно обновляем размеры и позиции
        requestAnimationFrame(() => {
          updateMaxScroll();
          updateSlideFX();
          updateSlideMetaVisibility();
        });
        
        // Восстанавливаем блокировку скролла для десктопного режима если слайдер активен
        if (pageState === STATE.ACTIVE) {
          setOverscrollContain(true);
        }
      } else {
        // Переключаемся с десктопа на мобильный
        clearWheel(); // очищаем wheel обработчики
        clearDesktopDrag(); // очищаем drag обработчики
        
        if (sliderWrapper) {
          sliderWrapper.style.cursor = '';
        }
        
        // Принудительно очищаем все обработчики перед настройкой новых
        clearWheel();
        clearDesktopDrag();
        
        // Обновляем ссылки на элементы после очистки
        if (sliderWrapper) {
          // Убираем десктопные стили
          sliderWrapper.style.removeProperty('cursor');
        }
        
        // Настраиваем мобильную функциональность
        setupMobileTouch();
        
        // На мобильном все метаданные видны
        slides.forEach(s => s.classList.remove('meta-active'));
        
        // Принудительно обновляем состояние слайдера для мобильного режима
        if (sliderTrack && typeof gsap !== 'undefined') {
          // Сбрасываем позицию слайдера к началу
          target = 0;
          current = 0;
          gsap.set(sliderTrack, { x: 0 });
        }
        
        // Обновляем визуальные эффекты для мобильного режима
        if (slides.length) {
          slides.forEach(slide => {
            // Сбрасываем все десктопные эффекты
            if (typeof gsap !== 'undefined') {
              gsap.set(slide, { scale: 1, x: 0 });
            }
          });
        }
        
        // Принудительно обновляем CSS стили для мобильного режима
        if (sliderWrapper) {
          // Убираем десктопные стили
          sliderWrapper.style.removeProperty('cursor');
          // Добавляем мобильные стили если нужно
          sliderWrapper.classList.add('mobile-mode');
        }
        
        // Принудительно обновляем CSS стили слайдов для мобильного режима
        if (slides.length) {
          slides.forEach(slide => {
            // Убираем все десктопные CSS классы и стили
            slide.classList.remove('desktop-mode');
            slide.classList.add('mobile-mode');
            // Сбрасываем inline стили
            slide.style.removeProperty('transform');
            slide.style.removeProperty('scale');
            slide.style.removeProperty('x');
          });
        }
        
        // Принудительно обновляем размеры и позиции
        requestAnimationFrame(() => {
          updateMaxScroll();
          updateSlideFX();
          updateSlideMetaVisibility();
        });
        
        // Принудительно обновляем состояние страницы для мобильного режима
        if (pageState === STATE.ACTIVE) {
          // Если слайдер был активен, сбрасываем его состояние
          setState(STATE.NORMAL);
          // Сбрасываем блокировку вертикального скролла для мобильного режима
          setOverscrollContain(false);
          // Затем снова активируем если нужно
          setTimeout(() => {
            const { vis } = visibilityInfo();
            if (vis >= ACTIVATE_WHEN_VISIBLE) {
              setState(STATE.ACTIVE);
            }
          }, 100);
        }
        
        // Всегда сбрасываем блокировку скролла при переключении на мобильный режим
        setOverscrollContain(false);
      }
    }
    
    // Обновляем максимальную прокрутку
    updateMaxScroll();
    
    // Обновляем визуальные эффекты
    updateSlideFX();
    updateSlideMetaVisibility();
  }, 150); // Задержка 150мс для оптимизации производительности
});

// === ОТЛАДОЧНАЯ ИНФОРМАЦИЯ ===
if (window.location.search.includes('debug')) {
  }
