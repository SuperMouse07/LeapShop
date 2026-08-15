/**
 * 沙箱方案注册表（portal 与新增方案的唯一登记点）
 * ------------------------------------------------------------
 * - 每套设计方案 = sandbox 下一个独立子目录，目录内需含 scheme.json 元数据清单
 * - 新增方案：创建目录后，在下方 SCHEMES 数组追加一行 { id: '<目录名>' }
 * - 方案的状态/描述等元信息一律维护在 <方案目录>/scheme.json（单一事实源）
 * - portal.html 依据本注册表探测各方案目录并动态渲染卡片与对比表
 */
export const SCHEMES = [
  { id: 'prototype-a' },
  { id: 'prototype-b' },
  { id: 'prototype-c' },
  { id: 'prototype-d' },
  { id: 'prototype-e' },
  { id: 'prototype-f' },
];
