/**
 * Prototype F · Affordable Luxury 白底金黑撞色编辑画廊 — 内嵌 mock 数据（多页面版）
 * ------------------------------------------------------------
 * 纯本地数据源：零 /api 调用、零 fetch、不引用 frontend/js/api.js、
 * 不读写 lc_token / lc_user（购物车使用独立键 pf_cart，由 site.js 管理）。
 * 设计语言来源：type-f-data/The Craft of Web UI Design.md + 品牌场景图。
 */

export const BRAND = {
  logo: 'assets/logo.svg',
  microTop: 'One-stop comprehensive service provider for global sports clubs',
  name: 'LEAP',
};

/* Hero 轮播三帧（品牌场景图，文案已烘焙于图内，8s 自动切换 + 手动） */
export const SLIDES = [
  { img: 'assets/hero-board.png', alt: 'TIMELESS STRATEGY · 胡桃木高级棋盘场景图' },
  { img: 'assets/hero-clock.png', alt: 'FOCUS ON EVERY MOVE · 专业比赛棋钟场景图' },
  { img: 'assets/hero-mug.png', alt: 'CHESS, EVERY MOVE MATTERS · 棋盘格主题马克杯场景图' },
];

export const CATS = [
  { id: 'chess-clock', label: 'Chess Clock' },
  { id: 'chess-board', label: 'Chess Board' },
  { id: 'stopwatch',   label: 'Stopwatch' },
  { id: 'lifestyle',   label: 'Chess Lifestyle' },
];

/* 分类页元数据（导航七页中的四个系列页） */
export const CAT_META = {
  'chess-clock': { file: 'chess-clock.html', title: 'Chess Clock', kicker: 'Precision Timing',
    tagline: 'Tournament-grade time control, precise to the very last second — from league clocks to classroom starters.' },
  'chess-board': { file: 'chess-board.html', title: 'Chess Board', kicker: 'The 64 Squares',
    tagline: 'From walnut inlay to magnetic travel sets — the perfect 64 squares for every playing scene.' },
  'stopwatch': { file: 'stopwatch.html', title: 'Stopwatch', kicker: 'Every Second Counts',
    tagline: 'The 3D-printed portable series and referee-grade dual channels — countdowns at a glance.' },
  'lifestyle': { file: 'lifestyle.html', title: 'Chess Lifestyle', kicker: 'Sip. Think. Win.',
    tagline: 'Bring the 64 squares into everyday life: objects, textiles and collector-grade pieces.' },
};

