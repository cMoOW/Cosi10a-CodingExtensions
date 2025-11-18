# Ticketing Frontend

React dashboard for TAs to view and manage tickets submitted from the VS Code extension.

## Quick Start

### 1. Install Dependencies
```bash
npm install
```

### 2. Set Up Environment Variables
Create `.env` file in this directory:
```bash
VITE_SUPABASE_URL=https://xxxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGc...
```

### 3. Run Development Server
```bash
npm run dev
```

Open `http://localhost:5173` in your browser.

## Features

- ✅ View all tickets in a list
- ✅ Filter by status, priority, assigned TA
- ✅ View full ticket details
- ✅ See code with syntax highlighting
- ✅ Add feedback/notes to tickets
- ✅ Update ticket status
- ✅ Assign tickets to TAs
- ✅ Change ticket priority

## Project Structure

```
src/
├── components/        # React components
│   ├── TicketList.jsx
│   ├── TicketCard.jsx
│   ├── TicketDetail.jsx
│   ├── FeedbackForm.jsx
│   └── ...
├── services/         # API service layer
│   └── ticketService.js
├── App.jsx           # Main app component
├── main.jsx          # Entry point
└── supabaseClient.js # Supabase connection
```

## Available Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run preview` - Preview production build
- `npm run lint` - Run ESLint

## Dependencies

- `react` - UI library
- `@supabase/supabase-js` - Database client
- `react-syntax-highlighter` - Code syntax highlighting
- `vite` - Build tool

## Documentation

See `IMPLEMENTATION_GUIDE.md` in the root directory for detailed documentation.

