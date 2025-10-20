import math
# TODO
x = 1
y = x +3
def myFactorial(n):
    if n == 0:
        return 1
    else:
        return n * myFactorial(n-1)
print('Factorial of', x, 'is', myFactorial(x))

