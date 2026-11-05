// 「生活」预置集合 —— 开箱即用的数据格式样板，可随意改字段 / 加集合 / 删除。
import type { CollectionDef, FieldDef, LifeItem } from "../types";

let _n = 0;
const id = (p: string) => p + "_" + (Date.now() + _n++).toString(36);
const f = (label: string, type: FieldDef["type"], extra: Partial<FieldDef> = {}): FieldDef => ({ id: id("f"), label, type, ...extra });

/** 独立导出：收货地址集合的字段格式（新用户随预置集合一起给；老用户由 Life.tsx 补建）。 */
export function addressCollection(): CollectionDef {
  const now = Date.now();
  return {
    id: id("c"), name: "收货地址", emoji: "📍", color: "#FF375F", createdAt: now, updatedAt: now,
    fields: [
      f("收件人", "text"),
      f("电话", "phone"),
      f("地址", "location"),
      f("标签", "select", { options: ["家", "公司", "学校", "父母家", "其它"] }),
      f("默认地址", "bool"),
    ],
  };
}

export function presetCollections(): { collections: CollectionDef[]; items: LifeItem[] } {
  const now = Date.now();
  const cols: CollectionDef[] = [];
  const items: LifeItem[] = [];
  const mk = (name: string, emoji: string, color: string, fields: FieldDef[]): CollectionDef => {
    const c: CollectionDef = { id: id("c"), name, emoji, color, fields, createdAt: now, updatedAt: now };
    cols.push(c); return c;
  };
  const add = (c: CollectionDef, title: string, values: Record<string, unknown>, extra: Partial<LifeItem> = {}) => {
    items.push({ id: id("i"), collectionId: c.id, title, values: values as LifeItem["values"], createdAt: now, updatedAt: now, ...extra });
  };

  cols.push(addressCollection());

  // 🍜 餐厅
  const fCuisine = f("菜系", "select", { options: ["火锅", "川菜", "粤菜", "日料", "西餐", "快餐", "烧烤", "其它"] });
  const fAvg = f("人均", "money", { unit: "¥" });
  const fAddr = f("地址", "location");
  const fPhone = f("电话", "phone");
  const fMust = f("必点", "tags");
  const fScene = f("适合", "tags");
  const fLast = f("上次去", "date");
  const rest = mk("餐厅", "🍜", "#FF9500", [fCuisine, fAvg, fAddr, fPhone, fMust, fScene, fLast]);
  add(rest, "海底捞 · 万象城店", { [fCuisine.id]: "火锅", [fAvg.id]: 150, [fAddr.id]: "万象城 4F", [fMust.id]: ["番茄锅", "毛肚", "虾滑"], [fScene.id]: ["聚餐", "约会"] }, { rating: 4, favorite: true, tags: ["常去"] });
  add(rest, "楼下兰州拉面", { [fCuisine.id]: "快餐", [fAvg.id]: 25, [fMust.id]: ["牛肉面", "凉拌黄瓜"], [fScene.id]: ["工作日午饭"] }, { rating: 3 });

  // 🏨 酒店
  const hCity = f("城市", "text");
  const hPrice = f("价位", "money", { unit: "¥" });
  const hRoom = f("常订房型", "text");
  const hMember = f("会员号", "text", { secret: true });
  const hAddr = f("地址", "location");
  const hotel = mk("酒店", "🏨", "#0A84FF", [hCity, hPrice, hRoom, hMember, hAddr]);
  add(hotel, "全季酒店 · 西湖店", { [hCity.id]: "杭州", [hPrice.id]: 420, [hRoom.id]: "高级大床", [hMember.id]: "HJ8821xxxx", [hAddr.id]: "西湖区文一路" }, { rating: 4, favorite: true });

  // ☕ 饮料
  const dKind = f("类别", "select", { options: ["咖啡", "茶", "奶茶", "汽水", "酒", "其它"] });
  const dBrand = f("品牌/店", "text");
  const dOrder = f("我的点法", "text");
  const drink = mk("饮料", "☕", "#34C759", [dKind, dBrand, dOrder]);
  add(drink, "燕麦拿铁", { [dKind.id]: "咖啡", [dBrand.id]: "Manner", [dOrder.id]: "燕麦奶 / 少糖 / 热" }, { rating: 5, favorite: true, tags: ["每天"] });
  add(drink, "多肉葡萄", { [dKind.id]: "奶茶", [dBrand.id]: "喜茶", [dOrder.id]: "三分糖 / 去冰" }, { rating: 4 });

  // 🔒 私人信息（多为私密字段）
  const pName = f("项目", "text");
  const pVal = f("内容", "text", { secret: true });
  const pNote = f("备注", "longtext");
  const priv = mk("私人信息", "🔒", "#5E5CE6", [pName, pVal, pNote]);
  add(priv, "衣服尺码", { [pName.id]: "上衣 / 裤子 / 鞋", [pVal.id]: "L / 32 / 42", [pNote.id]: "优衣库偏小一码" });
  add(priv, "过敏 & 忌口", { [pName.id]: "过敏原", [pVal.id]: "海鲜（虾蟹）", [pNote.id]: "点餐避开" });

  return { collections: cols, items };
}
