#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
冒泡排序算法实现
"""

def bubble_sort(arr):
    """
    冒泡排序算法
    
    参数:
        arr (list): 待排序的列表
        
    返回:
        list: 排序后的列表
    """
    n = len(arr)
    
    # 遍历所有数组元素
    for i in range(n):
        # 最后i个元素已经排好序，不需要再比较
        for j in range(0, n - i - 1):
            # 如果当前元素大于下一个元素，则交换它们
            if arr[j] > arr[j + 1]:
                arr[j], arr[j + 1] = arr[j + 1], arr[j]
    
    return arr


def bubble_sort_optimized(arr):
    """
    优化的冒泡排序算法
    
    参数:
        arr (list): 待排序的列表
        
    返回:
        list: 排序后的列表
    """
    n = len(arr)
    
    for i in range(n):
        # 添加一个标志位，如果这一轮没有发生交换，说明已经排序完成
        swapped = False
        
        for j in range(0, n - i - 1):
            if arr[j] > arr[j + 1]:
                arr[j], arr[j + 1] = arr[j + 1], arr[j]
                swapped = True
        
        # 如果这一轮没有发生交换，说明数组已经排序完成
        if not swapped:
            break
    
    return arr


def test_bubble_sort():
    """测试冒泡排序算法"""
    test_cases = [
        ([64, 34, 25, 12, 22, 11, 90], [11, 12, 22, 25, 34, 64, 90]),
        ([5, 1, 4, 2, 8], [1, 2, 4, 5, 8]),
        ([3, 2, 1], [1, 2, 3]),
        ([1], [1]),
        ([], []),
        ([1, 2, 3, 4, 5], [1, 2, 3, 4, 5]),  # 已经排序的数组
        ([5, 4, 3, 2, 1], [1, 2, 3, 4, 5]),  # 逆序数组
    ]
    
    print("测试基本冒泡排序算法:")
    for i, (input_arr, expected) in enumerate(test_cases):
        arr_copy = input_arr.copy()
        result = bubble_sort(arr_copy)
        status = "✓" if result == expected else "✗"
        print(f"  测试用例 {i+1}: {status} 输入: {input_arr}, 输出: {result}, 期望: {expected}")
    
    print("\n测试优化的冒泡排序算法:")
    for i, (input_arr, expected) in enumerate(test_cases):
        arr_copy = input_arr.copy()
        result = bubble_sort_optimized(arr_copy)
        status = "✓" if result == expected else "✗"
        print(f"  测试用例 {i+1}: {status} 输入: {input_arr}, 输出: {result}, 期望: {expected}")


def visualize_sorting():
    """可视化排序过程"""
    print("\n冒泡排序过程可视化:")
    arr = [64, 34, 25, 12, 22, 11, 90]
    print(f"原始数组: {arr}")
    
    n = len(arr)
    for i in range(n):
        print(f"\n第 {i+1} 轮:")
        swapped = False
        for j in range(0, n - i - 1):
            if arr[j] > arr[j + 1]:
                arr[j], arr[j + 1] = arr[j + 1], arr[j]
                swapped = True
                print(f"  交换 {arr[j+1]} 和 {arr[j]}: {arr}")
        
        if not swapped:
            print("  没有发生交换，排序完成!")
            break
    
    print(f"\n最终排序结果: {arr}")


if __name__ == "__main__":
    print("=" * 50)
    print("冒泡排序算法演示")
    print("=" * 50)
    
    # 运行测试
    test_bubble_sort()
    
    # 可视化排序过程
    visualize_sorting()
    
    # 示例使用
    print("\n" + "=" * 50)
    print("示例使用:")
    example_arr = [64, 34, 25, 12, 22, 11, 90]
    print(f"排序前: {example_arr}")
    
    sorted_arr = bubble_sort(example_arr.copy())
    print(f"排序后: {sorted_arr}")
    
    print("\n算法特点:")
    print("1. 时间复杂度: O(n²)")
    print("2. 空间复杂度: O(1) (原地排序)")
    print("3. 稳定性: 稳定排序算法")
    print("4. 适用场景: 小规模数据或教学演示")