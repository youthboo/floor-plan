# === Standard Library ===
import os
import re
import threading
import subprocess
from datetime import datetime, timedelta
from dateutil.relativedelta import relativedelta
import traceback
import platform

import time


# === Third-Party Libraries ===
import pandas as pd
import webview
from flask import Flask, render_template, request, redirect
from werkzeug.utils import secure_filename
from openpyxl import Workbook
from openpyxl.utils.dataframe import dataframe_to_rows
from openpyxl.worksheet.table import Table, TableStyleInfo
from openpyxl.utils import get_column_letter
from openpyxl.styles import Alignment

# เปิด Flask App
app = Flask(__name__)
app.config['UPLOAD_FOLDER'] = 'uploads'
os.makedirs(app.config['UPLOAD_FOLDER'], exist_ok=True)

# กำหนด config file path
CONFIG_PATH = os.path.join(os.getcwd(), "config", "Rental_Charge_Conditions_v2.xlsx")

# หน้าแรก index สำหรับดึง config และแสดงเงื่อนไข Rate
@app.route("/", methods=["GET"])
def index():
    try:
        df_rate = pd.read_excel(CONFIG_PATH, sheet_name="Rate_By_Day_Range", engine="openpyxl")
        df_subvention = pd.read_excel(CONFIG_PATH, sheet_name="Subvention_Campaign", engine="openpyxl")
        df_config = pd.read_excel(CONFIG_PATH, sheet_name="Config", engine="openpyxl")

        html_table = df_rate.to_html(index=False, classes="table", border=1, justify="center")
        html_subvention_table = df_subvention.to_html(index=False, classes="table", border=1, justify="center")
        html_config_table = df_config.to_html(index=False, classes="table", border=1, justify="center")

        config_dict = dict(zip(df_config['Key'], df_config['Value']))
        month_end_date = pd.to_datetime(config_dict.get("Month End Date"))
        last_month_label = (month_end_date - relativedelta(months=1)).strftime("%b").lower()

        step2_description = "<br>STEP 2: อัปโหลดไฟล์ AR รายเดือน (Detail AR...Month-End)<br>"
        step2_description += "ระบบจะค้นหาชื่อชีท 3 แบบในไฟล์:<br>"
        step2_description += f"&nbsp;&nbsp;- ชีทของเดือนก่อนหน้า เช่น <b>{last_month_label}</b><br>"
        step2_description += "&nbsp;&nbsp;- ชีทที่มีคำว่า <b>new</b><br>"
        step2_description += "&nbsp;&nbsp;- ชีทที่มีคำว่า <b>all</b>"

    except Exception as e:
        html_table = f"<p style='color:red;'>โหลด Rate_By_Day_Range ผิดพลาด: {e}</p>"
        html_subvention_table = ""
        html_config_table = ""
        step2_description = ""

    return render_template(
        "index.html",
        html_table=html_table,
        html_subvention_table=html_subvention_table,
        html_config_table=html_config_table,
        config_path=CONFIG_PATH,
        step2_description=step2_description
    )

@app.route("/upload", methods=["POST"])
def upload():
    if 'ar_file' not in request.files:
        return "No file uploaded", 400

    file = request.files['ar_file']
    if file.filename == '':
        return "No selected file", 400

    filename = secure_filename(file.filename)
    file_path = os.path.join(app.config['UPLOAD_FOLDER'], filename)
    file.save(file_path)

    try:
        xls = pd.ExcelFile(file_path, engine="openpyxl")
        preview_tables = {}

        for sheet_name in xls.sheet_names:
            try:
                # df = pd.read_excel(xls, sheet_name=sheet_name, header=1) # แบบเดิม
                if "penalty" in sheet_name.lower():
                    df = pd.read_excel(xls, sheet_name=sheet_name, header=0)
                else:
                    df = pd.read_excel(xls, sheet_name=sheet_name, header=1)

                df.columns = df.columns.astype(str).str.strip()
                df_preview = df.iloc[:5, :5]
                html_preview = df_preview.to_html(index=False, classes="table", border=1, justify="center")
                preview_tables[sheet_name] = html_preview
            except Exception as e:
                preview_tables[sheet_name] = f"<p style='color:red;'>ไม่สามารถอ่านชีท {sheet_name}: {e}</p>"

    except Exception as e:
        return f"<p style='color:red;'>ไม่สามารถอ่านไฟล์ AR: {e}</p>"

    return render_template("result.html", preview_tables=preview_tables, file_name=filename, file_path=file_path)


