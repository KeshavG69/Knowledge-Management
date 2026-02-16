# Complete Keycloak Setup Guide for Organization-Based Authentication

## Step 1: Install and Start Keycloak

### Using Docker (Recommended):

```bash
docker run -d \
  --name keycloak \
  -p 8080:8080 \
  -e KEYCLOAK_ADMIN=admin \
  -e KEYCLOAK_ADMIN_PASSWORD=admin \
  quay.io/keycloak/keycloak:latest \
  start-dev
```

or 

```bash
cd keycloak-26.5.2
bin/kc.sh start-dev

```

**Wait 1-2 minutes** for Keycloak to fully start.

Access Keycloak at: `http://localhost:8080`

---

## Step 2: Create a New Realm

1. **Login to Keycloak Admin Console**
   - URL: `http://localhost:8080/admin`
   - Username: `admin`
   - Password: `admin`

2. **Create Realm**
   - Click dropdown in top-left (says "master")
   - Click **"Create Realm"**
   - **Realm name**: `SoldierIQ` (or your app name)
   - **Enabled**: ON
   - Click **"Create"**

---

## Step 3: Configure Realm Settings

1. **Go to Realm Settings → General**
   - **Enabled**: ON
   - **User-managed access**: ON (optional)

2. **Go to Realm Settings → Login**
   - **User registration**: ON (if you want users to self-register)
   - **Email as username**: OFF (we use separate username)
   - **Login with email**: ON (optional)
   - **Remember me**: ON (optional)

3. **Go to Realm Settings → Email** (Optional, for password reset)
   - Configure SMTP settings if needed
   - Can skip for development

---

## Step 4: Enable User Profile Feature

⚠️ **CRITICAL STEP** - This is required for custom attributes!

1. **Go to Realm Settings → User Profile**
2. Toggle **"Enabled"** to **ON** (top-right corner)
3. Click **"Save"** if prompted

---

## Step 5: Create Custom User Attributes in User Profile

1. **Stay in Realm Settings → User Profile → Attributes tab**

2. **Create organization_id attribute:**
   - Click **"Create attribute"**
   - **Attribute [Name]**: `organization_id`
   - **Display name**: `Organization ID`
   - **Multivalued**: OFF (toggle should be OFF)
   - **Default value**: (leave empty)
   - **Attribute group**: None
   - **Enabled when**: Always (radio button selected)
   - **Required field**: OFF

   **Permission section:**
   - **Who can edit?**:
     - User: UNCHECKED ❌
     - Admin: CHECKED ✅
   - **Who can view?**:
     - User: CHECKED ✅
     - Admin: CHECKED ✅

   - Click **"Create"**

3. **Create organization_name attribute:**
   - Click **"Create attribute"** again
   - **Attribute [Name]**: `organization_name`
   - **Display name**: `Organization Name`
   - **Multivalued**: OFF
   - **Default value**: (leave empty)
   - **Attribute group**: None
   - **Enabled when**: Always
   - **Required field**: OFF

   **Permission section:**
   - **Who can edit?**:
     - User: UNCHECKED ❌
     - Admin: CHECKED ✅
   - **Who can view?**:
     - User: CHECKED ✅
     - Admin: CHECKED ✅

   - Click **"Create"**

---

## Step 6: Create OAuth2 Client

1. **Go to Clients (left sidebar)**
2. Click **"Create client"**

### General Settings:
   - **Client type**: OpenID Connect
   - **Client ID**: `soldieriq-backend` (or your app name)
   - Click **"Next"**

### Capability config:
   - **Client authentication**: ON ✅ (this makes it a confidential client)
   - **Authorization**: OFF
   - **Authentication flow**:
     - Standard flow: ON ✅
     - Direct access grants: ON ✅ (enables password grant type)
     - Implicit flow: OFF
     - Service accounts roles: OFF (unless needed)
   - Click **"Next"**

### Login settings:
   - **Root URL**: `http://localhost:3000` (your frontend URL)
   - **Home URL**: (leave empty)
   - **Valid redirect URIs**: `http://localhost:3000/*`
   - **Valid post logout redirect URIs**: `http://localhost:3000/*`
   - **Web origins**: `http://localhost:3000` (for CORS)
   - Click **"Save"**

---

## Step 7: Get Client Secret

1. **Stay in Clients → soldieriq-backend**
2. Click **"Credentials"** tab
3. **Copy the Client Secret** value
4. Save this for your `.env` file

---

## Step 8: Configure Token Mappers for Custom Attributes

⚠️ **CRITICAL** - Without this, organization_id won't appear in JWT tokens!

### Option A: Add Mappers to "profile" Scope (Recommended)

