# RARE Nepal - E-commerce Platform

This is a proprietary e-commerce platform developed by **Nikesh Uprety** and **Arnav Shrestha**. The project is currently under active development and is intended for a commercial launch.

## ⚠️ Proprietary Notice
This software is private and confidential. Unauthorized use, copying, or distribution is strictly prohibited. Refer to the [LICENSE](LICENSE) file for full details.

---

## Technical Setup Guide

### Prerequisites
- **Node.js**: v20 or higher
- **PostgreSQL**: Local instance or remote URL

### 1. Installation

#### Windows
1. Download and install [Node.js](https://nodejs.org/).
2. Download and install [PostgreSQL](https://www.postgresql.org/download/windows/).
3. Open PowerShell or Command Prompt in the project root:
   ```bash
   npm install
   ```

#### Kali Linux
1. Update system and install Node.js/PostgreSQL:
   ```bash
   sudo apt update
   ```
2. Install dependencies:
   ```bash
   npm install
   ```

### 2. Environment Configuration
Create a `.env` file in the root directory by copying the example:
```bash
cp .env.example .env
```
Update the `.env` file with your local PostgreSQL credentials and other secrets.

### 3. Database Setup
Push the schema to your database and seed initial data:
```bash
# Push schema
npm run db:push

# Seed initial data
npm run db:seed
```

### 4. Running the Project
Start the development server:
```bash
npm run dev
```
The application will be available at `http://localhost:5000`.

---

## Contributing
You can contribute to this project and join us in its development. Please contact the developers for authorized access and contribution guidelines.
