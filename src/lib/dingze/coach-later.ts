// 从没有对话面板的页面（资料页）跳到表里时，把要对数字咨询师说的话先存起来；
// 对话面板一挂上就填进输入框，不自动发送。只存一句，关掉标签页就没了。

const KEY = "dz:coach-say-later";

export function askCoachLater(text: string) {
  try {
    sessionStorage.setItem(KEY, text);
  } catch {
    /* 隐私模式等存不了就算了 */
  }
}

/** Reads and clears the pending sentence. */
export function takeLaterSay(): string | null {
  try {
    const text = sessionStorage.getItem(KEY);
    if (text) sessionStorage.removeItem(KEY);
    return text;
  } catch {
    return null;
  }
}