@app.route("/calculate", methods=["POST"])
def calculate():
    try:
        file_path = request.form.get("file_path")
        if not file_path or not os.path.exists(file_path):
            return "<p style='color:red;'> ไม่พบไฟล์ AR ที่ส่งมา</p>"

        cond_excel = pd.ExcelFile(CONFIG_PATH, engine="openpyxl")
        df_config = cond_excel.parse("Config")
        config = dict(zip(df_config["Key"], df_config["Value"]))
        month_end_date = pd.to_datetime(config["Month End Date"])
        current_month = month_end_date.strftime("%b%y")
        last_month_label = (month_end_date - relativedelta(months=1)).strftime("%b").lower()

        penalty_rate = float(config.get("Penalty Rate", 15))  # ถ้าไม่มีใน config ใช้ 15% default 

        # 3. Config & Sheet setup
        month_end = pd.to_datetime(config["Month End Date"])
        month_start = month_end.replace(day=1)

        xls = pd.ExcelFile(file_path, engine="openpyxl")
        sheet_names = xls.sheet_names
        sheet_last = next((s for s in sheet_names if last_month_label in s.lower()), None)
        sheet_new = next((s for s in sheet_names if "new" in s.lower()), None)
        sheet_all = next((s for s in sheet_names if "all" in s.lower()), None)

        sheet_penalty = next((s for s in sheet_names if "penalty" in s.lower()), None) 

        df_ar_lastmonth = xls.parse(sheet_last, header=1)
        df_new_volumn = xls.parse(sheet_new, header=1)
        df_all_payment = xls.parse(sheet_all, header=1)

        # ------------------------------
        # STEP 7: เตรียม df_ar_lastmonth
        # ------------------------------
        df_ar_lastmonth.columns = df_ar_lastmonth.columns.astype(str).str.strip()
        required_columns = [
            "Dealer Group", "Dealer Code", "Dealer Name", "Model", "VIN No.",
            "Pre-Vat", "Allocation Date", "Payment Date", "Contract No", "Subvention"]
        available_columns = [col for col in required_columns if col in df_ar_lastmonth.columns]
        df_ar_lastmonth_input = df_ar_lastmonth[available_columns].copy()
        rename_map = {
            "VIN No.": "VIN Number",
            "Pre-Vat": "Price (Ex. Vat)",
            "Contract No": "Contract Number",
            "Subvention": "Subvention Campaign"
            }

        # แก้ Dealer Code ให้เป็น string ไม่ติด .0
        df_ar_lastmonth_input["Dealer Code"] = (
            df_ar_lastmonth_input["Dealer Code"]
            .astype(str)
            .str.replace(r"\.0$", "", regex=True)
            .str.strip()
        )

        df_ar_lastmonth_input.rename(columns=rename_map, inplace=True)

        # -----------------------------
        # STEP 8: เตรียม df_all_payment
        # -----------------------------
        if "VIN No." not in df_all_payment.columns:
            raise ValueError(" ไม่พบคอลัมน์ 'VIN No.' ใน df_all_payment")

        # ตรวจสอบชื่อคอลัมน์วันจ่ายเงิน
        payment_date_column = "Payment Date" if "Payment Date" in df_all_payment.columns else (
            "Date" if "Date" in df_all_payment.columns else None
        )
        if not payment_date_column:
            raise ValueError(" ไม่พบคอลัมน์ 'Payment Date' หรือ 'Date' ใน df_all_payment")

        df_ar_all_payment_input = df_all_payment[["VIN No.", payment_date_column]].copy()
        df_ar_all_payment_input.rename(columns={
            "VIN No.": "VIN Number",
            payment_date_column: "Payment Date"
        }, inplace=True)

        # อ่านชีท Penalty (ถ้ามี)
        if sheet_penalty: 
            df_penalty = xls.parse(sheet_penalty, header=0)
            df_penalty.columns = df_penalty.columns.str.strip()
            df_penalty['VIN Number'] = df_penalty['VIN No.'].astype(str).str.strip() if 'VIN No.' in df_penalty.columns else df_penalty['VIN Number'].astype(str).str.strip()
            df_penalty['Due Date'] = pd.to_datetime(df_penalty['Due Date'], errors='coerce')
            df_penalty = df_penalty[['VIN Number', 'Due Date']].dropna(subset=['Due Date'])
        else:
            df_penalty = pd.DataFrame(columns=['VIN Number', 'Due Date'])  # empty df

        # ---------------------------
        # STEP 9: เตรียม df_new_volumn
        # ---------------------------
        df_new_volumn.columns = df_new_volumn.columns.str.strip().str.replace('\u00A0', ' ', regex=True)

        required_columns_new = [
            "Dealer Group", "Dealer Code", "Dealer Name", "Model", "VIN No.",
            "Pre-Vat", "Allocation Date", "Contract No", "Subvention"
        ]
        available_columns_new = [col for col in required_columns_new if col in df_new_volumn.columns]

        df_ar_new_volumn_input = df_new_volumn[available_columns_new].copy()
        rename_map_new = {
            "VIN No.": "VIN Number",
            "Pre-Vat": "Price (Ex. Vat)",
            "Contract No": "Contract Number",
            "Subvention": "Subvention Campaign"
        }
        df_ar_new_volumn_input.rename(columns=rename_map_new, inplace=True)

        # ---------------------------------------------------
        # STEP 10: รวมข้อมูล Last Month + New Volume + Source
        # ---------------------------------------------------
        df_ar_new_volumn_input["Source"] = "New Volume"
        df_ar_lastmonth_input["Source"] = "AR Last Month"

        df_ar_current_month = pd.concat([df_ar_new_volumn_input, df_ar_lastmonth_input], ignore_index=True)

        # เติม Subvention ที่ว่างให้เป็น 'Normal'
        df_ar_current_month["Subvention Campaign"] = df_ar_current_month["Subvention Campaign"].replace('', 'Normal')
        df_ar_current_month["Subvention Campaign"] = df_ar_current_month["Subvention Campaign"].fillna('Normal')

        # ลบ row ที่ Dealer Group เป็นค่าว่าง
        df_ar_current_month = df_ar_current_month[
            ~(df_ar_current_month["Dealer Group"].isna() |
            (df_ar_current_month["Dealer Group"].astype(str).str.strip() == ''))
        ]

        # รวมข้อมูลจ่ายเงินเข้ามา
        df_ar_current_month = df_ar_current_month.merge(
            df_ar_all_payment_input,
            on="VIN Number",
            how="left"
        )

        # Flag ว่า Paid หรือยัง
        df_ar_current_month["Paid"] = df_ar_current_month["Payment Date"].notna().map({True: 'Y', False: 'N'})

        df_ar_current_month = df_ar_current_month.merge(
            df_penalty,
            on='VIN Number',
            how='left'
        )

        # --- JOIN WAIVE (เฉพาะที่ approved == Y) ---
        df_waive = pd.DataFrame(
            columns=[
                "Dealer Code",
                "Dealer Name",
                "VIN Number",
                "waive amount",
                "reason",
                "approved"
            ]
        )


        df_ar_current_month = df_ar_current_month.merge(
            df_waive[['Dealer Code', 'VIN Number', 'waive amount', 'reason']],
            on=['Dealer Code', 'VIN Number'],
            how='left'
        )
        df_ar_current_month['waive amount'] = df_ar_current_month['waive amount'].fillna(0)

        # ====== Step: Prepare Rate/Campaign Logic ======
        df_rate = cond_excel.parse("Rate_By_Day_Range")
        df_rate.columns = df_rate.columns.str.strip()
        df_rate.rename(columns={
            "Start Day": "StartDay",
            "End Day": "EndDay",
            "Rate (%)": "Rate"
        }, inplace=True)
        df_subvention = cond_excel.parse("Subvention_Campaign")
        df_rate.columns = df_rate.columns.str.strip()
        df_subvention.columns = df_subvention.columns.str.strip()
        rate_ranges = df_rate.to_dict("records")
        subvention_map = df_subvention.set_index("Campaign Name")["Free Days"].to_dict()
        df_ar_current_month["Free Days"] = df_ar_current_month["Subvention Campaign"].map(subvention_map).fillna(0)

        # ====== Calculation ======
        def calculate_detailed_charge(row):
            price = float(row.get("Price (Ex. Vat)", 0))
            alloc_date = pd.to_datetime(row["Allocation Date"], errors="coerce")
            paid_date  = pd.to_datetime(row["Payment Date"], errors="coerce")
            free_days  = int(row.get("Free Days", 0))

            # ✅ เพิ่มบรรทัดนี้
            due_date = pd.to_datetime(row.get("Due Date"), errors="coerce")

            if pd.isna(alloc_date):
                return pd.Series([0.0, 0.0, 0.0, 0.0, "", "", 0, 0])

            free_day_actual_end = alloc_date + timedelta(days=free_days - 1)
            last_free_day = min(free_day_actual_end, month_end)
            ram_charge_days = pd.date_range(alloc_date, last_free_day, freq='D')
            ram_charge_freeday_days_this_month = sum([(month_start <= d <= month_end) for d in ram_charge_days])

            ram_charge = 0.0
            ram_desc = {}
            for d in ram_charge_days:
                day_count = (d - alloc_date).days + 1
                applicable_rates = [
                    r for r in rate_ranges
                    if r["StartDay"] <= day_count <= r["EndDay"]
                    and pd.to_datetime(r["EffectiveStart"]) <= d
                    and d <= pd.to_datetime(r["EffectiveEnd"])
                    and r.get("IsActive", True)
                ]
                if month_start <= d <= month_end and applicable_rates:
                    rate_rec = max(applicable_rates, key=lambda r: pd.to_datetime(r["EffectiveStart"]))
                    daily_interest = (price * float(rate_rec["Rate"])) / 36500
                    ram_charge += daily_interest
                    rate_key = f"{rate_rec['StartDay']}-{rate_rec['EndDay']} @ {rate_rec['Rate']}%"
                    ram_desc[rate_key] = ram_desc.get(rate_key, 0) + 1

            if pd.notna(paid_date):
                ram_charge_actual_end = min(paid_date - timedelta(days=1), month_end)
            else:
                ram_charge_actual_end = month_end
            ram_charge_actual_days = pd.date_range(max(alloc_date, month_start), ram_charge_actual_end, freq='D')

            ram_charge_actual = 0.0
            for d in ram_charge_actual_days:
                day_count = (d - alloc_date).days + 1
                applicable_rates = [
                    r for r in rate_ranges
                    if r["StartDay"] <= day_count <= r["EndDay"]
                    and pd.to_datetime(r["EffectiveStart"]) <= d
                    and d <= pd.to_datetime(r["EffectiveEnd"])
                    and r.get("IsActive", True)
                ]
                if applicable_rates:
                    rate_rec = max(applicable_rates, key=lambda r: pd.to_datetime(r["EffectiveStart"]))
                    daily_interest = (price * float(rate_rec["Rate"])) / 36500
                    ram_charge_actual += daily_interest

            dealer_charge = 0.0
            penalty_charge = 0.0
            dealer_desc = {}

            # --- ช่วงที่ 1: Dealer Charge ปกติ (จนถึง Due Date หรือ Payment Date) ---
            dealer_start = alloc_date + timedelta(days=free_days)

            if pd.notna(due_date):
                # มี Due Date → คิด Dealer ถึง Due Date
                if pd.notna(paid_date):
                    dealer_end = min(due_date, paid_date - timedelta(days=1), month_end)
                else:
                    dealer_end = min(due_date, month_end)
            else:
                # ไม่มี Due Date → คิด Dealer ตามเดิม
                if pd.notna(paid_date):
                    dealer_end = min(paid_date - timedelta(days=1), month_end)
                else:
                    dealer_end = month_end

            # คำนวณ Dealer Charge (ใช้ Rate_By_Day_Range เหมือนเดิม)
            if dealer_start <= dealer_end:
                dealer_days = pd.date_range(dealer_start, dealer_end, freq='D')
                for d in dealer_days:
                    day_count = (d - alloc_date).days + 1
                    applicable_rates = [
                        r for r in rate_ranges
                        if r["StartDay"] <= day_count <= r["EndDay"]
                        and pd.to_datetime(r["EffectiveStart"]) <= d
                        and d <= pd.to_datetime(r["EffectiveEnd"])
                        and r.get("IsActive", True)
                    ]
                    if month_start <= d <= month_end and applicable_rates:
                        rate_rec = max(applicable_rates, key=lambda r: pd.to_datetime(r["EffectiveStart"]))
                        daily_interest = (price * float(rate_rec["Rate"])) / 36500
                        dealer_charge += daily_interest
                        rate_key = f"{rate_rec['StartDay']}-{rate_rec['EndDay']} @ {rate_rec['Rate']}%"
                        dealer_desc[rate_key] = dealer_desc.get(rate_key, 0) + 1

            # --- ช่วงที่ 2: Penalty Charge (หลัง Due Date ถึง Payment Date หรือ Month End) ---
            if pd.notna(due_date):
                penalty_start = due_date + timedelta(days=1)
                
                if pd.notna(paid_date):
                    penalty_end = min(paid_date - timedelta(days=1), month_end)
                else:
                    penalty_end = month_end
                
                if penalty_start <= penalty_end:
                    penalty_days = pd.date_range(penalty_start, penalty_end, freq='D')
                    penalty_day_count = sum([1 for d in penalty_days if month_start <= d <= month_end])
                    
                    if penalty_day_count > 0:
                        # คำนวณ Penalty แบบ flat rate
                        daily_penalty = (price * penalty_rate) / 36500
                        penalty_charge = daily_penalty * penalty_day_count
                        dealer_desc["Penalty"] = penalty_day_count  # เพิ่มหมายเหตุ

            # รวม Dealer Charge + Penalty
            total_dealer_charge = dealer_charge + penalty_charge

            ram_desc_txt = ", ".join(f"{v}d: {k}" for k, v in ram_desc.items())

            if pd.notna(paid_date):
                aging = (paid_date - alloc_date).days
            else:
                aging = (month_end - alloc_date).days + 1
            aging = max(aging, 0)

            # สร้าง dealer_desc_txt ที่รวม Penalty (remark)
            dealer_desc_txt = ", ".join(
                f"{v}d: {k}" if k != "Penalty" else f"{v}d: Penalty @ {penalty_rate}%"
                for k, v in dealer_desc.items()
            )

            return pd.Series([
                round(ram_charge, 2),
                round(ram_charge_actual, 2),
                round(total_dealer_charge, 2),  # ← เปลี่ยนเป็น total (รวม penalty)
                ram_charge_freeday_days_this_month,
                ram_desc_txt,
                dealer_desc_txt,  # ← จะมีข้อความ "Xd: Penalty @ 15%" ถ้ามี penalty
                len(ram_charge_actual_days),
                aging
            ])

        df_ar_current_month[
            [
                "RAM Charge", 
                "RAM Charge (bf)", 
                "Dealer Charge", 
                "RAM Charge FreeDay (This Month)", 
                "RAM Rate Summary", 
                "Dealer Rate Summary", 
                "Actual Used Days (This Month)",
                "Aging"
            ]
        ] = df_ar_current_month.apply(calculate_detailed_charge, axis=1)

        # ===== หัก waive =====
        df_ar_current_month['Dealer Charge'] = df_ar_current_month['Dealer Charge'].astype(float)
        df_ar_current_month['Dealer Charge (After Waive)'] = (
            df_ar_current_month['Dealer Charge'] - df_ar_current_month['waive amount'].astype(float)
        ).map('{:,.2f}'.format)
        df_ar_current_month['Dealer Charge'] = df_ar_current_month['Dealer Charge'].map('{:,.2f}'.format)

        # ===== Format และ Export =====
        df_ar_current_month['Dealer Code'] = df_ar_current_month['Dealer Code'].astype(str).str.zfill(5)
        df_ar_current_month['VIN Number'] = df_ar_current_month['VIN Number'].astype(str)
        df_ar_current_month['Dealer Group'] = df_ar_current_month['Dealer Group'].astype(str)
        df_ar_current_month['Dealer Name'] = df_ar_current_month['Dealer Name'].astype(str)
        df_ar_current_month['Model'] = df_ar_current_month['Model'].astype(str)
        df_ar_current_month['Contract Number'] = (
            df_ar_current_month['Contract Number']
            .fillna('')
            .astype(str)
            .str.replace(r'\.0$', '', regex=True)
        )
        df_ar_current_month['Subvention Campaign'] = df_ar_current_month['Subvention Campaign'].astype(str)
        df_ar_current_month['Source'] = df_ar_current_month['Source'].astype(str)
        df_ar_current_month['Paid'] = df_ar_current_month['Paid'].astype(str)

        df_ar_current_month['Allocation Date'] = pd.to_datetime(df_ar_current_month['Allocation Date'], errors='coerce')
        df_ar_current_month['Payment Date'] = pd.to_datetime(df_ar_current_month['Payment Date'], errors='coerce')
        df_ar_current_month['Payment Date Filled'] = (
            pd.to_datetime(df_ar_current_month['Payment Date'], errors='coerce') - pd.Timedelta(days=1)
        ).fillna(month_end)

        df_ar_current_month['Allocation Date'] = df_ar_current_month['Allocation Date'].dt.strftime('%d/%m/%Y')
        df_ar_current_month['Payment Date'] = df_ar_current_month['Payment Date'].fillna(month_end)
        df_ar_current_month['Payment Date'] = df_ar_current_month['Payment Date'].dt.strftime('%d/%m/%Y')
        df_ar_current_month['Price (Ex. Vat)'] = df_ar_current_month['Price (Ex. Vat)'].astype(float).map('{:,.2f}'.format)
        df_ar_current_month["RAM Charge"] = df_ar_current_month['RAM Charge'].astype(float).map('{:,.2f}'.format)
        df_ar_current_month['RAM Charge (bf)'] = df_ar_current_month['RAM Charge (bf)'].astype(float).map('{:,.2f}'.format)
        # Dealer Charge (After Waive) ทำแล้วข้างบน
        # ลบ comma และแปลงเป็น float
        df_ar_current_month['RAM Charge'] = (
            df_ar_current_month['RAM Charge']
            .astype(str)
            .str.replace(',', '', regex=False)
            .astype(float)
        )

        df_ar_current_month['Dealer Charge'] = (
            df_ar_current_month['Dealer Charge']
            .astype(str)
            .str.replace(',', '', regex=False)
            .astype(float)
        )

        # waive amount (ควรไม่มี comma แต่เพื่อความชัวร์)
        df_ar_current_month['waive amount'] = (
            df_ar_current_month['waive amount']
            .astype(str)
            .str.replace(',', '', regex=False)
            .astype(float)
        )

        # แล้วค่อยคำนวณ
