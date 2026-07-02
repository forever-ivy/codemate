/**
 * 两数之和算法
 * 
 * 给定一个整数数组 nums 和一个整数目标值 target，
 * 请你在该数组中找出和为目标值 target 的那两个整数，
 * 并返回它们的数组下标。
 * 
 * 你可以假设每种输入只会对应一个答案，并且你不能重复使用相同的元素。
 * 你可以按任意顺序返回答案。
 */

/**
 * 使用哈希表实现的两数之和算法
 * 时间复杂度：O(n)
 * 空间复杂度：O(n)
 * 
 * @param nums 整数数组
 * @param target 目标值
 * @returns 两个数的索引数组，如果找不到则返回空数组
 */
export function twoSum(nums: number[], target: number): number[] {
    // 创建一个哈希表来存储数字和对应的索引
    const numMap = new Map<number, number>();
    
    // 遍历数组
    for (let i = 0; i < nums.length; i++) {
        const currentNum = nums[i];
        const complement = target - currentNum;
        
        // 检查补数是否已经在哈希表中
        if (numMap.has(complement)) {
            // 找到答案，返回两个索引
            return [numMap.get(complement)!, i];
        }
        
        // 将当前数字和索引存入哈希表
        numMap.set(currentNum, i);
    }
    
    // 如果没有找到答案，返回空数组
    return [];
}

/**
 * 测试函数
 */
export function testTwoSum(): void {
    console.log('=== 两数之和算法测试 ===');
    
    // 测试用例1：基本示例
    const nums1 = [2, 7, 11, 15];
    const target1 = 9;
    const result1 = twoSum(nums1, target1);
    console.log(`测试1: nums = [${nums1}], target = ${target1}`);
    console.log(`结果: [${result1}]`);
    console.log(`预期: [0, 1]`);
    console.log(`通过: ${JSON.stringify(result1) === JSON.stringify([0, 1])}`);
    console.log();
    
    // 测试用例2：有重复数字
    const nums2 = [3, 2, 4];
    const target2 = 6;
    const result2 = twoSum(nums2, target2);
    console.log(`测试2: nums = [${nums2}], target = ${target2}`);
    console.log(`结果: [${result2}]`);
    console.log(`预期: [1, 2]`);
    console.log(`通过: ${JSON.stringify(result2) === JSON.stringify([1, 2])}`);
    console.log();
    
    // 测试用例3：相同数字
    const nums3 = [3, 3];
    const target3 = 6;
    const result3 = twoSum(nums3, target3);
    console.log(`测试3: nums = [${nums3}], target = ${target3}`);
    console.log(`结果: [${result3}]`);
    console.log(`预期: [0, 1]`);
    console.log(`通过: ${JSON.stringify(result3) === JSON.stringify([0, 1])}`);
    console.log();
    
    // 测试用例4：找不到答案
    const nums4 = [1, 2, 3, 4];
    const target4 = 10;
    const result4 = twoSum(nums4, target4);
    console.log(`测试4: nums = [${nums4}], target = ${target4}`);
    console.log(`结果: [${result4}]`);
    console.log(`预期: []`);
    console.log(`通过: ${JSON.stringify(result4) === JSON.stringify([])}`);
    console.log();
    
    // 测试用例5：负数
    const nums5 = [-1, -2, -3, -4, -5];
    const target5 = -8;
    const result5 = twoSum(nums5, target5);
    console.log(`测试5: nums = [${nums5}], target = ${target5}`);
    console.log(`结果: [${result5}]`);
    console.log(`预期: [2, 4]`);
    console.log(`通过: ${JSON.stringify(result5) === JSON.stringify([2, 4])}`);
    console.log();
    
    console.log('=== 测试完成 ===');
}

/**
 * 使用示例
 */
export function exampleUsage(): void {
    console.log('=== 两数之和算法使用示例 ===');
    
    // 示例1：基本使用
    const nums = [2, 7, 11, 15];
    const target = 9;
    const result = twoSum(nums, target);
    
    console.log(`输入数组: [${nums}]`);
    console.log(`目标值: ${target}`);
    console.log(`找到的索引: [${result}]`);
    
    if (result.length === 2) {
        const [i, j] = result;
        console.log(`对应的数字: ${nums[i]} + ${nums[j]} = ${nums[i] + nums[j]}`);
    } else {
        console.log('未找到符合条件的两个数字');
    }
    
    console.log();
    
    // 示例2：实际应用场景
    console.log('实际应用场景：查找商品价格组合');
    const prices = [15, 25, 35, 45, 55];
    const budget = 80;
    const priceIndices = twoSum(prices, budget);
    
    console.log(`商品价格: [${prices.map(p => `$${p}`).join(', ')}]`);
    console.log(`预算: $${budget}`);
    
    if (priceIndices.length === 2) {
        const [idx1, idx2] = priceIndices;
        console.log(`可以购买的商品索引: ${idx1}, ${idx2}`);
        console.log(`商品价格: $${prices[idx1]} + $${prices[idx2]} = $${prices[idx1] + prices[idx2]}`);
    } else {
        console.log('没有两种商品的价格之和等于预算');
    }
}

// 如果直接运行此文件，执行测试
if (require.main === module) {
    testTwoSum();
    console.log('\n');
    exampleUsage();
}