1. **Go to Client Scopes (left sidebar)**
2. Click **"profile"** (this is a built-in scope)
3. Click **"Mappers"** tab
4. Click **"Configure a new mapper"**
5. Select **"User Attribute"**

**Mapper 1: organization_id**
   - **Name**: `organization_id`
   - **User Attribute**: `organization_id`
   - **Token Claim Name**: `organization_id`
   - **Claim JSON Type**: String
   - **Add to ID token**: ON ✅
   - **Add to access token**: ON ✅
   - **Add to userinfo**: ON ✅
   - **Multivalued**: OFF
   - **Aggregate attribute values**: OFF
   - Click **"Save"**

6. Click **"Add mapper"** → **"By configuration"** → **"User Attribute"** again

**Mapper 2: organization_name**
   - **Name**: `organization_name`
   - **User Attribute**: `organization_name`
   - **Token Claim Name**: `organization_name`
   - **Claim JSON Type**: String
   - **Add to ID token**: ON ✅
   - **Add to access token**: ON ✅
   - **Add to userinfo**: ON ✅
   - **Multivalued**: OFF
   - **Aggregate attribute values**: OFF
   - Click **"Save"**

---

## Step 9: Verify Client Scope Assignment

1. **Go to Clients → soldieriq-backend**
2. Click **"Client scopes"** tab
3. Verify **"profile"** is listed under **"Assigned default client scopes"**
4. The **Type** column should show **"Default"** (not "Optional")

If "profile" is missing:
   - Click **"Add client scope"**
   - Select **"profile"**
   - Choose **"Default"**
   - Click **"Add"**

---

## Step 10: Configure Backend Environment Variables

Create or update your `.env` file:

```bash
# Keycloak Configuration
KEYCLOAK_SERVER_URL=http://localhost:8080
KEYCLOAK_REALM=SoldierIQ
KEYCLOAK_CLIENT_ID=soldieriq-backend
KEYCLOAK_CLIENT_SECRET=<paste-client-secret-from-step-7>

# Keycloak Admin (for user management)
KEYCLOAK_ADMIN_USERNAME=admin
KEYCLOAK_ADMIN_PASSWORD=admin
```

---

## Step 11: Backend Dependencies

Ensure your backend has these dependencies:

```bash
pip install python-keycloak fastapi pymongo
```

Or in `pyproject.toml`:
```toml
dependencies = [
    "python-keycloak>=3.0.0",
    "fastapi>=0.100.0",
    "pymongo>=4.0.0"
]
```

---

## Step 12: Test the Setup

### 1. Test Signup:
```bash
curl -X POST "http://localhost:8000/api/auth/signup" \
  -H "Content-Type: application/json" \
  -d '{
    "username":"testuser",
    "email":"test@example.com",
    "password":"password123",
    "firstName":"Test",
    "lastName":"User"
  }'
```

Expected response:
```json
{
  "id": "...",
  "username": "testuser",
  "email": "test@example.com",
  "firstName": "Test",
  "lastName": "User",
  "organization_id": "6990e62352a609e9fe327c80",
  "organization_name": "Test User's Organization",
  "message": "User created successfully. You can now login."
}
```

### 2. Verify User in Keycloak UI:
   - Go to **Users** → Search for "testuser"
   - Click on user → **Attributes** tab
   - Should show `organization_id` and `organization_name`

### 3. Test Login:
```bash
curl -X POST "http://localhost:8000/api/auth/login" \
  -H "Content-Type: application/json" \
  -d '{
    "username":"testuser",
    "password":"password123"
  }'
```

Expected response:
```json
{
  "access_token": "eyJhbG...",
  "refresh_token": "eyJhbG...",
  "token_type": "bearer",
  "expires_in": 300
}
```

### 4. Test /me Endpoint:
```bash
curl -X GET "http://localhost:8000/api/auth/me" \
  -H "Authorization: Bearer <access_token_from_login>"
```

Expected response:
```json
{
  "id": "...",
  "username": "testuser",
  "email": "test@example.com",
  "firstName": "Test",
  "lastName": "User",
  "email_verified": true,
  "roles": ["default-roles-soldieriq", ...],
  "organization_id": "6990e62352a609e9fe327c80",
  "organization_name": "Test User's Organization"
}
```

✅ If `organization_id` and `organization_name` appear in the response, everything is working!

---

## Common Issues and Solutions

### Issue 1: Attributes not appearing in token
**Solution**:
- Verify User Profile is enabled (Step 4)
- Verify attributes are defined in User Profile schema (Step 5)
- Verify token mappers are configured (Step 8)
- Verify "profile" scope is assigned as "Default" to client (Step 9)

