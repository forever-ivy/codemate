/**
 * 计算器工具函数
 */

/**
 * 乘法函数
 * @param a 第一个数字
 * @param b 第二个数字
 * @returns 两个数字的乘积
 */
/**
 * 乘法函数
 * @param a 第一个数字
 * @param b 第二个数字
 * @returns 两个数字的乘积
 * @throws {Error} 当参数不是有效数字时抛出错误
 */
/**
 * 乘法函数
 * @param a 第一个数字
 * @param b 第二个数字
 * @returns 两个数字的乘积
 * @throws {Error} 当参数不是有效数字时抛出错误
 */
export function multiply(a: number, b: number): number {
  // 验证参数是否为有效数字（不是 NaN、Infinity 或 -Infinity）
  if (!Number.isFinite(a) || !Number.isFinite(b)) {
    throw new Error('参数必须是有效数字（不能是 NaN、Infinity 或 -Infinity）');
  }

  return a * b;
}

/**
 * 除法函数
 * @param a 被除数
 * @param b 除数
 * @returns 两个数字的商
 * @throws {Error} 当除数为零时抛出错误
 */
export function divide(a: number, b: number): number {
  if (b === 0) {
    throw new Error('除数不能为零');
  }
  return a / b;
}
