# Target Account Dashboard

A modern, AI-powered sales intelligence platform for identifying high-intent accounts and generating personalized outreach strategies. Built with React 19, tRPC, Express, and Manus AI.

## Features

- **Account Intelligence**: Real-time intent scoring, tech stack detection, and AI-generated executive summaries
- **Contact Management**: 14K+ contacts with role-based filtering, MFA provider detection
- **AI-Powered Insights**: Executive summaries, strategic recommendations, and competitive analysis
- **MFA Provider Filtering**: Filter accounts by identity providers (Ping Identity, Okta, Duo, Azure AD, etc.)
- **Top 15 Accounts**: View prioritized accounts by region (West, Central, East) and by Account Executive
- **6sense Integration**: Real-time intent data syncing with automated alerts for 20+ point score jumps
- **Call Analytics**: Gong call transcripts with AI analysis (Call Analyzer, Compare mode, Bulk processing)
- **RFP Tracking**: Monitor active RFPs and procurement opportunities
- **Outreach Generation**: AI-powered email generation with account and contact context

## Tech Stack

- **Frontend**: React 19, Tailwind CSS 4, shadcn/ui components
- **Backend**: Express 4, tRPC 11, Node.js
- **Database**: MySQL/TiDB with Drizzle ORM
- **AI**: Manus LLM API, 6sense Intent API, Gong API
- **Auth**: Manus OAuth 2.0
- **Storage**: S3-compatible file storage

## Prerequisites

Before running this project, you need to set up the following external services and API keys:

### Required API Keys

1. **Manus OAuth** (Automatic - comes with Manus platform)
   - `VITE_APP_ID` - OAuth application ID
   - `OAUTH_SERVER_URL` - OAuth server base URL
   - `VITE_OAUTH_PORTAL_URL` - Login portal URL

2. **Manus Built-in APIs** (Automatic - comes with Manus platform)
   - `BUILT_IN_FORGE_API_KEY` - Bearer token for server-side APIs
   - `BUILT_IN_FORGE_API_URL` - Manus API base URL
   - `VITE_FRONTEND_FORGE_API_KEY` - Bearer token for frontend APIs
   - `VITE_FRONTEND_FORGE_API_URL` - Frontend API URL

3. **6sense Intent API** (Optional but recommended)
   - `SIXSENSE_API_KEY` - Get from https://app.6sense.com/settings/api-keys
   - Enables real-time intent scoring and automated alerts

4. **Database** (Automatic on Manus)
   - `DATABASE_URL` - MySQL/TiDB connection string

5. **JWT Secret** (Automatic on Manus)
   - `JWT_SECRET` - Session cookie signing secret

### Optional Integrations

- **Gong API**: For call transcript analysis (configure in environment)
- **Google Maps**: For location-based features (proxy provided by Manus)
- **LinkedIn**: For contact enrichment (via Clay or Apollo integrations)

## Installation

### On Manus Platform (Recommended)

This project is designed to run on the Manus platform where all environment variables are automatically injected:

1. Create a new project from this repository
2. All secrets are automatically configured
3. Run `pnpm install && pnpm dev`

### Local Development

If running locally, you'll need to provide all environment variables:

```bash
# Clone the repository
git clone https://github.com/mrc2256/targetdashboardbyid.git
cd target-account-dashboard

# Install dependencies
pnpm install

# Create .env.local with all required variables
cp .env.example .env.local

# Edit .env.local and add your API keys
# See "Environment Variables" section below

# Run development server
pnpm dev
```

## Environment Variables

Create a `.env.local` file with the following variables:

```env
# Database
DATABASE_URL=mysql://user:password@host:3306/database

# Manus OAuth
VITE_APP_ID=your_app_id
OAUTH_SERVER_URL=https://api.manus.im
VITE_OAUTH_PORTAL_URL=https://login.manus.im

# Manus APIs
BUILT_IN_FORGE_API_KEY=your_api_key
BUILT_IN_FORGE_API_URL=https://api.manus.im
VITE_FRONTEND_FORGE_API_KEY=your_frontend_key
VITE_FRONTEND_FORGE_API_URL=https://api.manus.im

# 6sense Intent API (Optional)
SIXSENSE_API_KEY=your_6sense_api_key

# Session
JWT_SECRET=your_jwt_secret_key

# Owner Info (Optional)
OWNER_NAME=Your Name
OWNER_OPEN_ID=your_open_id

# Analytics (Optional)
VITE_ANALYTICS_ENDPOINT=https://analytics.example.com
VITE_ANALYTICS_WEBSITE_ID=your_website_id

# App Config (Optional)
VITE_APP_TITLE=Target Account Dashboard
VITE_APP_LOGO=/logo.svg
```

