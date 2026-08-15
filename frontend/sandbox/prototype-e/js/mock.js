/**
 * Prototype E — 内嵌 mock 数据（商品取材自 theleapchess.com 官网，文案适配酸性热力设计稿）
 * 沙箱规范：本文件为纯静态数据源，禁止任何 fetch / /api 调用
 */

export const BRAND = {
  logoScript: 'LeapChess',
  displayTop: 'LEAP',
  displayBottom: 'CHESS',
  displayDot: 'FUTURE',
  titleZh: '落子之间 制胜未来',
  subZh: '2026 LEAPCHESS 全球棋具臻选系列',
  slogan: 'Built for Grandmasters, Accessible to Everyone.',
  stat: { value: '500,000+', label: 'Chess Clubs Supported Worldwide' },
};

export const CATEGORIES = ['All', 'Chess Timers', 'Chess Sets', 'Apparel & Gifts'];

/** 商品数据：型号与价格取自 theleapchess.com 官网商品列表 */
export const PRODUCTS = [
  { id: 'pq9921', name: 'LEAP PQ9921 Pro Choice Timer', desc: 'High-Visibility Lever & Multi-Mode', category: 'Chess Timers', price: 36.99, badge: "Beginner's Pick" },
  { id: 'pq9923', name: 'LEAP PQ9923 Timer — Blue', desc: 'Tournament Clock for Clubs & Schools', category: 'Chess Timers', price: 21.99, badge: '' },
  { id: 'pq9907s', name: 'LEAP PQ9907S Chess Clock', desc: 'Matte Black Edition', category: 'Chess Timers', price: 21.99, badge: '' },
  { id: 'pq9917', name: 'LEAP PQ9917 Pro Timer — White', desc: 'Multi Timing Modes', category: 'Chess Timers', price: 24.99, badge: '' },
  { id: 'pq9918', name: 'LEAP PQ9918 Digital Timer', desc: 'Extra Large Screen Tournament Clock', category: 'Chess Timers', price: 56.99, badge: "Pro's Choice" },
  { id: 'kk9909', name: 'LEAP KK9909 FIDE Timer', desc: '39 Modes · Dual-Color Lever Indicator', category: 'Chess Timers', price: 48.99, badge: 'FIDE' },
  { id: 'kk9908', name: 'LEAP KK9908 FIDE Timer', desc: 'Ultra Portable Tournament Clock', category: 'Chess Timers', price: 38.99, badge: 'FIDE' },
  { id: 'cs13wm', name: '13″ Magnetic Foldable Wooden Set', desc: '2.5″ King Tall · Steady Moves Anywhere', category: 'Chess Sets', price: 42.00, badge: '' },
  { id: 'tee-mens', name: "Men's Short Sleeve T-Shirt", desc: 'Custom chess print · Design your own', category: 'Apparel & Gifts', price: 24.00, badge: '' },
  { id: 'tee-vneck', name: "Women's Classic V-Neck Tee", desc: 'Cool Stuff for Chess Lovers', category: 'Apparel & Gifts', price: 30.00, badge: '' },
];

export const VALUES = [
  { icon: '◎', title: 'Precision for Players', desc: 'Professional-grade accuracy in every timer, engineered for tournament play.' },
  { icon: '♞', title: 'FIDE-Standard Quality', desc: 'Certified clocks with 39 timing modes for official events.' },
  { icon: '✦', title: 'Empowering Clubs', desc: 'Supporting 500,000+ chess clubs worldwide — equip, support, win.' },
];

export const JOURNEY = [
  { year: '2018', stage: 'Origin', text: 'Players building for players — born from a lifelong passion for the game.' },
  { year: '2021', stage: 'Grow', text: 'From FIDE-standard timers to creative chess essentials for every level.' },
  { year: '2026', stage: 'Today', text: 'Empowering 500,000+ clubs worldwide to focus on the next move.' },
];

export function escapeHtml(str) {
  return String(str ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}