/* 商品（ratio 驱动瀑布流节奏；gallery 为详情主图；info 为详情文字介绍） */
export const PRODUCTS = [
  { id: 1, name: 'Tournament Pro Chess Clock', cat: 'chess-clock', price: 89, img: null, ratio: '4/3',
    desc: 'FIDE-grade time control with a gold-rimmed panel and silent keys — precise to the very last second.',
    info: ['Meets FIDE-certified timing standards, with 36 built-in tournament presets including Fischer and Bronstein increments.', 'Gold-rimmed LCD panel and silent dual paddle keys, weighted non-slip base — built for league and club play.'] },
  { id: 5, name: 'Blitz Trainer Clock', cat: 'chess-clock', price: 59, img: null, ratio: '1/1',
    desc: 'Born for blitz training — long-travel paddle keys and clearly audible increment alerts.',
    info: ['Key travel and rebound tuned for 3+2 / 5+0 blitz, with three-level adjustable increment alerts.', 'One-hand blind-operation layout; training mode logs per-move time to review your clock management.'] },
  { id: 9, name: 'League Master Clock', cat: 'chess-clock', price: 74, img: null, ratio: '4/5',
    desc: 'The club league standard — metal paddle keys with full delay and increment support.',
    info: ['Crisp metal paddle keys; full support for delay and increment modes.', 'Around 1,200 hours of battery life, with a low-battery alert that never interrupts the game.'] },
  { id: 13, name: 'Cadet Teaching Clock', cat: 'chess-clock', price: 35, img: null, ratio: '3/4',
    desc: 'The classroom first choice — large digits and simplified three-button operation.',
    info: ['Large-digit LCD and simplified three-button setup — students learn it in 30 seconds.', 'Key-lock against accidental presses, ideal for high-frequency classroom and club use.'] },

  { id: 2, name: 'Walnut Folding Chess Board', cat: 'chess-board', price: 129, img: null, ratio: '4/3',
    desc: 'Walnut and maple inlay with gold-leaf detailing; magnetic storage case with a crest metal clasp.',
    info: ['Hand-inlaid walnut and maple squares with gold-leaf detailing; folds into magnetic storage.', 'Family crest metal clasp, velvet-lined interior to protect the pieces, numbered collector card included.'] },
  { id: 6, name: 'Club Series Tournament Mat', cat: 'chess-board', price: 45, img: null, ratio: '1/1',
    desc: 'The club-standard vinyl roll-up mat — matte anti-glare squares, roll and go.',
    info: ['Matte vinyl squares eliminate glare; league-standard 57mm square size.', 'Rolls up instantly, strap and carry tube included — easy transport for away matches.'] },
  { id: 10, name: 'Maple Classic Solid Board', cat: 'chess-board', price: 98, img: null, ratio: '4/5',
    desc: 'Solid maple, hand-polished with a matte lacquer — an heirloom surface that improves with age.',
    info: ['CNC-engraved grid lines on a single solid maple board; matte lacquer preserves the wood feel.', 'Soft cork feet protect your table — perfect for long-displayed parlour games.'] },
  { id: 14, name: 'Travel Magnetic Board', cat: 'chess-board', price: 52, img: null, ratio: '3/4',
    desc: 'Folding magnetic set — pieces lock in place, so nothing spills mid-journey.',
    info: ['Folds down to A5 size; magnetic bases hold every piece in place.', 'Storage pouch and spare queen included — open a game anywhere, commute or travel.'] },

  { id: 4, name: 'Portable 3D-Printed Stopwatch', cat: 'stopwatch', price: 39, img: 'assets/timer-main-01.png', ratio: '1/1',
    /* 新素材：主图轮播 5 张（详情页 1:1 横滑）+ 详情图 3 张 */
    gallery: ['assets/timer-main-01.png', 'assets/timer-main-02.png', 'assets/timer-main-03.png', 'assets/timer-main-04.png', 'assets/timer-main-05.png'],
    detail: ['assets/timer-detail-01.png', 'assets/timer-detail-02.png', 'assets/timer-detail-03.png'],
    desc: 'The 3D-printed portable series — lightweight, rugged, made for a mobile playing lifestyle.',
    info: ['3D-printed honeycomb shell: lightweight, rugged, with a texture no two are alike.', 'Single-button start / split; magnetic back clip attaches to the edge of any board.'] },
  { id: 8, name: 'Pocket Stopwatch', cat: 'stopwatch', price: 29, img: null, ratio: '4/5',
    desc: 'Single-button blind operation and a magnetic back clip — countdowns at a glance.',
    info: ['Single-button blind operation — precise presses even while wearing gloves.', 'Large countdown display with backlight, perfectly readable in low light.'] },
  { id: 12, name: 'Referee Dual-Channel Stopwatch', cat: 'stopwatch', price: 66, img: null, ratio: '3/4',
    desc: 'Two independent channels — one referee, two boards under control.',
    info: ['Independent start / stop on both channels — one timer supervises two boards on patrol.', 'Vibration alert mode keeps quiet zones of the venue undisturbed.'] },
  { id: 16, name: 'Gym Training Split Stopwatch', cat: 'stopwatch', price: 41, img: null, ratio: '4/3',
    desc: '99-lap split memory — the rhythm manager for fitness and problem-solving drills.',
    info: ['99-lap split memory with exportable training rhythm curves.', 'Wrist or tabletop use — one timer for both puzzle drills and physical training.'] },

  { id: 3, name: 'Checkmate Ceramic Mug', cat: 'lifestyle', price: 24, img: null, ratio: '4/3',
    desc: 'Black-and-white checker glaze with a gold-rimmed lip; king emblem on the black handle. Sip. Think. Win.',
    info: ['Black-and-white checkerboard glaze, gold-rimmed lip, black handle with a king emblem.', '380ml capacity; microwave and dishwasher safe (hand wash recommended for the gold rim).'] },
  { id: 7, name: 'Grandmaster Signature Mug', cat: 'lifestyle', price: 32, img: null, ratio: '1/1',
    desc: 'Limited gold-traced glaze with a champion signature card — for collecting and everyday use.',
    info: ['Limited-edition gold-traced glaze body, each individually numbered.', 'Champion signature collector card included; gift-box packed — for giving or keeping.'] },
  { id: 11, name: '64 Squares Velvet Table Runner', cat: 'lifestyle', price: 46, img: null, ratio: '4/5',
    desc: 'Velvet-woven checkerboard runner with gold-stitched edges — your desk becomes a chessboard.',
    info: ['High-density velvet weave with gold-stitched edges and an elegant drape.', 'Standard 180cm runner — turns any desk or sideboard into a scene.'] },
  { id: 15, name: 'King & Queen Bookend Pair', cat: 'lifestyle', price: 58, img: null, ratio: '3/4',
    desc: 'Resin-cast king and queen bookends — black and gold that anchor an entire shelf.',
    info: ['Resin-cast weighted base keeps even the heaviest chess volumes upright.', 'Black-and-gold finish echoing the entire LEAP collection.'] },
];

