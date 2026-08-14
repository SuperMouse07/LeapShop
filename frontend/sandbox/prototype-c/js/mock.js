/**
 * Prototype C — 内嵌 mock 数据（内容取材自 theleapchess.com 官网真实文案与商品）
 * 沙箱规范：本文件为纯静态数据源，禁止任何 fetch / /api 调用
 */

export const BRAND = {
  slogan: 'Built for Grandmasters, Accessible to Everyone.',
  sub: 'Precision for Players, by Players.',
  intro:
    'Born from a lifelong passion for the game, LEAP combines professional-grade accuracy with innovative design. From FIDE-standard timers to creative chess essentials, we empower players at every level to focus on what matters most: the next move.',
  stat: { value: '500,000+', label: 'Chess Clubs Supported Worldwide' },
  taglines: ['Find the Move. Beat the Clock.', 'Steady Moves, Anywhere You Go.'],
};

export const CATEGORIES = ['All', 'Chess Timers', 'Chess Sets', 'Apparel & Gifts'];

/** 商品数据：型号与价格取自 theleapchess.com 官网商品列表 */
export const PRODUCTS = [
  { id: 'pq9921', name: 'LEAP PQ9921 Pro Choice Digital Chess Timer', desc: 'High-Visibility Lever & Multi-Mode', category: 'Chess Timers', price: 36.99, badge: "Beginner's Pick" },
  { id: 'pq9923', name: 'LEAP PQ9923 Digital Chess Timer — Blue', desc: 'Tournament Clock for Clubs & Schools', category: 'Chess Timers', price: 21.99, badge: '' },
  { id: 'pq9907s-black', name: 'LEAP PQ9907S Digital Chess Clock', desc: 'Matte Black Edition', category: 'Chess Timers', price: 21.99, badge: '' },
  { id: 'pq9917', name: 'LEAP PQ9917 Professional Digital Chess Timer', desc: 'White · Multi Timing Modes', category: 'Chess Timers', price: 24.99, badge: '' },
  { id: 'pq9918', name: 'LEAP PQ9918 Digital Timer', desc: 'Extra Large Screen Tournament Clock', category: 'Chess Timers', price: 56.99, badge: "Pro's Choice" },
  { id: 'kk9909', name: 'LEAP KK9909 FIDE Certified Digital Timer', desc: '39 Modes · Dual-Color Lever Indicator', category: 'Chess Timers', price: 48.99, badge: 'FIDE Certified' },
  { id: 'kk9908', name: 'LEAP KK9908 FIDE Certified Digital Timer', desc: 'Ultra Portable Tournament Clock', category: 'Chess Timers', price: 38.99, badge: 'FIDE Certified' },
  { id: 'cs13wm', name: '13″ Magnetic Foldable Wooden Chess Set', desc: '2.5″ King Tall · Steady Moves, Anywhere You Go', category: 'Chess Sets', price: 42.00, badge: '' },
  { id: 'tee-mens', name: "Men's Short Sleeve T-Shirt", desc: 'Custom chess print · Design your own', category: 'Apparel & Gifts', price: 24.00, badge: '' },
  { id: 'tee-vneck', name: "Women's Classic V-Neck T-Shirt", desc: 'Cool Stuff for Chess Lovers', category: 'Apparel & Gifts', price: 30.00, badge: '' },
];

/** 品牌主张：对应官网 Why Choose Leap / 俱乐部支持内容 */
export const VALUES = [
  { title: 'Precision for Players', desc: 'Professional-grade accuracy in every timer, engineered for tournament play and trusted at the board.' },
  { title: 'FIDE-Standard Quality', desc: 'Certified tournament clocks with 39 timing modes and dual-color lever indicators for official events.' },
  { title: 'Empowering Clubs', desc: 'Supporting 500,000+ chess clubs worldwide — equip, support, win. Elevating the game together.' },
];

/** 品牌历程：对应官网 OUR JOURNEY 段落（极简文案版） */
export const JOURNEY = [
  { year: 'Origin', text: 'Born from a lifelong passion for the game — players building for players.' },
  { year: 'Grow', text: 'From FIDE-standard timers to creative chess essentials for every level.' },
  { year: 'Today', text: 'Empowering 500,000+ chess clubs worldwide to focus on the next move.' },
];

export function escapeHtml(str) {
  return String(str ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}
