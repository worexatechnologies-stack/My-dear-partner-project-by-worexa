import os

files_to_clean = [
    r"c:\Users\ullas\Desktop\Company projects\matiromony\frontend\legacy\pages\admin\AdminComplaintsPage.tsx",
    r"c:\Users\ullas\Desktop\Company projects\matiromony\frontend\legacy\pages\admin\AdminPermissionsPage.tsx",
    r"c:\Users\ullas\Desktop\Company projects\matiromony\frontend\legacy\pages\admin\AdminRolesPage.tsx",
    r"c:\Users\ullas\Desktop\Company projects\matiromony\frontend\legacy\pages\admin\AdminStaffActivityPage.tsx",
    r"c:\Users\ullas\Desktop\Company projects\matiromony\frontend\legacy\pages\admin\AdminDashboardPage.tsx",
    r"c:\Users\ullas\Desktop\Company projects\matiromony\frontend\legacy\components\admin\AdminUI.tsx",
    r"c:\Users\ullas\Desktop\Company projects\matiromony\frontend\legacy\components\admin\AdminLayout.tsx",
]

for path in files_to_clean:
    if os.path.exists(path):
        with open(path, "r", encoding="utf-8") as f:
            content = f.read()

        content = content.replace("=== 'STAFF'", "=== 'ADMIN'")
        content = content.replace("!== 'STAFF'", "!== 'ADMIN'")
        content = content.replace("=== 'CUSTOMER_SUPPORT'", "=== 'ADMIN'")
        content = content.replace("role === 'STAFF' ?", "role === 'ADMIN' ?")
        content = content.replace("role === 'STAFF'", "role === 'ADMIN'")
        content = content.replace("role: 'STAFF'", "role: 'ADMIN'")
        content = content.replace("STAFF: [", "")
        content = content.replace("STAFF: {", "")
        content = content.replace("CUSTOMER_SUPPORT: [", "")
        content = content.replace("CUSTOMER_SUPPORT: {", "")

        with open(path, "w", encoding="utf-8") as f:
            f.write(content)

print("[SUCCESS] Cleansed STAFF/CUSTOMER_SUPPORT from admin legacy pages & components!")
