# Vettam Hocuspocus Backend

A production-ready TypeScript server combining **Hocuspocus real-time collaboration** with **Express REST API** for document management, integrated with Vettam's primary API service. This unified server handles both WebSocket-based collaborative editing and HTTP-based document operations.

## 🚀 Features

### Core Collaboration
- ✅ **Real-time collaborative editing** via Hocuspocus (Y.js CRDTs)  
- ✅ **Document persistence** with automatic snapshots to Vettam API
- ✅ **Memory management** with automatic cleanup of inactive documents
- ✅ **Bidirectional conversion** between Markdown ↔ TipTap JSON ↔ Y.Doc

### Security & Authentication  
- ✅ **JWT-based authentication** using `jose` library with robust validation
- ✅ **API key middleware** for internal service protection
- ✅ **Rate limiting** with JWT-based user identification  
- ✅ **CORS configuration** with production domain restrictions
- ✅ **Security headers** (CSP, X-Frame-Options, etc.)

### Production Ready
- ✅ **Standardized error handling** with consistent API responses
- ✅ **Structured logging** with request correlation
- ✅ **Graceful shutdown** with document persistence
- ✅ **Health monitoring** endpoints
- ✅ **Docker containerization** with multi-stage builds
- ✅ **TypeScript** with comprehensive type safety

## 🏗️ Architecture

### Unified Server Design
```
┌──────────────────────────────────────────────────────┐
│                Express Server                        │
├──────────────────────────────────────────────────────┤
│  HTTP Routes               │  WebSocket Handler      │
│  ├─ /health                │  └─ /collaboration      │
│  ├─ /v1/state/:id/state    │      (Hocuspocus)       │
│  └─ API endpoints          │                         │
├──────────────────────────────────────────────────────┤
│                Middleware Stack                      │
│    Security → CORS → Rate Limit → API Key → Body     │
└──────────────────────────────────────────────────────┘
           │                    │
           ▼                    ▼
    ┌──────────────┐    ┌──────────────┐
    │ Document     │    │ Vettam API   │
    │ Service      │    │ Integration  │
    │ (Y.js Mgmt)  │    │ (Auth/Data)  │
    └──────────────┘    └──────────────┘
```

### Project Structure
```
src/
├── server.ts                 # Main application entry point
├── config/                   # Configuration management
│   ├── index.ts               # Environment variables & validation
│   ├── logger.ts              # Structured logging setup
│   └── constants.ts           # Application constants
├── servers/
│   └── express.ts           # Unified Express+WebSocket server
├── routes/                  # HTTP API endpoints
│   ├── index.ts               # Root endpoint (API info)
│   ├── health.ts              # Health check endpoint
│   └── state.ts               # Document state management
├── services/                # Business logic services
│   ├── document.ts            # Y.Doc management & persistence
│   └── vettam-api.ts          # External API integration
├── middleware/              # Express middleware
│   └── api-key.ts             # API key authentication
├── utils/                   # Utility functions
│   ├── auth-utils.ts          # JWT handling utilities
│   ├── error-handling.ts      # Standardized error management
│   └── converters/            # Document format converters
└── types/                  # TypeScript type definitions
```

## 🔧 Setup & Configuration

### Installation

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Configure environment:**
   ```bash
   cp .env.example .env
   ```

3. Fill in .env file

### Development

```bash
# Start development server with Docker (recommended)
docker compose -f docker-compose.yml -f docker-compose.dev-override.yml up --build

# Or start development server with hot reload locally
npm run dev

# Build for production  
npm run build

# Start production server
npm start
```

## 🔐 Authentication & Security

### WebSocket Authentication
Authentication via Authorization header:

```javascript
const ws = new WebSocket('ws://localhost:3000/collaboration', {
  headers: { 'Authorization': 'Bearer jwt_token' }
});
```

### API Key Protection
REST endpoints are protected by API key middleware:

```http
GET /v1/state/uuid:uuid/state
X-API-Key: generated_daily_hash
```

**Open endpoints** (no API key required):
- `/health`
- `/` (root)  
- `/collaboration/*` (WebSocket)

### Rate Limiting
- **Authenticated users**: 100 requests/15min
- **Unauthenticated**: 30 requests/15min  
- **WebSocket connections**: Exempt from rate limits

## 🔄 Document Flow

### Real-time Collaboration Workflow
```
1. Client connects via WebSocket with JWT
2. Server validates JWT & checks document access via Vettam API
3. Server loads existing document state from Vettam API  
4. Y.Doc instance created/retrieved for real-time collaboration
5. Document changes sync in real-time between all clients
6. Auto-save snapshots to Vettam API every 30 minutes
7. Manual save on client disconnect
```

### Document Format Conversions
```
Markdown ↔ TipTap JSON ↔ Y.js Document (CRDT)
    ↑           ↑            ↑
REST API   Internal     WebSocket
Storage   Processing   Collaboration
```

### Room ID Format
Documents are identified by: `{draft_id}:{version_id}`
- Both IDs must be valid UUIDs
- Format validated via regex patterns
- Used for Vettam API integration

## 🚀 Production Deployment

### Docker Deployment
```bash
# Build image
docker build -t vettam-hocuspocus .

# Run container
docker run -p 3000:3000 --env-file .env vettam-hocuspocus

# Or use docker-compose
docker-compose up -d
```

### Environment-Specific Configuration

#### Production Settings
```env
NODE_ENV=production
DEBUG=false
CORS_ORIGIN=https://app.vettam.app,https://admin.vettam.app
```

#### Security Checklist
- ✅ JWT secret minimum 32 characters
- ✅ CORS restricted to `*.vettam.app` domains  
- ✅ API keys rotated daily (automatic)
- ✅ Rate limiting enabled
- ✅ Security headers configured
- ✅ Error messages sanitized

### Monitoring & Health Checks
```bash
# Health check endpoint
curl http://localhost:3000/health

# Container health check (Docker)
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:3000/health || exit 1
```

### REST API Usage
API requests require the `X-API-Key` header with the generated daily hash. See Bruno collection for detailed request/response examples.

## 📊 Monitoring & Observability

### Structured Logging
All logs include contextual information with timestamps, log levels, and relevant metadata for debugging and monitoring.

### Key Metrics to Monitor
- Active WebSocket connections
- Document persistence success rate  
- Authentication failure rates
- Memory usage and document cleanup
- API response times

## 🤝 Contributing

1. Follow TypeScript strict mode
2. Use structured error handling via `ErrorFactory`
3. Wrap async routes with `asyncHandler`
4. Add proper JSDoc comments
5. Test both WebSocket and REST functionality

## 📄 License

MIT License - see LICENSE file for details.
