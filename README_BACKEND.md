# Redbrick & Ridge Construction — Backend API

A lightweight Node.js + Express + SQLite backend for the Redbrick & Ridge Construction website.

---

## Stack

| Layer        | Library             |
|--------------|---------------------|
| HTTP server  | Express 4           |
| Database     | SQLite via better-sqlite3 |
| Auth         | JWT (jsonwebtoken)  |
| PIN hashing  | bcryptjs            |
| Security     | helmet, express-rate-limit, cors |
| Config       | dotenv              |

---

## Quick Start

### 1. Install dependencies

```bash
npm install
```

### 2. Configure environment

```bash
cp .env.example .env
# Edit .env — set JWT_SECRET and OWNER_PIN_HASH at minimum
```

### 3. Run the server

```bash
node server.js
# → [Redbrick & Ridge API] Listening on http://localhost:3001
```

For development with auto-restart:

```bash
npm run dev
```

---

## Environment Variables

| Variable        | Required | Description                                              |
|-----------------|----------|----------------------------------------------------------|
| `PORT`          | No       | Port to listen on (default: `3001`)                     |
| `JWT_SECRET`    | **Yes**  | Long random string used to sign JWTs                    |
| `OWNER_PIN_HASH`| **Yes**  | bcrypt hash of the owner login PIN                      |
| `CORS_ORIGIN`   | No       | Comma-separated allowed origins (default: `http://localhost:3000`) |

---

## API Reference

All endpoints are prefixed with `/api`. Protected endpoints require:

```
Authorization: Bearer <jwt-token>
```

Tokens are issued by `POST /api/auth/login` and expire after **8 hours**.

### Auth
- `POST /api/auth/login`: `{ "pin": "2468" }` -> Returns `{ token }`

### Enquiries
- `GET /api/enquiries` (Protected): Returns enquiries list
- `POST /api/enquiries` (Public, Rate-limited): Submits new enquiry
- `PATCH /api/enquiries/:id/status` (Protected): Updates lead status
- `DELETE /api/enquiries/:id` (Protected): Deletes lead

### Brand Config
- `GET /api/brand`: Returns brand configuration
- `PUT /api/brand` (Protected): Updates brand configuration
