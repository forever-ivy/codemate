/**
 * 加法函数
 * 
 * 实现基本的加法运算，支持整数和浮点数
 */

/**
 * 加法函数
 * 支持三个数相加
 * 
 * @param a 第一个加数
 * @param b 第二个加数
 * @param c 第三个加数
 * @returns 三个数的和
 */
export function add(a: number, b: number, c: number): number {
    return a + b + c;
}

/**
 * 多个数相加
 * 支持任意数量的参数相加
 * 
 * @param numbers 要相加的数字数组
 * @returns 所有数字的和
 */
export function addMultiple(...numbers: number[]): number {
    return numbers.reduce((sum, num) => sum + num, 0);
}

/**
 * 安全的加法函数
 * 处理可能的溢出和精度问题
 * 
 * @param a 第一个加数
 * @param b 第二个加数
 * @returns 两个数的和，如果溢出则返回最大安全整数
 */
export function safeAdd(a: number, b: number): number {
    const sum = a + b;
    
    // 检查是否溢出
    if (!Number.isFinite(sum)) {
        // 如果溢出，返回最大安全整数
        return Number.MAX_SAFE_INTEGER;
    }
    
    // 处理浮点数精度问题
    const precision = Math.max(
        (a.toString().split('.')[1] || '').length,
        (b.toString().split('.')[1] || '').length
    );
    
    if (precision > 0) {
        const multiplier = Math.pow(10, precision);
        return (Math.round(a * multiplier) + Math.round(b * multiplier)) / multiplier;
    }
    
    return sum;
}

/**
 * 测试函数
 */
export function testAdd(): void {
    console.log('=== 加法函数测试 ===');
    
    // 测试用例1：基本整数加法
    const result1 = add(2, 3, 4);
    console.log(`测试1: add(2, 3, 4)`);
    console.log(`结果: ${result1}`);
    console.log(`预期: 9`);
    console.log(`通过: ${result1 === 9}`);
    console.log();
    
    // 测试用例2：浮点数加法
    const result2 = add(1.1, 2.2, 3.3);
    console.log(`测试2: add(1.1, 2.2, 3.3)`);
    console.log(`结果: ${result2}`);
    console.log(`预期: 6.6`);
    console.log(`通过: ${Math.abs(result2 - 6.6) < 0.000001}`);
    console.log();
    
    // 测试用例3：负数加法
    const result3 = add(-5, 3, -2);
    console.log(`测试3: add(-5, 3, -2)`);
    console.log(`结果: ${result3}`);
    console.log(`预期: -4`);
    console.log(`通过: ${result3 === -4}`);
    console.log();
    
    // 测试用例4：多个数相加
    const result4 = addMultiple(1, 2, 3, 4, 5);
    console.log(`测试4: addMultiple(1, 2, 3, 4, 5)`);
    console.log(`结果: ${result4}`);
    console.log(`预期: 15`);
    console.log(`通过: ${result4 === 15}`);
    console.log();
    
    // 测试用例5：安全加法
    const result5 = safeAdd(0.1, 0.2);
    console.log(`测试5: safeAdd(0.1, 0.2)`);
    console.log(`结果: ${result5}`);
    console.log(`预期: 0.3`);
    console.log(`通过: ${result5 === 0.3}`);
    console.log();
    
    // 测试用例6：大数加法
    const result6 = safeAdd(Number.MAX_SAFE_INTEGER, 1);
    console.log(`测试6: safeAdd(MAX_SAFE_INTEGER, 1)`);
    console.log(`结果: ${result6}`);
    console.log(`预期: ${Number.MAX_SAFE_INTEGER}`);
    console.log(`通过: ${result6 === Number.MAX_SAFE_INTEGER}`);
    console.log();
    
    console.log('=== 测试完成 ===');
}

/**
 * 使用示例
 */
export function exampleUsage(): void {
    console.log('=== 加法函数使用示例 ===');
    
    // 示例1：基本使用
    console.log('示例1：基本加法');
    const sum1 = add(10, 20, 30);
    console.log(`add(10, 20, 30) = ${sum1}`);
    console.log();
    
    // 示例2：多个数相加
    console.log('示例2：多个数相加');
    const sum2 = addMultiple(1, 2, 3, 4, 5, 6, 7, 8, 9, 10);
    console.log(`1到10的和 = ${sum2}`);
    console.log();
    
    // 示例3：浮点数精度处理
    console.log('示例3：浮点数精度处理');
    const regularSum = 0.1 + 0.2;
    const safeSum = safeAdd(0.1, 0.2);
    console.log(`普通加法: 0.1 + 0.2 = ${regularSum}`);
    console.log(`安全加法: safeAdd(0.1, 0.2) = ${safeSum}`);
    console.log(`普通加法有精度问题: ${regularSum !== 0.3}`);
    console.log(`安全加法更准确: ${safeSum === 0.3}`);
    console.log();
    
    // 示例4：实际应用场景 - 购物车总价计算
    console.log('示例4：购物车总价计算');
    const cartItems = [
        { name: '商品A', price: 29.99 },
        { name: '商品B', price: 15.50 },
        { name: '商品C', price: 42.75 },
        { name: '商品D', price: 8.99 }
    ];
    
    const totalPrice = addMultiple(...cartItems.map(item => item.price));
    console.log('购物车商品:');
    cartItems.forEach(item => {
        console.log(`  ${item.name}: $${item.price.toFixed(2)}`);
    });
    console.log(`总价: $${totalPrice.toFixed(2)}`);
    console.log();
    
    // 示例5：实际应用场景 - 成绩统计
    console.log('示例5：成绩统计');
    const scores = [85, 92, 78, 95, 88, 91];
    const totalScore = addMultiple(...scores);
    const averageScore = totalScore / scores.length;
    console.log(`学生成绩: ${scores.join(', ')}`);
    console.log(`总分: ${totalScore}`);
    console.log(`平均分: ${averageScore.toFixed(2)}`);
    
    // 示例6：三个数相加的实际应用
    console.log('示例6：三个数相加的实际应用');
    console.log('场景：计算三个季度的销售额总和');
    const q1Sales = 125000;
    const q2Sales = 138500;
    const q3Sales = 142300;
    const totalSales = add(q1Sales, q2Sales, q3Sales);
    console.log(`第一季度销售额: $${q1Sales.toLocaleString()}`);
    console.log(`第二季度销售额: $${q2Sales.toLocaleString()}`);
    console.log(`第三季度销售额: $${q3Sales.toLocaleString()}`);
    console.log(`前三季度总销售额: $${totalSales.toLocaleString()}`);
}

// 如果直接运行此文件，执行测试
if (require.main === module) {
    testAdd();
    console.log('\n');
    exampleUsage();
}