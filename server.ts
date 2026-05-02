import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";
import Database from "better-sqlite3";
import fs from "fs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Initialize SQLite Database
  const db = new Database("maya_users.db");
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Pre-seed 'zishan' user if it doesn't exist
  const checkZishan = db.prepare("SELECT * FROM users WHERE name = ?").get("zishan");
  if (!checkZishan) {
    db.prepare("INSERT INTO users (name, password) VALUES (?, ?)").run("zishan", "7860");
    console.log("Pre-seeded user 'zishan' with password '7860'");
  }

  app.use(express.json());

  // API Routes
  app.post("/api/signup", (req, res) => {
    const { name, password } = req.body;
    if (!name || !password) {
      return res.status(400).json({ error: "Name and password required" });
    }

    try {
      const stmt = db.prepare("INSERT INTO users (name, password) VALUES (?, ?)");
      stmt.run(name, password);
      res.json({ success: true, message: "User registered successfully" });
    } catch (error: any) {
      if (error.code === 'SQLITE_CONSTRAINT') {
        res.status(400).json({ error: "Name already taken" });
      } else {
        res.status(500).json({ error: "Database error" });
      }
    }
  });

  app.post("/api/login", (req, res) => {
    const { name, password } = req.body;
    if (!name || !password) {
      return res.status(400).json({ error: "Name and password required" });
    }

    try {
      const user = db.prepare("SELECT * FROM users WHERE name = ?").get(name) as any;
      if (user && user.password === password) {
        res.json({ success: true, name: user.name });
      } else {
        res.status(401).json({ error: "Invalid name or password" });
      }
    } catch (error) {
      res.status(500).json({ error: "Database error" });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    if (fs.existsSync(distPath)) {
      app.use(express.static(distPath));
      app.get('*', (req, res) => {
        res.sendFile(path.join(distPath, 'index.html'));
      });
    }
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer().catch(console.error);
