import express from "express";

const app = express();
const PORT = 3001;

app.use(express.json());

app.get("/", (req, res) => {
	res.json({ message: "NexusDocs API is online 🚀" });
});

app.listen(PORT, () => {
	console.log(`Backend running at: http://localhost:${PORT}`);
});
