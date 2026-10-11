// 图 3-7 增长战略与生产率战略 (《自驱战略落地》第三章): the reference card for 一级路径 — “按图 3-7
// 两组想”. Each item can start a level-1 path (S2-03) or a financial theme (S2-01 子步骤 1).

export type Figure37Item = { key: string; group: string; label: string; decodeCategory: string };

export const FIGURE_3_7: { strategy: string; groups: { name: string; items: Figure37Item[] }[] }[] = [
  {
    strategy: "增长战略",
    groups: [
      {
        name: "增加收入机会",
        items: [
          { key: "rev-product", group: "增加收入机会", label: "产品", decodeCategory: "grow-new-product" },
          { key: "rev-business", group: "增加收入机会", label: "业务", decodeCategory: "grow-new-product" },
          { key: "rev-region", group: "增加收入机会", label: "区域", decodeCategory: "grow-new-market" },
          { key: "rev-model", group: "增加收入机会", label: "经营模式", decodeCategory: "grow-channel" },
        ],
      },
      {
        name: "提高客户价值",
        items: [
          { key: "cv-new", group: "提高客户价值", label: "开发新客户", decodeCategory: "grow-new-customer" },
          { key: "cv-referral", group: "提高客户价值", label: "老客户转介绍", decodeCategory: "grow-existing-customer" },
          { key: "cv-value", group: "提高客户价值", label: "提高单客户价值", decodeCategory: "grow-price" },
        ],
      },
    ],
  },
  {
    strategy: "生产率战略",
    groups: [
      {
        name: "生产率",
        items: [
          { key: "pr-cost", group: "改善成本结构", label: "改善成本结构", decodeCategory: "cut-cost" },
          { key: "pr-asset", group: "提高资产利用率", label: "提高资产利用率", decodeCategory: "asset-efficiency" },
        ],
      },
    ],
  },
];

export const figureTag = (item: Figure37Item) => (item.group === item.label ? item.label : `${item.group} › ${item.label}`);
