# LevelUp Backend

Welcome to the **LevelUp Backend** repository! This project powers the backend of **LevelUp**, a gamified educational platform designed to motivate and track learners' progress through quests, streaks, and experience points.

> 🚀 Repository: [https://github.com/KrishnaGrg1/LevelUp-Backend.git](https://github.com/KrishnaGrg1/LevelUp-Backend)

---

## 🏗️ Features

- ✅ User registration and login (JWT-based auth)
- 🎯 Quest creation and completion tracking
- 🧠 XP, levels, and streak calculation logic
- 📊 Goal setting and personal progression
- 🔒 JWT-based session handling
- 💾 PostgreSQL with Prisma ORM
- 📧 Email notifications via SMTP

---

## 🛠️ Tech Stack

| Layer      | Technology                            |
| ---------- | ------------------------------------- |
| Backend    | Node.js, Express.js                   |
| Database   | PostgreSQL + Prisma ORM               |
| Auth       | JWT (JSON Web Tokens)                 |
| Deployment | Railway / Render / Vercel (suggested) |

---

## 📦 Installation

1. **Clone the repo:**

```bash
git clone https://github.com/KrishnaGrg1/LevelUp-Backend.git
cd LevelUp-Backend
```

2. **Install dependencies:**

```bash
# Using npm
npm install

# Using pnpm
pnpm install
```

3. **Setup environment variables:**

Copy the `.env.example` file to `.env` and fill in your actual values:

```bash
cp .env.example .env
```

Then edit the `.env` file with your configuration:

```env
# Database connection string
DATABASE_URL="postgresql://username:password@host:port/database?sslmode=require"

# JWT secret password
JWT_SECRET="your_jwt_secret_password"

# Port for the application
PORT=8080

# SMTP configuration for email notifications
SMTP_HOST="smtp.example.com"
SMTP_PORT=587
SMTP_USERNAME="example_user"
SMTP_PASSWORD="example_password"
```

4. **Initialize Prisma and migrate database:**

```bash
npx prisma migrate dev
npx prisma generate
```

5. **Run the application:**

```bash
# Using npm
npm run start

# Using pnpm
pnpm dev
```

---

## 🚀 Available Scripts

| Command                      | Description                       |
| ---------------------------- | --------------------------------- |
| `npm run start` / `pnpm dev` | Start the development server      |
| `npx prisma migrate dev`     | Run database migrations           |
| `npx prisma generate`        | Generate Prisma client            |
| `npx prisma studio`          | Open Prisma Studio (database GUI) |

---

## 🤝 Contributing

Pull requests are welcome! For major changes, please open an issue first to discuss what you'd like to change.

> Make sure to update tests and documentation where needed.

---

## 📄 License

This project is licensed under the [MIT License](https://choosealicense.com/licenses/mit/)

---

## 🔗 Author

**Krishna Bahadur Gurung**  
🌐 [GitHub @KrishnaGrg1](https://github.com/KrishnaGrg1)

---
