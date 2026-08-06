# Quick Start Guide

## 🚀 Start the Application (2 Terminal Windows)

### Terminal 1: Backend (Python/Flask)

```bash
# Navigate to backend
cd backend

# Create virtual environment
python -m venv venv

# Activate virtual environment
source venv/bin/activate  # macOS/Linux
# or
venv\Scripts\activate     # Windows

# Install dependencies
pip install -r requirements.txt

# Run Flask server
python app.py
```

✅ Backend runs on: `http://localhost:5000`

### Terminal 2: Frontend (React)

```bash
# Navigate to frontend
cd frontend

# Install Node dependencies
npm install

# Run development server
npm run dev
```

✅ Frontend runs on: `http://localhost:5173`

---

## 📋 Usage Steps

1. **Open Browser**: Navigate to `http://localhost:5173`

2. **Home Page**
   - View configuration (month end date, penalty rate)
   - See interest rates by day range
   - View subvention campaigns

3. **Upload AR File**
   - Click "📤 Upload AR File & Calculate"
   - Upload your Excel file with sheets:
     - **Previous Month** (e.g., "may", "apr")
     - **new** (new volume)
     - **all** (payment data)
     - **penalty** (optional - due dates)

4. **Preview & Calculate**
   - Review file preview
   - Click "✓ Proceed to Calculation"
   - Click "🔢 Calculate" to run calculations
   - View summary and first 10 records

5. **Download Results**
   - Excel file automatically generated
   - Contains 3 sheets:
     - **Summary** - Price totals
     - **AR Detail** - Full vehicle records with charges
     - **Dealer Summary** - Grouped by dealer with taxes

---

## 📂 File Structure (Quick Reference)

```
backend/
  app.py              ← Main Flask API
  requirements.txt    ← Python packages
  config/
    Rental_Charge_Conditions_v2.xlsx  ← Config file
  uploads/            ← Uploaded files
  AR_Outputs/         ← Generated Excel files
  AR_Outputs - Waive/ ← Waive calculation outputs
  AR_Input/           ← Waive input files

frontend/
  src/
    components/       ← React components
      Pages/          ← Page components
      Shared/         ← Reusable UI components
    hooks/            ← Custom React hooks
    services/         ← API communication
    types/            ← TypeScript interfaces
    utils/            ← Helper functions
    App.tsx           ← Main app
  package.json        ← Node dependencies
```

---

## 🔧 Troubleshooting

### Backend Won't Start
```bash
# Make sure you're in backend folder and venv is activated
pip install -r requirements.txt
python app.py
```

### Frontend Won't Load
```bash
# Make sure you're in frontend folder
npm cache clean --force
npm install
npm run dev
```

### CORS Error
- Ensure backend is running on port 5000
- Check that frontend is making requests to `http://localhost:5000/api`

### Excel File Not Found
- Place `Rental_Charge_Conditions_v2.xlsx` in `backend/config/` folder

---

## 📊 Example Excel Input Format

### Sheet 1: "may" (or previous month)
| Dealer Group | Dealer Code | Dealer Name | Model | VIN No. | Pre-Vat | Allocation Date | Payment Date | Contract No | Subvention |
|---|---|---|---|---|---|---|---|---|---|
| GroupA | 123 | Dealer A | MV001 | VIN123 | 500000 | 01/05/2025 | 15/05/2025 | CN001 | Normal |

### Sheet 2: "new"
| Dealer Group | Dealer Code | Dealer Name | Model | VIN No. | Pre-Vat | Allocation Date | Contract No | Subvention |
|---|---|---|---|---|---|---|---|---|
| GroupA | 456 | Dealer B | MV002 | VIN456 | 600000 | 01/06/2025 | CN002 | Campaign A |

### Sheet 3: "all"
| VIN No. | Payment Date |
|---|---|
| VIN123 | 15/05/2025 |
| VIN456 | (blank) |

### Sheet 4: "penalty" (Optional)
| VIN No. | Due Date |
|---|---|
| VIN456 | 30/06/2025 |

---

## ✨ Key Calculations

The application calculates:

1. **RAM Charge** = Interest during free days (based on free days per campaign)
2. **Dealer Charge** = Interest after free days end
3. **Penalty** = Extra charge if payment is overdue (15% default)
4. **Waive** = Optional discount (reduces dealer charge)
5. **Taxes** = WHT (3% or 5%) and VAT (7%)

Formula: `Daily Interest = (Price × Rate) / 36500`

---

## 📱 Next Steps

- **Read** `PROGRAM_LOGIC_DOCUMENTATION.md` for detailed calculation logic
- **Read** `REACT_TYPESCRIPT_IMPLEMENTATION_GUIDE.md` for architecture details
- **Modify** `backend/config/Rental_Charge_Conditions_v2.xlsx` to adjust rates and campaigns
- **Customize** components in `frontend/src/components/` for your branding

---

## 💡 Tips

- Keep both servers running while developing
- Backend API docs available at terminal output
- Frontend shows API errors in console (F12)
- Excel files are timestamped and saved in AR_Outputs folder
- All calculations are preserved from original example.py logic