## Getting Started

### 1. Set Up Database

```bash
# Generate Drizzle types
pnpm db:generate

# Push schema to database
pnpm db:push
```

### 2. Start Development Server

```bash
pnpm dev
```

The app will be available at `http://localhost:3000`

### 3. Build for Production

```bash
pnpm build
```

## Project Structure

```
client/
  src/
    pages/          # Page components (Accounts, Contacts, Insights, etc.)
    components/     # Reusable UI components
    lib/            # Utilities (tRPC client, helpers)
    contexts/       # React contexts (auth, rep selection)
    index.css       # Global styles with design tokens

server/
  routers.ts        # tRPC procedure definitions
  db.ts             # Database query helpers
  sixsense.ts       # 6sense API integration
  _core/            # Framework internals (auth, LLM, storage, etc.)

drizzle/
  schema.ts         # Database schema definitions
  migrations/       # Database migrations

shared/
  types.ts          # Shared TypeScript types
  constants.ts      # Shared constants
```

## Key Features Explained

### Account Intelligence
- Real-time intent scoring from 6sense
- Automatic tech stack detection
- AI-generated executive summaries with key opportunities, recommendations, and risks
- Contact mapping and engagement history

### MFA Provider Filtering
Filter accounts by identity/MFA providers they use:
- Ping Identity
- Okta
- Duo Security
- Azure AD
- OneLogin
- ForgeRock
- And 9+ more

### Top 15 Accounts
View your highest-priority accounts organized by:
- **By Region**: West, Central, East (top 15 each)
- **By AE**: Weekly prioritized accounts for each Account Executive

### AI-Powered Insights
- **Executive Summary**: Key opportunities, recommended actions, risk factors, best contacts
- **Strategic Recommendations**: Competitive analysis, talking points, next actions
- **Market Research**: Industry trends and competitive intelligence

### 6sense Integration
- Automatic intent score syncing every 6 hours
- Real-time alerts for 20+ point score jumps in 24 hours
- Intent spike dashboard widget

## API Documentation

### tRPC Procedures

All procedures are defined in `server/routers.ts` and automatically typed on the client.

#### Accounts
- `accounts.list` - Get all accounts with filters
- `accounts.detail` - Get single account with full details
- `accounts.getByRegion` - Get accounts filtered by region
- `accounts.getByAE` - Get accounts for specific Account Executive

#### AI Insights
- `ai.compile` - Generate executive summary
- `ai.generateStrategicInsights` - Generate strategic recommendations
- `ai.generateResearch` - Generate market research

#### 6sense
- `sixsense.sync` - Manually trigger intent data sync
- `sixsense.getIntentSpikes` - Get recent intent score jumps

#### Contacts
- `contacts.list` - Get all contacts with filters
- `contacts.getByAccount` - Get contacts for specific account

## Testing

```bash
# Run all tests
pnpm test

# Run specific test file
pnpm test server/sixsense.test.ts

# Watch mode
pnpm test:watch
```

## Deployment

### On Manus Platform

1. Click "Publish" in the Management UI
2. All environment variables are automatically configured
3. Your app is live at `https://your-project.manus.space`

### External Hosting

If deploying elsewhere, ensure you have:
- Node.js 18+
- MySQL/TiDB database
- All environment variables configured
- S3-compatible storage for file uploads

```bash
# Build
pnpm build

# Start production server
NODE_ENV=production node dist/server.js
```

## Common Issues

### "SIXSENSE_API_KEY is not configured"
- Get your API key from https://app.6sense.com/settings/api-keys
- Add it to your environment variables
- Restart the dev server

### "BUILT_IN_FORGE_API_KEY is not configured"
- This is automatically set on Manus platform
- For local development, contact your Manus administrator

### Database connection errors
- Verify `DATABASE_URL` is correct
- Ensure database user has proper permissions
- Check network connectivity to database host

## Contributing

1. Create a feature branch: `git checkout -b feature/your-feature`
2. Make your changes and test thoroughly
3. Commit with clear messages: `git commit -m "Add feature: description"`
4. Push to your fork and create a Pull Request

## License

Proprietary - All rights reserved

## Support

For issues, questions, or feature requests:
1. Check the existing GitHub issues
2. Create a new issue with detailed information
3. Include environment details and error messages

## Roadmap

- [ ] Advanced RFP scraping and tracking
- [ ] Former customer job change detection (Clay/LinkedIn integration)
- [ ] Competitor displacement tracking
- [ ] Multi-select MFA provider filtering
- [ ] Account comparison view
- [ ] Email export for weekly priorities
- [ ] Intent spike push notifications
- [ ] Custom dashboard builder

---

**Built with ❤️ using Manus AI Platform**
