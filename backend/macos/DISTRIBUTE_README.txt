FloorPlan Interest Calculator — macOS (ใช้ภายในองค์กร)
======================================================

สำคัญ: ไฟล์ .zip ไม่ใช่แอp — แตก zip ก่อน แล้วค่อยเปิด .app

สิ่งที่อยู่ในโฟลเดอร์ FloorPlan-mac
  • FloorPlan Interest Calculator.app     ← เปิดตัวนี้ (ไอคอนแอpplications)
  • Open-with-Terminal-if-no-window.command  ← ใช้เมื่อ double-click .app แล้วไม่มีหน้าต่าง
  • ไฟล์นี้ (DISTRIBUTE_README.txt)

วิธีใช้ (เครื่องที่รับไฟล์)
  1. Double-click FloorPlan-Interest-Calculator-mac.zip เพื่อแตกไฟล์
  2. เปิดโฟลเดอร์ FloorPlan-mac
  3. ลาก "FloorPlan Interest Calculator.app" ไป Desktop หรือ Applications
     (ลากด้วย Finder — อย่ารันจาก Downloads โดยตรง)
  4. ครั้งแรก: คลิกขวาที่ .app → Open → Open
     (double-click ครั้งแรกมักถูก macOS บล็อกเงียบ ๆ — ไม่มีหน้าต่างขึ้น)
  5. ควรเห็นหน้าต่าง "FloorPlan Interest Calculator"

ถ้า double-click .app แล้วไม่มีอะไรขึ้นเลย
  A) ลองขั้นตอน 4 (คลิกขวา → Open) หรือ System Settings → Privacy & Security → Open Anyway
  B) Double-click "Open-with-Terminal-if-no-window.command" แล้ว copy ข้อความสีแดงส่งให้ทีม build
  C) ดูไฟล์ ~/Desktop/FloorPlan-startup.log (ถ้ามี)

ข้อกำหนดเครื่อง
  • Mac ชิป Apple (M1/M2/M3…) — ไม่รองรับ Mac Intel
  • macOS 11 (Big Sur) ขึ้นไป

ไม่ต้องติดตั้ง Python / Node และไม่ต้องรันไฟล์ .sh ใด ๆ

ข้อมูลของแอp (upload, AR_Outputs, data)
  เก็บในโฟลเดอร์เดียวกับที่วาง .app
