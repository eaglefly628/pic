// 从粘贴的文本（例如京东 App「我的-地址管理」里复制出来的地址列表）里，
// 尽量识别出 收件人/电话/地址/标签/默认 —— 识别结果仅作为草稿，导入前用户还能逐条改。
export interface ParsedAddress {
  name: string;
  phone: string;
  address: string;
  tag?: string;
  isDefault?: boolean;
}

const PHONE_RE = /1[3-9]\d{9}/;
const TAG_WORDS = ["家", "公司", "学校", "父母家", "老家", "单位"];
const PROVINCE_RE = /(北京|天津|上海|重庆|河北|山西|辽宁|吉林|黑龙江|江苏|浙江|安徽|福建|江西|山东|河南|湖北|湖南|广东|广西|海南|四川|贵州|云南|西藏|陕西|甘肃|青海|宁夏|新疆|内蒙古|香港|澳门|台湾)/;
const LABEL_RE = /(收件人|手机号码?|联系电话|电话|收货地址|详细地址|所在地区|地址|标签)[:：]?/g;

export function parseAddressText(raw: string): ParsedAddress[] {
  const cleaned = raw.replace(/\r\n/g, "\n").trim();
  if (!cleaned) return [];
  return splitBlocks(cleaned).map(parseBlock).filter((x): x is ParsedAddress => x != null);
}

/** 按行扫描分组：空行断开；一旦当前组里已经出现过手机号、又碰到新的手机号行，就当作下一条地址开始。
 *  这样能同时兼容「一行一条」「一条地址跨好几行、中间没空行」两种粘贴格式。 */
function splitBlocks(cleaned: string): string[] {
  const lines = cleaned.split("\n").map((l) => l.trim());
  const blocks: string[] = [];
  let cur: string[] = [];
  const flush = () => { if (cur.length) { blocks.push(cur.join(" ")); cur = []; } };
  for (const line of lines) {
    if (!line) { flush(); continue; }
    const curHasPhone = cur.some((l) => PHONE_RE.test(l));
    if (PHONE_RE.test(line) && curHasPhone) { flush(); cur = [line]; }
    else cur.push(line);
  }
  flush();
  return blocks.filter(Boolean);
}

function parseBlock(block: string): ParsedAddress | null {
  const phoneM = block.match(PHONE_RE);
  if (!phoneM) return null; // 一条地址至少得有个手机号，没有就大概率不是地址行
  const phone = phoneM[0];
  let rest = block.slice(0, phoneM.index) + " " + block.slice((phoneM.index ?? 0) + phone.length);

  let isDefault = false;
  if (/默认地址|默认/.test(rest)) { isDefault = true; rest = rest.replace(/设为默认地址|默认地址|默认/g, " "); }

  let tag: string | undefined;
  for (const w of TAG_WORDS) {
    if (rest.includes(w)) { tag = w; rest = rest.replace(new RegExp(`[\\[【(（]?${w}[\\]】)）]?`), " "); break; }
  }

  rest = rest.replace(LABEL_RE, " ").replace(/\s+/g, " ").trim();

  let name = "";
  const spaceIdx = rest.indexOf(" ");
  if (spaceIdx > 0) {
    const head = rest.slice(0, spaceIdx);
    if (/^[一-龥·]{2,6}$/.test(head)) { name = head; rest = rest.slice(spaceIdx + 1).trim(); }
  }
  if (!name) {
    // 没空格的紧凑格式：姓名紧跟在省份名前面，例如 "张三浙江省杭州市…"
    const pm = rest.match(PROVINCE_RE);
    if (pm && pm.index != null && pm.index >= 2 && pm.index <= 6) {
      const head = rest.slice(0, pm.index);
      if (/^[一-龥·]{2,6}$/.test(head)) { name = head; rest = rest.slice(pm.index); }
    }
  }

  const address = rest.replace(/[[【(（]\s*[\]】)）]/g, "").replace(/\s+/g, "").trim();
  if (!address && !name) return null;
  return { name, phone, address, tag, isDefault };
}
