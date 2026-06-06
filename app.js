require("dotenv").config();

const express = require("express");
const helmet = require("helmet");
const morgan = require("morgan");
const cookieparser = require("cookie-parser");
const session = require("express-session");
const http = require("http");
const socketIo = require("socket.io");
const mongoSanitize = require("express-mongo-sanitize");
const { apiLimiter } = require("./app/utils/rateLimiter");
const { initSocketIO } = require("./app/socket/socketHandler");
const flash = require("connect-flash");

const app = express();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static("public"));

//Database connection
const DatabaseConnect = require("./app/config/dbconfig");
DatabaseConnect();

const createRedisClient = require("./app/config/redisConfig");
createRedisClient()

app.set("view engine", "ejs");
app.set("views", "views");

app.use(cookieparser());
app.use(morgan("dev"));

// Security: Prevent NoSQL injection (Manual sanitization to support Express 5 getters)
app.use((req, res, next) => {
  if (req.body) mongoSanitize.sanitize(req.body);
  if (req.query) mongoSanitize.sanitize(req.query);
  if (req.params) mongoSanitize.sanitize(req.params);
  next();
});

// Security: Global API Rate Limiting
app.use("/api", apiLimiter);
app.use(
  helmet({
    contentSecurityPolicy: false,
    xDownloadOptions: false,
  }),
);
app.use(
  session({
    secret: process.env.NODE_ENV,
    resave: false,
    saveUninitialized: false,
    cookie: {
      maxAge: 1000 * 60 * 60 * 24, // 24 hours
    },
  }),
);

app.use(flash());
app.use((req, res, next) => {
  res.locals.success = req.flash('success');
  res.locals.error = req.flash('error');
  res.locals.requiresVerification = req.flash('requiresVerification');
  next();
});

app.use(require("./app/routes/index"));


const server = http.createServer(app);
const io = socketIo(server);

app.set("io", io);

// Initialize Socket.IO logic from separate handler
initSocketIO(io);

// Global Error Handlers
app.use((req, res, next) => {
  res.status(404).render("error/404");
});

app.use((err, req, res, next) => {
  console.error("Server Error:", err.stack);
  res.status(500).render("error/500", { error: err.message || "Internal Server Error" });
});

server.listen(process.env.PORT, (err) => {
  if (err) {
    console.log(`Failed to start the server, error:${err.message}`);
  }
  console.log(
    `Server is running on this port http://localhost:${process.env.PORT}`,
  );
});