# ---- STEP 1: ให้แน่ใจว่าเลขทุกช่องเป็น float ก่อน ----

# ---- STEP 2: คำนวณหลังหัก waive (ยังคงเป็น float อยู่) ----
        df_ar_current_month['RAM Charge (After Waive)'] = (
            df_ar_current_month['RAM Charge'] + df_ar_current_month['waive amount']
        )
        df_ar_current_month['Dealer Charge (After Waive)'] = (
            df_ar_current_month['Dealer Charge'] - df_ar_current_month['waive amount']
        )
        # สร้าง AR Master Code
        df_ar_current_month['AR Master Code'] = df_ar_current_month['Dealer Charge (After Waive)'].apply(
            lambda x: 'RAM Rever Automotive' if x == 0 else 'Charge to Dealer'
        )


        # Summary
        summary = {
            "AR Last Month": df_ar_current_month[df_ar_current_month['Source'] == 'AR Last Month']['Price (Ex. Vat)'].replace(',', '', regex=True).astype(float).sum(),
            "New Volume": df_ar_current_month[df_ar_current_month['Source'] == 'New Volume']['Price (Ex. Vat)'].replace(',', '', regex=True).astype(float).sum(),
            "All Payment (Paid=Y)": df_ar_current_month[df_ar_current_month['Paid'] == 'Y']['Price (Ex. Vat)'].replace(',', '', regex=True).astype(float).sum(),
            "AR Outstanding (Paid=N)": df_ar_current_month[df_ar_current_month['Paid'] == 'N']['Price (Ex. Vat)'].replace(',', '', regex=True).astype(float).sum(),
            "Total": df_ar_current_month['Price (Ex. Vat)'].replace(',', '', regex=True).astype(float).sum()
        }
        summary_df = pd.DataFrame.from_dict(summary, orient='index', columns=['Amount (THB)'])
        summary_df['Amount (THB)'] = summary_df['Amount (THB)'].map('{:,.2f}'.format)

        # === START SUMMARY CALC ===

        # --- สรุปยอดราย dealer และ RAM (Dealer Rental Summary) ---
        df_rental = df_ar_current_month.copy()
        for col in ['RAM Charge (After Waive)', 'Dealer Charge (After Waive)']:
            df_rental[col] = df_rental[col].replace(',', '', regex=True).astype(float)

        # แยกข้อมูลที่เป็นของ RAM และ Dealer
        df_ram = df_rental[df_rental['RAM Charge (After Waive)'] > 0].copy()
        df_dealer = df_rental[df_rental['Dealer Charge (After Waive)'] > 0].copy()

        # คำนวณสรุปยอดสำหรับ RAM
        df_ram['AR Master code'] = 'RAM Rever Automotive'
        df_ram['Amount per calculation'] = df_ram['RAM Charge (After Waive)']
        df_ram['Waive'] = df_ram['waive amount']
        df_ram['WHT'] = df_ram['Amount per calculation'] * 0.03   # หักภาษี ณ ที่จ่าย 3%
        df_ram['VAT'] = df_ram['Amount per calculation'] * 0.07   # ภาษีมูลค่าเพิ่ม 7%
        df_ram['Total receivable'] = df_ram['Amount per calculation'] - df_ram['WHT'] + df_ram['VAT']
        df_ram['Total'] = df_ram['Amount per calculation'] + df_ram['VAT']

        # คำนวณสรุปยอดสำหรับ Dealer
        df_dealer['AR Master code'] = 'Charge to Dealer'
        df_dealer['Amount per calculation'] = df_dealer['Dealer Charge (After Waive)']
        df_dealer['Waive'] = df_dealer['waive amount']
        df_dealer['WHT'] = df_dealer['Amount per calculation'] * 0.05   # หักภาษี ณ ที่จ่าย 5%
        df_dealer['VAT'] = df_dealer['Amount per calculation'] * 0.07
        df_dealer['Total receivable'] = df_dealer['Amount per calculation'] - df_dealer['WHT'] + df_dealer['VAT']
        df_dealer['Total'] = df_dealer['Amount per calculation'] + df_dealer['VAT']

        # จัดลำดับคอลัมน์ให้ตรงกันทั้งสองฝั่ง (Dealer/RAM)
        summary_cols = [
            'Dealer Group', 'Dealer Code', 'Dealer Name', 'AR Master code', 
            'Amount per calculation', 'Waive', 'WHT', 'VAT', 'Total receivable', 'Total'
        ]
        df_dealer_summary = df_dealer[summary_cols].copy()
        df_ram_summary = df_ram[summary_cols].copy()

        # รวมข้อมูลของทั้ง Dealer และ RAM เข้าด้วยกัน
        group_cols = ['Dealer Group', 'Dealer Code', 'Dealer Name', 'AR Master code']
        sum_cols = ['Amount per calculation', 'Waive', 'WHT', 'VAT', 'Total receivable', 'Total']

        df_ram_summary = (
            df_ram[summary_cols]
            .groupby(group_cols, as_index=False)[sum_cols]
            .sum()
            .sort_values(group_cols)
            .reset_index(drop=True)
        )
        
        df_dealer_summary = (
            df_dealer[summary_cols]
            .groupby(group_cols, as_index=False)[sum_cols]
            .sum()
            .sort_values(group_cols)
            .reset_index(drop=True)
        )

        df_ram_summary
        df_dealer_summary

        df_rental_summary = pd.concat(
        [df_dealer_summary, df_ram_summary], 
            ignore_index=True)
                        # 3. สร้างฟังก์ชันสำหรับเพิ่มบรรทัดรวม Total
        def _sum_row(label, df):
            """
            สร้างแถว summary รวมยอดของแต่ละกลุ่ม (Total)
            label: ชื่อที่จะแสดงในคอลัมน์ Dealer Name (เช่น 'Total Charge to Dealer')
            df: DataFrame ที่จะรวมยอด
            """
            sums = df[sum_cols].sum()
            return pd.Series({
                'Dealer Group': '',
                'Dealer Code': '',
                'Dealer Name': label,
                'AR Master code': '',
                'Amount per calculation': sums['Amount per calculation'],
                'Waive': sums['Waive'],
                'WHT': sums['WHT'],
                'VAT': sums['VAT'],
                'Total receivable': sums['Total receivable'],
                'Total': sums['Total'],
            })

        # 4. เพิ่มบรรทัด Total Summary 2 บรรทัด (Charge to Dealer และ RAM Rever Automotive)
        df_rental_summary = pd.concat([
            df_rental_summary,
            pd.DataFrame([
                _sum_row('Total Charge to Dealer', df_dealer_summary),
                _sum_row('Total RAM Rever Automotive', df_ram_summary)
            ])
        ], ignore_index=True)



        # ===== สร้าง Workbook และ Sheet =====
        wb = Workbook()

        # 1. Summary Sheet
        ws_summary = wb.active
        ws_summary.title = "Summary"
        for r in dataframe_to_rows(summary_df.reset_index().rename(columns={"index": "Description"}), index=False, header=True):
            ws_summary.append(r)
 
        

        # 2. AR Detail Sheet
        desired_order = [
            'Dealer Group', 'Dealer Code', 'Dealer Name', 'Model', 'VIN Number', 'Price (Ex. Vat)',
            'Allocation Date', 'Contract Number', 'Subvention Campaign', 'Source', 'Payment Date',
            'Paid', 'Free Days', 'Due Date', 'Aging', 'RAM Charge FreeDay (This Month)', "RAM Charge (bf)",
            'RAM Charge', 'Dealer Charge', 'waive amount', 'RAM Charge (After Waive)',
            'Dealer Charge (After Waive)', 'RAM Rate Summary', 'Dealer Rate Summary', 'reason'
        ]
        df_ar_current_month = df_ar_current_month[[col for col in desired_order if col in df_ar_current_month.columns]]
        # และต้อง Format Due Date ให้เป็น string
        df_ar_current_month['Due Date'] = pd.to_datetime(df_ar_current_month['Due Date'], errors='coerce')
        df_ar_current_month['Due Date'] = df_ar_current_month['Due Date'].dt.strftime('%d/%m/%Y')
        df_ar_current_month['Due Date'] = df_ar_current_month['Due Date'].replace('NaT', '')  # ถ้าไม่มีให้เป็นค่าว่าง

        ws_detail = wb.create_sheet(title="AR Detail")
        for r in dataframe_to_rows(df_ar_current_month, index=False, header=True):
            ws_detail.append(r)



        # 3. Dealer Summary Sheet
        ws_dealer_summary = wb.create_sheet(title="Dealer Summary")
        for r in dataframe_to_rows(df_rental_summary, index=False, header=True):
            ws_dealer_summary.append(r)

        # ใส่ Table Format สวยงาม
        def add_table(ws, table_name):
            last_col = ws.max_column
            last_row = ws.max_row
            last_col_letter = get_column_letter(last_col)
            tab = Table(displayName=table_name, ref=f"A1:{last_col_letter}{last_row}")
            style = TableStyleInfo(name="TableStyleMedium9", showRowStripes=True)
            tab.tableStyleInfo = style
            ws.add_table(tab)

        add_table(ws_summary, "SummaryTable")
        add_table(ws_detail, "DetailTable")
        add_table(ws_dealer_summary, "DealerSummaryTable")

        # ฟังก์ชันจัดคอลัมน์ตัวเลขให้ align ขวา และแสดงทศนิยม
        def format_currency_column(ws, col_name):
            for cell in ws[1]:
                if cell.value == col_name:
                    col_letter = cell.column_letter
                    for row in range(2, ws.max_row + 1):
                        cell = ws[f"{col_letter}{row}"]
                        cell.number_format = '#,##0.00'
                        cell.alignment = Alignment(horizontal='right')

        # ใช้ฟังก์ชันจัด format กับแต่ละชีท
        # ==== 1. ws_summary ====
        for col in [
            'Amount (THB)'
        ]:
            format_currency_column(ws_summary, col)

        # ==== 2. ws_detail ====
        for col in [
            'Price (Ex. Vat)', 
            'RAM Charge (bf)', 
            'RAM Charge', 
            'Dealer Charge',
            'waive amount',
            'RAM Charge (After Waive)', 
            'Dealer Charge (After Waive)'
        ]:
            format_currency_column(ws_detail, col)

        # ==== 3. ws_dealer_summary ====
        for col in [
            'Amount per calculation', 
            'Waive', 
            'WHT', 
            'VAT', 
            'Total receivable', 
            'Total'
        ]:
            format_currency_column(ws_dealer_summary, col)

        # ขยายความกว้างคอลัมน์ให้เหมาะสม
        for ws in [ws_summary, ws_detail, ws_dealer_summary]:
            for column_cells in ws.columns:
                max_len = max(len(str(cell.value)) if cell.value else 0 for cell in column_cells)
                ws.column_dimensions[get_column_letter(column_cells[0].column)].width = max_len + 2

        # บันทึกและดาวน์โหลดไฟล์ Excel
        month_str = month_end.strftime('%b')
        year_str = month_end.strftime('%Y')
        now = datetime.now()
        timestamp_str = now.strftime('%Y%m%d_%H%M%S')  # เช่น 20250708_134920

        # สร้างโฟลเดอร์ปลายทาง (ถ้ายังไม่มี)
        output_folder = os.path.join(os.getcwd(), "AR_Outputs")
        os.makedirs(output_folder, exist_ok=True)

        # สร้างชื่อไฟล์ พร้อม datetime stamp
        output_filename = f"AR_Summary_{month_str}{year_str}_{timestamp_str}.xlsx"
        output_path = os.path.join(output_folder, output_filename)

        # บันทึกลงโฟลเดอร์ที่ต้องการ
        wb.save(output_path)

        # (ไม่ต้อง files.download ถ้าเป็น local script บน Windows)
        
        # เตรียม summary_df ให้แสดงสวยใน HTML
        summary_df_display = summary_df.reset_index().rename(columns={"index": "หมวดรายการ"})
        summary_html = summary_df_display.to_html(
            index=False,
            border=1,
            classes="summary-table",
            justify="center"
        )
 # ส่งข้อความสรุปผลกลับ
        return f"""
                <style>
                    body {{
                        font-family: 'Segoe UI', sans-serif;
                        color: #222;
                    }}
                    .summary-table {{
                        border-collapse: collapse;
                        width: 500px;
                        margin-top: 10px;
                    }}
                    .summary-table th {{
                        background-color: #003366;
                        color: white;
                        padding: 8px;
                        text-align: center;
                    }}
                    .summary-table td {{
                        padding: 6px;
                        text-align: right;
                        border: 1px solid #ccc;
                    }}
                    .summary-table td:first-child {{
                        text-align: left;
                    }}
                    .link-button {{
                        display: inline-block;
                        background-color: #0d47a1;
                        color: white;
                        padding: 10px 18px;
                        border-radius: 6px;
                        text-decoration: none;
                        font-weight: bold;
                        margin-top: 10px;
                    }}
                </style>

                <p>
                ✔ <b>วันที่สิ้นงวดบัญชี:</b> {month_end_date.strftime('%d/%m/%Y')}<br><br>

                📄 <b>พบข้อมูลจากชีทในไฟล์ที่อัปโหลดดังนี้:</b><br>
                • {sheet_last} — จำนวน {df_ar_lastmonth.shape[0]:,} รายการ<br>
                • {sheet_new} — จำนวน {df_new_volumn.shape[0]:,} รายการ<br>
                • {sheet_all} — จำนวน {df_all_payment.shape[0]:,} รายการ<br>
                • {sheet_penalty if sheet_penalty else 'ไม่มี Penalty Sheet'} — จำนวน {df_penalty.shape[0]:,} รายการ<br> 
                • ข้อมูล AR รวม (df_ar_current_month) — จำนวน {df_ar_current_month.shape[0]:,} รายการ
                </p>

                <p><b> สรุปยอดรวม (THB):</b></p>
                {summary_html}

                <p><b> ไฟล์ผลลัพธ์ถูกบันทึกไว้ที่:</b><br>
                <code>{output_path}</code><br><br>

                <a href="/open-output-folder" class="link-button"> เปิดโฟลเดอร์ AR_Outputs</a>
                </p>
                """





    except Exception as e:
        return f"<p style='color:red;'> เกิดข้อผิดพลาดในการคำนวณ:<br><pre>{traceback.format_exc()}</pre></p>"


