FloorPlan Interest Calculator — Windows (ใช้ภายในองค์กร)
==========================================================

สำคัญ: ไฟล์ .zip ไม่ใช่แอป — แตก zip ก่อน แล้วค่อยเปิด .exe

สิ่งที่อยู่ในโฟลเดอร์ FloorPlan-windows
  • FloorPlan Interest Calculator\                 ← ทั้งโฟลเดอร์ต้องอยู่ด้วยกัน
      └─ FloorPlan Interest Calculator.exe          ← เปิดตัวนี้
  • ไฟล์นี้ (DISTRIBUTE_README.txt)

วิธีใช้ (เครื่องที่รับไฟล์)
  1. คลิกขวาที่ FloorPlan-Interest-Calculator-windows.zip → Extract All...
  2. เปิดโฟลเดอร์ FloorPlan-windows → FloorPlan Interest Calculator
  3. Double-click "FloorPlan Interest Calculator.exe"
  4. ถ้าเจอหน้าจอสีฟ้า "Windows protected your PC" (Windows SmartScreen):
     กด "More info" แล้วกด "Run anyway" — เกิดขึ้นเพราะไฟล์นี้ยังไม่ได้เซ็นรับรอง
     (unsigned) ไม่ใช่ไวรัส เป็นเรื่องปกติสำหรับแอปที่ build ใช้ภายในองค์กร
  5. ควรเห็นหน้าต่าง "FloorPlan Interest Calculator"

ถ้า double-click .exe แล้วไม่มีอะไรขึ้นเลย หรือปิดตัวเองทันที
  A) เปิดผ่าน Command Prompt แทน เพื่อดู error message:
     cd path\to\FloorPlan Interest Calculator
     "FloorPlan Interest Calculator.exe"
     แล้ว copy ข้อความ error ส่งให้ทีม build
  B) ดูไฟล์ Desktop\FloorPlan-startup.log (ถ้ามี)
  C) ตรวจสอบว่า Microsoft Edge WebView2 Runtime ติดตั้งอยู่ (ปกติมีมากับ Windows 10/11
     อยู่แล้ว ถ้าไม่มีสามารถโหลดฟรีจาก Microsoft ได้)

ข้อกำหนดเครื่อง
  • Windows 10 หรือ 11 (64-bit)

ไม่ต้องติดตั้ง Python / Node และไม่ต้องรันสคริปต์ .ps1 ใด ๆ

ข้อมูลของแอป (upload, AR_Outputs, data)
  เก็บในโฟลเดอร์ "FloorPlan Interest Calculator" เดียวกับที่ตัว .exe อยู่ —
  ย้ายทั้งโฟลเดอร์ไปด้วยกันเสมอ อย่าย้ายแค่ไฟล์ .exe อย่างเดียว
