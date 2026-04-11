const app = require("./app");
const { initializeDatabase } = require("./db/database");

const PORT = process.env.PORT || 4000;

async function startServer() {
  try {
    await initializeDatabase();

    app.listen(PORT, () => {
      console.log(`Fendor backend running on http://localhost:${PORT}`);
    });
  } catch (error) {
    console.error("Failed to start Fendor backend:", error);
    process.exit(1);
  }
}

startServer();