/* Home Featured 四系列代表品 */
export const FEATURED_IDS = [1, 2, 4, 3];

/* Why Choose Leap —— 三条价值主张（编辑式编号列表） */
export const WHY = [
  { n: '01', t: 'Deep R&D Foundation',
    d: 'Backed by our parent company’s R&D center and numerous timing-technology patents, every clock and board passes rigorous stress testing.' },
  { n: '02', t: 'Professional Excellence',
    d: 'Built to the exacting standards of the professional community — widely used in clubs and sanctioned tournaments worldwide.' },
  { n: '03', t: 'Factory-Direct Assurance',
    d: 'Our own factory controls quality from raw material to packaging, delivering professional-grade gear at a value intermediaries cannot match.' },
];

/* 品牌历程数字（CSS @property 计数动画，--to 为目标值） */
export const STATS = [
  { to: 32,  suffix: '',  label: 'Years of Craft' },
  { to: 46,  suffix: '',  label: 'Countries Served' },
  { to: 300, suffix: '+', label: 'Pro Products' },
  { to: 500, suffix: 'K+', label: 'Clubs Worldwide' },
];

/* Home 品牌历程摘要 */
export const HERITAGE = [
  'Since 2001, LEAP has grown from a specialized laboratory name into a household brand trusted by millions of players — from the child making a first move to the grandmaster under the spotlight.',
  'Today, our 3D-printed portable series redefines the 64 squares: lighter, more rugged, more personal — equipment as unique as your own playing style.',
];

/* Our Journey 页全文（直接引用自 The Craft of Web UI Design.md） */
export const JOURNEY_DOC = [
  { h: 'Our Heritage: Two Decades of Mastery', ps: [
    'The story of LeapSport (leapsport.nl) is not one that started yesterday. Our roots are deeply embedded in the legacy of Leap Industrial Co., Ltd. Since its founding in 2001, Leap has been a global pioneer in the field of professional sports timing and chess equipment.',
    'For over 20 years, the "LEAP" brand has evolved from a specialized laboratory name into a household staple trusted by millions of chess players worldwide. From young students making their first moves to Grandmasters competing under the bright lights of international stages, LEAP timers have witnessed countless moments of strategic brilliance. This dedication to precision—down to the very last second—is the soul of every product we offer.',
  ], bullets: [] },
  { h: 'Why Choose LeapSport?', ps: [
    'At LeapSport, we do more than just sell equipment; we bridge the gap between world-class manufacturing and the individual needs of the modern player.',
  ], bullets: [
    'Deep R&D Foundation: Backed by our parent company’s robust Research & Development center, we hold numerous patents in timing technology. Every clock and chessboard in our collection has undergone rigorous stress testing to ensure tournament-grade reliability.',
    'Professional Excellence: Our products are designed to meet the exacting standards of the chess community and are widely used in professional clubs and sanctioned tournaments globally.',
    'Factory-Direct Assurance: Owning our manufacturing facilities means we control quality from the raw material to the final package. It allows us to provide professional-grade gear at a value that intermediaries simply cannot match.',
  ] },
  { h: 'Innovation: Redefining the 64 Squares', ps: [
    'While we hold a deep respect for the traditions of the "Game of Kings," we refuse to be limited by them. With the launch of leapsport.nl, we have introduced our most ambitious project yet: The 3D-Printed Portable Series.',
  ], bullets: [
    'Technology-Driven Design: We utilize cutting-edge 3D printing technology to reimagine the form and function of chess sets—making them lighter, more durable, and perfectly suited for a mobile lifestyle.',
    'Personalized Expression: This technology allows us to offer customization and unique designs that traditional mass-injection molding cannot achieve. We are making it possible for every player to own a set as unique as their own playing style.',
  ] },
  { h: 'Our Global Commitment', ps: [
    'While we are proudly rooted in our Dutch-facing platform (leapsport.nl), our vision is truly global. Today, our catalog features over 300 professional products, ranging from entry-level educational tools to collector-grade art pieces.',
    'Our mission is simple: To ensure that every chess enthusiast, regardless of where they are in the world, has access to the equipment they need to master the game.',
  ], bullets: [] },
];

export const escapeHtml = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
}[c]));