### Issue 2: Login returns "Invalid client credentials"
**Solution**:
- Verify client secret in `.env` matches Keycloak (Step 7)
- Verify "Client authentication" is ON in client settings (Step 6)

### Issue 3: "Account is not fully set up" error
**Solution**:
- Check if user has email verified: Users → user → Details → Email Verified = ON
- Check if user is enabled: Users → user → Details → User Enabled = ON

### Issue 4: Attributes not saving to users
**Solution**:
- Must define attributes in User Profile schema FIRST (Step 5)
- Backend code must fetch complete user representation before updating

---

## Summary Checklist

Before going live, verify:

- [ ] Realm created and enabled
- [ ] User Profile feature enabled
- [ ] `organization_id` attribute defined in User Profile
- [ ] `organization_name` attribute defined in User Profile
- [ ] Client created with Client authentication ON
- [ ] Direct access grants enabled for client
- [ ] Client secret saved in `.env`
- [ ] Token mappers configured for both attributes
- [ ] "profile" scope assigned as Default to client
- [ ] Test user can signup with organization_id
- [ ] Test user can login successfully
- [ ] `/me` endpoint returns organization_id and organization_name
- [ ] Attributes visible in Keycloak UI under user's Attributes tab

---

## Key Insights from Troubleshooting

This guide covers everything needed to replicate the working setup. The key points that caused issues during development were:

1. **User Profile must be enabled** - When User Profile is enabled, custom attributes MUST be defined in the User Profile schema before they can be used
2. **Attributes must be defined in User Profile schema** - Without this, Keycloak silently rejects attribute updates
3. **Token mappers must be configured** - Custom attributes don't automatically appear in JWT tokens; you must create User Attribute mappers
4. **Backend must fetch complete user representation before updating** - The Keycloak API requires sending the complete user object when updating, not just the changed fields
5. **Token mappers should be in "profile" scope** - Adding mappers to the built-in "profile" scope (assigned as Default) is more reliable than creating custom scopes

---

## Architecture Overview

```
┌─────────────┐         ┌──────────────┐         ┌─────────────┐
│   Frontend  │────────▶│   Backend    │────────▶│  Keycloak   │
│  (Next.js)  │         │  (FastAPI)   │         │   Server    │
└─────────────┘         └──────────────┘         └─────────────┘
                                │
                                ▼
                        ┌──────────────┐
                        │   MongoDB    │
                        │   (Vector    │
                        │   Storage)   │
                        └──────────────┘

Authentication Flow:
1. User signs up → Backend creates user in Keycloak with organization_id
2. User logs in → Backend requests token from Keycloak
3. Keycloak returns JWT with organization_id and organization_name claims
4. Backend validates token and extracts user info including organization_id
5. Backend uses organization_id to filter user's data in MongoDB
```

---

## Security Considerations

1. **Client Secret**: Store securely in environment variables, never commit to git
2. **Password Grant**: Only use for first-party applications; use Authorization Code flow for third-party apps
3. **Token Expiry**: Default 5 minutes (300 seconds) - adjust in Realm Settings → Tokens
4. **HTTPS**: Always use HTTPS in production (Keycloak and your backend)
5. **CORS**: Configure Web Origins correctly to prevent unauthorized origins
6. **Organization Isolation**: Ensure all database queries filter by organization_id to prevent data leakage

---

## Production Deployment Notes

### Keycloak Production Setup:
```bash
docker run -d \
  --name keycloak-prod \
  -p 8443:8443 \
  -e KEYCLOAK_ADMIN=admin \
  -e KEYCLOAK_ADMIN_PASSWORD=<strong-password> \
  -e KC_HOSTNAME=<your-domain.com> \
  -e KC_HTTPS_CERTIFICATE_FILE=/path/to/cert.pem \
  -e KC_HTTPS_CERTIFICATE_KEY_FILE=/path/to/key.pem \
  -v /path/to/certs:/etc/x509/https \
  quay.io/keycloak/keycloak:latest \
  start --optimized
```

### Database Backend:
- Use PostgreSQL instead of H2 for production
- Configure database connection in Keycloak startup

### High Availability:
- Run multiple Keycloak instances behind a load balancer
- Use shared database for session storage
- Configure sticky sessions on load balancer

---

## Additional Resources

- [Keycloak Official Documentation](https://www.keycloak.org/documentation)
- [User Profile Feature Guide](https://www.keycloak.org/docs/latest/server_admin/#user-profile)
- [Token Mapper Documentation](https://www.keycloak.org/docs/latest/server_admin/#_protocol-mappers)
- [python-keycloak Library](https://python-keycloak.readthedocs.io/)

---

**Document Version**: 1.0
**Last Updated**: 2026-02-15
**Author**: Generated from Claude Code session
