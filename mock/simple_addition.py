#!/usr/bin/env python3
"""
简单的加法运算模块
"""

def add(a, b, c, d):
    """返回四个数字的和"""
    return a + b + c + d


def add_three(a, b, c):
    """返回三个数字的和"""
    return a + b + c


def add_list(numbers):
    """返回列表中所有数字的和"""
    return sum(numbers)


# 测试代码
if __name__ == "__main__":
    print("测试加法运算:")
    print(f"1 + 2 + 3 + 4 = {add(1, 2, 3, 4)}")
    print(f"1 + 2 + 3 = {add_three(1, 2, 3)}")
    print(f"[1, 2, 3, 4, 5] 的和 = {add_list([1, 2, 3, 4, 5])}")