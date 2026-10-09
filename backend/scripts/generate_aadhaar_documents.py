import gzip
import hashlib
import io
import os
import random
from PIL import Image, ImageDraw, ImageFont, ImageFilter

def create_aadhaar_card_image(member, doc_type="Aadhaar Card"):
    width, height = 1000, 630
    card = Image.new('RGB', (width, height), color=(255, 255, 255))
    draw = ImageDraw.Draw(card)

    # Subtle outer border and background
    draw.rectangle([0, 0, width-1, height-1], outline=(200, 205, 215), width=2)
    
    # Security guilloche watermark effect (light concentric circles in background)
    for r in range(40, 400, 30):
        draw.ellipse([width//2 - r, height//2 - r, width//2 + r, height//2 + r], outline=(245, 247, 250), width=1)

    # Top Indian Tricolor Header Bar
    draw.rectangle([0, 0, width, 18], fill=(255, 153, 51))    # Saffron
    draw.rectangle([0, 18, width, 24], fill=(255, 255, 255))  # White
    draw.rectangle([0, 24, width, 32], fill=(19, 136, 8))     # Green

    # Government of India Banner
    draw.rectangle([30, 45, width-30, 105], fill=(248, 249, 252), outline=(225, 230, 238), width=1)
    
    # Emblem representation (Ashoka Pillar icon representation)
    draw.rectangle([45, 55, 75, 95], fill=(230, 235, 245), outline=(100, 110, 130), width=2)
    draw.line([60, 55, 60, 95], fill=(100, 110, 130), width=2)
    draw.ellipse([50, 70, 70, 80], outline=(0, 0, 128), width=1) # Chakra

    # Header Text
    draw.text((90, 53), 'भारत सरकार', fill=(160, 30, 30))
    draw.text((90, 68), 'GOVERNMENT OF INDIA', fill=(160, 30, 30))
    draw.text((90, 84), 'भारतीय विशिष्ट पहचान प्राधिकरण  |  UNIQUE IDENTIFICATION AUTHORITY OF INDIA', fill=(70, 75, 85))

    # Aadhaar Sun Logo representation on right
    draw.ellipse([width - 85, 52, width - 45, 92], fill=(254, 226, 226), outline=(220, 38, 38), width=2)
    draw.text((width - 77, 65), 'आधार', fill=(185, 28, 28))

    # Separator Line
    draw.line([30, 115, width - 30, 115], fill=(220, 225, 235), width=2)

    # Member Profile Photo Box
    photo_x, photo_y, photo_w, photo_h = 50, 135, 200, 250
    draw.rectangle([photo_x - 2, photo_y - 2, photo_x + photo_w + 2, photo_y + photo_h + 2], fill=(240, 243, 248), outline=(180, 190, 205), width=2)

    # Try to load member's profile photo
    photo_pasted = False
    try:
        from apps.profiles.models import ProfilePhoto
        p = ProfilePhoto.objects.filter(user=member, is_primary=True).first()
        if not p:
            p = ProfilePhoto.objects.filter(user=member).first()
        if p and p.image_data:
            mem_img = Image.open(io.BytesIO(bytes(p.image_data)))
            mem_img = mem_img.convert('RGB')
            mem_img = mem_img.resize((photo_w, photo_h), Image.Resampling.LANCZOS)
            card.paste(mem_img, (photo_x, photo_y))
            photo_pasted = True
    except Exception:
        pass

    if not photo_pasted:
        # Placeholder avatar
        draw.rectangle([photo_x, photo_y, photo_x + photo_w, photo_y + photo_h], fill=(235, 240, 248))
        draw.ellipse([photo_x + 60, photo_y + 40, photo_x + 140, photo_y + 120], fill=(160, 175, 195))
        draw.ellipse([photo_x + 30, photo_y + 130, photo_x + 170, photo_y + 240], fill=(160, 175, 195))

    # Member Info
    full_name = member.get_full_name() or 'Member Name'
    dob_str = str(member.date_of_birth or '15/08/1995')
    gender = getattr(member, 'gender', 'Male') or 'Male'
    city = getattr(member, 'city', 'Mumbai') or 'Mumbai'
    state = getattr(member, 'state', 'Maharashtra') or 'Maharashtra'

    text_x = 280
    draw.text((text_x, 140), 'नाम / Name:', fill=(110, 115, 125))
    draw.text((text_x + 120, 140), full_name, fill=(15, 23, 42))

    draw.text((text_x, 180), 'जन्म तिथि / DOB:', fill=(110, 115, 125))
    draw.text((text_x + 120, 180), dob_str, fill=(15, 23, 42))

    draw.text((text_x, 220), 'लिंग / Gender:', fill=(110, 115, 125))
    draw.text((text_x + 120, 220), str(gender).capitalize(), fill=(15, 23, 42))

    draw.text((text_x, 260), 'पता / Address:', fill=(110, 115, 125))
    draw.text((text_x + 120, 260), f'{city}, {state}, India', fill=(71, 85, 105))

    # QR Code placeholder representation on the right
    qr_x, qr_y, qr_s = width - 210, 145, 150
    draw.rectangle([qr_x, qr_y, qr_x + qr_s, qr_y + qr_s], fill=(255, 255, 255), outline=(15, 23, 42), width=2)
    # Draw QR code square pattern
    for i in range(qr_x + 10, qr_x + qr_s - 10, 14):
        for j in range(qr_y + 10, qr_y + qr_s - 10, 14):
            if (hash(f'{full_name}_{i}_{j}') % 3) == 0:
                draw.rectangle([i, j, i + 10, j + 10], fill=(15, 23, 42))
    # 3 corner markers of QR code
    draw.rectangle([qr_x + 10, qr_y + 10, qr_x + 40, qr_y + 40], outline=(15, 23, 42), width=3)
    draw.rectangle([qr_x + qr_s - 40, qr_y + 10, qr_x + qr_s - 10, qr_y + 40], outline=(15, 23, 42), width=3)
    draw.rectangle([qr_x + 10, qr_y + qr_s - 40, qr_x + 40, qr_y + qr_s - 10], outline=(15, 23, 42), width=3)

    # Prominent Aadhaar Number Box
    uid_box_y = 395
    draw.rectangle([50, uid_box_y, width - 50, uid_box_y + 80], fill=(255, 248, 248), outline=(239, 68, 68), width=2)
    
    # Generate stable deterministic 12-digit Aadhaar number
    seed_val = int(hashlib.md5(str(member.id).encode()).hexdigest()[:8], 16)
    part1 = 2000 + (seed_val % 7000)
    part2 = 1000 + ((seed_val // 7) % 8000)
    part3 = 1000 + ((seed_val // 13) % 8000)
    uid_str = f'XXXX  XXXX  {part3}'

    # Draw large Aadhaar number
    draw.text((width // 2 - 130, uid_box_y + 25), uid_str, fill=(185, 28, 28))
    draw.text((width // 2 - 110, uid_box_y + 55), 'आधार - आम आदमी का अधिकार', fill=(120, 125, 135))

    # Bottom Tricolor Footer Bar
    draw.rectangle([0, height - 42, width, height], fill=(180, 40, 40))
    draw.text((width // 2 - 120, height - 28), 'मेरा आधार, मेरी पहचान / Unique Identification Authority of India', fill=(255, 255, 255))

    # Return both Image and PDF
    pdf_buf = io.BytesIO()
    card.save(pdf_buf, format='PDF', quality=95)
    pdf_bytes = pdf_buf.getvalue()

    img_buf = io.BytesIO()
    card.save(img_buf, format='JPEG', quality=90)
    img_bytes = img_buf.getvalue()

    return card, pdf_bytes, img_bytes
