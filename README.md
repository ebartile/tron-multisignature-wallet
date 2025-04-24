# Multi-Signature Tron Wallet API

A secure and developer-friendly **multi-signature Tron wallet** system supporting:

- **Tron Mainnet**
- **Tron Shasta Testnet**
- **Tron Nile Testnet**

## 🔐 What is a Multi-Signature Wallet?

A **multi-signature (multi-sig)** wallet requires **multiple private keys to authorize a transaction**. Unlike traditional wallets that require only one signature (from one private key), multi-sig wallets increase security by allowing multiple parties to verify and approve transactions.

This is ideal for:
- Shared ownership accounts
- Organizational treasury management
- High-security personal funds

---

## 🛡️ Security & Architecture

This project is designed for server-side use by web developers managing Tron wallets. It simplifies integration while maintaining a high level of security.

**Key Storage Strategy:**
- **MongoDB**: Stores one part of the wallet key data.
- **MySQL or File System**: Stores the remaining key part.
- Keys are never fully stored in one place, ensuring distributed trust and minimizing risk in case of breach.

---

## ⚙️ Deployment Steps

1. Clone the repository.

2. Obtain tron network api key via [Tron Grid ➝](https://developers.tron.network/reference/select-network#note). As refer to [Tron Network selection ➝](https://www.trongrid.io/documents) for better understanding

3. Set up your environment variables by editing the `.env` file:

    ```env
    #--------------------------------------------------------------------------
    #  Tron Config
    #  (refer to our doc)
    #--------------------------------------------------------------------------
    DB_DATABASE=tron-api
    DB_USERNAME=root
    DB_PASSWORD=password
    TRON_API_HOST=https://api.trongrid.io
    TRON_API_KEY=
    TRON_MONGODB_URL='mongodb://root:password@localhost:27017/'
    TRON_API_HEADER="TRON-PRO-API-KEY"
    TRON_STORAGE_PATH='./storage'
    TRON_LOGFILE=tron.log
    TRON_KEYPATH=
    TRON_CRTPATH=
    TRON_ENV=test
    TRON_BIND=localhost
    TRON_PORT=6000
    ```

3. Build and run the project using Docker: (You will need to install docker if you have not done so)

    ```bash
    ./server initialize
    ./server up
    ```

    or 

    ```bash
    npm install
    npm run dev
    ```

4. The API should now be live at `http://localhost:6000`


5. ⚠️ **Important:** Using MongoDB from a Docker container is **not recommended** for production use.  
   Visit the official [MongoDB Deployment Documentation](https://www.mongodb.com/docs/manual/administration/install-community/) for secure and scalable deployment options.

## 📡 API Documentation

For details on how to interact with this wallet through the API, check out the full request guide here:  
➡️ [API Request Reference](./docs/API_REQUESTS.md)

---

---

## 🧰 Tech Stack

- **Node.js**
- **Web3.js**
- **MongoDB**
- **Docker**
- **REST API (Web API only)**

---

## 🙌 Contributions & Donations

If you'd like to support this project or contribute:

📧 Email: **ebartile@gmail.com**  
Hire Me: 🙌 

💰 Bitcoin Address (SegWit): **bc1qcdsssmn2j439cdfx428l69545av95qxwp3hgfm**

💰 Ethereum Address: **0xc62065388fa180ac44769b5252c8ee366be5569d**

💰 Binance Address (BEP-20 Network): **0xc62065388fa180ac44769b5252c8ee366be5569d**

---