@app.route("/calculate_with_waive", methods=["POST"])
def calculate_with_waive():
    try:
        
        # 1. เลือกไฟล์ AR ล่าสุดใน uploads
        ar_folder = os.path.join(os.getcwd(), "uploads")
        ar_files = [
            os.path.join(ar_folder, f)
            for f in os.listdir(ar_folder)
            if f.lower().endswith((".xlsx", ".xls"))
        ]
        if not ar_files:
            return "<p style='color:red;'>ไม่พบไฟล์ AR ใน uploads</p>"
        file_path = max(ar_files, key=os.path.getmtime)

        # 2. Waive file (ส่งมาทาง form)
        waive_file_path = request.form.get("waive_file_path")
        if not waive_file_path or not os.path.exists(waive_file_path):
            return "<p style='color:red;'> ไม่พบไฟล์ Waive ที่ส่งมา</p>"

        # 3. Config & Sheet setup
        cond_excel = pd.ExcelFile(CONFIG_PATH, engine="openpyxl")
        df_config = cond_excel.parse("Config")
        config = dict(zip(df_config["Key"], df_config["Value"]))
        penalty_rate = float(config.get("Penalty Rate", 15))
        month_end_date = pd.to_datetime(config["Month End Date"])
        last_month_label = (month_end_date - relativedelta(months=1)).strftime("%b").lower()
        month_end = pd.to_datetime(config["Month End Date"])
        month_start = month_end.replace(day=1)

        xls = pd.ExcelFile(file_path, engine="openpyxl")
        sheet_names = xls.sheet_names
        sheet_last = next((s for s in sheet_names if last_month_label in s.lower()), None)
        sheet_new = next((s for s in sheet_names if "new" in s.lower()), None)
        sheet_all = next((s for s in sheet_names if "all" in s.lower()), None)
        sheet_penalty = next((s for s in sheet_names if "penalty" in s.lower()), None)

        df_ar_lastmonth = xls.parse(sheet_last, header=1)
        df_new_volumn = xls.parse(sheet_new, header=1)
        df_all_payment = xls.parse(sheet_all, header=1)

        xls = pd.ExcelFile(file_path, engine="openpyxl")
        sheet_names = xls.sheet_names
        sheet_last = next((s for s in sheet_names if last_month_label in s.lower()), None)
        sheet_new = next((s for s in sheet_names if "new" in s.lower()), None)
        sheet_all = next((s for s in sheet_names if "all" in s.lower()), None)
        sheet_penalty = next((s for s in sheet_names if "penalty" in s.lower()), None)

        df_ar_lastmonth = xls.parse(sheet_last, header=1)
        df_new_volumn = xls.parse(sheet_new, header=1)
        df_all_payment = xls.parse(sheet_all, header=1)
        

        # อ่านชีท Penalty (ถ้ามี)
        if sheet_penalty:
            df_penalty.columns = df_penalty.columns.str.strip()
            df_penalty['VIN Number'] = df_penalty['VIN No.'].astype(str).str.strip() if 'VIN No.' in df_penalty.columns else df_penalty['VIN Number'].astype(str).str.strip()
            df_penalty['Due Date'] = pd.to_datetime(df_penalty['Due Date'], errors='coerce')
            df_penalty = df_penalty[['VIN Number', 'Due Date']].dropna(subset=['Due Date'])
        else:
            df_penalty = pd.DataFrame(columns=['VIN Number', 'Due Date'])

        # --- เตรียมข้อมูล AR ---
        df_ar_lastmonth.columns = df_ar_lastmonth.columns.astype(str).str.strip()
        required_columns = [
            "Dealer Group", "Dealer Code", "Dealer Name", "Model", "VIN No.",
            "Pre-Vat", "Allocation Date", "Payment Date", "Contract No", "Subvention"]
        available_columns = [col for col in required_columns if col in df_ar_lastmonth.columns]
        df_ar_lastmonth_input = df_ar_lastmonth[available_columns].copy()
        rename_map = {
            "VIN No.": "VIN Number",
            "Pre-Vat": "Price (Ex. Vat)",
            "Contract No": "Contract Number",
            "Subvention": "Subvention Campaign"
        }
        df_ar_lastmonth_input["Dealer Code"] = (
            df_ar_lastmonth_input["Dealer Code"]
            .astype(str)
            .str.replace(r"\.0$", "", regex=True)
            .str.strip()
        )
        df_ar_lastmonth_input.rename(columns=rename_map, inplace=True)

        if "VIN No." not in df_all_payment.columns:
            raise ValueError("ไม่พบคอลัมน์ 'VIN No.' ใน df_all_payment")
        payment_date_column = "Payment Date" if "Payment Date" in df_all_payment.columns else (
            "Date" if "Date" in df_all_payment.columns else None
        )
        if not payment_date_column:
            raise ValueError("ไม่พบคอลัมน์ 'Payment Date' หรือ 'Date' ใน df_all_payment")

        df_ar_all_payment_input = df_all_payment[["VIN No.", payment_date_column]].copy()
        df_ar_all_payment_input.rename(columns={
            "VIN No.": "VIN Number",
            payment_date_column: "Payment Date"
        }, inplace=True)

        df_new_volumn.columns = df_new_volumn.columns.str.strip().str.replace('\u00A0', ' ', regex=True)
        required_columns_new = [
            "Dealer Group", "Dealer Code", "Dealer Name", "Model", "VIN No.",
            "Pre-Vat", "Allocation Date", "Contract No", "Subvention"
        ]
        available_columns_new = [col for col in required_columns_new if col in df_new_volumn.columns]
        df_ar_new_volumn_input = df_new_volumn[available_columns_new].copy()
        rename_map_new = {
            "VIN No.": "VIN Number",
            "Pre-Vat": "Price (Ex. Vat)",
            "Contract No": "Contract Number",
            "Subvention": "Subvention Campaign"
        }
        df_ar_new_volumn_input.rename(columns=rename_map_new, inplace=True)
        df_ar_new_volumn_input["Source"] = "New Volume"
        df_ar_lastmonth_input["Source"] = "AR Last Month"
        df_ar_current_month = pd.concat([df_ar_new_volumn_input, df_ar_lastmonth_input], ignore_index=True)

        df_ar_current_month["Subvention Campaign"] = df_ar_current_month["Subvention Campaign"].replace('', 'Normal')
        df_ar_current_month["Subvention Campaign"] = df_ar_current_month["Subvention Campaign"].fillna('Normal')
        df_ar_current_month = df_ar_current_month[
            ~(df_ar_current_month["Dealer Group"].isna() |
              (df_ar_current_month["Dealer Group"].astype(str).str.strip() == ''))
        ]
        df_ar_current_month = df_ar_current_month.merge(
            df_ar_all_payment_input,
            on="VIN Number",
            how="left"
        )
        df_ar_current_month["Paid"] = df_ar_current_month["Payment Date"].notna().map({True: 'Y', False: 'N'})

        # รวม Due Date จากชีท Penalty
        df_ar_current_month = df_ar_current_month.merge(
            df_penalty,
            on='VIN Number',
            how='left'
        )

        # --- JOIN WAIVE (เฉพาะที่ approved == Y) ---
        df_waive = pd.read_excel(waive_file_path)
        df_waive["Dealer Code"] = df_waive["Dealer Code"].astype(str).str.strip()
        df_waive["VIN Number"] = df_waive["VIN Number"].astype(str).str.strip()
        df_waive = df_waive[df_waive['approved'].astype(str).str.upper() == 'Y']
        df_waive['waive amount'] = df_waive['waive amount'].fillna(0)

        df_ar_current_month = df_ar_current_month.merge(
            df_waive[['Dealer Code', 'VIN Number', 'waive amount', 'reason']],
            on=['Dealer Code', 'VIN Number'],
            how='left'
        )
        df_ar_current_month['waive amount'] = df_ar_current_month['waive amount'].fillna(0)

        # ====== Step: Prepare Rate/Campaign Logic ======
        df_rate = cond_excel.parse("Rate_By_Day_Range")
        df_rate.columns = df_rate.columns.str.strip()
        df_rate.rename(columns={
            "Start Day": "StartDay",
            "End Day": "EndDay",
            "Rate (%)": "Rate"
        }, inplace=True)
        df_subvention = cond_excel.parse("Subvention_Campaign")
        df_rate.columns = df_rate.columns.str.strip()
        df_subvention.columns = df_subvention.columns.str.strip()
        rate_ranges = df_rate.to_dict("records")
        subvention_map = df_subvention.set_index("Campaign Name")["Free Days"].to_dict()
        df_ar_current_month["Free Days"] = df_ar_current_month["Subvention Campaign"].map(subvention_map).fillna(0)

        # ====== Calculation ======
        def calculate_detailed_charge(row):
            price = float(row.get("Price (Ex. Vat)", 0))
            alloc_date = pd.to_datetime(row["Allocation Date"], errors="coerce")
            paid_date  = pd.to_datetime(row["Payment Date"], errors="coerce")
            free_days  = int(row.get("Free Days", 0))
            due_date = pd.to_datetime(row.get("Due Date"), errors="coerce")

            if pd.isna(alloc_date):
                return pd.Series([0.0, 0.0, 0.0, 0.0, "", "", 0, 0])

            free_day_actual_end = alloc_date + timedelta(days=free_days - 1)
            last_free_day = min(free_day_actual_end, month_end)
            ram_charge_days = pd.date_range(alloc_date, last_free_day, freq='D')
            ram_charge_freeday_days_this_month = sum([(month_start <= d <= month_end) for d in ram_charge_days])

            ram_charge = 0.0
            ram_desc = {}
            for d in ram_charge_days:
                day_count = (d - alloc_date).days + 1
                applicable_rates = [
                    r for r in rate_ranges
                    if r["StartDay"] <= day_count <= r["EndDay"]
                    and pd.to_datetime(r["EffectiveStart"]) <= d
                    and d <= pd.to_datetime(r["EffectiveEnd"])
                    and r.get("IsActive", True)
                ]
                if month_start <= d <= month_end and applicable_rates:
                    rate_rec = max(applicable_rates, key=lambda r: pd.to_datetime(r["EffectiveStart"]))
                    daily_interest = (price * float(rate_rec["Rate"])) / 36500
                    ram_charge += daily_interest
                    rate_key = f"{rate_rec['StartDay']}-{rate_rec['EndDay']} @ {rate_rec['Rate']}%"
                    ram_desc[rate_key] = ram_desc.get(rate_key, 0) + 1

            if pd.notna(paid_date):
                ram_charge_actual_end = min(paid_date - timedelta(days=1), month_end)
            else:
                ram_charge_actual_end = month_end
            ram_charge_actual_days = pd.date_range(max(alloc_date, month_start), ram_charge_actual_end, freq='D')

            ram_charge_actual = 0.0
            for d in ram_charge_actual_days:
                day_count = (d - alloc_date).days + 1
                applicable_rates = [
                    r for r in rate_ranges
                    if r["StartDay"] <= day_count <= r["EndDay"]
                    and pd.to_datetime(r["EffectiveStart"]) <= d
                    and d <= pd.to_datetime(r["EffectiveEnd"])
                    and r.get("IsActive", True)
                ]
                if applicable_rates:
                    rate_rec = max(applicable_rates, key=lambda r: pd.to_datetime(r["EffectiveStart"]))
                    daily_interest = (price * float(rate_rec["Rate"])) / 36500
                    ram_charge_actual += daily_interest

            dealer_charge = 0.0
            penalty_charge = 0.0
            dealer_desc = {}

            # --- ช่วงที่ 1: Dealer Charge ปกติ (จนถึง Due Date หรือ Payment Date) ---
            dealer_start = alloc_date + timedelta(days=free_days)

            if pd.notna(due_date):
                if pd.notna(paid_date):
                    dealer_end = min(due_date, paid_date - timedelta(days=1), month_end)
                else:
                    dealer_end = min(due_date, month_end)
            else:
                if pd.notna(paid_date):
                    dealer_end = min(paid_date - timedelta(days=1), month_end)
                else:
                    dealer_end = month_end

            if dealer_start <= dealer_end:
                dealer_days = pd.date_range(dealer_start, dealer_end, freq='D')
                for d in dealer_days:
                    day_count = (d - alloc_date).days + 1
                    applicable_rates = [
                        r for r in rate_ranges
                        if r["StartDay"] <= day_count <= r["EndDay"]
                        and pd.to_datetime(r["EffectiveStart"]) <= d
                        and d <= pd.to_datetime(r["EffectiveEnd"])
                        and r.get("IsActive", True)
                    ]
                    if month_start <= d <= month_end and applicable_rates:
                        rate_rec = max(applicable_rates, key=lambda r: pd.to_datetime(r["EffectiveStart"]))
                        daily_interest = (price * float(rate_rec["Rate"])) / 36500
                        dealer_charge += daily_interest
                        rate_key = f"{rate_rec['StartDay']}-{rate_rec['EndDay']} @ {rate_rec['Rate']}%"
                        dealer_desc[rate_key] = dealer_desc.get(rate_key, 0) + 1

            # --- ช่วงที่ 2: Penalty (หลัง Due Date) ---
            if pd.notna(due_date):
                penalty_start = due_date + timedelta(days=1)
                if pd.notna(paid_date):
                    penalty_end = min(paid_date - timedelta(days=1), month_end)
                else:
                    penalty_end = month_end
                if penalty_start <= penalty_end:
                    penalty_days = pd.date_range(penalty_start, penalty_end, freq='D')
                    penalty_day_count = sum([1 for d in penalty_days if month_start <= d <= month_end])
                    if penalty_day_count > 0:
                        daily_penalty = (price * penalty_rate) / 36500
                        penalty_charge = daily_penalty * penalty_day_count
                        dealer_desc["Penalty"] = penalty_day_count

            total_dealer_charge = dealer_charge + penalty_charge

            ram_desc_txt = ", ".join(f"{v}d: {k}" for k, v in ram_desc.items())
            dealer_desc_txt = ", ".join(
                f"{v}d: {k}" if k != "Penalty" else f"{v}d: Penalty @ {penalty_rate}%" for k, v in dealer_desc.items()
            )

            if pd.notna(paid_date):
                aging = (paid_date - alloc_date).days
            else:
                aging = (month_end - alloc_date).days + 1
            aging = max(aging, 0)

            return pd.Series([
                round(ram_charge, 2),
                round(ram_charge_actual, 2),
                round(total_dealer_charge, 2),
                ram_charge_freeday_days_this_month,
                ram_desc_txt,
                dealer_desc_txt,
                len(ram_charge_actual_days),
                aging
            ])

        df_ar_current_month[
            [
                "RAM Charge", 
                "RAM Charge (bf)", 
                "Dealer Charge", 
                "RAM Charge FreeDay (This Month)", 
                "RAM Rate Summary", 
                "Dealer Rate Summary", 
                "Actual Used Days (This Month)",
                "Aging"
            ]
        ] = df_ar_current_month.apply(calculate_detailed_charge, axis=1)

        # ===== หัก waive =====
        df_ar_current_month['Dealer Charge'] = df_ar_current_month['Dealer Charge'].astype(float)
        df_ar_current_month['Dealer Charge (After Waive)'] = (
            df_ar_current_month['Dealer Charge'] - df_ar_current_month['waive amount'].astype(float)
        ).map('{:,.2f}'.format)
        df_ar_current_month['Dealer Charge'] = df_ar_current_month['Dealer Charge'].map('{:,.2f}'.format)

        # ===== Format และ Export =====
        df_ar_current_month['Dealer Code'] = df_ar_current_month['Dealer Code'].astype(str).str.zfill(5)
        df_ar_current_month['VIN Number'] = df_ar_current_month['VIN Number'].astype(str)
        df_ar_current_month['Dealer Group'] = df_ar_current_month['Dealer Group'].astype(str)
        df_ar_current_month['Dealer Name'] = df_ar_current_month['Dealer Name'].astype(str)
        df_ar_current_month['Model'] = df_ar_current_month['Model'].astype(str)
        df_ar_current_month['Contract Number'] = (
            df_ar_current_month['Contract Number']
            .fillna('')
            .astype(str)
            .str.replace(r'\.0$', '', regex=True)
        )
        df_ar_current_month['Subvention Campaign'] = df_ar_current_month['Subvention Campaign'].astype(str)
        df_ar_current_month['Source'] = df_ar_current_month['Source'].astype(str)
        df_ar_current_month['Paid'] = df_ar_current_month['Paid'].astype(str)

        df_ar_current_month['Allocation Date'] = pd.to_datetime(df_ar_current_month['Allocation Date'], errors='coerce')
        df_ar_current_month['Payment Date'] = pd.to_datetime(df_ar_current_month['Payment Date'], errors='coerce')
        df_ar_current_month['Payment Date Filled'] = (
            pd.to_datetime(df_ar_current_month['Payment Date'], errors='coerce') - pd.Timedelta(days=1)
        ).fillna(month_end)

        df_ar_current_month['Allocation Date'] = df_ar_current_month['Allocation Date'].dt.strftime('%d/%m/%Y')
        df_ar_current_month['Payment Date'] = df_ar_current_month['Payment Date'].fillna(month_end)
        df_ar_current_month['Payment Date'] = df_ar_current_month['Payment Date'].dt.strftime('%d/%m/%Y')
        df_ar_current_month['Price (Ex. Vat)'] = df_ar_current_month['Price (Ex. Vat)'].astype(float).map('{:,.2f}'.format)
        df_ar_current_month["RAM Charge"] = df_ar_current_month['RAM Charge'].astype(float).map('{:,.2f}'.format)
        df_ar_current_month['RAM Charge (bf)'] = df_ar_current_month['RAM Charge (bf)'].astype(float).map('{:,.2f}'.format)
        # Dealer Charge (After Waive) ทำแล้วข้างบน
        # ลบ comma และแปลงเป็น float
        df_ar_current_month['RAM Charge'] = (
            df_ar_current_month['RAM Charge']
            .astype(str)
            .str.replace(',', '', regex=False)
            .astype(float)
        )

        df_ar_current_month['Dealer Charge'] = (
            df_ar_current_month['Dealer Charge']
            .astype(str)
            .str.replace(',', '', regex=False)
            .astype(float)
        )

        # waive amount (ควรไม่มี comma แต่เพื่อความชัวร์)
        df_ar_current_month['waive amount'] = (
            df_ar_current_month['waive amount']
            .astype(str)
            .str.replace(',', '', regex=False)
            .astype(float)
        )

        # แล้วค่อยคำนวณ
        # ---- STEP 1: ให้แน่ใจว่าเลขทุกช่องเป็น float ก่อน ----

        # ---- STEP 2: คำนวณหลังหัก waive (ยังคงเป็น float อยู่) ----
        df_ar_current_month['RAM Charge (After Waive)'] = (
            df_ar_current_month['RAM Charge'] + df_ar_current_month['waive amount']
        )
        df_ar_current_month['Dealer Charge (After Waive)'] = (
            df_ar_current_month['Dealer Charge'] - df_ar_current_month['waive amount']
        )
        # สร้าง AR Master Code
        df_ar_current_month['AR Master Code'] = df_ar_current_month['Dealer Charge (After Waive)'].apply(
            lambda x: 'RAM Rever Automotive' if x == 0 else 'Charge to Dealer'
        )


        # Summary
        summary = {
            "AR Last Month": df_ar_current_month[df_ar_current_month['Source'] == 'AR Last Month']['Price (Ex. Vat)'].replace(',', '', regex=True).astype(float).sum(),
            "New Volume": df_ar_current_month[df_ar_current_month['Source'] == 'New Volume']['Price (Ex. Vat)'].replace(',', '', regex=True).astype(float).sum(),
            "All Payment (Paid=Y)": df_ar_current_month[df_ar_current_month['Paid'] == 'Y']['Price (Ex. Vat)'].replace(',', '', regex=True).astype(float).sum(),
            "AR Outstanding (Paid=N)": df_ar_current_month[df_ar_current_month['Paid'] == 'N']['Price (Ex. Vat)'].replace(',', '', regex=True).astype(float).sum(),
            "Total": df_ar_current_month['Price (Ex. Vat)'].replace(',', '', regex=True).astype(float).sum()
        }
        summary_df = pd.DataFrame.from_dict(summary, orient='index', columns=['Amount (THB)'])
        summary_df['Amount (THB)'] = summary_df['Amount (THB)'].map('{:,.2f}'.format)

        # === START SUMMARY CALC ===

        # --- สรุปยอดราย dealer และ RAM (Dealer Rental Summary) ---
        df_rental = df_ar_current_month.copy()
        for col in ['RAM Charge (After Waive)', 'Dealer Charge (After Waive)']:
            df_rental[col] = df_rental[col].replace(',', '', regex=True).astype(float)

        # แยกข้อมูลที่เป็นของ RAM และ Dealer
        df_ram = df_rental[df_rental['RAM Charge (After Waive)'] > 0].copy()
        df_dealer = df_rental[df_rental['Dealer Charge (After Waive)'] > 0].copy()

        # คำนวณสรุปยอดสำหรับ RAM
        df_ram['AR Master code'] = 'RAM Rever Automotive'
        df_ram['Amount per calculation'] = df_ram['RAM Charge (After Waive)']
        df_ram['Waive'] = df_ram['waive amount']
        df_ram['WHT'] = df_ram['Amount per calculation'] * 0.03   # หักภาษี ณ ที่จ่าย 3%
        df_ram['VAT'] = df_ram['Amount per calculation'] * 0.07   # ภาษีมูลค่าเพิ่ม 7%
        df_ram['Total receivable'] = df_ram['Amount per calculation'] - df_ram['WHT'] + df_ram['VAT']
        df_ram['Total'] = df_ram['Amount per calculation'] + df_ram['VAT']

        # คำนวณสรุปยอดสำหรับ Dealer
        df_dealer['AR Master code'] = 'Charge to Dealer'
        df_dealer['Amount per calculation'] = df_dealer['Dealer Charge (After Waive)']
        df_dealer['Waive'] = df_dealer['waive amount']
        df_dealer['WHT'] = df_dealer['Amount per calculation'] * 0.05   # หักภาษี ณ ที่จ่าย 5%
        df_dealer['VAT'] = df_dealer['Amount per calculation'] * 0.07
        df_dealer['Total receivable'] = df_dealer['Amount per calculation'] - df_dealer['WHT'] + df_dealer['VAT']
        df_dealer['Total'] = df_dealer['Amount per calculation'] + df_dealer['VAT']

        # จัดลำดับคอลัมน์ให้ตรงกันทั้งสองฝั่ง (Dealer/RAM)
        summary_cols = [
            'Dealer Group', 'Dealer Code', 'Dealer Name', 'AR Master code', 
            'Amount per calculation', 'Waive', 'WHT', 'VAT', 'Total receivable', 'Total'
        ]
        df_dealer_summary = df_dealer[summary_cols].copy()
        df_ram_summary = df_ram[summary_cols].copy()

        # รวมข้อมูลของทั้ง Dealer และ RAM เข้าด้วยกัน

        # รวมข้อมูลของทั้ง Dealer และ RAM เข้าด้วยกัน
        group_cols = ['Dealer Group', 'Dealer Code', 'Dealer Name', 'AR Master code']
        sum_cols = ['Amount per calculation', 'Waive', 'WHT', 'VAT', 'Total receivable', 'Total']

        df_ram_summary = (
            df_ram[summary_cols]
            .groupby(group_cols, as_index=False)[sum_cols]
            .sum()
            .sort_values(group_cols)
            .reset_index(drop=True)
        )
        
        df_dealer_summary = (
            df_dealer[summary_cols]
            .groupby(group_cols, as_index=False)[sum_cols]
            .sum()
            .sort_values(group_cols)
            .reset_index(drop=True)
        )

        df_ram_summary
        df_dealer_summary

        df_rental_summary = pd.concat(
        [df_dealer_summary, df_ram_summary], 
            ignore_index=True)
        
        # 3. สร้างฟังก์ชันสำหรับเพิ่มบรรทัดรวม Total
        def _sum_row(label, df):
            """
            สร้างแถว summary รวมยอดของแต่ละกลุ่ม (Total)
            label: ชื่อที่จะแสดงในคอลัมน์ Dealer Name (เช่น 'Total Charge to Dealer')
            df: DataFrame ที่จะรวมยอด
            """
            sums = df[sum_cols].sum()
            return pd.Series({
                'Dealer Group': '',
                'Dealer Code': '',
                'Dealer Name': label,
                'AR Master code': '',
                'Amount per calculation': sums['Amount per calculation'],
                'Waive': sums['Waive'],
                'WHT': sums['WHT'],
                'VAT': sums['VAT'],
                'Total receivable': sums['Total receivable'],
                'Total': sums['Total'],
            })

        # 4. เพิ่มบรรทัด Total Summary 2 บรรทัด (Charge to Dealer และ RAM Rever Automotive)
        df_rental_summary = pd.concat([
            df_rental_summary,
            pd.DataFrame([
                _sum_row('Total Charge to Dealer', df_dealer_summary),
                _sum_row('Total RAM Rever Automotive', df_ram_summary)
            ])
        ], ignore_index=True)



        # ===== สร้าง Workbook และ Sheet =====
        wb = Workbook()

        # 1. Summary Sheet
        ws_summary = wb.active
        ws_summary.title = "Summary"
        for r in dataframe_to_rows(summary_df.reset_index().rename(columns={"index": "Description"}), index=False, header=True):
            ws_summary.append(r)
 
        

        # 2. AR Detail Sheet
        desired_order = [
            'Dealer Group', 'Dealer Code', 'Dealer Name', 'Model', 'VIN Number', 'Price (Ex. Vat)',
            'Allocation Date', 'Contract Number', 'Subvention Campaign', 'Source', 'Payment Date',
            'Paid', 'Free Days', 'Due Date', 'Aging', 'RAM Charge FreeDay (This Month)', "RAM Charge (bf)",
            'RAM Charge', 'Dealer Charge', 'waive amount', 'RAM Charge (After Waive)',
            'Dealer Charge (After Waive)', 'RAM Rate Summary', 'Dealer Rate Summary', 'reason'
        ]
        df_ar_current_month = df_ar_current_month[[col for col in desired_order if col in df_ar_current_month.columns]]
        # Format Due Date as string for export
        if 'Due Date' in df_ar_current_month.columns:
            df_ar_current_month['Due Date'] = pd.to_datetime(df_ar_current_month['Due Date'], errors='coerce')
            df_ar_current_month['Due Date'] = df_ar_current_month['Due Date'].dt.strftime('%d/%m/%Y')
            df_ar_current_month['Due Date'] = df_ar_current_month['Due Date'].replace('NaT', '')
        ws_detail = wb.create_sheet(title="AR Detail")
        for r in dataframe_to_rows(df_ar_current_month, index=False, header=True):
            ws_detail.append(r)


        # 3. Dealer Summary Sheet
        ws_dealer_summary = wb.create_sheet(title="Dealer Summary")
        for r in dataframe_to_rows(df_rental_summary, index=False, header=True):
            ws_dealer_summary.append(r)

        # ใส่ Table Format สวยงาม
        def add_table(ws, table_name):
            last_col = ws.max_column
            last_row = ws.max_row
            last_col_letter = get_column_letter(last_col)
            tab = Table(displayName=table_name, ref=f"A1:{last_col_letter}{last_row}")
            style = TableStyleInfo(name="TableStyleMedium9", showRowStripes=True)
            tab.tableStyleInfo = style
            ws.add_table(tab)

        add_table(ws_summary, "SummaryTable")
        add_table(ws_detail, "DetailTable")
        add_table(ws_dealer_summary, "DealerSummaryTable")

        # ฟังก์ชันจัดคอลัมน์ตัวเลขให้ align ขวา และแสดงทศนิยม
        def format_currency_column(ws, col_name):
            for cell in ws[1]:
                if cell.value == col_name:
                    col_letter = cell.column_letter
                    for row in range(2, ws.max_row + 1):
                        cell = ws[f"{col_letter}{row}"]
                        cell.number_format = '#,##0.00'
                        cell.alignment = Alignment(horizontal='right')

        # ใช้ฟังก์ชันจัด format กับแต่ละชีท
        # ==== 1. ws_summary ====
        for col in [
            'Amount (THB)'
        ]:
            format_currency_column(ws_summary, col)

        # ==== 2. ws_detail ====
        for col in [
            'Price (Ex. Vat)', 
            'RAM Charge (bf)', 
            'RAM Charge', 
            'Dealer Charge',
            'waive amount',
            'RAM Charge (After Waive)', 
            'Dealer Charge (After Waive)'
        ]:
            format_currency_column(ws_detail, col)

        # ==== 3. ws_dealer_summary ====
        for col in [
            'Amount per calculation', 
            'Waive', 
            'WHT', 
            'VAT', 
            'Total receivable', 
            'Total'
        ]:
            format_currency_column(ws_dealer_summary, col)

        # ขยายความกว้างคอลัมน์ให้เหมาะสม
        for ws in [ws_summary, ws_detail, ws_dealer_summary]:
            for column_cells in ws.columns:
                max_len = max(len(str(cell.value)) if cell.value else 0 for cell in column_cells)
                ws.column_dimensions[get_column_letter(column_cells[0].column)].width = max_len + 2


     
                # ขยายความกว้างคอลัมน์ให้เหมาะสม
  
        now = datetime.now()
        today_str = now.strftime("%Y%m%d_%H%M")   # YYYYMMDD_HHMM
        month_str = month_end.strftime('%b')
        year_str = month_end.strftime('%Y')
        output_folder = os.path.join(os.getcwd(), "AR_Outputs - Waive")
        os.makedirs(output_folder, exist_ok=True)

        output_filename = f"AR_Summary_{month_str}{year_str}_After_Waive_{today_str}.xlsx"
        output_path = os.path.join(output_folder, output_filename)
        wb.save(output_path)
        # ... ส่วนบันทึกไฟล์
   

                # เตรียม summary_df ให้แสดงสวยใน HTML
        summary_df_display = summary_df.reset_index().rename(columns={"index": "หมวดรายการ"})
        summary_html = summary_df_display.to_html(
            index=False,
            border=1,
            classes="summary-table",
            justify="center"
        )

        return f"""
                <style>
                    body {{
                        font-family: 'Segoe UI', sans-serif;
                        color: #222;
                    }}
                    .summary-table {{
                        border-collapse: collapse;
                        width: 500px;
                        margin-top: 10px;
                    }}
                    .summary-table th {{
                        background-color: #003366;
                        color: white;
                        padding: 8px;
                        text-align: center;
                    }}
                    .summary-table td {{
                        padding: 6px;
                        text-align: right;
                        border: 1px solid #ccc;
                    }}
                    .summary-table td:first-child {{
                        text-align: left;
                    }}
                    .link-button {{
                        display: inline-block;
                        background-color: #0d47a1;
                        color: white;
                        padding: 10px 18px;
                        border-radius: 6px;
                        text-decoration: none;
                        font-weight: bold;
                        margin-top: 10px;
                    }}
                </style>

                <p>
                ✔ <b>วันที่สิ้นงวดบัญชี:</b> {month_end_date.strftime('%d/%m/%Y')}<br><br>

                📄 <b>พบข้อมูลจากชีทในไฟล์ที่อัปโหลดดังนี้:</b><br>
                • {sheet_last} — จำนวน {df_ar_lastmonth.shape[0]:,} รายการ<br>
                • {sheet_new} — จำนวน {df_new_volumn.shape[0]:,} รายการ<br>
                • {sheet_all} — จำนวน {df_all_payment.shape[0]:,} รายการ<br>
                • ข้อมูล AR รวม (df_ar_current_month) — จำนวน {df_ar_current_month.shape[0]:,} รายการ
                </p>

                <p><b> สรุปยอดรวม (THB):</b></p>
                {summary_html}

                <p><b> ไฟล์ผลลัพธ์ถูกบันทึกไว้ที่:</b><br>
                <code>{output_path}</code><br><br>

                <a href="/open-output-folder1" class="link-button"> เปิดโฟลเดอร์ AR_Outputs - Waive</a>
                </p>
                """
    except Exception as e:
        return f"<p style='color:red;'> เกิดข้อผิดพลาดในการคำนวณ:<br><pre>{traceback.format_exc()}</pre></p>"



