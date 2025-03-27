import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import speakerRoutes from "./routes/speakerRoutes";
import eventRoutes from "./routes/eventRoutes";
import authRoutes from "./routes/authRoutes";
import { errorHandler } from "./middleware/errorHandler";

dotenv.config();

const app = express();
const port = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

// Routes
app.use("/api/speakers", speakerRoutes);
app.use("/api/events", eventRoutes);
app.use("/api/auth", authRoutes);

// Error handling
app.use(errorHandler);

app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});
