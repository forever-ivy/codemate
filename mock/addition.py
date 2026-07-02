#!/usr/bin/env python3
"""
加法运算模块
提供基本的加法运算功能
"""

def add(a: float, b: float) -> float:
    """
    加法函数
    
    参数:
        a (float): 第一个数字
        b (float): 第二个数字
        
    返回:
        float: a 和 b 的和
    """
    return a + b


def add_multiple(*args: float) -> float:
    """
    多个数字相加
    
    参数:
        *args (float): 可变数量的数字
        
    返回:
        float: 所有数字的和
    """
    return sum(args)


def add_with_validation(a: float, b: float) -> float:
    """
    带验证的加法函数
    
    参数:
        a (float): 第一个数字
        b (float): 第二个数字
        
    返回:
        float: a 和 b 的和
        
    异常:
        TypeError: 如果输入不是数字
    """
    if not (isinstance(a, (int, float)) and isinstance(b, (int, float))):
        raise TypeError("输入必须是数字类型")
    return a + b


def main():
    """主函数，演示加法运算"""
    print("=== 加法运算演示 ===")
    
    # 基本加法
    result1 = add(5, 3)
    print(f"5 + 3 = {result1}")
    
    # 多个数字相加
    result2 = add_multiple(1, 2, 3, 4, 5)
    print(f"1 + 2 + 3 + 4 + 5 = {result2}")
    
    # 带验证的加法
    try:
        result3 = add_with_validation(10.5, 20.3)
        print(f"10.5 + 20.3 = {result3}")
        
        # 测试错误情况
        add_with_validation("10", 20)
    except TypeError as e:
        print(f"错误: {e}")
    
    # 更多示例
    print("\n=== 更多示例 ===")
    examples = [
        (2, 3),
        (-5, 10),
        (0, 0),
        (3.14, 2.86),
        (100, -50)
    ]
    
    for a, b in examples:
        result = add(a, b)
        print(f"{a} + {b} = {result}")


if __name__ == "__main__":
    main()