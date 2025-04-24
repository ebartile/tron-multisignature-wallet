# 🚀 Tron Wallet API

A Node.js API to interact with Tron wallets. It provides endpoints for creating wallets, generating wallet addresses, transferring TRX and tokens, consolidating balances, and setting up webhook-based event notifications.

## 📦 Features

- 🔒 Create wallets with password-based encryption
- 🏦 Generate new wallet addresses
- 💸 Transfer TRX and TRC20 tokens
- 🧾 Fetch transfer details (TRX and tokens)
- 📥 Consolidate funds from wallet addresses
- 📡 Webhook setup for transfer event handling

## 📑 API Endpoints

### 🛠 Base URL

```
POST http://localhost:6000/
```

---

### 🧠 Health Check

```http
GET /ping
```

**Response:**
```json
{ "status": "tron-api is running." }
```

---

### 🆕 Create Wallet

```http
POST /wallets
```

**Body:**
```json
{ "password": "yourStrongPassword" }
```

**Response:**
```json
{ "id": "wallet-id", "address": "TRON_ADDRESS" }
```

---

### 🏷️ Create Wallet Address

```http
POST /wallets/:id/addresses
```

**Body:**
```json
{ "password": "yourStrongPassword" }
```

---

### 🔍 Get Wallet

```http
GET /wallets/:id
```

**Response:**
```json
{ "id": "wallet-id", "address": "TRON_ADDRESS" }
```

---

### 📦 Get TRX Transfer Info

```http
GET /wallets/:id/transfers/:hash
```

Returns transfer details, and labels it as either "send" or "receive".

---

### 🧮 Consolidate TRX Balance

```http
POST /wallets/:id/consolidate
```

**Body:**
```json
{ "address": "walletSubAddress", "password": "yourStrongPassword" }
```

---

### 💰 Send TRX

```http
POST /wallets/:id/send
```

**Body:**
```json
{
  "address": "destinationAddress",
  "password": "yourStrongPassword",
  "value": "amountAsString"
}
```

---

### 🔔 Register Transfer Webhook

```http
POST /transfers/events
```

**Body:**
```json
{
  "wallet": "wallet-id",
  "url": "https://your-webhook-url.com"
}
```

---

### 🔍 Get Transfer By Hash

```http
GET /transfers/:hash
```

Returns a TRX transfer using its hash.

---

### 🪙 Get Token Transfer Info

```http
GET /wallets/:id/tokens/:contract/transfers/:hash
```

Returns TRC20 transfer details.

---

### 🔁 Consolidate Token Balance

```http
POST /wallets/:id/tokens/:contract/consolidate
```

**Body:**
```json
{
  "address": "walletSubAddress",
  "password": "yourStrongPassword"
}
```

---

### 🪙 Send Token Balance

```http
POST /wallets/:id/tokens/:contract/send
```

**Body:**
```json
{
  "address": "destinationAddress",
  "value": "amountAsString",
  "password": "yourStrongPassword"
}
```

---

## ❌ Error Responses

Errors are returned in a standard format:
```json
{ "error": "Description of the error." }
```

HTTP codes like `403`, `409`, and `400` are used for logic-based validation failures.

---
