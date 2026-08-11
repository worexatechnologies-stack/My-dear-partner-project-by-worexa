import re

path = r"c:\Users\ullas\Desktop\Company projects\matiromony\backend\apps\core\role_views.py"
with open(path, "r", encoding="utf-8") as f:
    content = f.read()

# Replace AccountType.STAFF and RoleCode.STAFF
content = content.replace("RoleCode.STAFF", "RoleCode.ADMIN")
content = content.replace("AccountType.STAFF", "AccountType.ADMIN")
content = content.replace("'STAFF'", "'ADMIN'")
content = content.replace('"STAFF"', '"ADMIN"')

with open(path, "w", encoding="utf-8") as f:
    f.write(content)

print("[SUCCESS] Cleansed STAFF from role_views.py!")
