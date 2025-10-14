# Vettam Hocuspocus Backend

A modular TypeScript server with Hocuspocus CRDT collaboration and Express REST API for document collaboration, integrated with the Vettam Primary API Service.

## Features

- ✅ JWT token verification using `jose` library
- ✅ Supabase integration for user authorization
- ✅ Support for both JWKS and secret-based JWT verification
- ✅ Clean separation of concerns with modular architecture
- ✅ Comprehensive error handling and logging
- ✅ Environment-based configuration
- ✅ TypeScript with full type safety

## Prerequisites

- Node.js 18+ 
- npm or yarn
- Supabase project with authentication enabled

## Setup

1. **Clone and install dependencies:**
   ```bash
   npm install
   ```

2. **Environment Configuration:**
   Copy `.env.example` to `.env` and fill in your values:
   ```bash
   cp .env.example .env
   ```

   Required environment variables:
   ```env
   SUPABASE_URL=https://your-project.supabase.co
   SUPABASE_JWT_SECRET=your-jwt-secret-here
   RPC_KEY=your-rpc-key-here
   PORT=1234
   NODE_ENV=development
   ```

3. **Supabase Setup:**
   
   Create an RPC function in your Supabase database:
   ```sql
   CREATE OR REPLACE FUNCTION authorize_document_access(
     user_id text,
     document_name text
   )
   RETURNS json
   LANGUAGE plpgsql
   SECURITY DEFINER
   AS $$
   DECLARE
     result json;
   BEGIN
     -- Your authorization logic here
     -- Example: Check if user has access to the document
     
     IF user_id IS NOT NULL AND document_name IS NOT NULL THEN
       -- For demo purposes, allow all authenticated users
       -- Replace with your actual authorization logic
       result := json_build_object('allowed', true);
     ELSE
       result := json_build_object('allowed', false, 'reason', 'Invalid parameters');
     END IF;
     
     RETURN result;
   END;
   $$;
   ```

## Development

**Start the development server:**
```bash
npm run dev
```

**Build for production:**
```bash
npm run build
npm start
```

## Usage

### Client Connection

Connect to the WebSocket server with JWT authentication:

```javascript
// Option 1: Token in URL parameter
const ws = new WebSocket('ws://localhost:1234?token=your-jwt-token');

// Option 2: Token in Authorization header (if supported by your client)
const ws = new WebSocket('ws://localhost:1234', {
  headers: {
    'Authorization': 'Bearer your-jwt-token'
  }
});
```

### Authentication Flow

1. Client connects with JWT token
2. Server verifies JWT using JWKS or secret
3. Server extracts user ID from JWT payload
4. Server calls Supabase RPC to authorize document access
5. Connection accepted if authorization succeeds

### Document Access

The server uses the document name from the connection to determine access. Each document can have different authorization rules implemented in your Supabase RPC function.

## Architecture

```
src/
├── server.ts      # Main server and Hocuspocus configuration
├── jwt.ts         # JWT verification using jose library
├── auth.ts        # Supabase authorization service
└── types.ts       # TypeScript type definitions
```

### Key Components

- **JWTVerifier**: Handles JWT token verification with JWKS fallback
- **SupabaseAuthorizationService**: Manages authorization via Supabase RPC
- **Server Configuration**: Hocuspocus server with authentication hooks

## Configuration Options

### JWT Verification

The system supports two JWT verification methods:

1. **JWKS (Recommended)**: Automatically fetches public keys from Supabase
2. **Secret-based**: Uses the JWT secret directly

### Authorization Methods

Two authorization approaches are supported:

1. **RPC Functions**: Call Supabase stored procedures
2. **Edge Functions**: Call Supabase Edge Functions

## Error Handling

The server provides detailed error logging for:

- JWT verification failures
- Authorization failures  
- Network connectivity issues
- Invalid tokens or expired tokens

## Security Considerations

- JWT tokens are verified for signature and expiration
- All authorization calls are made with the user's token
- Environment variables store sensitive configuration
- Comprehensive error logging without exposing sensitive data

## Troubleshooting

### Common Issues

1. **JWT Verification Fails**
   - Check `SUPABASE_JWT_SECRET` in environment
   - Verify Supabase URL is correct
   - Ensure token is properly formatted

2. **Authorization RPC Fails**
   - Verify RPC function exists in Supabase
   - Check `RPC_KEY` permissions
   - Ensure user has necessary permissions

3. **Connection Issues**
   - Verify port is not in use
   - Check firewall settings
   - Ensure WebSocket client is compatible

## Production Deployment

1. Set `NODE_ENV=production`
2. Use proper secrets management
3. Configure reverse proxy (nginx/Apache)
4. Set up SSL/TLS termination
5. Configure monitoring and logging

## License

MIT License