@app.route('/upload_waive', methods=['GET', 'POST'])
def upload_waive():
    if request.method == 'POST':
        waive_file = request.files.get('waive_file')
        if not waive_file or waive_file.filename == '':
            return "No waive file uploaded", 400

        # Save file
        input_folder = os.path.join(os.getcwd(), "AR_Input")
        os.makedirs(input_folder, exist_ok=True)
        timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
        filename = f"waive_input_{timestamp}.xlsx"
        save_path = os.path.join(input_folder, filename)
        waive_file.save(save_path)

        # Read first 5 rows for preview
        try:
            df_waive = pd.read_excel(save_path)
            html_preview = df_waive.head(5).to_html(classes="waive-table", index=False)
        except Exception as e:
            html_preview = f"<div style='color:red;'>Error reading file: {e}</div>"

        # 🟢 ส่งตัวแปรให้ตรงกับ template
        return render_template(
            "preview_waive.html",
            waive_file_path=save_path,
            waive_preview_table=html_preview
        )

    # GET: render upload form
    return render_template("upload_waive.html")



@app.route("/open-output-folder1", methods=["GET"])
def open_output_folder1():
    folder_path = os.path.join(os.getcwd(), "AR_Outputs - Waive")
    try:
        subprocess.Popen(f'explorer "{folder_path}"')  # เปิด Windows Explorer
        # subprocess.Popen(['open', folder_path]) # สำหรับ macOS
        return f"""
            <style>
            .result-box {{
                font-family: 'Segoe UI', sans-serif;
                background: #f4f6f8;
                padding: 20px;
                border-radius: 8px;
                border-left: 5px solid #0d47a1;
                max-width: 700px;
                margin-top: 30px;
                color: #333;
            }}
            .result-box code {{
                background: #e3eaf4;
                padding: 3px 6px;
                border-radius: 4px;
                font-family: Consolas, monospace;
            }}
            </style>

            <div class="result-box">
             <strong>AR Summary calculation completed successfully.</strong><br><br>

          

            ℹ You may now proceed to review or distribute the report.
            </div>
            """

        
    except Exception as e:
        return f"<p style='color:red;'> ไม่สามารถเปิดโฟลเดอร์ได้: {e}</p>"


