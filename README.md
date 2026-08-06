# FloorPlan Interest Calculator

A modern web application for calculating automotive dealer rental charges using React + TypeScript frontend and Flask Python backend.

## Project Structure

```
floor-plan/
├── backend/
│   ├── app.py                    # Flask REST API server
│   ├── example.py                # Legacy example code
│   ├── requirements.txt           # Python dependencies
│   └── config/
│       └── Rental_Charge_Conditions_v2.xlsx  # Configuration file
├── frontend/
│   ├── src/
│   │   ├── components/           # React components
│   │   ├── hooks/                # Custom hooks
│   │   ├── services/             # API services
│   │   ├── types/                # TypeScript types
│   │   ├── utils/                # Utility functions
│   │   ├── styles/               # Global styles
│   │   ├── App.tsx               # Main app component
│   │   └── main.tsx              # React entry point
│   ├── index.html                # HTML template
│   ├── package.json              # Node dependencies
│   ├── tsconfig.json             # TypeScript config
│   └── vite.config.ts            # Vite config
├── PROGRAM_LOGIC_DOCUMENTATION.md
├── REACT_TYPESCRIPT_IMPLEMENTATION_GUIDE.md
└── README.md                      # This file
```

## Features

### Backend (Python/Flask)
- RESTful API endpoints for file upload and calculation
- Comprehensive charge calculation logic (RAM charges, Dealer charges, Penalties)
- Excel file processing and generation
- Support for waive (discount) calculations
- CORS-enabled for frontend communication

### Frontend (React/TypeScript)
- Modern React 18 with TypeScript
- Responsive UI with custom components
- File upload with preview functionality
- Real-time calculation results
- Summary and detail tables
- Formatted currency and date display

## Installation & Setup

### Backend Setup

1. **Navigate to backend folder:**
```bash
cd backend
```

2. **Create Python virtual environment:**
```bash
python -m venv venv

# On macOS/Linux
source venv/bin/activate

# On Windows
venv\Scripts\activate
```

3. **Install dependencies:**
```bash
pip install -r requirements.txt
```

4. **Ensure config file exists:**
   - Place `Rental_Charge_Conditions_v2.xlsx` in `backend/config/` folder

5. **Run Flask server:**
```bash
python app.py
```
   Server runs on `http://localhost:5000`

### Frontend Setup

1. **Navigate to frontend folder:**
```bash
cd frontend
```

2. **Install Node dependencies:**
```bash
npm install
```

3. **Run development server:**
```bash
npm run dev
```
   Application opens at `http://localhost:5173`

## API Endpoints

### Configuration
- `GET /api/config` - Load rates and subvention campaigns

### File Upload
- `POST /api/upload` - Upload and preview AR file
- `POST /api/upload-waive` - Upload and preview waive file

### Calculation
- `POST /api/calculate` - Calculate charges without waive
- `POST /api/calculate-with-waive` - Calculate charges with waive applied

### Download
- `GET /api/download` - Download generated Excel file

## Usage Workflow

1. **Start both servers** (backend on 5000, frontend on 5173)
2. **Home Page** - View configuration, rates, and subvention campaigns
3. **Upload AR File** - Upload monthly AR file for processing
4. **Preview** - Review uploaded data before calculation
5. **Calculate** - Run calculation and view results
6. **Download** - Export results as Excel file

## Key Features Explained

### Charge Calculation
- **RAM Charge** - Interest on free rental days (per subvention campaign)
- **Dealer Charge** - Interest after free days expire
- **Penalty Charge** - Additional charge if payment is overdue
- **Waive** - Optional discount applied to dealer charges

### Rate Management
- Rates vary by day range (1-30, 31-90, etc.)
- Different rates can be effective for different date periods
- IsActive flag controls which rates are applied

### Subvention Campaigns
- Define free rental days for different campaigns
- Maps to vehicle records for charge calculation
- Default "Normal" campaign if not specified

## Development

### Building for Production

**Frontend:**
```bash
cd frontend
npm run build
```

**Backend:**
- Use production WSGI server (Gunicorn, uWSGI)
- Set appropriate environment variables
- Enable HTTPS for production

### Project Dependencies

**Backend:**
- Flask 2.3.2
- Pandas 2.0.2
- OpenPyXL 3.1.2
- Python-dateutil

**Frontend:**
- React 18.2
- React Router 6.8
- Axios 1.3
- Vite 4.1
- TypeScript 4.9

## File Formats

### AR Input File
Required sheets:
- **Previous Month** (e.g., "may", "apr") - Last month's records
- **new** - New volume records for current month
- **all** - Payment information (VIN + Payment Date)
- **penalty** (optional) - Due dates for penalty calculation

### Waive File
Columns:
- Dealer Code
- VIN Number
- waive amount
- reason (optional)
- approved (Y/N)

### Configuration File
Sheets:
- **Config** - Month end date, penalty rate
- **Rate_By_Day_Range** - Interest rates by day range
- **Subvention_Campaign** - Campaign names and free days

## Troubleshooting

### Backend Issues
- Ensure `Rental_Charge_Conditions_v2.xlsx` is in `config/` folder
- Check Python version compatibility (3.8+)
- Verify all dependencies installed: `pip install -r requirements.txt`

### Frontend Issues
- Clear Node cache: `npm cache clean --force`
- Reinstall node_modules: `rm -rf node_modules && npm install`
- Check that backend is running on port 5000

### Calculation Issues
- Verify Excel file has required columns
- Check date formats (should be recognized by pandas)
- Ensure dealer codes and VIN numbers match between sheets

## License

© 2026 FloorPlan Interest Calculator

## Support

For issues or questions, refer to:
- `PROGRAM_LOGIC_DOCUMENTATION.md` - Detailed calculation logic
- `REACT_TYPESCRIPT_IMPLEMENTATION_GUIDE.md` - Frontend architecture
# floor-plan
