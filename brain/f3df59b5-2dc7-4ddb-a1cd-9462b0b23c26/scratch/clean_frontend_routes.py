import re

def clean_file(path):
    with open(path, "r", encoding="utf-8") as f:
        content = f.read()

    # Remove 'STAFF' from allowedRoles arrays
    content = content.replace(", 'STAFF'", "")
    content = content.replace("'STAFF', ", "")
    content = content.replace("'STAFF'", "")

    # Clean lines with /staff/ routes or roles
    lines = content.splitlines()
    new_lines = [l for l in lines if "/staff/" not in l and "const staff:" not in l]
    
    with open(path, "w", encoding="utf-8") as f:
        f.write("\n".join(new_lines) + "\n")

clean_file(r"c:\Users\ullas\Desktop\Company projects\matiromony\frontend\config\navigation.ts")
clean_file(r"c:\Users\ullas\Desktop\Company projects\matiromony\frontend\config\routes.ts")
clean_file(r"c:\Users\ullas\Desktop\Company projects\matiromony\frontend\legacy\admin\navigation.ts")

print("[SUCCESS] Cleansed STAFF from frontend navigation and routes!")
