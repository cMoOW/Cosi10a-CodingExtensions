x = 1
y = 2
z = 3
A = []

def foo(i):
    i += 2
    i *= 4
    return i

for i in (x,y,z): 
    i = foo(i)
    A.append(i)
    print (i)
    
print(i)