@app.route("/open-output-folder", methods=["GET"])
def open_output_folder():
    folder_path = os.path.join(os.getcwd(), "AR_Outputs")
    try:
        subprocess.Popen(f'explorer "{folder_path}"')  # เปิด Windows Explorer
        # subprocess.Popen(['open', folder_path]) # สำหรับ macOS
        return f"""
            <style>
            .result-box {{
                font-family: 'Segoe UI', sans-serif;
                background: #f4f6f8;
                padding: 20px;
                border-radius: 8px;
                border-left: 5px solid #0d47a1;
                max-width: 700px;
                margin-top: 30px;
                color: #333;
            }}
            .result-box code {{
                background: #e3eaf4;
                padding: 3px 6px;
                border-radius: 4px;
                font-family: Consolas, monospace;
            }}
            </style>

            <div class="result-box">
             <strong>AR Summary calculation completed successfully.</strong><br><br>

          

            ℹ You may now proceed to review or distribute the report.
            </div>
            """

        
    except Exception as e:
        return f"<p style='color:red;'> ไม่สามารถเปิดโฟลเดอร์ได้: {e}</p>"


@app.route('/open-config-folder', methods=["GET", "POST"])
def open_config_folder():
    folder_path = os.path.abspath("config")
    try:
        subprocess.Popen(f'explorer "{folder_path}"') # เปิด Windows Explorer
        # subprocess.Popen(['open', folder_path]) # สำหรับ macOS
    except Exception as e:
        print(f" Error: {e}")
    return redirect('/')

def run_flask():
    app.run(host='127.0.0.1', port=5000, debug=False, use_reloader=False)

if __name__ == '__main__':
    threading.Thread(target=run_flask, daemon=True).start()
    webview.create_window("FloorPlan Interest Calculator", "http://127.0.0.1:5000", width=1000, height=800)
    webview.start()
